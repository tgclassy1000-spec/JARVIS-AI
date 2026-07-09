import type { AppConfig } from '../platform/config/configuration';
import type { ServiceContainer } from '../platform/di/service-container';
import type { IpcRouter } from '../platform/ipc/ipc-router';
import type { Logger } from '../platform/logging/logger';
import { SERVICE_TOKENS } from '../services/tokens';
import { registerWebEndpoints } from './ipc/web.endpoints';
import { SqliteWebRepository } from './persistence/sqlite-web-repository';
import { createDefaultWebProviders } from './providers/default-providers';
import type { WebProviders } from './providers/contracts';
import { WebIntelligenceService } from './service/web-intelligence-service';

export interface WebBootstrapOptions {
  readonly config: AppConfig;
  readonly databasePath: string;
  readonly logger: Logger;
  readonly router: IpcRouter;
  readonly services: ServiceContainer;
  readonly providers?: WebProviders;
}

export interface WebRuntime {
  readonly service: WebIntelligenceService;
  dispose(): void;
}

export function bootstrapWeb(options: WebBootstrapOptions): WebRuntime {
  const logger = options.logger.child({ subsystem: 'web' });
  const repository = new SqliteWebRepository(options.databasePath);
  const providers =
    options.providers ??
    createDefaultWebProviders({
      timeoutMs: options.config.web.timeoutMs,
      maxAttempts: options.config.web.maxAttempts,
    });
  const service = new WebIntelligenceService({
    repository,
    providers,
    cacheTtlMs: options.config.web.cacheTtlMs,
    rateLimitPerMinute: options.config.web.rateLimitPerMinute,
    aiProvider: () => options.services.resolve(SERVICE_TOKENS.aiProvider),
  });
  options.services.registerValue(SERVICE_TOKENS.web, service);
  registerWebEndpoints(options.router, service);
  logger.info('Web intelligence platform initialized.', {
    schemaVersion: repository.schemaVersion(),
    providers: {
      search: providers.search.id,
      weather: providers.weather.id,
      news: providers.news.id,
      currency: providers.currency.id,
      maps: providers.maps.id,
      time: providers.time.id,
      knowledge: providers.knowledge.id,
    },
  });
  return Object.freeze({ service, dispose: () => service.close() });
}
