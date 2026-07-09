// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bootstrapDocuments } from '../../src/main/documents/bootstrap';
import { SERVICE_TOKENS } from '../../src/main/services/tokens';
import type {
  AIProvider,
  ChatSession,
  StreamChunk,
  StreamResponse,
} from '../../src/main/conversation/provider/contracts';
import { ServiceContainer } from '../../src/main/platform/di/service-container';
import type { IpcEndpoint, IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import type { Logger } from '../../src/main/platform/logging/logger';
import type { IpcChannel } from '../../src/shared/platform/ipc';

class RouterStub {
  public readonly endpoints: string[] = [];
  public register<C extends IpcChannel>(endpoint: IpcEndpoint<C>): void {
    this.endpoints.push(endpoint.channel);
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

class BootstrapStream implements StreamResponse {
  public cancel(): void {
    return undefined;
  }

  public [Symbol.asyncIterator](): AsyncIterator<StreamChunk> {
    let emitted = false;
    return {
      next: () => {
        if (emitted) return Promise.resolve({ done: true, value: undefined });
        emitted = true;
        return Promise.resolve({ done: false, value: { text: 'Bootstrap AI summary' } });
      },
    };
  }
}

function bootstrapProvider(): AIProvider {
  const session: ChatSession = { stream: () => new BootstrapStream() };
  return {
    id: 'bootstrap',
    model: 'bootstrap',
    tokenEstimator: { estimate: () => Promise.resolve(1) },
    createSession: () => session,
  };
}

describe('bootstrapDocuments', () => {
  it('registers service and IPC endpoints', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-doc-bootstrap-'));
    const services = new ServiceContainer();
    services.registerValue(SERVICE_TOKENS.aiProvider, bootstrapProvider());
    const router = new RouterStub();
    const runtime = bootstrapDocuments({
      databasePath: join(directory, 'documents.sqlite'),
      logger,
      router: router as unknown as IpcRouter,
      services,
    });
    expect(router.endpoints).toHaveLength(8);
    expect(services.resolve(SERVICE_TOKENS.documents)).toBe(runtime.service);
    expect(runtime.service.dashboard().totalDocuments).toBe(0);
    const detail = await runtime.service.importBuffer(
      join(directory, 'brief.txt'),
      new TextEncoder().encode('Bootstrap document content.'),
      'txt',
    );
    await expect(
      runtime.service.analyze({ documentId: detail.id, action: 'summarize' }),
    ).resolves.toMatchObject({ content: 'Bootstrap AI summary' });
    runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  });
});
