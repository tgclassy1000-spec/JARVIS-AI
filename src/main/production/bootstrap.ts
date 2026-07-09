import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { AppConfig } from '../platform/config/configuration';
import type { ServiceContainer } from '../platform/di/service-container';
import type { IpcRouter } from '../platform/ipc/ipc-router';
import type { Logger } from '../platform/logging/logger';
import { SERVICE_TOKENS } from '../services/tokens';
import { ALLOWED_IPC_CHANNELS } from '../../shared/platform/ipc';
import { CrashRecoveryService, type CrashAwareWindow } from './crash/crash-recovery-service';
import { DatabaseProtectionService } from './data/database-protection-service';
import { EncryptedCredentialVault, SensitiveDataProtector } from './data/sensitive-data-protector';
import { DiagnosticsService } from './diagnostics/diagnostics-service';
import { registerProductionEndpoints } from './ipc/production.endpoints';
import { PerformanceMonitor } from './performance/performance-monitor';
import { SecurityAuditService } from './security/security-audit-service';
import { ProductionHardeningService } from './service/production-hardening-service';

export interface ProductionBootstrapOptions {
  readonly appVersion: string;
  readonly config: AppConfig;
  readonly userDataPath: string;
  readonly databasePaths: readonly string[];
  readonly projectRoot: string;
  readonly logger: Logger;
  readonly router: IpcRouter;
  readonly services: ServiceContainer;
  readonly restart?: () => void;
}

export interface ProductionRuntime {
  readonly service: ProductionHardeningService;
  attachWindow(window: CrashAwareWindow): void;
  dispose(): void;
}

export function bootstrapProduction(options: ProductionBootstrapOptions): ProductionRuntime {
  const logger = options.logger.child({ subsystem: 'production' });
  const productionDirectory = join(options.userDataPath, 'production');
  const crashDirectory = join(productionDirectory, 'crash-reports');
  const backupDirectory = join(productionDirectory, 'backups');
  const logDirectory = join(productionDirectory, 'logs');
  mkdirSync(crashDirectory, { recursive: true });
  mkdirSync(backupDirectory, { recursive: true });
  mkdirSync(logDirectory, { recursive: true });

  const crashRecovery = new CrashRecoveryService({
    reportDirectory: crashDirectory,
    appVersion: options.appVersion,
    restart: options.restart,
    logger,
  });
  crashRecovery.installGlobalHandlers();

  const dataProtection = new DatabaseProtectionService({
    databasePaths: options.databasePaths,
    backupDirectory,
  });
  const protector = new SensitiveDataProtector({
    applicationSecret: `jarvis:${options.appVersion}`,
    machineSecret: options.userDataPath,
  });
  const credentialVault = new EncryptedCredentialVault(protector);
  const performance = new PerformanceMonitor({
    leakThresholdBytes: options.config.production.leakThresholdBytes,
    logger,
  });
  performance.markStartup('production-bootstrap');
  performance.scheduleTask({
    id: 'database-integrity-watch',
    intervalMs: 15 * 60_000,
    run: () => {
      dataProtection.checkIntegrity();
    },
  });
  const securityAudit = new SecurityAuditService({
    projectRoot: options.projectRoot,
    cspHtmlPath: join(options.projectRoot, 'src', 'renderer', 'index.html'),
    allowedIpcChannels: ALLOWED_IPC_CHANNELS,
  });
  const diagnostics = new DiagnosticsService({
    logDirectory,
    crashRecovery,
    dataProtection,
    performance,
    securityAudit,
  });
  const service = new ProductionHardeningService({
    crashRecovery,
    dataProtection,
    credentialVault,
    diagnostics,
    performance,
    securityAudit,
    debugMode: options.config.production.debugMode,
  });

  options.services.registerValue(SERVICE_TOKENS.production, service);
  registerProductionEndpoints(options.router, service);
  logger.info('Production hardening initialized.', {
    databaseCount: options.databasePaths.length,
    debugMode: options.config.production.debugMode,
  });

  return Object.freeze({
    service,
    attachWindow: (window: CrashAwareWindow) => service.attachWindow(window),
    dispose: () => service.dispose(),
  });
}
