import type { AppConfig } from './config/configuration';
import { createServiceToken } from './di/service-container';
import type { IpcRouter } from './ipc/ipc-router';
import type { Logger } from './logging/logger';
import type { PermissionManager } from './permissions/permission-manager';

export const PLATFORM_TOKENS = Object.freeze({
  config: createServiceToken<AppConfig>('AppConfig'),
  ipcRouter: createServiceToken<IpcRouter>('IpcRouter'),
  logger: createServiceToken<Logger>('Logger'),
  permissionManager: createServiceToken<PermissionManager>('PermissionManager'),
});
