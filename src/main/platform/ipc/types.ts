import type { Permission } from '../../../shared/platform/permissions';

export interface IpcEvent {
  readonly senderUrl: string;
  send(channel: string, payload: unknown): void;
}

export type IpcListener = (event: IpcEvent, payload: unknown) => Promise<unknown>;

export interface IpcMainAdapter {
  handle(channel: string, listener: IpcListener): void;
  removeHandler(channel: string): void;
}

export interface IpcInvocationContext {
  readonly channel: string;
  readonly senderUrl: string;
  readonly requestId: string;
  readonly payload: unknown;
  readonly requiredPermission?: Permission;
  emit(channel: string, payload: unknown): void;
}

export type IpcNext = () => Promise<unknown>;
export type IpcMiddleware = (context: IpcInvocationContext, next: IpcNext) => Promise<unknown>;
