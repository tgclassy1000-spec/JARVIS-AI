import { ERROR_CODES } from '../../src/shared/platform/errors';
import { PlatformError, toPublicError } from '../../src/main/platform/errors/platform-error';

describe('PlatformError', () => {
  it('preserves structured metadata and a cause', () => {
    const cause = new Error('root');
    const error = new PlatformError(ERROR_CODES.validationFailed, 'Invalid request', {
      cause,
      metadata: { field: 'name' },
    });

    expect(error.name).toBe('PlatformError');
    expect(error.cause).toBe(cause);
    expect(error.metadata).toEqual({ field: 'name' });
    expect(Object.isFrozen(error.metadata)).toBe(true);
  });

  it('serializes exposed errors with request identifiers', () => {
    const result = toPublicError(
      new PlatformError(ERROR_CODES.permissionDenied, 'Permission denied'),
      'request-1',
    );
    expect(result).toEqual({
      code: ERROR_CODES.permissionDenied,
      message: 'Permission denied',
      requestId: 'request-1',
    });
  });

  it('hides sensitive and unknown errors', () => {
    expect(
      toPublicError(
        new PlatformError(ERROR_CODES.configInvalid, 'contains a secret', { exposeMessage: false }),
      ),
    ).toEqual({ code: ERROR_CODES.configInvalid, message: 'The request could not be completed.' });
    expect(toPublicError(new Error('database details'))).toEqual({
      code: ERROR_CODES.internal,
      message: 'An unexpected internal error occurred.',
    });
  });
});
// @vitest-environment node
