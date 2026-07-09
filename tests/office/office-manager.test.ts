// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  AIProvider,
  ChatSession,
  StreamChunk,
  StreamResponse,
} from '../../src/main/conversation/provider/contracts';
import type { ConversationEngine } from '../../src/main/conversation/engine/conversation-engine';
import type { MemoryManager } from '../../src/main/memory/manager/memory-manager';
import { OfficeManager } from '../../src/main/office/manager/office-manager';
import { OfficeCommandInterpreter } from '../../src/main/office/natural-language/office-command-interpreter';
import { SqliteOfficeRepository } from '../../src/main/office/persistence/sqlite-office-repository';

class MockStream implements StreamResponse {
  public constructor(private readonly text: string) {}
  public cancel(): void {
    return undefined;
  }
  public [Symbol.asyncIterator](): AsyncIterator<StreamChunk> {
    let emitted = false;
    return {
      next: () => {
        if (emitted) return Promise.resolve({ done: true, value: undefined });
        emitted = true;
        return Promise.resolve({ done: false, value: { text: this.text } });
      },
    };
  }
}

function providerReturning(text: string): AIProvider {
  const session: ChatSession = {
    stream: () => new MockStream(text),
  };
  return {
    id: 'mock',
    model: 'mock-gemini',
    tokenEstimator: { estimate: () => Promise.resolve(1) },
    createSession: () => session,
  };
}

function createManager(
  provider?: AIProvider,
  conversations?: ConversationEngine,
  memories?: MemoryManager,
) {
  const directory = mkdtempSync(join(tmpdir(), 'jarvis-office-manager-'));
  let tick = 0;
  const repository = new SqliteOfficeRepository(
    join(directory, 'office.sqlite'),
    () => new Date(`2026-01-0${Math.min(tick + 1, 9)}T09:00:00.000Z`),
    () => `office-${++tick}`,
  );
  const manager = new OfficeManager(
    repository,
    new OfficeCommandInterpreter(provider ? () => provider : undefined),
    conversations,
    memories,
  );
  return {
    manager,
    cleanup: () => {
      manager.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

describe('OfficeManager', () => {
  it('normalizes CRUD inputs and throws friendly not-found errors', () => {
    const { manager, cleanup } = createManager();
    try {
      const task = manager.createTask({
        title: '  Finish invoice  ',
        labels: ['Finance', 'finance', ''],
        progress: 200,
      });
      expect(task.title).toBe('Finish invoice');
      expect(task.labels).toEqual(['finance']);
      expect(task.progress).toBe(100);
      expect(() => manager.deleteTask('missing')).toThrow('Office item was not found.');
      expect(() => manager.createReminder({ title: 'Bad', remindAt: 'not-a-date' })).toThrow(
        'Reminder time must be a valid ISO date.',
      );
    } finally {
      cleanup();
    }
  });

  it('uses Gemini-style JSON for natural language office commands', async () => {
    const { manager, cleanup } = createManager(
      providerReturning('{"kind":"create-project","name":"Apollo","description":"Moonshot"}'),
    );
    try {
      const result = await manager.quickAdd({
        text: 'Create project Apollo',
        now: '2026-01-01T09:00:00.000Z',
      });
      expect(result.action.kind).toBe('create-project');
      expect(manager.listProjects()[0]).toMatchObject({ name: 'Apollo', description: 'Moonshot' });
    } finally {
      cleanup();
    }
  });

  it('falls back to deterministic parsing for reminders, tasks and notes', async () => {
    const { manager, cleanup } = createManager();
    try {
      const reminder = await manager.quickAdd({
        text: 'Remind me at 5 PM submit report',
        now: '2026-01-01T09:00:00.000Z',
      });
      expect(reminder.action.kind).toBe('create-reminder');
      expect(manager.listReminders()[0]?.remindAt).toBe('2026-01-01T11:30:00.000Z');
      const task = await manager.quickAdd({
        text: 'Finish invoice tomorrow',
        now: '2026-01-01T09:00:00.000Z',
      });
      expect(task.action.kind).toBe('create-task');
      expect(manager.listTasks()[0]?.priority).toBe('high');
      const note = await manager.quickAdd({
        text: "Add today's work completed module tests",
        now: '2026-01-01T09:00:00.000Z',
      });
      expect(note.action.kind).toBe('create-note');
      expect(manager.listNotes()[0]?.tags).toEqual(['daily']);
    } finally {
      cleanup();
    }
  });

  it('covers note, project, reminder, dashboard and search operations', async () => {
    const { manager, cleanup } = createManager(
      providerReturning('{"kind":"create-note","title":"Gemini Note","content":"Remember this"}'),
    );
    try {
      const project = manager.createProject({
        name: '  Apollo  ',
        deadlineAt: '2026-01-05T09:00:00.000Z',
        goals: ['Ship'],
      });
      const updatedProject = manager.updateProject({
        id: project.id,
        status: 'blocked',
        progress: 40,
        goals: ['Ship', 'Validate'],
      });
      expect(updatedProject).toMatchObject({ status: 'blocked', progress: 40 });

      const task = manager.createTask({
        title: 'Dashboard review',
        projectId: project.id,
        dueAt: '2026-01-01T12:00:00.000Z',
      });
      expect(manager.updateTask({ id: task.id, category: 'ops', dueAt: null })).toMatchObject({
        category: 'ops',
        dueAt: undefined,
      });
      expect(
        manager.updateTask({
          id: task.id,
          description: 'Updated task',
          labels: ['Ops'],
        }),
      ).toMatchObject({ description: 'Updated task', labels: ['ops'] });
      expect(manager.completeTask(task.id)).toMatchObject({ completed: true });

      const note = manager.createNote({
        title: '  Pinned note  ',
        content: 'Apollo markdown',
        projectId: project.id,
        pinned: true,
      });
      expect(manager.updateNote({ id: note.id, archived: true, tags: ['Apollo'] })).toMatchObject({
        archived: true,
        tags: ['apollo'],
      });

      const reminder = manager.createReminder({
        title: 'Standup',
        remindAt: '2026-01-01T10:00:00.000Z',
        projectId: project.id,
      });
      expect(
        manager.updateReminder({
          id: reminder.id,
          note: 'Bring updates',
          taskId: task.id,
          recurrence: { frequency: 'weekly', interval: 1 },
        }),
      ).toMatchObject({ note: 'Bring updates' });
      expect(
        manager.snoozeReminder({
          id: reminder.id,
          until: '2026-01-01T10:10:00.000Z',
        }),
      ).toMatchObject({ status: 'snoozed' });
      expect(manager.dismissReminder(reminder.id)).toMatchObject({ status: 'dismissed' });

      const quickNote = await manager.quickAdd({
        text: 'Add note with Gemini',
        now: '2026-01-01T09:00:00.000Z',
      });
      expect(quickNote.action.kind).toBe('create-note');
      expect(manager.search({ query: 'Apollo', limit: 10 }).length).toBeGreaterThan(0);
      expect(manager.dashboard(new Date('2026-01-01T09:00:00.000Z')).statistics.openTasks).toBe(0);

      manager.deleteNote(note.id);
      manager.deleteReminder(reminder.id);
      manager.deleteTask(task.id);
      manager.deleteProject(project.id);
      expect(manager.listProjects()).toHaveLength(0);
      expect(manager.search({ query: '', limit: 10 })).toHaveLength(0);
      expect(() => manager.updateNote({ id: 'missing', title: 'Nope' })).toThrow(
        'Office item was not found.',
      );
      expect(() => manager.updateProject({ id: 'missing', name: 'Nope' })).toThrow(
        'Office item was not found.',
      );
      expect(() => manager.updateReminder({ id: 'missing', title: 'Nope' })).toThrow(
        'Office item was not found.',
      );
      expect(() => manager.completeTask('missing')).toThrow('Office item was not found.');
      expect(() => manager.deleteNote('missing')).toThrow('Office item was not found.');
      expect(() => manager.deleteProject('missing')).toThrow('Office item was not found.');
      expect(() => manager.deleteReminder('missing')).toThrow('Office item was not found.');
      expect(() =>
        manager.snoozeReminder({
          id: 'missing',
          until: '2026-01-01T10:00:00.000Z',
        }),
      ).toThrow('Office item was not found.');
      expect(() => manager.dismissReminder('missing')).toThrow('Office item was not found.');
      expect(() =>
        manager.snoozeReminder({
          id: reminder.id,
          until: 'not-a-date',
        }),
      ).toThrow('Snooze time must be a valid ISO date.');
    } finally {
      cleanup();
    }
  });

  it('interprets Gemini task and reminder JSON and falls back when the provider fails', async () => {
    const taskRun = createManager(
      providerReturning(
        '{"kind":"create-task","title":"Prepare deck","dueAt":"2026-01-02T09:00:00.000Z"}',
      ),
    );
    try {
      expect((await taskRun.manager.quickAdd({ text: 'Prepare deck' })).action.kind).toBe(
        'create-task',
      );
    } finally {
      taskRun.cleanup();
    }

    const reminderRun = createManager(
      providerReturning(
        '{"kind":"create-reminder","title":"Call Alex","remindAt":"2026-01-01T12:00:00.000Z"}',
      ),
    );
    try {
      expect((await reminderRun.manager.quickAdd({ text: 'Call Alex' })).action.kind).toBe(
        'create-reminder',
      );
    } finally {
      reminderRun.cleanup();
    }

    const failingProvider: AIProvider = {
      ...providerReturning('{}'),
      createSession: () => {
        throw new Error('provider unavailable');
      },
    };
    const fallbackRun = createManager(failingProvider);
    try {
      expect(
        (await fallbackRun.manager.quickAdd({ text: 'Finish fallback task' })).action.kind,
      ).toBe('create-task');
    } finally {
      fallbackRun.cleanup();
    }
  });

  it('composes dashboard and global search with conversation and memory managers', () => {
    const conversations = {
      list: () => [
        {
          id: 'conversation',
          title: 'Invoice chat',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          messageCount: 2,
          preview: 'Discussed invoices',
        },
      ],
      search: () => [
        {
          id: 'conversation',
          title: 'Invoice chat',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          messageCount: 2,
          preview: 'Discussed invoices',
        },
      ],
    } as unknown as ConversationEngine;
    const memories = {
      list: () => [
        {
          id: 'memory',
          kind: 'fact',
          content: 'Invoices go out Friday',
          summary: 'Invoice cadence',
          tags: ['finance'],
          pinned: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-03T00:00:00.000Z',
        },
      ],
      searchMemory: () => [
        {
          memory: {
            id: 'memory',
            kind: 'fact',
            content: 'Invoices go out Friday',
            summary: 'Invoice cadence',
            tags: ['finance'],
            pinned: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-03T00:00:00.000Z',
          },
          score: 0.9,
        },
      ],
    } as unknown as MemoryManager;
    const { manager, cleanup } = createManager(undefined, conversations, memories);
    try {
      manager.createTask({ title: 'Invoice task' });
      const dashboard = manager.dashboard(new Date('2026-01-01T09:00:00.000Z'));
      expect(dashboard.recentConversations).toHaveLength(1);
      expect(dashboard.recentMemories).toHaveLength(1);
      expect(manager.search({ query: 'invoice', limit: 10 }).map((item) => item.kind)).toEqual(
        expect.arrayContaining(['task', 'conversation', 'memory']),
      );
      expect(manager.search({ query: 'invoice' })).toHaveLength(3);
    } finally {
      cleanup();
    }
  });

  it('covers additional natural-language parser branches', async () => {
    const projectRun = createManager();
    try {
      expect(
        (
          await projectRun.manager.quickAdd({
            text: 'Create project',
            now: '2026-01-01T09:00:00.000Z',
          })
        ).action.kind,
      ).toBe('create-project');
      expect(
        (
          await projectRun.manager.quickAdd({
            text: 'Remind me',
            now: '2026-01-01T18:00:00.000Z',
          })
        ).action.kind,
      ).toBe('create-reminder');
      await projectRun.manager.quickAdd({
        text: 'Remind me at 12 AM',
        now: '2026-01-01T09:00:00.000Z',
      });
      await projectRun.manager.quickAdd({
        text: 'Remind me at 12 PM',
        now: '2026-01-01T09:00:00.000Z',
      });
      await projectRun.manager.quickAdd({
        text: 'Remind me at 8:30 AM',
        now: '2026-01-01T09:00:00.000Z',
      });
      expect(
        (
          await projectRun.manager.quickAdd({
            text: 'Buy milk',
            now: '2026-01-01T09:00:00.000Z',
          })
        ).action.kind,
      ).toBe('create-task');
      expect(
        (
          await projectRun.manager.quickAdd({
            text: 'Finish',
            now: '2026-01-01T09:00:00.000Z',
          })
        ).action.kind,
      ).toBe('create-task');
    } finally {
      projectRun.cleanup();
    }

    const unknownJsonRun = createManager(providerReturning('{"kind":"unknown"}'));
    try {
      expect((await unknownJsonRun.manager.quickAdd({ text: 'Finish unknown' })).action.kind).toBe(
        'create-task',
      );
    } finally {
      unknownJsonRun.cleanup();
    }

    const projectTitleRun = createManager(
      providerReturning('{"kind":"create-project","title":"Title Project"}'),
    );
    try {
      expect(
        (await projectTitleRun.manager.quickAdd({ text: 'Create project title' })).action.kind,
      ).toBe('create-project');
    } finally {
      projectTitleRun.cleanup();
    }

    const noteDescriptionRun = createManager(
      providerReturning('{"kind":"create-note","title":"Note","description":"From description"}'),
    );
    try {
      expect((await noteDescriptionRun.manager.quickAdd({ text: 'Create note' })).action.kind).toBe(
        'create-note',
      );
    } finally {
      noteDescriptionRun.cleanup();
    }

    const noteContentRun = createManager(
      providerReturning('{"kind":"create-note","title":"Content Note","content":"From content"}'),
    );
    try {
      expect(
        (await noteContentRun.manager.quickAdd({ text: 'Create content note' })).action.kind,
      ).toBe('create-note');
    } finally {
      noteContentRun.cleanup();
    }

    const emptyNoteRun = createManager(providerReturning('{"kind":"create-note","title":"Empty"}'));
    try {
      expect((await emptyNoteRun.manager.quickAdd({ text: 'Create empty note' })).action.kind).toBe(
        'create-note',
      );
    } finally {
      emptyNoteRun.cleanup();
    }

    const reminderDescriptionRun = createManager(
      providerReturning(
        '{"kind":"create-reminder","title":"Call Sam","description":"Discuss launch","remindAt":"2026-01-01T12:00:00.000Z"}',
      ),
    );
    try {
      expect(
        (await reminderDescriptionRun.manager.quickAdd({ text: 'Remind call Sam' })).action.kind,
      ).toBe('create-reminder');
    } finally {
      reminderDescriptionRun.cleanup();
    }

    const malformedRun = createManager(providerReturning('not json'));
    try {
      expect((await malformedRun.manager.quickAdd({ text: 'Finish malformed' })).action.kind).toBe(
        'create-task',
      );
    } finally {
      malformedRun.cleanup();
    }
  });

  it('falls back when AI provider resolution fails', async () => {
    const interpreter = new OfficeCommandInterpreter(() => {
      throw new Error('no provider');
    });
    const command = await interpreter.interpret({
      text: 'Remind me tomorrow',
      now: '2026-01-01T09:00:00.000Z',
    });
    expect(command.kind).toBe('create-reminder');
  });
});
