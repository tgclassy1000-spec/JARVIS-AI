// @vitest-environment node

import type {
  OfficeDashboard,
  OfficeNote,
  OfficeProject,
  OfficeQuickAddResult,
  OfficeReminder,
  OfficeTask,
} from '../../src/shared/office/contracts';
import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
} from '../../src/shared/platform/ipc';
import { PERMISSIONS } from '../../src/shared/platform/permissions';
import type { OfficeController } from '../../src/main/office/ipc/office.endpoints';
import { registerOfficeEndpoints } from '../../src/main/office/ipc/office.endpoints';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import { createPermissionMiddleware } from '../../src/main/platform/ipc/middleware';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';
import { PermissionManager } from '../../src/main/platform/permissions/permission-manager';

class Adapter implements IpcMainAdapter {
  public readonly handlers = new Map<string, IpcListener>();
  public handle(channel: string, listener: IpcListener): void {
    this.handlers.set(channel, listener);
  }
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child() {
    return this;
  },
};

const timestamp = '2026-01-01T00:00:00.000Z';
const task: OfficeTask = {
  id: 'task',
  title: 'Task',
  description: '',
  completed: false,
  priority: 'medium',
  labels: [],
  progress: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const note: OfficeNote = {
  id: 'note',
  title: 'Note',
  content: '# Note',
  tags: [],
  pinned: true,
  archived: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  versions: [],
};
const project: OfficeProject = {
  id: 'project',
  name: 'Project',
  description: '',
  status: 'active',
  priority: 'medium',
  progress: 0,
  goals: [],
  taskCount: 0,
  noteCount: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const reminder: OfficeReminder = {
  id: 'reminder',
  title: 'Reminder',
  note: '',
  remindAt: '2026-01-01T10:00:00.000Z',
  status: 'scheduled',
  createdAt: timestamp,
  updatedAt: timestamp,
};
const dashboard: OfficeDashboard = {
  todayTasks: [task],
  upcomingDeadlines: [project],
  pinnedNotes: [note],
  recentConversations: [],
  recentMemories: [],
  quickActions: ['Create task'],
  statistics: {
    openTasks: 1,
    completedTasks: 0,
    activeProjects: 1,
    scheduledReminders: 1,
    pinnedNotes: 1,
  },
};
const quickAdd: OfficeQuickAddResult = {
  action: { kind: 'create-task', task },
  interpretedAs: 'Created.',
};

function createRouter(decision: 'allow' | 'deny' = 'allow') {
  const adapter = new Adapter();
  const router = new IpcRouter(
    adapter,
    ALLOWED_IPC_CHANNELS,
    ALLOWED_IPC_EVENTS,
    [createPermissionMiddleware(new PermissionManager(new Map([[PERMISSIONS.network, decision]])))],
    logger,
    () => 'office-request',
  );
  return { adapter, router };
}

describe('office IPC endpoints', () => {
  it('registers allow-listed endpoints and handles CRUD contracts', async () => {
    const { adapter, router } = createRouter();
    const controller: OfficeController = {
      dashboard: vi.fn(() => dashboard),
      search: vi.fn(() => [
        {
          id: 'task',
          kind: 'task' as const,
          title: 'Task',
          preview: '',
          updatedAt: timestamp,
          score: 1,
        },
      ]),
      quickAdd: vi.fn(() => Promise.resolve(quickAdd)),
      listTasks: vi.fn(() => [task]),
      createTask: vi.fn(() => task),
      updateTask: vi.fn(() => task),
      completeTask: vi.fn(() => ({ ...task, completed: true, progress: 100 })),
      deleteTask: vi.fn(),
      listNotes: vi.fn(() => [note]),
      createNote: vi.fn(() => note),
      updateNote: vi.fn(() => note),
      deleteNote: vi.fn(),
      listProjects: vi.fn(() => [project]),
      createProject: vi.fn(() => project),
      updateProject: vi.fn(() => project),
      deleteProject: vi.fn(),
      listReminders: vi.fn(() => [reminder]),
      createReminder: vi.fn(() => reminder),
      updateReminder: vi.fn(() => reminder),
      snoozeReminder: vi.fn(() => ({ ...reminder, status: 'snoozed' as const })),
      dismissReminder: vi.fn(() => ({ ...reminder, status: 'dismissed' as const })),
      deleteReminder: vi.fn(),
    };
    registerOfficeEndpoints(router, controller);
    expect(adapter.handlers.size).toBe(22);
    const invoke = (channel: string, payload: unknown) =>
      adapter.handlers.get(channel)?.({ senderUrl: 'file:///app', send: vi.fn() }, payload);

    await expect(invoke(IPC_CHANNELS.officeDashboard, {})).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.officeSearch, { query: 'task' })).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      invoke(IPC_CHANNELS.officeQuickAdd, { text: 'Finish invoice' }),
    ).resolves.toMatchObject({ ok: true });
    await invoke(IPC_CHANNELS.officeTaskList, {});
    await invoke(IPC_CHANNELS.officeTaskCreate, { title: 'Task' });
    await invoke(IPC_CHANNELS.officeTaskUpdate, { id: 'task', title: 'Task 2' });
    await invoke(IPC_CHANNELS.officeTaskComplete, { id: 'task' });
    await invoke(IPC_CHANNELS.officeTaskDelete, { id: 'task' });
    await invoke(IPC_CHANNELS.officeNoteList, {});
    await invoke(IPC_CHANNELS.officeNoteCreate, { title: 'Note', content: '# Hi' });
    await invoke(IPC_CHANNELS.officeNoteUpdate, { id: 'note', archived: true });
    await invoke(IPC_CHANNELS.officeNoteDelete, { id: 'note' });
    await invoke(IPC_CHANNELS.officeProjectList, {});
    await invoke(IPC_CHANNELS.officeProjectCreate, { name: 'Project' });
    await invoke(IPC_CHANNELS.officeProjectUpdate, { id: 'project', status: 'blocked' });
    await invoke(IPC_CHANNELS.officeProjectDelete, { id: 'project' });
    await invoke(IPC_CHANNELS.officeReminderList, {});
    await invoke(IPC_CHANNELS.officeReminderCreate, {
      title: 'Reminder',
      remindAt: '2026-01-01T10:00:00.000Z',
    });
    await invoke(IPC_CHANNELS.officeReminderUpdate, { id: 'reminder', note: 'Updated' });
    await invoke(IPC_CHANNELS.officeReminderSnooze, {
      id: 'reminder',
      until: '2026-01-01T10:10:00.000Z',
    });
    await invoke(IPC_CHANNELS.officeReminderDismiss, { id: 'reminder' });
    await invoke(IPC_CHANNELS.officeReminderDelete, { id: 'reminder' });
    expect(controller.deleteTask).toHaveBeenCalledWith('task');
    router.dispose();
  });

  it('rejects invalid payloads and denied quick-add permission', async () => {
    const denied = createRouter('deny');
    registerOfficeEndpoints(denied.router, {
      dashboard: vi.fn(() => dashboard),
      search: vi.fn(() => []),
      quickAdd: vi.fn(() => Promise.resolve(quickAdd)),
      listTasks: vi.fn(() => []),
      createTask: vi.fn(() => task),
      updateTask: vi.fn(() => task),
      completeTask: vi.fn(() => task),
      deleteTask: vi.fn(),
      listNotes: vi.fn(() => []),
      createNote: vi.fn(() => note),
      updateNote: vi.fn(() => note),
      deleteNote: vi.fn(),
      listProjects: vi.fn(() => []),
      createProject: vi.fn(() => project),
      updateProject: vi.fn(() => project),
      deleteProject: vi.fn(),
      listReminders: vi.fn(() => []),
      createReminder: vi.fn(() => reminder),
      updateReminder: vi.fn(() => reminder),
      snoozeReminder: vi.fn(() => reminder),
      dismissReminder: vi.fn(() => reminder),
      deleteReminder: vi.fn(),
    });
    const event = { senderUrl: 'file:///app', send: vi.fn() };
    await expect(
      denied.adapter.handlers.get(IPC_CHANNELS.officeTaskCreate)?.(event, { title: '' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    await expect(
      denied.adapter.handlers.get(IPC_CHANNELS.officeQuickAdd)?.(event, { text: 'Create task' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});
