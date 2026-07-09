// @vitest-environment node

import type {
  ConversationDetail,
  ConversationMessage,
  GenerationEvent,
} from '../../src/shared/conversation/contracts';
import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
  IPC_EVENTS,
} from '../../src/shared/platform/ipc';
import { PERMISSIONS } from '../../src/shared/platform/permissions';
import type { ConversationController } from '../../src/main/conversation/ipc/conversation.endpoints';
import { registerConversationEndpoints } from '../../src/main/conversation/ipc/conversation.endpoints';
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
const detail: ConversationDetail = {
  id: 'conversation',
  title: 'Chat',
  createdAt: timestamp,
  updatedAt: timestamp,
  messageCount: 0,
  preview: '',
  messages: [],
};
const user: ConversationMessage = {
  id: 'user',
  conversationId: detail.id,
  role: 'user',
  content: 'Hello',
  status: 'complete',
  createdAt: timestamp,
  updatedAt: timestamp,
};
const assistant: ConversationMessage = {
  ...user,
  id: 'assistant',
  role: 'assistant',
  content: '',
  status: 'streaming',
};

describe('conversation IPC endpoints', () => {
  it('registers only allow-listed endpoints and emits only allow-listed events', async () => {
    const adapter = new Adapter();
    const permissions = new PermissionManager(new Map([[PERMISSIONS.network, 'allow']]));
    const router = new IpcRouter(
      adapter,
      ALLOWED_IPC_CHANNELS,
      ALLOWED_IPC_EVENTS,
      [createPermissionMiddleware(permissions)],
      logger,
      () => 'request-id',
    );
    const send: ConversationController['send'] = (_conversationId, _content, sink) => {
      const event: GenerationEvent = {
        type: 'delta',
        generationId: 'generation',
        conversationId: detail.id,
        messageId: assistant.id,
        delta: 'Hi',
      };
      sink(event);
      return {
        generationId: 'generation',
        conversationId: detail.id,
        userMessage: user,
        assistantMessage: assistant,
      };
    };
    const edit: ConversationController['edit'] = (_conversationId, _messageId, _content, sink) => {
      sink({
        type: 'delta',
        generationId: 'generation',
        conversationId: detail.id,
        messageId: assistant.id,
        delta: 'Edited',
      });
      return {
        generationId: 'generation',
        conversationId: detail.id,
        userMessage: user,
        assistantMessage: assistant,
      };
    };
    const regenerate: ConversationController['regenerate'] = (
      _conversationId,
      _assistantMessageId,
      sink,
    ) => {
      sink({
        type: 'delta',
        generationId: 'generation',
        conversationId: detail.id,
        messageId: assistant.id,
        delta: 'Regenerated',
      });
      return {
        generationId: 'generation',
        conversationId: detail.id,
        userMessage: user,
        assistantMessage: assistant,
      };
    };
    const controller: ConversationController = {
      list: vi.fn(() => [detail]),
      create: vi.fn(() => detail),
      get: vi.fn(() => detail),
      rename: vi.fn(() => detail),
      delete: vi.fn(),
      search: vi.fn(() => [detail]),
      send: vi.fn(send),
      edit: vi.fn(edit),
      regenerate: vi.fn(regenerate),
      cancel: vi.fn(() => true),
      export: vi.fn(() => ({
        filename: 'chat.md',
        mimeType: 'text/markdown' as const,
        content: '# Chat',
      })),
    };
    registerConversationEndpoints(router, controller);
    expect(adapter.handlers.size).toBe(11);

    const sent = vi.fn();
    const handler = adapter.handlers.get(IPC_CHANNELS.conversationSend);
    const result = await handler?.(
      { senderUrl: 'file:///app', send: sent },
      { conversationId: detail.id, content: 'Hello' },
    );
    expect(result).toMatchObject({ ok: true });
    expect(sent).toHaveBeenCalledWith(
      IPC_EVENTS.generation,
      expect.objectContaining({ type: 'delta', delta: 'Hi' }),
    );

    const invoke = (channel: string, payload: unknown) =>
      adapter.handlers.get(channel)?.({ senderUrl: 'file:///app', send: sent }, payload);
    await invoke(IPC_CHANNELS.conversationList, {});
    await invoke(IPC_CHANNELS.conversationCreate, { title: 'Created' });
    await invoke(IPC_CHANNELS.conversationGet, { conversationId: detail.id });
    await invoke(IPC_CHANNELS.conversationRename, {
      conversationId: detail.id,
      title: 'Renamed',
    });
    await invoke(IPC_CHANNELS.conversationDelete, { conversationId: detail.id });
    await invoke(IPC_CHANNELS.conversationSearch, { query: 'Chat' });
    await invoke(IPC_CHANNELS.conversationEdit, {
      conversationId: detail.id,
      messageId: user.id,
      content: 'Edited',
    });
    await invoke(IPC_CHANNELS.conversationRegenerate, {
      conversationId: detail.id,
      assistantMessageId: assistant.id,
    });
    await invoke(IPC_CHANNELS.conversationCancel, { generationId: 'generation' });
    await invoke(IPC_CHANNELS.conversationExport, {
      conversationId: detail.id,
      format: 'markdown',
    });
    expect(controller.delete).toHaveBeenCalledWith(detail.id);
    expect(controller.cancel).toHaveBeenCalledWith('generation');

    const invalid = await handler?.(
      { senderUrl: 'file:///app', send: sent },
      { conversationId: detail.id, content: '' },
    );
    expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    router.dispose();
  });
});
