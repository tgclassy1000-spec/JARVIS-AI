import type { ServiceContainer } from '../platform/di/service-container';
import type { IpcRouter } from '../platform/ipc/ipc-router';
import type { Logger } from '../platform/logging/logger';
import { SERVICE_TOKENS } from '../services/tokens';
import { registerPluginEndpoints } from './ipc/plugin.endpoints';
import { PluginManager, type PluginManagerOptions } from './service/plugin-manager';

export interface PluginBootstrapOptions {
  readonly appVersion: string;
  readonly logger: Logger;
  readonly router: IpcRouter;
  readonly services: ServiceContainer;
  readonly registry?: PluginManagerOptions['registry'];
}

export interface PluginRuntime {
  readonly manager: PluginManager;
  dispose(): void;
}

export function bootstrapPlugins(options: PluginBootstrapOptions): PluginRuntime {
  const logger = options.logger.child({ subsystem: 'plugins' });
  const manager = new PluginManager({
    appVersion: options.appVersion,
    registry: options.registry,
  });
  options.services.registerValue(SERVICE_TOKENS.plugins, manager);
  registerPluginEndpoints(options.router, manager);
  logger.info('AI skills and plugin platform initialized.', {
    registryPlugins: manager.registry().map((plugin) => plugin.id),
  });
  return Object.freeze({ manager, dispose: () => undefined });
}
