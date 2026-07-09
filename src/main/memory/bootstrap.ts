import type { ServiceContainer } from '../platform/di/service-container';
import type { IpcRouter } from '../platform/ipc/ipc-router';
import type { Logger } from '../platform/logging/logger';
import { SERVICE_TOKENS } from '../services/tokens';
import { ManagedConversationMemory } from './conversation-memory';
import { GeminiMemoryExtractor } from './extraction/memory-extractor';
import { registerMemoryEndpoints } from './ipc/memory.endpoints';
import { MemoryManager } from './manager/memory-manager';
import { SqliteMemoryRepository } from './persistence/sqlite-memory-repository';
import { ShortTermMemory } from './short-term-memory';

export interface MemoryBootstrapOptions {
  readonly databasePath: string;
  readonly logger: Logger;
  readonly router: IpcRouter;
  readonly services: ServiceContainer;
}

export interface MemoryRuntime {
  readonly manager: MemoryManager;
  readonly conversationMemory: ManagedConversationMemory;
  readonly shortTerm: ShortTermMemory;
  dispose(): void;
}

export function bootstrapMemory(options: MemoryBootstrapOptions): MemoryRuntime {
  const logger = options.logger.child({ subsystem: 'memory' });
  const repository = new SqliteMemoryRepository(options.databasePath);
  const manager = new MemoryManager(repository);
  const extractor = new GeminiMemoryExtractor(() =>
    options.services.resolve(SERVICE_TOKENS.aiProvider),
  );
  const conversationMemory = new ManagedConversationMemory(manager, extractor, logger);
  const shortTerm = new ShortTermMemory();
  options.services.registerValue(SERVICE_TOKENS.memory, manager);
  registerMemoryEndpoints(options.router, manager);
  logger.info('Personal memory system initialized.', {
    schemaVersion: repository.schemaVersion(),
    enabled: manager.settings().enabled,
  });
  return Object.freeze({
    manager,
    conversationMemory,
    shortTerm,
    dispose: () => {
      shortTerm.clear();
      manager.close();
    },
  });
}
