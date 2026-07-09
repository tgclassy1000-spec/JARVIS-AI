import { ERROR_CODES } from '../../src/shared/platform/errors';
import { PERMISSIONS } from '../../src/shared/platform/permissions';
import { PlatformError } from '../../src/main/platform/errors/platform-error';
import {
  composeMiddleware,
  createPermissionMiddleware,
  createSecurityMiddleware,
} from '../../src/main/platform/ipc/middleware';
import type { IpcInvocationContext, IpcMiddleware } from '../../src/main/platform/ipc/types';
import { PermissionManager } from '../../src/main/platform/permissions/permission-manager';

function context(overrides: Partial<IpcInvocationContext> = {}): IpcInvocationContext {
  return {
    channel: 'test:channel',
    senderUrl: 'file:///trusted/index.html',
    requestId: 'request-1',
    payload: {},
    emit: vi.fn(),
    ...overrides,
  };
}

describe('IPC middleware', () => {
  it('composes middleware in order and rejects repeated next calls', async () => {
    const order: string[] = [];
    const first: IpcMiddleware = async (_invocation, next) => {
      order.push('before');
      const result = await next();
      order.push('after');
      return result;
    };

    await expect(
      composeMiddleware([first], context(), () => {
        order.push('handler');
        return Promise.resolve('complete');
      }),
    ).resolves.toBe('complete');
    expect(order).toEqual(['before', 'handler', 'after']);

    const invalid: IpcMiddleware = async (_invocation, next) => {
      await next();
      return next();
    };
    await expect(
      composeMiddleware([invalid], context(), () => Promise.resolve(undefined)),
    ).rejects.toMatchObject({
      code: ERROR_CODES.internal,
    });
  });

  it('enforces trusted senders and serializable size limits', async () => {
    const middleware = createSecurityMiddleware({
      isTrustedSender: (url) => url.startsWith('file:'),
      maxRequestBytes: 10,
      rateLimitPerMinute: 10,
    });

    await expect(
      middleware(context({ senderUrl: 'https://evil.test' }), () => Promise.resolve(true)),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ipcForbidden,
    });
    await expect(
      middleware(context({ payload: { long: 'content' } }), () => Promise.resolve(true)),
    ).rejects.toMatchObject({
      code: ERROR_CODES.requestTooLarge,
    });

    const circular: { self?: unknown } = {};
    circular.self = circular;
    await expect(
      middleware(context({ payload: circular }), () => Promise.resolve(true)),
    ).rejects.toMatchObject({
      code: ERROR_CODES.validationFailed,
    });
    await expect(
      middleware(context({ payload: undefined }), () => Promise.resolve(true)),
    ).resolves.toBe(true);
  });

  it('rate limits per sender/channel and expires the window', async () => {
    let now = 100_000;
    const middleware = createSecurityMiddleware({
      isTrustedSender: () => true,
      maxRequestBytes: 100,
      rateLimitPerMinute: 2,
      clock: () => now,
    });
    const next = () => Promise.resolve('ok');

    await expect(middleware(context(), next)).resolves.toBe('ok');
    await expect(middleware(context(), next)).resolves.toBe('ok');
    await expect(middleware(context(), next)).rejects.toMatchObject({
      code: ERROR_CODES.rateLimited,
    });

    now += 60_001;
    await expect(middleware(context(), next)).resolves.toBe('ok');
  });

  it('runs permission checks only when an endpoint declares a capability', async () => {
    const manager = new PermissionManager();
    const middleware = createPermissionMiddleware(manager);
    await expect(middleware(context(), () => Promise.resolve('ok'))).resolves.toBe('ok');
    await expect(
      middleware(context({ requiredPermission: PERMISSIONS.network }), () =>
        Promise.resolve('never'),
      ),
    ).rejects.toBeInstanceOf(PlatformError);

    manager.grant(PERMISSIONS.network, 'once');
    await expect(
      middleware(context({ requiredPermission: PERMISSIONS.network }), () => Promise.resolve('ok')),
    ).resolves.toBe('ok');
  });
});
// @vitest-environment node
