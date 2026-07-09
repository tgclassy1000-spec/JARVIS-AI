// @vitest-environment node

import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
} from '../../src/shared/platform/ipc';
import { bootstrapConversation } from '../../src/main/conversation/bootstrap';
import { ConfigurationManager } from '../../src/main/platform/config/configuration';
import { ServiceContainer } from '../../src/main/platform/di/service-container';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';
import { SERVICE_TOKENS } from '../../src/main/services/tokens';

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

describe('conversation bootstrap', () => {
  it('registers the provider, engine, and conversation endpoints without exposing secrets', async () => {
    const adapter = new Adapter();
    const router = new IpcRouter(
      adapter,
      ALLOWED_IPC_CHANNELS,
      ALLOWED_IPC_EVENTS,
      [],
      logger,
      () => 'request',
    );
    const services = new ServiceContainer();
    const configuration = ConfigurationManager.fromEnvironment({
      GEMINI_API_KEY: 'main-only-secret',
    });
    const runtime = bootstrapConversation({
      config: configuration.value,
      geminiApiKey: configuration.getGeminiApiKey(),
      databasePath: ':memory:',
      logger,
      router,
      services,
    });

    expect(services.resolve(SERVICE_TOKENS.aiProvider).model).toBe('gemini-2.5-flash');
    expect(JSON.stringify(configuration.value)).not.toContain('main-only-secret');
    const create = adapter.handlers.get(IPC_CHANNELS.conversationCreate);
    const result = await create?.({ senderUrl: 'file:///app', send: vi.fn() }, {});
    expect(result).toMatchObject({ ok: true, data: { title: 'New conversation' } });
    runtime.dispose();
    router.dispose();
  });
});
