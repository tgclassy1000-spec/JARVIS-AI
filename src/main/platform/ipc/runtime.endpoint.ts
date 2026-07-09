import { z } from 'zod';

import { IPC_CHANNELS, type DesktopPlatform, type RuntimeInfo } from '../../../shared/platform/ipc';
import type { IpcEndpoint } from './ipc-router';

export interface RuntimeInfoProvider {
  readonly appVersion: string;
  readonly electronVersion: string;
  readonly processPlatform: NodeJS.Platform;
}

export function toDesktopPlatform(platform: NodeJS.Platform): DesktopPlatform {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  return 'other';
}

export function createRuntimeEndpoint(
  provider: RuntimeInfoProvider,
): IpcEndpoint<typeof IPC_CHANNELS.runtimeInfo> {
  return {
    channel: IPC_CHANNELS.runtimeInfo,
    requestSchema: z.object({}).strict(),
    handle: (): RuntimeInfo =>
      Object.freeze({
        appVersion: provider.appVersion,
        electronVersion: provider.electronVersion,
        platform: toDesktopPlatform(provider.processPlatform),
      }),
  };
}
