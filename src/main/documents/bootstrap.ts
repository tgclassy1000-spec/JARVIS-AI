import type { ServiceContainer } from '../platform/di/service-container';
import type { IpcRouter } from '../platform/ipc/ipc-router';
import type { Logger } from '../platform/logging/logger';
import { SERVICE_TOKENS } from '../services/tokens';
import { registerDocumentEndpoints } from './ipc/document.endpoints';
import { SqliteDocumentRepository } from './persistence/sqlite-document-repository';
import { DocumentService } from './service/document-service';

export interface DocumentBootstrapOptions {
  readonly databasePath: string;
  readonly logger: Logger;
  readonly router: IpcRouter;
  readonly services: ServiceContainer;
}

export interface DocumentRuntime {
  readonly service: DocumentService;
  dispose(): void;
}

export function bootstrapDocuments(options: DocumentBootstrapOptions): DocumentRuntime {
  const logger = options.logger.child({ subsystem: 'documents' });
  const repository = new SqliteDocumentRepository(options.databasePath);
  const service = new DocumentService({
    repository,
    aiProvider: () => options.services.resolve(SERVICE_TOKENS.aiProvider),
  });
  options.services.registerValue(SERVICE_TOKENS.documents, service);
  registerDocumentEndpoints(options.router, service);
  logger.info('Document intelligence platform initialized.', {
    schemaVersion: repository.schemaVersion(),
  });
  return Object.freeze({ service, dispose: () => service.close() });
}
