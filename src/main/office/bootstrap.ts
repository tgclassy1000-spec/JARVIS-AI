import type { ConversationEngine } from '../conversation/engine/conversation-engine';
import type { MemoryManager } from '../memory/manager/memory-manager';
import type { ServiceContainer } from '../platform/di/service-container';
import type { IpcRouter } from '../platform/ipc/ipc-router';
import type { Logger } from '../platform/logging/logger';
import { SERVICE_TOKENS } from '../services/tokens';
import { registerOfficeEndpoints } from './ipc/office.endpoints';
import { OfficeManager } from './manager/office-manager';
import { OfficeCommandInterpreter } from './natural-language/office-command-interpreter';
import { SqliteOfficeRepository } from './persistence/sqlite-office-repository';

export interface OfficeBootstrapOptions {
  readonly databasePath: string;
  readonly logger: Logger;
  readonly router: IpcRouter;
  readonly services: ServiceContainer;
  readonly conversations?: ConversationEngine;
  readonly memories?: MemoryManager;
}

export interface OfficeRuntime {
  readonly manager: OfficeManager;
  dispose(): void;
}

export function bootstrapOffice(options: OfficeBootstrapOptions): OfficeRuntime {
  const logger = options.logger.child({ subsystem: 'office' });
  const repository = new SqliteOfficeRepository(options.databasePath);
  const interpreter = new OfficeCommandInterpreter(() =>
    options.services.resolve(SERVICE_TOKENS.aiProvider),
  );
  const manager = new OfficeManager(
    repository,
    interpreter,
    options.conversations,
    options.memories,
  );
  options.services.registerValue(SERVICE_TOKENS.office, manager);
  registerOfficeEndpoints(options.router, manager);
  logger.info('Office productivity platform initialized.', {
    schemaVersion: repository.schemaVersion(),
  });
  return Object.freeze({ manager, dispose: () => manager.close() });
}
