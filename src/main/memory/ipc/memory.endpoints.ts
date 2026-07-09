import { z } from 'zod';

import { MEMORY_KINDS } from '../../../shared/memory/contracts';
import { IPC_CHANNELS } from '../../../shared/platform/ipc';
import type { IpcRouter } from '../../platform/ipc/ipc-router';
import type { MemoryManager } from '../manager/memory-manager';

const id = z.string().trim().min(1).max(128);
const content = z.string().trim().min(3).max(10_000);
const summary = z.string().trim().min(3).max(1_000);
const tags = z.array(z.string().trim().min(1).max(40)).max(20);
const kind = z.enum(MEMORY_KINDS);
const record = z.object({
  id,
  kind,
  content,
  summary,
  tags,
  pinned: z.boolean(),
  sourceConversationId: id.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const archive = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  settings: z.object({ enabled: z.boolean() }).strict(),
  memories: z.array(record.strict()).max(100_000),
});

export type MemoryController = Pick<
  MemoryManager,
  | 'list'
  | 'saveMemory'
  | 'updateMemory'
  | 'forgetMemory'
  | 'searchMemory'
  | 'settings'
  | 'setEnabled'
  | 'deleteEverything'
  | 'exportMemory'
  | 'backup'
  | 'restore'
  | 'mergeDuplicateMemories'
>;

export function registerMemoryEndpoints(router: IpcRouter, manager: MemoryController): void {
  router.register({
    channel: IPC_CHANNELS.memoryList,
    requestSchema: z.object({ kind: kind.optional() }).strict(),
    handle: (request) => manager.list(request.kind),
  });
  router.register({
    channel: IPC_CHANNELS.memorySave,
    requestSchema: z
      .object({
        kind,
        content,
        summary: summary.optional(),
        tags: tags.optional(),
        pinned: z.boolean().optional(),
        sourceConversationId: id.optional(),
      })
      .strict(),
    handle: (request) => manager.saveMemory(request),
  });
  router.register({
    channel: IPC_CHANNELS.memoryUpdate,
    requestSchema: z
      .object({
        id,
        content: content.optional(),
        summary: summary.optional(),
        tags: tags.optional(),
        pinned: z.boolean().optional(),
      })
      .strict(),
    handle: (request) => manager.updateMemory(request),
  });
  router.register({
    channel: IPC_CHANNELS.memoryDelete,
    requestSchema: z.object({ id }).strict(),
    handle: (request) => {
      manager.forgetMemory(request.id);
      return { deleted: true } as const;
    },
  });
  router.register({
    channel: IPC_CHANNELS.memorySearch,
    requestSchema: z
      .object({
        query: z.string().trim().max(500),
        kind: kind.optional(),
        tags: tags.optional(),
        mode: z.enum(['keyword', 'semantic', 'hybrid']).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .strict(),
    handle: (request) => manager.searchMemory(request),
  });
  router.register({
    channel: IPC_CHANNELS.memorySettings,
    requestSchema: z.object({}).strict(),
    handle: () => manager.settings(),
  });
  router.register({
    channel: IPC_CHANNELS.memorySetEnabled,
    requestSchema: z.object({ enabled: z.boolean() }).strict(),
    handle: (request) => manager.setEnabled(request.enabled),
  });
  router.register({
    channel: IPC_CHANNELS.memoryDeleteAll,
    requestSchema: z.object({ confirm: z.literal(true) }).strict(),
    handle: () => ({ deleted: manager.deleteEverything() }),
  });
  router.register({
    channel: IPC_CHANNELS.memoryExport,
    requestSchema: z.object({}).strict(),
    handle: () => manager.exportMemory(),
  });
  router.register({
    channel: IPC_CHANNELS.memoryBackup,
    requestSchema: z.object({}).strict(),
    handle: () => manager.backup(),
  });
  router.register({
    channel: IPC_CHANNELS.memoryRestore,
    requestSchema: z.object({ archive, replace: z.boolean() }).strict(),
    handle: (request) => ({ restored: manager.restore(request.archive, request.replace) }),
  });
  router.register({
    channel: IPC_CHANNELS.memoryMerge,
    requestSchema: z.object({}).strict(),
    handle: () => ({ merged: manager.mergeDuplicateMemories() }),
  });
}
