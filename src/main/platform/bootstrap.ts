import { randomUUID } from 'node:crypto';

import { ALLOWED_IPC_CHANNELS, ALLOWED_IPC_EVENTS } from '../../shared/platform/ipc';
import {
  PERMISSIONS,
  type Permission,
  type PermissionDecision,
} from '../../shared/platform/permissions';
import { ConfigurationManager } from './config/configuration';
import { ServiceContainer } from './di/service-container';
import { IpcRouter } from './ipc/ipc-router';
import { createPermissionMiddleware, createSecurityMiddleware } from './ipc/middleware';
import { createRuntimeEndpoint, type RuntimeInfoProvider } from './ipc/runtime.endpoint';
import type { IpcMainAdapter } from './ipc/types';
import {
  ConsoleLogTransport,
  StructuredLogger,
  type ConsoleSink,
  type LogTransport,
} from './logging/logger';
import { PermissionManager } from './permissions/permission-manager';
import { PLATFORM_TOKENS } from './tokens';

export interface PlatformBootstrapOptions {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly ipcAdapter: IpcMainAdapter;
  readonly runtimeInfo: RuntimeInfoProvider;
  readonly isTrustedSender: (url: string) => boolean;
  readonly consoleSink?: ConsoleSink;
  readonly logTransports?: readonly LogTransport[];
  readonly requestIdFactory?: () => string;
  readonly permissionPolicy?: ReadonlyMap<Permission, PermissionDecision>;
}

export interface PlatformRuntime {
  readonly services: ServiceContainer;
  readonly configuration: ConfigurationManager;
  dispose(): void;
}

function createDefaultPermissionPolicy(
  overrides?: ReadonlyMap<Permission, PermissionDecision>,
): ReadonlyMap<Permission, PermissionDecision> {
  return new Map(
    Object.values(PERMISSIONS).map((permission) => [
      permission,
      overrides?.get(permission) ?? 'deny',
    ]),
  );
}

export function bootstrapPlatform(options: PlatformBootstrapOptions): PlatformRuntime {
  const configuration = ConfigurationManager.fromEnvironment(options.environment);
  const config = configuration.value;
  const logger = new StructuredLogger(
    config.logging.level,
    [new ConsoleLogTransport(options.consoleSink), ...(options.logTransports ?? [])],
    { process: 'main' },
  );
  const permissionManager = new PermissionManager(
    createDefaultPermissionPolicy(options.permissionPolicy),
  );
  const router = new IpcRouter(
    options.ipcAdapter,
    ALLOWED_IPC_CHANNELS,
    ALLOWED_IPC_EVENTS,
    [
      createSecurityMiddleware({
        isTrustedSender: options.isTrustedSender,
        maxRequestBytes: config.ipc.maxRequestBytes,
        rateLimitPerMinute: config.ipc.rateLimitPerMinute,
      }),
      createPermissionMiddleware(permissionManager),
    ],
    logger.child({ subsystem: 'ipc' }),
    options.requestIdFactory ?? randomUUID,
  );

  router.register(createRuntimeEndpoint(options.runtimeInfo));

  const services = new ServiceContainer();
  services.registerValue(PLATFORM_TOKENS.config, config);
  services.registerValue(PLATFORM_TOKENS.logger, logger);
  services.registerValue(PLATFORM_TOKENS.permissionManager, permissionManager);
  services.registerValue(PLATFORM_TOKENS.ipcRouter, router);

  logger.info('Secure platform initialized.');

  return Object.freeze({
    services,
    configuration,
    dispose: () => router.dispose(),
  });
}
