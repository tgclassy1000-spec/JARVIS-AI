import { ERROR_CODES } from '../../../shared/platform/errors';
import type { PermissionRequest } from '../../../shared/platform/permissions';
import { PlatformError } from '../errors/platform-error';
import type { PermissionManager } from '../permissions/permission-manager';
import type { IpcInvocationContext, IpcMiddleware, IpcNext } from './types';

export function composeMiddleware(
  middleware: readonly IpcMiddleware[],
  context: IpcInvocationContext,
  handler: IpcNext,
): Promise<unknown> {
  let lastIndex = -1;

  const dispatch = async (index: number): Promise<unknown> => {
    if (index <= lastIndex) {
      throw new PlatformError(ERROR_CODES.internal, 'IPC middleware called next more than once.', {
        exposeMessage: false,
      });
    }
    lastIndex = index;
    const current = middleware[index];
    if (!current) return handler();
    return current(context, () => dispatch(index + 1));
  };

  return dispatch(0);
}

export interface SecurityMiddlewareOptions {
  readonly isTrustedSender: (url: string) => boolean;
  readonly maxRequestBytes: number;
  readonly rateLimitPerMinute: number;
  readonly clock?: () => number;
}

export function createSecurityMiddleware(options: SecurityMiddlewareOptions): IpcMiddleware {
  const requests = new Map<string, number[]>();
  const clock = options.clock ?? Date.now;

  return async (context, next) => {
    if (!options.isTrustedSender(context.senderUrl)) {
      throw new PlatformError(ERROR_CODES.ipcForbidden, 'IPC sender is not trusted.');
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(context.payload) ?? '';
    } catch (error) {
      throw new PlatformError(ERROR_CODES.validationFailed, 'IPC request is not serializable.', {
        cause: error,
      });
    }

    if (new TextEncoder().encode(serialized).byteLength > options.maxRequestBytes) {
      throw new PlatformError(
        ERROR_CODES.requestTooLarge,
        'IPC request exceeds the configured size limit.',
      );
    }

    const now = clock();
    const windowStart = now - 60_000;
    const rateKey = `${context.senderUrl}:${context.channel}`;
    const recent = (requests.get(rateKey) ?? []).filter((timestamp) => timestamp > windowStart);
    if (recent.length >= options.rateLimitPerMinute) {
      requests.set(rateKey, recent);
      throw new PlatformError(ERROR_CODES.rateLimited, 'IPC rate limit exceeded.');
    }
    recent.push(now);
    requests.set(rateKey, recent);

    return next();
  };
}

export function createPermissionMiddleware(manager: PermissionManager): IpcMiddleware {
  return async (context, next) => {
    if (context.requiredPermission) {
      const request: PermissionRequest = {
        permission: context.requiredPermission,
        reason: `IPC request to ${context.channel}`,
      };
      await manager.assertAllowed(request);
    }
    return next();
  };
}
