import type { IpcResult } from '../../src/shared/platform/errors';
import { IPC_CHANNELS, type RuntimeInfo } from '../../src/shared/platform/ipc';
import { PERMISSIONS } from '../../src/shared/platform/permissions';
import { bootstrapPlatform } from '../../src/main/platform/bootstrap';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { ConsoleSink } from '../../src/main/platform/logging/logger';
import { PLATFORM_TOKENS } from '../../src/main/platform/tokens';
import { SERVICE_TOKENS } from '../../src/main/services/tokens';

class Adapter implements IpcMainAdapter {
  public readonly handlers = new Map<string, IpcListener>();
  public handle(channel: string, listener: IpcListener): void {
    this.handlers.set(channel, listener);
  }
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

function silentConsole(): ConsoleSink {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('platform bootstrap', () => {
  it('composes secure infrastructure without binding future services', async () => {
    const adapter = new Adapter();
    const runtime = bootstrapPlatform({
      environment: { NODE_ENV: 'test', JARVIS_IPC_RATE_LIMIT: '5' },
      ipcAdapter: adapter,
      runtimeInfo: {
        appVersion: '0.2.0',
        electronVersion: '42.6.0',
        processPlatform: 'win32',
      },
      isTrustedSender: (url) => url.startsWith('file:'),
      consoleSink: silentConsole(),
      requestIdFactory: () => 'bootstrap-request',
      permissionPolicy: new Map([[PERMISSIONS.network, 'allow']]),
    });

    expect(runtime.services.resolve(PLATFORM_TOKENS.config).environment).toBe('test');
    expect(runtime.services.has(PLATFORM_TOKENS.logger)).toBe(true);
    expect(runtime.services.has(PLATFORM_TOKENS.permissionManager)).toBe(true);
    expect(runtime.services.has(PLATFORM_TOKENS.ipcRouter)).toBe(true);
    expect(runtime.services.has(SERVICE_TOKENS.aiProvider)).toBe(false);
    expect(runtime.services.has(SERVICE_TOKENS.persistence)).toBe(false);
    expect(runtime.services.has(SERVICE_TOKENS.voice)).toBe(false);

    const handler = adapter.handlers.get(IPC_CHANNELS.runtimeInfo);
    expect(handler).toBeDefined();
    const response = (await handler?.(
      { senderUrl: 'file:///app/index.html', send: vi.fn() },
      {},
    )) as IpcResult<RuntimeInfo>;
    expect(response).toEqual({
      ok: true,
      data: { appVersion: '0.2.0', electronVersion: '42.6.0', platform: 'windows' },
    });

    await expect(
      runtime.services.resolve(PLATFORM_TOKENS.permissionManager).assertAllowed({
        permission: PERMISSIONS.fileAccess,
        reason: 'default deny verification',
      }),
    ).rejects.toBeDefined();
    await expect(
      runtime.services.resolve(PLATFORM_TOKENS.permissionManager).assertAllowed({
        permission: PERMISSIONS.network,
        reason: 'Gemini provider access',
      }),
    ).resolves.toBeUndefined();

    runtime.dispose();
    expect(adapter.handlers.size).toBe(0);
  });

  it('rejects untrusted endpoint invocations', async () => {
    const adapter = new Adapter();
    const runtime = bootstrapPlatform({
      environment: {},
      ipcAdapter: adapter,
      runtimeInfo: { appVersion: '1', electronVersion: '42', processPlatform: 'linux' },
      isTrustedSender: () => false,
      consoleSink: silentConsole(),
      requestIdFactory: () => 'id',
    });
    const handler = adapter.handlers.get(IPC_CHANNELS.runtimeInfo);
    const response = (await handler?.(
      { senderUrl: 'https://evil.test', send: vi.fn() },
      {},
    )) as IpcResult<RuntimeInfo>;
    expect(response.ok).toBe(false);
    runtime.dispose();
  });

  it('supports production defaults for console logging and request identifiers', async () => {
    const adapter = new Adapter();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const runtime = bootstrapPlatform({
      environment: {},
      ipcAdapter: adapter,
      runtimeInfo: { appVersion: '1', electronVersion: '42', processPlatform: 'linux' },
      isTrustedSender: () => true,
    });
    const handler = adapter.handlers.get(IPC_CHANNELS.runtimeInfo);
    const response = (await handler?.(
      { senderUrl: 'file:///app', send: vi.fn() },
      {},
    )) as IpcResult<RuntimeInfo>;
    expect(response.ok).toBe(true);
    expect(info).toHaveBeenCalled();
    runtime.dispose();
    info.mockRestore();
    debug.mockRestore();
  });
});
// @vitest-environment node
