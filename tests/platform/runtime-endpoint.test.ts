import { IPC_CHANNELS } from '../../src/shared/platform/ipc';
import {
  createRuntimeEndpoint,
  toDesktopPlatform,
} from '../../src/main/platform/ipc/runtime.endpoint';

describe('runtime endpoint', () => {
  it('maps supported and unknown operating systems', () => {
    expect(toDesktopPlatform('win32')).toBe('windows');
    expect(toDesktopPlatform('darwin')).toBe('macos');
    expect(toDesktopPlatform('linux')).toBe('linux');
    expect(toDesktopPlatform('aix')).toBe('other');
  });

  it('provides frozen non-secret runtime information', async () => {
    const endpoint = createRuntimeEndpoint({
      appVersion: '2.0.0',
      electronVersion: '42.6.0',
      processPlatform: 'win32',
    });
    const result = await endpoint.handle(
      {},
      {
        channel: IPC_CHANNELS.runtimeInfo,
        senderUrl: 'file:///app',
        requestId: 'id',
        payload: {},
        emit: vi.fn(),
      },
    );

    expect(result).toEqual({ appVersion: '2.0.0', electronVersion: '42.6.0', platform: 'windows' });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
// @vitest-environment node
