import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type {
  CreateNoteRequest,
  CreateProjectRequest,
  CreateReminderRequest,
  CreateTaskRequest,
  OfficeDashboard,
  OfficeNote,
  OfficeNoteVersion,
  OfficePriority,
  OfficeProject,
  OfficeReminder,
  OfficeSearchResult,
  OfficeTask,
  ProjectGoal,
  ProjectStatus,
  RecurrenceRule,
  ReminderStatus,
  SnoozeReminderRequest,
  UpdateNoteRequest,
  UpdateProjectRequest,
  UpdateReminderRequest,
  UpdateTaskRequest,
} from '../../../shared/office/contracts';
import type { OfficeRepository } from './office-repository';

const SCHEMA_VERSION = 1;
type Clock = () => Date;
type IdFactory = () => string;

interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly completed: number;
  readonly priority: OfficePriority;
  readonly due_at: string | null;
  readonly labels: string;
  readonly category: string | null;
  readonly project_id: string | null;
  readonly recurrence: string | null;
  readonly progress: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at: string | null;
}

interface NoteRow {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: string;
  readonly pinned: number;
  readonly archived: number;
  readonly project_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface NoteVersionRow {
  readonly id: string;
  readonly note_id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: string;
  readonly created_at: string;
}

interface ProjectRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  readonly priority: OfficePriority;
  readonly deadline_at: string | null;
  readonly progress: number;
  readonly task_count: number;
  readonly note_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

interface GoalRow {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly completed: number;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ReminderRow {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly remind_at: string;
  readonly status: ReminderStatus;
  readonly recurrence: string | null;
  readonly task_id: string | null;
  readonly project_id: string | null;
  readonly snoozed_until: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

function parseStringArray(value: string): readonly string[] {
  const parsed = JSON.parse(value) as unknown;
  return Object.freeze(
    Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [],
  );
}

function parseRecurrence(value: string | null): RecurrenceRule | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as RecurrenceRule;
  return Object.freeze(parsed);
}

function recurrenceToJson(value: RecurrenceRule | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

function nullable(value: string | undefined | null): string | null {
  return value === undefined ? null : value;
}

function clampProgress(value: number | undefined, fallback = 0): number {
  const candidate = value ?? fallback;
  return Math.min(100, Math.max(0, Math.round(candidate)));
}

function taskFromRow(row: TaskRow): OfficeTask {
  return Object.freeze({
    id: row.id,
    title: row.title,
    description: row.description,
    completed: Boolean(row.completed),
    priority: row.priority,
    dueAt: row.due_at ?? undefined,
    labels: parseStringArray(row.labels),
    category: row.category ?? undefined,
    projectId: row.project_id ?? undefined,
    recurrence: parseRecurrence(row.recurrence),
    progress: row.progress,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  });
}

function versionFromRow(row: NoteVersionRow): OfficeNoteVersion {
  return Object.freeze({
    id: row.id,
    noteId: row.note_id,
    title: row.title,
    content: row.content,
    tags: parseStringArray(row.tags),
    createdAt: row.created_at,
  });
}

function noteFromRow(row: NoteRow, versions: readonly OfficeNoteVersion[]): OfficeNote {
  return Object.freeze({
    id: row.id,
    title: row.title,
    content: row.content,
    tags: parseStringArray(row.tags),
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    projectId: row.project_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions: Object.freeze(versions),
  });
}

function goalFromRow(row: GoalRow): ProjectGoal {
  return Object.freeze({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function projectFromRow(row: ProjectRow, goals: readonly ProjectGoal[]): OfficeProject {
  return Object.freeze({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    deadlineAt: row.deadline_at ?? undefined,
    progress: row.progress,
    goals: Object.freeze(goals),
    taskCount: row.task_count,
    noteCount: row.note_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function reminderFromRow(row: ReminderRow): OfficeReminder {
  return Object.freeze({
    id: row.id,
    title: row.title,
    note: row.note,
    remindAt: row.remind_at,
    status: row.status,
    recurrence: parseRecurrence(row.recurrence),
    taskId: row.task_id ?? undefined,
    projectId: row.project_id ?? undefined,
    snoozedUntil: row.snoozed_until ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SqliteOfficeRepository implements OfficeRepository {
  readonly #database: DatabaseSync;

  public constructor(
    databasePath: string,
    private readonly clock: Clock = () => new Date(),
    private readonly idFactory: IdFactory = randomUUID,
  ) {
    this.#database = new DatabaseSync(databasePath);
    try {
      this.#database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      this.migrate();
    } catch (error) {
      this.#database.close();
      throw error;
    }
  }

  public schemaVersion(): number {
    return (this.#database.prepare('PRAGMA user_version').get() as { user_version: number })
      .user_version;
  }

  public listTasks(): readonly OfficeTask[] {
    const rows = this.#database
      .prepare(
        'SELECT * FROM office_tasks ORDER BY completed ASC, due_at IS NULL, due_at ASC, updated_at DESC',
      )
      .all() as unknown as TaskRow[];
    return Object.freeze(rows.map(taskFromRow));
  }

  public createTask(request: CreateTaskRequest): OfficeTask {
    const id = this.idFactory();
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        `INSERT INTO office_tasks
        (id, title, description, completed, priority, due_at, labels, category, project_id, recurrence, progress, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        id,
        request.title,
        request.description ?? '',
        request.priority ?? 'medium',
        request.dueAt ?? null,
        JSON.stringify(request.labels ?? []),
        request.category ?? null,
        request.projectId ?? null,
        recurrenceToJson(request.recurrence),
        clampProgress(request.progress),
        timestamp,
        timestamp,
      );
    return this.getTask(id)!;
  }

  public updateTask(request: UpdateTaskRequest): OfficeTask | undefined {
    const current = this.getTask(request.id);
    if (!current) return undefined;
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        `UPDATE office_tasks
         SET title = ?, description = ?, priority = ?, due_at = ?, labels = ?, category = ?,
             project_id = ?, recurrence = ?, progress = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        request.title ?? current.title,
        request.description ?? current.description,
        request.priority ?? current.priority,
        request.dueAt === undefined ? (current.dueAt ?? null) : request.dueAt,
        JSON.stringify(request.labels ?? current.labels),
        request.category === undefined ? (current.category ?? null) : request.category,
        request.projectId === undefined ? (current.projectId ?? null) : request.projectId,
        request.recurrence === undefined
          ? recurrenceToJson(current.recurrence)
          : recurrenceToJson(request.recurrence ?? undefined),
        clampProgress(request.progress, current.progress),
        timestamp,
        request.id,
      );
    return this.getTask(request.id);
  }

  public completeTask(id: string): OfficeTask | undefined {
    const current = this.getTask(id);
    if (!current) return undefined;
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        'UPDATE office_tasks SET completed = 1, progress = 100, completed_at = ?, updated_at = ? WHERE id = ?',
      )
      .run(timestamp, timestamp, id);
    return this.getTask(id);
  }

  public deleteTask(id: string): boolean {
    return this.#database.prepare('DELETE FROM office_tasks WHERE id = ?').run(id).changes > 0;
  }

  public listNotes(): readonly OfficeNote[] {
    const rows = this.#database
      .prepare('SELECT * FROM office_notes ORDER BY pinned DESC, archived ASC, updated_at DESC')
      .all() as unknown as NoteRow[];
    return Object.freeze(rows.map((row) => noteFromRow(row, this.getNoteVersions(row.id))));
  }

  public createNote(request: CreateNoteRequest): OfficeNote {
    const id = this.idFactory();
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        `INSERT INTO office_notes
        (id, title, content, tags, pinned, archived, project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(
        id,
        request.title,
        request.content ?? '',
        JSON.stringify(request.tags ?? []),
        request.pinned ? 1 : 0,
        request.projectId ?? null,
        timestamp,
        timestamp,
      );
    this.recordNoteVersion(id, request.title, request.content ?? '', request.tags ?? [], timestamp);
    return this.getNote(id)!;
  }

  public updateNote(request: UpdateNoteRequest): OfficeNote | undefined {
    const current = this.getNote(request.id);
    if (!current) return undefined;
    const timestamp = this.clock().toISOString();
    const title = request.title ?? current.title;
    const content = request.content ?? current.content;
    const tags = request.tags ?? current.tags;
    this.#database
      .prepare(
        `UPDATE office_notes
         SET title = ?, content = ?, tags = ?, pinned = ?, archived = ?, project_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        title,
        content,
        JSON.stringify(tags),
        (request.pinned ?? current.pinned) ? 1 : 0,
        (request.archived ?? current.archived) ? 1 : 0,
        request.projectId === undefined ? (current.projectId ?? null) : request.projectId,
        timestamp,
        request.id,
      );
    this.recordNoteVersion(request.id, title, content, tags, timestamp);
    return this.getNote(request.id);
  }

  public deleteNote(id: string): boolean {
    return this.#database.prepare('DELETE FROM office_notes WHERE id = ?').run(id).changes > 0;
  }

  public listProjects(): readonly OfficeProject[] {
    const rows = this.projectRows();
    return Object.freeze(rows.map((row) => projectFromRow(row, this.getProjectGoals(row.id))));
  }

  public createProject(request: CreateProjectRequest): OfficeProject {
    const id = this.idFactory();
    const timestamp = this.clock().toISOString();
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      this.#database
        .prepare(
          `INSERT INTO office_projects
          (id, name, description, status, priority, deadline_at, progress, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          request.name,
          request.description ?? '',
          request.status ?? 'active',
          request.priority ?? 'medium',
          request.deadlineAt ?? null,
          clampProgress(request.progress),
          timestamp,
          timestamp,
        );
      for (const goal of request.goals ?? []) this.insertGoal(id, goal, timestamp);
      this.#database.exec('COMMIT');
      /* v8 ignore next 3 -- defensive rollback for unexpected SQLite failures */
      /* c8 ignore next 3 -- kept for compatible coverage runners */
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
    return this.getProject(id)!;
  }

  public updateProject(request: UpdateProjectRequest): OfficeProject | undefined {
    const current = this.getProject(request.id);
    if (!current) return undefined;
    const timestamp = this.clock().toISOString();
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      this.#database
        .prepare(
          `UPDATE office_projects
           SET name = ?, description = ?, status = ?, priority = ?, deadline_at = ?, progress = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          request.name ?? current.name,
          request.description ?? current.description,
          request.status ?? current.status,
          request.priority ?? current.priority,
          request.deadlineAt === undefined ? (current.deadlineAt ?? null) : request.deadlineAt,
          clampProgress(request.progress, current.progress),
          timestamp,
          request.id,
        );
      if (request.goals) {
        this.#database
          .prepare('DELETE FROM office_project_goals WHERE project_id = ?')
          .run(request.id);
        for (const goal of request.goals) this.insertGoal(request.id, goal, timestamp);
      }
      this.#database.exec('COMMIT');
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
    return this.getProject(request.id);
  }

  public deleteProject(id: string): boolean {
    return this.#database.prepare('DELETE FROM office_projects WHERE id = ?').run(id).changes > 0;
  }

  public listReminders(): readonly OfficeReminder[] {
    const rows = this.#database
      .prepare('SELECT * FROM office_reminders ORDER BY status ASC, remind_at ASC, updated_at DESC')
      .all() as unknown as ReminderRow[];
    return Object.freeze(rows.map(reminderFromRow));
  }

  public createReminder(request: CreateReminderRequest): OfficeReminder {
    const id = this.idFactory();
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        `INSERT INTO office_reminders
        (id, title, note, remind_at, status, recurrence, task_id, project_id, snoozed_until, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, NULL, ?, ?)`,
      )
      .run(
        id,
        request.title,
        request.note ?? '',
        request.remindAt,
        recurrenceToJson(request.recurrence),
        request.taskId ?? null,
        request.projectId ?? null,
        timestamp,
        timestamp,
      );
    return this.getReminder(id)!;
  }

  public updateReminder(request: UpdateReminderRequest): OfficeReminder | undefined {
    const current = this.getReminder(request.id);
    if (!current) return undefined;
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        `UPDATE office_reminders
         SET title = ?, note = ?, remind_at = ?, recurrence = ?, task_id = ?, project_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        request.title ?? current.title,
        request.note ?? current.note,
        request.remindAt ?? current.remindAt,
        request.recurrence === undefined
          ? recurrenceToJson(current.recurrence)
          : recurrenceToJson(request.recurrence ?? undefined),
        request.taskId === undefined ? (current.taskId ?? null) : request.taskId,
        request.projectId === undefined ? (current.projectId ?? null) : request.projectId,
        timestamp,
        request.id,
      );
    return this.getReminder(request.id);
  }

  public snoozeReminder(request: SnoozeReminderRequest): OfficeReminder | undefined {
    return this.setReminderStatus(request.id, 'snoozed', request.until);
  }

  public dismissReminder(id: string): OfficeReminder | undefined {
    return this.setReminderStatus(id, 'dismissed', undefined);
  }

  public deleteReminder(id: string): boolean {
    return this.#database.prepare('DELETE FROM office_reminders WHERE id = ?').run(id).changes > 0;
  }

  public dashboard(now: Date): OfficeDashboard {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const todayTasks = this.listTasks().filter((task) => {
      if (task.completed) return false;
      if (!task.dueAt) return false;
      const due = new Date(task.dueAt);
      return due >= start && due < end;
    });
    const upcomingDeadlines = this.listProjects()
      .filter(
        (project) =>
          project.deadlineAt && project.status !== 'archived' && project.status !== 'completed',
      )
      .slice(0, 8);
    const notes = this.listNotes();
    const tasks = this.listTasks();
    const reminders = this.listReminders();
    return Object.freeze({
      todayTasks: Object.freeze(todayTasks),
      upcomingDeadlines: Object.freeze(upcomingDeadlines),
      pinnedNotes: Object.freeze(notes.filter((note) => note.pinned && !note.archived).slice(0, 8)),
      recentConversations: Object.freeze([]),
      recentMemories: Object.freeze([]),
      quickActions: Object.freeze([
        'Create task',
        'Add markdown note',
        'Schedule reminder',
        'Start project',
      ]),
      statistics: Object.freeze({
        openTasks: tasks.filter((task) => !task.completed).length,
        completedTasks: tasks.filter((task) => task.completed).length,
        activeProjects: this.listProjects().filter((project) => project.status === 'active').length,
        scheduledReminders: reminders.filter(
          (reminder) => reminder.status === 'scheduled' || reminder.status === 'snoozed',
        ).length,
        pinnedNotes: notes.filter((note) => note.pinned && !note.archived).length,
      }),
    });
  }

  public search(query: string, limit: number): readonly OfficeSearchResult[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return Object.freeze([]);
    const score = (text: string): number => (text.toLowerCase().includes(normalized) ? 1 : 0);
    const results: OfficeSearchResult[] = [];
    for (const task of this.listTasks()) {
      const value = score(`${task.title} ${task.description} ${task.labels.join(' ')}`);
      if (value > 0)
        results.push({
          id: task.id,
          kind: 'task',
          title: task.title,
          preview: task.description,
          updatedAt: task.updatedAt,
          score: value,
        });
    }
    for (const note of this.listNotes()) {
      const value = score(`${note.title} ${note.content} ${note.tags.join(' ')}`);
      if (value > 0)
        results.push({
          id: note.id,
          kind: 'note',
          title: note.title,
          preview: note.content.slice(0, 180),
          updatedAt: note.updatedAt,
          score: value,
        });
    }
    for (const project of this.listProjects()) {
      const value = score(
        `${project.name} ${project.description} ${project.goals.map((goal) => goal.title).join(' ')}`,
      );
      if (value > 0)
        results.push({
          id: project.id,
          kind: 'project',
          title: project.name,
          preview: project.description,
          updatedAt: project.updatedAt,
          score: value,
        });
    }
    for (const reminder of this.listReminders()) {
      const value = score(`${reminder.title} ${reminder.note}`);
      if (value > 0)
        results.push({
          id: reminder.id,
          kind: 'reminder',
          title: reminder.title,
          preview: reminder.note,
          updatedAt: reminder.updatedAt,
          score: value,
        });
    }
    return Object.freeze(
      results
        .sort(
          (left, right) =>
            right.score - left.score || right.updatedAt.localeCompare(left.updatedAt),
        )
        .slice(0, limit),
    );
  }

  public close(): void {
    this.#database.close();
  }

  private getTask(id: string): OfficeTask | undefined {
    const row = this.#database.prepare('SELECT * FROM office_tasks WHERE id = ?').get(id) as
      TaskRow | undefined;
    return row ? taskFromRow(row) : undefined;
  }

  private getNote(id: string): OfficeNote | undefined {
    const row = this.#database.prepare('SELECT * FROM office_notes WHERE id = ?').get(id) as
      NoteRow | undefined;
    return row ? noteFromRow(row, this.getNoteVersions(id)) : undefined;
  }

  private getProject(id: string): OfficeProject | undefined {
    const row = this.projectRows('WHERE p.id = ?', id)[0];
    return row ? projectFromRow(row, this.getProjectGoals(id)) : undefined;
  }

  private getReminder(id: string): OfficeReminder | undefined {
    const row = this.#database.prepare('SELECT * FROM office_reminders WHERE id = ?').get(id) as
      ReminderRow | undefined;
    return row ? reminderFromRow(row) : undefined;
  }

  private getNoteVersions(noteId: string): readonly OfficeNoteVersion[] {
    const rows = this.#database
      .prepare(
        'SELECT * FROM office_note_versions WHERE note_id = ? ORDER BY created_at DESC, rowid DESC',
      )
      .all(noteId) as unknown as NoteVersionRow[];
    return Object.freeze(rows.map(versionFromRow));
  }

  private recordNoteVersion(
    noteId: string,
    title: string,
    content: string,
    tags: readonly string[],
    timestamp: string,
  ): void {
    this.#database
      .prepare(
        'INSERT INTO office_note_versions (id, note_id, title, content, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(this.idFactory(), noteId, title, content, JSON.stringify(tags), timestamp);
  }

  private projectRows(where = '', parameter?: string): readonly ProjectRow[] {
    const statement = this.#database.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM office_tasks t WHERE t.project_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM office_notes n WHERE n.project_id = p.id) AS note_count
      FROM office_projects p
      ${where}
      ORDER BY p.status ASC, p.deadline_at IS NULL, p.deadline_at ASC, p.updated_at DESC
    `);
    return (parameter ? statement.all(parameter) : statement.all()) as unknown as ProjectRow[];
  }

  private getProjectGoals(projectId: string): readonly ProjectGoal[] {
    const rows = this.#database
      .prepare(
        'SELECT * FROM office_project_goals WHERE project_id = ? ORDER BY created_at ASC, rowid ASC',
      )
      .all(projectId) as unknown as GoalRow[];
    return Object.freeze(rows.map(goalFromRow));
  }

  private insertGoal(projectId: string, title: string, timestamp: string): void {
    this.#database
      .prepare(
        'INSERT INTO office_project_goals (id, project_id, title, completed, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
      )
      .run(this.idFactory(), projectId, title, timestamp, timestamp);
  }

  private setReminderStatus(
    id: string,
    status: ReminderStatus,
    snoozedUntil: string | undefined,
  ): OfficeReminder | undefined {
    const current = this.getReminder(id);
    if (!current) return undefined;
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        'UPDATE office_reminders SET status = ?, snoozed_until = ?, updated_at = ? WHERE id = ?',
      )
      .run(status, nullable(snoozedUntil), timestamp, id);
    return this.getReminder(id);
  }

  private migrate(): void {
    const version = this.schemaVersion();
    if (version > SCHEMA_VERSION) throw new Error(`Unsupported office schema version ${version}.`);
    if (version < 1) {
      this.#database.exec(`
        BEGIN;
        CREATE TABLE office_projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('planning','active','blocked','completed','archived')),
          priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
          deadline_at TEXT,
          progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE office_project_goals (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES office_projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE office_tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
          priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
          due_at TEXT,
          labels TEXT NOT NULL DEFAULT '[]',
          category TEXT,
          project_id TEXT REFERENCES office_projects(id) ON DELETE SET NULL,
          recurrence TEXT,
          progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        );
        CREATE TABLE office_notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '[]',
          pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
          archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
          project_id TEXT REFERENCES office_projects(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE office_note_versions (
          id TEXT PRIMARY KEY,
          note_id TEXT NOT NULL REFERENCES office_notes(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL
        );
        CREATE TABLE office_reminders (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          note TEXT NOT NULL,
          remind_at TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('scheduled','snoozed','dismissed','completed')),
          recurrence TEXT,
          task_id TEXT REFERENCES office_tasks(id) ON DELETE SET NULL,
          project_id TEXT REFERENCES office_projects(id) ON DELETE SET NULL,
          snoozed_until TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_office_tasks_due ON office_tasks(completed, due_at);
        CREATE INDEX idx_office_notes_lookup ON office_notes(pinned DESC, archived, updated_at DESC);
        CREATE INDEX idx_office_projects_deadline ON office_projects(status, deadline_at);
        CREATE INDEX idx_office_reminders_queue ON office_reminders(status, remind_at);
        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }
}
