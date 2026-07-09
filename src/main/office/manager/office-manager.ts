import type { ConversationEngine } from '../../conversation/engine/conversation-engine';
import type { MemoryManager } from '../../memory/manager/memory-manager';
import { PlatformError } from '../../platform/errors/platform-error';
import { ERROR_CODES } from '../../../shared/platform/errors';
import type {
  CreateNoteRequest,
  CreateProjectRequest,
  CreateReminderRequest,
  CreateTaskRequest,
  OfficeDashboard,
  OfficeNote,
  OfficeProject,
  OfficeQuickAddRequest,
  OfficeQuickAddResult,
  OfficeReminder,
  OfficeSearchRequest,
  OfficeSearchResult,
  OfficeTask,
  SnoozeReminderRequest,
  UpdateNoteRequest,
  UpdateProjectRequest,
  UpdateReminderRequest,
  UpdateTaskRequest,
} from '../../../shared/office/contracts';
import type {
  OfficeCommandInterpreter,
  ParsedOfficeCommand,
} from '../natural-language/office-command-interpreter';
import type { OfficeRepository } from '../persistence/office-repository';

function normalizeLabels(values: readonly string[] = []): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
  );
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

function requireIsoDate(value: string | undefined, field: string): void {
  if (value && Number.isNaN(new Date(value).getTime())) {
    throw new PlatformError(ERROR_CODES.validationFailed, `${field} must be a valid ISO date.`);
  }
}

function missing(id: string): PlatformError {
  return new PlatformError(ERROR_CODES.officeItemNotFound, 'Office item was not found.', {
    metadata: { id },
  });
}

export class OfficeManager {
  public constructor(
    private readonly repository: OfficeRepository,
    private readonly interpreter: OfficeCommandInterpreter,
    private readonly conversations?: ConversationEngine,
    private readonly memories?: MemoryManager,
  ) {}

  public listTasks(): readonly OfficeTask[] {
    return this.repository.listTasks();
  }

  public createTask(request: CreateTaskRequest): OfficeTask {
    requireIsoDate(request.dueAt, 'Task due date');
    return this.repository.createTask({
      ...request,
      title: normalizeTitle(request.title),
      description: request.description?.trim(),
      labels: normalizeLabels(request.labels),
    });
  }

  public updateTask(request: UpdateTaskRequest): OfficeTask {
    requireIsoDate(request.dueAt ?? undefined, 'Task due date');
    const task = this.repository.updateTask({
      ...request,
      title: request.title ? normalizeTitle(request.title) : undefined,
      description: request.description?.trim(),
      labels: request.labels ? normalizeLabels(request.labels) : undefined,
    });
    if (!task) throw missing(request.id);
    return task;
  }

  public completeTask(id: string): OfficeTask {
    const task = this.repository.completeTask(id);
    if (!task) throw missing(id);
    return task;
  }

  public deleteTask(id: string): void {
    if (!this.repository.deleteTask(id)) throw missing(id);
  }

  public listNotes(): readonly OfficeNote[] {
    return this.repository.listNotes();
  }

  public createNote(request: CreateNoteRequest): OfficeNote {
    return this.repository.createNote({
      ...request,
      title: normalizeTitle(request.title),
      content: request.content?.trim(),
      tags: normalizeLabels(request.tags),
    });
  }

  public updateNote(request: UpdateNoteRequest): OfficeNote {
    const note = this.repository.updateNote({
      ...request,
      title: request.title ? normalizeTitle(request.title) : undefined,
      content: request.content?.trim(),
      tags: request.tags ? normalizeLabels(request.tags) : undefined,
    });
    if (!note) throw missing(request.id);
    return note;
  }

  public deleteNote(id: string): void {
    if (!this.repository.deleteNote(id)) throw missing(id);
  }

  public listProjects(): readonly OfficeProject[] {
    return this.repository.listProjects();
  }

  public createProject(request: CreateProjectRequest): OfficeProject {
    requireIsoDate(request.deadlineAt, 'Project deadline');
    return this.repository.createProject({
      ...request,
      name: normalizeTitle(request.name),
      description: request.description?.trim(),
    });
  }

  public updateProject(request: UpdateProjectRequest): OfficeProject {
    requireIsoDate(request.deadlineAt ?? undefined, 'Project deadline');
    const project = this.repository.updateProject({
      ...request,
      name: request.name ? normalizeTitle(request.name) : undefined,
      description: request.description?.trim(),
    });
    if (!project) throw missing(request.id);
    return project;
  }

  public deleteProject(id: string): void {
    if (!this.repository.deleteProject(id)) throw missing(id);
  }

  public listReminders(): readonly OfficeReminder[] {
    return this.repository.listReminders();
  }

  public createReminder(request: CreateReminderRequest): OfficeReminder {
    requireIsoDate(request.remindAt, 'Reminder time');
    return this.repository.createReminder({
      ...request,
      title: normalizeTitle(request.title),
      note: request.note?.trim(),
    });
  }

  public updateReminder(request: UpdateReminderRequest): OfficeReminder {
    requireIsoDate(request.remindAt, 'Reminder time');
    const reminder = this.repository.updateReminder({
      ...request,
      title: request.title ? normalizeTitle(request.title) : undefined,
      note: request.note?.trim(),
    });
    if (!reminder) throw missing(request.id);
    return reminder;
  }

  public snoozeReminder(request: SnoozeReminderRequest): OfficeReminder {
    requireIsoDate(request.until, 'Snooze time');
    const reminder = this.repository.snoozeReminder(request);
    if (!reminder) throw missing(request.id);
    return reminder;
  }

  public dismissReminder(id: string): OfficeReminder {
    const reminder = this.repository.dismissReminder(id);
    if (!reminder) throw missing(id);
    return reminder;
  }

  public deleteReminder(id: string): void {
    if (!this.repository.deleteReminder(id)) throw missing(id);
  }

  public async quickAdd(request: OfficeQuickAddRequest): Promise<OfficeQuickAddResult> {
    const command = await this.interpreter.interpret(request);
    return this.executeCommand(command);
  }

  public dashboard(now = new Date()): OfficeDashboard {
    const base = this.repository.dashboard(now);
    const recentConversations =
      this.conversations
        ?.list()
        .slice(0, 5)
        .map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updatedAt,
          preview: conversation.preview,
        })) ?? [];
    const recentMemories =
      this.memories
        ?.list()
        .slice(0, 5)
        .map((memory) => ({
          id: memory.id,
          summary: memory.summary,
          updatedAt: memory.updatedAt,
        })) ?? [];
    return Object.freeze({
      ...base,
      recentConversations: Object.freeze(recentConversations),
      recentMemories: Object.freeze(recentMemories),
    });
  }

  public search(request: OfficeSearchRequest): readonly OfficeSearchResult[] {
    const query = request.query.trim();
    const limit = request.limit ?? 20;
    const office = [...this.repository.search(query, limit)];
    const conversations =
      this.conversations?.search(query).map((conversation) => ({
        id: conversation.id,
        kind: 'conversation' as const,
        title: conversation.title,
        preview: conversation.preview,
        updatedAt: conversation.updatedAt,
        score: 0.8,
      })) ?? [];
    const memories =
      this.memories?.searchMemory({ query, limit }).map((result) => ({
        id: result.memory.id,
        kind: 'memory' as const,
        title: result.memory.summary,
        preview: result.memory.content,
        updatedAt: result.memory.updatedAt,
        score: result.score,
      })) ?? [];
    return Object.freeze(
      [...office, ...conversations, ...memories]
        .sort(
          (left, right) =>
            right.score - left.score || right.updatedAt.localeCompare(left.updatedAt),
        )
        .slice(0, limit),
    );
  }

  public close(): void {
    this.repository.close();
  }

  private executeCommand(command: ParsedOfficeCommand): OfficeQuickAddResult {
    if (command.kind === 'create-task') {
      return Object.freeze({
        action: { kind: 'create-task' as const, task: this.createTask(command.request) },
        interpretedAs: command.interpretedAs,
      });
    }
    if (command.kind === 'create-reminder') {
      return Object.freeze({
        action: {
          kind: 'create-reminder' as const,
          reminder: this.createReminder(command.request),
        },
        interpretedAs: command.interpretedAs,
      });
    }
    if (command.kind === 'create-project') {
      return Object.freeze({
        action: {
          kind: 'create-project' as const,
          project: this.createProject(command.request),
        },
        interpretedAs: command.interpretedAs,
      });
    }
    return Object.freeze({
      action: { kind: 'create-note' as const, note: this.createNote(command.request) },
      interpretedAs: command.interpretedAs,
    });
  }
}
