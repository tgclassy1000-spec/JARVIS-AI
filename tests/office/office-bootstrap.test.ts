// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SERVICE_TOKENS } from '../../src/main/services/tokens';
import type {
  AIProvider,
  ChatSession,
  StreamChunk,
  StreamResponse,
} from '../../src/main/conversation/provider/contracts';
import { bootstrapOffice } from '../../src/main/office/bootstrap';
import { ServiceContainer } from '../../src/main/platform/di/service-container';
import type { IpcEndpoint, IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import type { Logger } from '../../src/main/platform/logging/logger';
import type { IpcChannel } from '../../src/shared/platform/ipc';

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child() {
    return this;
  },
};

class RouterStub {
  public readonly endpoints: string[] = [];
  public register<C extends IpcChannel>(endpoint: IpcEndpoint<C>): void {
    this.endpoints.push(endpoint.channel);
  }
}

class MockStream implements StreamResponse {
  public cancel(): void {
    return undefined;
  }
  public [Symbol.asyncIterator](): AsyncIterator<StreamChunk> {
    let emitted = false;
    return {
      next: () => {
        if (emitted) return Promise.resolve({ done: true, value: undefined });
        emitted = true;
        return Promise.resolve({
          done: false,
          value: { text: '{"kind":"create-task","title":"Boot AI"}' },
        });
      },
    };
  }
}

describe('bootstrapOffice', () => {
  it('registers the manager, endpoints and disposes cleanly', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-office-bootstrap-'));
    const router = new RouterStub();
    const services = new ServiceContainer();
    const session: ChatSession = { stream: () => new MockStream() };
    const provider: AIProvider = {
      id: 'mock',
      model: 'mock',
      tokenEstimator: { estimate: () => Promise.resolve(1) },
      createSession: () => session,
    };
    services.registerValue(SERVICE_TOKENS.aiProvider, provider);
    const runtime = bootstrapOffice({
      databasePath: join(directory, 'office.sqlite'),
      logger,
      router: router as unknown as IpcRouter,
      services,
    });
    expect(router.endpoints).toHaveLength(22);
    expect(services.resolve(SERVICE_TOKENS.office)).toBe(runtime.manager);
    expect(runtime.manager.createTask({ title: 'Bootstrap task' }).title).toBe('Bootstrap task');
    return runtime.manager
      .quickAdd({ text: 'Bootstrap AI task' })
      .then((result) => {
        expect(result.action.kind).toBe('create-task');
        runtime.dispose();
        rmSync(directory, { recursive: true, force: true });
      })
      .catch((error: unknown) => {
        runtime.dispose();
        rmSync(directory, { recursive: true, force: true });
        throw error;
      });
  });
});
