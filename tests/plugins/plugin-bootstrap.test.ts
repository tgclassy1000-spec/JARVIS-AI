// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { bootstrapPlugins } from '../../src/main/plugins/bootstrap';
import { ServiceContainer } from '../../src/main/platform/di/service-container';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';
import { SERVICE_TOKENS } from '../../src/main/services/tokens';
import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
} from '../../src/shared/platform/ipc';

class Adapter implements IpcMainAdapter {
  public readonly handlers = new Map<string, IpcListener>();
  public handle(channel: string, listener: IpcListener): void {
    this.handlers.set(channel, listener);
  }
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
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

describe('plugin bootstrap', () => {
  it('registers the plugin manager service and IPC endpoints', () => {
    const adapter = new Adapter();
    const router = new IpcRouter(
      adapter,
      ALLOWED_IPC_CHANNELS,
      ALLOWED_IPC_EVENTS,
      [],
      logger,
      () => 'plugin-bootstrap',
    );
    const services = new ServiceContainer();

    const runtime = bootstrapPlugins({
      appVersion: '0.8.0',
      logger,
      router,
      services,
    });

    expect(services.resolve(SERVICE_TOKENS.plugins)).toBe(runtime.manager);
    expect(adapter.handlers.has(IPC_CHANNELS.pluginDashboard)).toBe(true);
    runtime.dispose();
    router.dispose();
  });
});
