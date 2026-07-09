import type { z } from 'zod';

import { ERROR_CODES, type IpcResult } from '../../../shared/platform/errors';
import type {
  IpcChannel,
  IpcContractMap,
  IpcRequest,
  IpcResponse,
} from '../../../shared/platform/ipc';
import type { Permission } from '../../../shared/platform/permissions';
import { PlatformError, toPublicError } from '../errors/platform-error';
import type { Logger } from '../logging/logger';
import { composeMiddleware } from './middleware';
import type { IpcInvocationContext, IpcMainAdapter, IpcMiddleware } from './types';

export interface IpcEndpoint<C extends IpcChannel> {
  readonly channel: C;
  readonly requestSchema: z.ZodType<IpcRequest<C>>;
  readonly requiredPermission?: Permission;
  readonly handle: (
    request: IpcRequest<C>,
    context: IpcInvocationContext,
  ) => IpcResponse<C> | Promise<IpcResponse<C>>;
}

export class IpcRouter {
  readonly #allowedChannels: ReadonlySet<string>;
  readonly #allowedEvents: ReadonlySet<string>;
  readonly #registeredChannels = new Set<string>();

  public constructor(
    private readonly adapter: IpcMainAdapter,
    allowedChannels: readonly string[],
    allowedEvents: readonly string[],
    private readonly middleware: readonly IpcMiddleware[],
    private readonly logger: Logger,
    private readonly requestIdFactory: () => string,
  ) {
    this.#allowedChannels = new Set(allowedChannels);
    this.#allowedEvents = new Set(allowedEvents);
  }

  public register<C extends IpcChannel>(endpoint: IpcEndpoint<C>): void {
    if (!this.#allowedChannels.has(endpoint.channel)) {
      throw new PlatformError(
        ERROR_CODES.ipcNotAllowed,
        `IPC channel is not allow-listed: ${endpoint.channel}`,
      );
    }
    if (this.#registeredChannels.has(endpoint.channel)) {
      throw new PlatformError(
        ERROR_CODES.ipcDuplicate,
        `IPC channel is already registered: ${endpoint.channel}`,
      );
    }

    this.#registeredChannels.add(endpoint.channel);
    this.adapter.removeHandler(endpoint.channel);
    this.adapter.handle(endpoint.channel, async (event, payload): Promise<IpcResult<unknown>> => {
      const requestId = this.requestIdFactory();
      const context: IpcInvocationContext = {
        channel: endpoint.channel,
        senderUrl: event.senderUrl,
        requestId,
        payload,
        emit: (channel, eventPayload) => {
          if (!this.#allowedEvents.has(channel)) {
            throw new PlatformError(
              ERROR_CODES.ipcNotAllowed,
              `IPC event is not allow-listed: ${channel}`,
            );
          }
          event.send(channel, eventPayload);
        },
        ...(endpoint.requiredPermission ? { requiredPermission: endpoint.requiredPermission } : {}),
      };

      try {
        const data = await composeMiddleware(this.middleware, context, () => {
          const parsed = endpoint.requestSchema.safeParse(payload);
          if (!parsed.success) {
            throw new PlatformError(
              ERROR_CODES.validationFailed,
              'IPC request validation failed.',
              {
                metadata: { issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
              },
            );
          }
          return Promise.resolve(endpoint.handle(parsed.data, context));
        });
        this.logger.debug('IPC request completed.', { channel: endpoint.channel, requestId });
        return { ok: true, data };
      } catch (error) {
        const platformError = error instanceof PlatformError ? error : undefined;
        this.logger.error('IPC request failed.', {
          channel: endpoint.channel,
          requestId,
          errorCode: platformError?.code ?? ERROR_CODES.internal,
        });
        return { ok: false, error: toPublicError(error, requestId) };
      }
    });
  }

  public dispose(): void {
    for (const channel of this.#registeredChannels) this.adapter.removeHandler(channel);
    this.#registeredChannels.clear();
  }
}

export type RegisteredIpcContracts = IpcContractMap;
