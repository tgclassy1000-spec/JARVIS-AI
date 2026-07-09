import { z } from 'zod';

import {
  OFFICE_PRIORITIES,
  OFFICE_PROJECT_STATUSES,
  OFFICE_RECURRENCE_FREQUENCIES,
} from '../../../shared/office/contracts';
import { IPC_CHANNELS } from '../../../shared/platform/ipc';
import { PERMISSIONS } from '../../../shared/platform/permissions';
import type { IpcRouter } from '../../platform/ipc/ipc-router';
import type { OfficeManager } from '../manager/office-manager';

export type OfficeController = Pick<
  OfficeManager,
  | 'dashboard'
  | 'search'
  | 'quickAdd'
  | 'listTasks'
  | 'createTask'
  | 'updateTask'
  | 'completeTask'
  | 'deleteTask'
  | 'listNotes'
  | 'createNote'
  | 'updateNote'
  | 'deleteNote'
  | 'listProjects'
  | 'createProject'
  | 'updateProject'
  | 'deleteProject'
  | 'listReminders'
  | 'createReminder'
  | 'updateReminder'
  | 'snoozeReminder'
  | 'dismissReminder'
  | 'deleteReminder'
>;

const idSchema = z.string().trim().min(1).max(128);
const titleSchema = z.string().trim().min(1).max(240);
const optionalTextSchema = z.string().trim().max(20_000).optional();
const nullableIdSchema = z.union([idSchema, z.null()]);
const isoDateSchema = z.iso.datetime({ offset: true });
const nullableIsoDateSchema = z.union([isoDateSchema, z.null()]);
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20);
const recurrenceSchema = z.object({
  frequency: z.enum(OFFICE_RECURRENCE_FREQUENCIES),
  interval: z.number().int().min(1).max(365),
  endsAt: isoDateSchema.optional(),
});
const nullableRecurrenceSchema = z.union([recurrenceSchema, z.null()]);
const emptySchema = z.object({}).strict();
const idRequestSchema = z.object({ id: idSchema }).strict();

const createTaskSchema = z
  .object({
    title: titleSchema,
    description: optionalTextSchema,
    priority: z.enum(OFFICE_PRIORITIES).optional(),
    dueAt: isoDateSchema.optional(),
    labels: tagsSchema.optional(),
    category: z.string().trim().min(1).max(80).optional(),
    projectId: idSchema.optional(),
    recurrence: recurrenceSchema.optional(),
    progress: z.number().int().min(0).max(100).optional(),
  })
  .strict();

const updateTaskSchema = createTaskSchema
  .partial()
  .extend({
    id: idSchema,
    dueAt: nullableIsoDateSchema.optional(),
    category: z.union([z.string().trim().min(1).max(80), z.null()]).optional(),
    projectId: nullableIdSchema.optional(),
    recurrence: nullableRecurrenceSchema.optional(),
  })
  .strict();

const createNoteSchema = z
  .object({
    title: titleSchema,
    content: optionalTextSchema,
    tags: tagsSchema.optional(),
    pinned: z.boolean().optional(),
    projectId: idSchema.optional(),
  })
  .strict();

const updateNoteSchema = createNoteSchema
  .partial()
  .extend({
    id: idSchema,
    archived: z.boolean().optional(),
    projectId: nullableIdSchema.optional(),
  })
  .strict();

const createProjectSchema = z
  .object({
    name: titleSchema,
    description: optionalTextSchema,
    status: z.enum(OFFICE_PROJECT_STATUSES).optional(),
    priority: z.enum(OFFICE_PRIORITIES).optional(),
    deadlineAt: isoDateSchema.optional(),
    progress: z.number().int().min(0).max(100).optional(),
    goals: z.array(titleSchema).max(50).optional(),
  })
  .strict();

const updateProjectSchema = createProjectSchema
  .partial()
  .extend({
    id: idSchema,
    deadlineAt: nullableIsoDateSchema.optional(),
  })
  .strict();

const createReminderSchema = z
  .object({
    title: titleSchema,
    note: optionalTextSchema,
    remindAt: isoDateSchema,
    recurrence: recurrenceSchema.optional(),
    taskId: idSchema.optional(),
    projectId: idSchema.optional(),
  })
  .strict();

const updateReminderSchema = createReminderSchema
  .partial()
  .extend({
    id: idSchema,
    recurrence: nullableRecurrenceSchema.optional(),
    taskId: nullableIdSchema.optional(),
    projectId: nullableIdSchema.optional(),
  })
  .strict();

const snoozeSchema = z.object({ id: idSchema, until: isoDateSchema }).strict();
const searchSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();
const quickAddSchema = z
  .object({ text: z.string().trim().min(1).max(1000), now: isoDateSchema.optional() })
  .strict();

export function registerOfficeEndpoints(router: IpcRouter, controller: OfficeController): void {
  router.register({
    channel: IPC_CHANNELS.officeDashboard,
    requestSchema: emptySchema,
    handle: () => controller.dashboard(),
  });
  router.register({
    channel: IPC_CHANNELS.officeSearch,
    requestSchema: searchSchema,
    handle: (request) => controller.search(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeQuickAdd,
    requestSchema: quickAddSchema,
    requiredPermission: PERMISSIONS.network,
    handle: (request) => controller.quickAdd(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeTaskList,
    requestSchema: emptySchema,
    handle: () => controller.listTasks(),
  });
  router.register({
    channel: IPC_CHANNELS.officeTaskCreate,
    requestSchema: createTaskSchema,
    handle: (request) => controller.createTask(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeTaskUpdate,
    requestSchema: updateTaskSchema,
    handle: (request) => controller.updateTask(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeTaskDelete,
    requestSchema: idRequestSchema,
    handle: (request) => {
      controller.deleteTask(request.id);
      return { deleted: true };
    },
  });
  router.register({
    channel: IPC_CHANNELS.officeTaskComplete,
    requestSchema: idRequestSchema,
    handle: (request) => controller.completeTask(request.id),
  });
  router.register({
    channel: IPC_CHANNELS.officeNoteList,
    requestSchema: emptySchema,
    handle: () => controller.listNotes(),
  });
  router.register({
    channel: IPC_CHANNELS.officeNoteCreate,
    requestSchema: createNoteSchema,
    handle: (request) => controller.createNote(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeNoteUpdate,
    requestSchema: updateNoteSchema,
    handle: (request) => controller.updateNote(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeNoteDelete,
    requestSchema: idRequestSchema,
    handle: (request) => {
      controller.deleteNote(request.id);
      return { deleted: true };
    },
  });
  router.register({
    channel: IPC_CHANNELS.officeProjectList,
    requestSchema: emptySchema,
    handle: () => controller.listProjects(),
  });
  router.register({
    channel: IPC_CHANNELS.officeProjectCreate,
    requestSchema: createProjectSchema,
    handle: (request) => controller.createProject(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeProjectUpdate,
    requestSchema: updateProjectSchema,
    handle: (request) => controller.updateProject(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeProjectDelete,
    requestSchema: idRequestSchema,
    handle: (request) => {
      controller.deleteProject(request.id);
      return { deleted: true };
    },
  });
  router.register({
    channel: IPC_CHANNELS.officeReminderList,
    requestSchema: emptySchema,
    handle: () => controller.listReminders(),
  });
  router.register({
    channel: IPC_CHANNELS.officeReminderCreate,
    requestSchema: createReminderSchema,
    handle: (request) => controller.createReminder(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeReminderUpdate,
    requestSchema: updateReminderSchema,
    handle: (request) => controller.updateReminder(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeReminderDelete,
    requestSchema: idRequestSchema,
    handle: (request) => {
      controller.deleteReminder(request.id);
      return { deleted: true };
    },
  });
  router.register({
    channel: IPC_CHANNELS.officeReminderSnooze,
    requestSchema: snoozeSchema,
    handle: (request) => controller.snoozeReminder(request),
  });
  router.register({
    channel: IPC_CHANNELS.officeReminderDismiss,
    requestSchema: idRequestSchema,
    handle: (request) => controller.dismissReminder(request.id),
  });
}
