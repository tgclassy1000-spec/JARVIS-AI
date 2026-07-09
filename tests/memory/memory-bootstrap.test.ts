// @vitest-environment node

import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
} from '../../src/shared/platform/ipc';
import { bootstrapMemory } from '../../src/main/memory/bootstrap';
import { ServiceContainer } from '../../src/main/platform/di/service-container';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';
import { SERVICE_TOKENS } from '../../src/main/services/tokens';
import type { AIProvider, StreamResponse } from '../../src/main/conversation/provider/contracts';
import { HeuristicTokenEstimator } from '../../src/main/conversation/provider/token-estimator';

class Adapter implements IpcMainAdapter {
  readonly handlers = new Map<string, IpcListener>();
  handle(channel: string, listener: IpcListener): void {
    this.handlers.set(channel, listener);
  }
  removeHandler(channel: string): void {
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

describe('memory bootstrap', () => {
  it('registers memory services and endpoints and disposes both memory tiers', async () => {
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
    const provider: AIProvider = {
      id: 'mock',
      model: 'mock',
      tokenEstimator: new HeuristicTokenEstimator(),
      createSession: () => ({
        stream: (): StreamResponse => ({
          cancel: vi.fn(),
          async *[Symbol.asyncIterator]() {
            await Promise.resolve();
            yield { text: '{"memories":[]}' };
          },
        }),
      }),
    };
    services.registerValue(SERVICE_TOKENS.aiProvider, provider);
    const runtime = bootstrapMemory({ databasePath: ':memory:', logger, router, services });
    expect(services.resolve(SERVICE_TOKENS.memory)).toBe(runtime.manager);
    expect(adapter.handlers.has(IPC_CHANNELS.memorySearch)).toBe(true);
    runtime.shortTerm.set('draft', 'value', 1_000);
    await runtime.conversationMemory.extract('I prefer concise answers', 'chat');
    runtime.dispose();
    expect(runtime.shortTerm.get('draft')).toBeUndefined();
    router.dispose();
  });
});
