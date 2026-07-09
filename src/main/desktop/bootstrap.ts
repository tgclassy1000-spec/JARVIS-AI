import type { ServiceContainer } from '../platform/di/service-container';
import type { IpcRouter } from '../platform/ipc/ipc-router';
import type { Logger } from '../platform/logging/logger';
import { SERVICE_TOKENS } from '../services/tokens';
import { registerDesktopEndpoints } from './ipc/desktop.endpoints';
import { ElectronDesktopHost } from './service/electron-desktop-host';
import {
  DesktopAutomationService,
  type DesktopAutomationHost,
} from './service/desktop-automation-service';

export interface DesktopBootstrapOptions {
  readonly logger: Logger;
  readonly router: IpcRouter;
  readonly services: ServiceContainer;
  readonly homeDirectory: string;
  readonly downloadsPath: string;
  readonly documentsPath: string;
  readonly desktopPath: string;
  readonly host?: DesktopAutomationHost;
}

export interface DesktopRuntime {
  readonly service: DesktopAutomationService;
  dispose(): void;
}

export function bootstrapDesktop(options: DesktopBootstrapOptions): DesktopRuntime {
  const logger = options.logger.child({ subsystem: 'desktop' });
  const service = new DesktopAutomationService({
    host: options.host ?? new ElectronDesktopHost(),
    homeDirectory: options.homeDirectory,
    allowedRoots: [options.downloadsPath, options.documentsPath, options.desktopPath],
    downloadsPath: options.downloadsPath,
    documentsPath: options.documentsPath,
    desktopPath: options.desktopPath,
  });
  options.services.registerValue(SERVICE_TOKENS.desktopAutomation, service);
  registerDesktopEndpoints(options.router, service);
  logger.info('Permission-first desktop automation initialized.', {
    allowedApplications: service.allowedApplications().map((app) => app.id),
  });
  return Object.freeze({ service, dispose: () => undefined });
}
