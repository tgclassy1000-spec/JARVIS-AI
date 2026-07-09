import { z } from 'zod';

import { IPC_CHANNELS, IPC_EVENTS } from '../../../shared/platform/ipc';
import { PERMISSIONS } from '../../../shared/platform/permissions';
import type { IpcRouter } from '../../platform/ipc/ipc-router';
import type { ConversationEngine } from '../engine/conversation-engine';

export type ConversationController = Pick<
  ConversationEngine,
  | 'list'
  | 'create'
  | 'get'
  | 'rename'
  | 'delete'
  | 'search'
  | 'send'
  | 'edit'
  | 'regenerate'
  | 'cancel'
  | 'export'
>;

const id = z.string().trim().min(1).max(128);
const title = z.string().trim().min(1).max(200);
const content = z.string().trim().min(1).max(100_000);

export function registerConversationEndpoints(
  router: IpcRouter,
  engine: ConversationController,
): void {
  router.register({
    channel: IPC_CHANNELS.conversationList,
    requestSchema: z.object({}).strict(),
    handle: () => engine.list(),
  });
  router.register({
    channel: IPC_CHANNELS.conversationCreate,
    requestSchema: z.object({ title: title.optional() }).strict(),
    handle: (request) => engine.create(request.title),
  });
  router.register({
    channel: IPC_CHANNELS.conversationGet,
    requestSchema: z.object({ conversationId: id }).strict(),
    handle: (request) => engine.get(request.conversationId),
  });
  router.register({
    channel: IPC_CHANNELS.conversationRename,
    requestSchema: z.object({ conversationId: id, title }).strict(),
    handle: (request) => engine.rename(request.conversationId, request.title),
  });
  router.register({
    channel: IPC_CHANNELS.conversationDelete,
    requestSchema: z.object({ conversationId: id }).strict(),
    handle: (request) => {
      engine.delete(request.conversationId);
      return { deleted: true } as const;
    },
  });
  router.register({
    channel: IPC_CHANNELS.conversationSearch,
    requestSchema: z.object({ query: z.string().trim().max(200) }).strict(),
    handle: (request) => engine.search(request.query),
  });
  router.register({
    channel: IPC_CHANNELS.conversationSend,
    requestSchema: z.object({ conversationId: id, content }).strict(),
    requiredPermission: PERMISSIONS.network,
    handle: (request, context) =>
      engine.send(request.conversationId, request.content, (event) =>
        context.emit(IPC_EVENTS.generation, event),
      ),
  });
  router.register({
    channel: IPC_CHANNELS.conversationEdit,
    requestSchema: z.object({ conversationId: id, messageId: id, content }).strict(),
    requiredPermission: PERMISSIONS.network,
    handle: (request, context) =>
      engine.edit(request.conversationId, request.messageId, request.content, (event) =>
        context.emit(IPC_EVENTS.generation, event),
      ),
  });
  router.register({
    channel: IPC_CHANNELS.conversationRegenerate,
    requestSchema: z.object({ conversationId: id, assistantMessageId: id }).strict(),
    requiredPermission: PERMISSIONS.network,
    handle: (request, context) =>
      engine.regenerate(request.conversationId, request.assistantMessageId, (event) =>
        context.emit(IPC_EVENTS.generation, event),
      ),
  });
  router.register({
    channel: IPC_CHANNELS.conversationCancel,
    requestSchema: z.object({ generationId: id }).strict(),
    handle: (request) => ({ cancelled: engine.cancel(request.generationId) }),
  });
  router.register({
    channel: IPC_CHANNELS.conversationExport,
    requestSchema: z.object({ conversationId: id, format: z.enum(['markdown', 'json']) }).strict(),
    handle: (request) => engine.export(request.conversationId, request.format),
  });
}
