import { z } from 'zod';

import { ERROR_CODES, type IpcResult } from '../../src/shared/platform/errors';
import { IPC_CHANNELS, type RuntimeInfo } from '../../src/shared/platform/ipc';
import { PERMISSIONS } from '../../src/shared/platform/permissions';
import { PlatformError } from '../../src/main/platform/errors/platform-error';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import type {
  IpcEvent,
  IpcListener,
  IpcMainAdapter,
  IpcMiddleware,
} from '../../src/main/platform/ipc/types';
import type { LogContext, Logger } from '../../src/main/platform/logging/logger';

class FakeAdapter implements IpcMainAdapter {
  public readonly listeners = new Map<string, IpcListener>();
  public readonly removed: string[] = [];
  public handle(channel: string, listener: IpcListener): void {
    this.listeners.set(channel, listener);
  }
  public removeHandler(channel: string): void {
    this.removed.push(channel);
    this.listeners.delete(channel);
  }
  public invoke(
    channel: string,
    payload: unknown,
    event: IpcEvent = { senderUrl: 'file:///app', send: vi.fn() },
  ): Promise<unknown> {
    const listener = this.listeners.get(channel);
    if (!listener) throw new Error(`Missing listener: ${channel}`);
    return listener(event, payload);
  }
}

class FakeLogger implements Logger {
  public readonly entries: { level: string; message: string; context?: LogContext }[] = [];
  public debug(message: string, context?: LogContext): void {
    this.entries.push({ level: 'debug', message, context });
  }
  public info(message: string, context?: LogContext): void {
    this.entries.push({ level: 'info', message, context });
  }
  public warn(message: string, context?: LogContext): void {
    this.entries.push({ level: 'warn', message, context });
  }
  public error(message: string, context?: LogContext): void {
    this.entries.push({ level: 'error', message, context });
  }
  public child(): Logger {
    return this;
  }
}

function createRouter(
  middleware: readonly IpcMiddleware[] = [],
  allowedEvents: readonly string[] = [],
) {
  const adapter = new FakeAdapter();
  const logger = new FakeLogger();
  const router = new IpcRouter(
    adapter,
    [IPC_CHANNELS.runtimeInfo],
    allowedEvents,
    middleware,
    logger,
    () => 'request-id',
  );
  return { adapter, logger, router };
}

const runtimeInfo: RuntimeInfo = {
  appVersion: '1.0.0',
  electronVersion: '42',
  platform: 'windows',
};

describe('IpcRouter', () => {
  it('registers typed endpoints and returns result envelopes', async () => {
    const middleware = vi.fn<IpcMiddleware>(async (_context, next) => next());
    const { adapter, logger, router } = createRouter([middleware]);
    router.register({
      channel: IPC_CHANNELS.runtimeInfo,
      requestSchema: z.object({}).strict(),
      handle: (_request, invocation) => ({ ...runtimeInfo, appVersion: invocation.requestId }),
    });

    await expect(adapter.invoke(IPC_CHANNELS.runtimeInfo, {})).resolves.toEqual({
      ok: true,
      data: { ...runtimeInfo, appVersion: 'request-id' },
    });
    expect(middleware).toHaveBeenCalledOnce();
    expect(logger.entries.at(-1)?.level).toBe('debug');
  });

  it('returns safe validation and internal errors', async () => {
    const { adapter, logger, router } = createRouter();
    router.register({
      channel: IPC_CHANNELS.runtimeInfo,
      requestSchema: z.object({}).strict(),
      handle: () => {
        throw new Error('sensitive database failure');
      },
    });

    const validation = (await adapter.invoke(IPC_CHANNELS.runtimeInfo, {
      unexpected: true,
    })) as IpcResult<unknown>;
    expect(validation).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.validationFailed,
        message: 'IPC request validation failed.',
        requestId: 'request-id',
      },
    });

    const internal = (await adapter.invoke(IPC_CHANNELS.runtimeInfo, {})) as IpcResult<unknown>;
    expect(internal).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.internal,
        message: 'An unexpected internal error occurred.',
        requestId: 'request-id',
      },
    });
    expect(JSON.stringify(internal)).not.toContain('database');
    expect(logger.entries.filter((entry) => entry.level === 'error')).toHaveLength(2);
  });

  it('rejects non-allow-listed and duplicate channels', () => {
    const { router } = createRouter();
    const endpoint = {
      channel: IPC_CHANNELS.runtimeInfo,
      requestSchema: z.object({}).strict(),
      handle: () => runtimeInfo,
    } as const;
    router.register(endpoint);
    expect(() => router.register(endpoint)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.ipcDuplicate }),
    );

    const unsafe = new IpcRouter(new FakeAdapter(), [], [], [], new FakeLogger(), () => 'id');
    expect(() => unsafe.register(endpoint)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.ipcNotAllowed }),
    );
  });

  it('disposes every registered handler', () => {
    const { adapter, router } = createRouter();
    router.register({
      channel: IPC_CHANNELS.runtimeInfo,
      requestSchema: z.object({}).strict(),
      handle: () => runtimeInfo,
    });
    router.dispose();
    expect(adapter.listeners.size).toBe(0);
    expect(adapter.removed).toEqual([IPC_CHANNELS.runtimeInfo, IPC_CHANNELS.runtimeInfo]);
  });

  it('preserves structured middleware errors', async () => {
    const schemaTouched = vi.fn();
    const deny: IpcMiddleware = () =>
      Promise.reject(new PlatformError(ERROR_CODES.ipcForbidden, 'Blocked'));
    const { adapter, router } = createRouter([deny]);
    router.register({
      channel: IPC_CHANNELS.runtimeInfo,
      requestSchema: z.preprocess((value) => {
        schemaTouched();
        return value;
      }, z.object({}).strict()),
      handle: () => runtimeInfo,
    });

    await expect(adapter.invoke(IPC_CHANNELS.runtimeInfo, {})).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.ipcForbidden, message: 'Blocked', requestId: 'request-id' },
    });
    expect(schemaTouched).not.toHaveBeenCalled();
  });

  it('carries declared endpoint permissions into middleware context', async () => {
    const observed = vi.fn<IpcMiddleware>((invocation, next) => {
      expect(invocation.requiredPermission).toBe(PERMISSIONS.network);
      return next();
    });
    const { adapter, router } = createRouter([observed]);
    router.register({
      channel: IPC_CHANNELS.runtimeInfo,
      requestSchema: z.object({}).strict(),
      requiredPermission: PERMISSIONS.network,
      handle: () => runtimeInfo,
    });
    await adapter.invoke(IPC_CHANNELS.runtimeInfo, {});
    expect(observed).toHaveBeenCalledOnce();
  });

  it('emits only allow-listed main-to-renderer events', async () => {
    const send = vi.fn();
    const { adapter, router } = createRouter([], ['safe:event']);
    router.register({
      channel: IPC_CHANNELS.runtimeInfo,
      requestSchema: z.object({}).strict(),
      handle: (_request, context) => {
        context.emit('safe:event', { ready: true });
        return runtimeInfo;
      },
    });
    await adapter.invoke(IPC_CHANNELS.runtimeInfo, {}, { senderUrl: 'file:///app', send });
    expect(send).toHaveBeenCalledWith('safe:event', { ready: true });

    const disallowed = createRouter();
    disallowed.router.register({
      channel: IPC_CHANNELS.runtimeInfo,
      requestSchema: z.object({}).strict(),
      handle: (_request, context) => {
        context.emit('unsafe:event', {});
        return runtimeInfo;
      },
    });
    await expect(disallowed.adapter.invoke(IPC_CHANNELS.runtimeInfo, {})).resolves.toMatchObject({
      ok: false,
      error: { code: ERROR_CODES.ipcNotAllowed },
    });
  });
});
// @vitest-environment node
