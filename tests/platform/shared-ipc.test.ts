import { ERROR_CODES } from '../../src/shared/platform/errors';
import { unwrapIpcResult } from '../../src/shared/platform/ipc';

describe('shared IPC result contract', () => {
  it('unwraps successful data and rejects public errors', () => {
    expect(unwrapIpcResult({ ok: true, data: 42 })).toBe(42);
    expect(() =>
      unwrapIpcResult({
        ok: false,
        error: { code: ERROR_CODES.ipcForbidden, message: 'Forbidden' },
      }),
    ).toThrow('IPC_FORBIDDEN: Forbidden');
  });
});
// @vitest-environment node
