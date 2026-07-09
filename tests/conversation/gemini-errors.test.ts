// @vitest-environment node

import { ERROR_CODES } from '../../src/shared/platform/errors';
import { PlatformError } from '../../src/main/platform/errors/platform-error';
import {
  isRetryableGeminiError,
  mapGeminiError,
} from '../../src/main/conversation/provider/gemini/gemini-errors';

describe('Gemini error mapping', () => {
  const normal = { cancelled: false, timedOut: false };

  it.each([
    [{ status: 401, message: 'unauthorized' }, ERROR_CODES.invalidApiKey],
    [{ code: 403, message: 'forbidden' }, ERROR_CODES.invalidApiKey],
    [{ status: 400, message: 'API key not valid' }, ERROR_CODES.invalidApiKey],
    [{ status: 429, message: 'too many requests' }, ERROR_CODES.rateLimited],
    [{ code: 'RESOURCE_EXHAUSTED', message: 'daily quota reached' }, ERROR_CODES.quotaExceeded],
    [{ status: 503, message: 'unavailable' }, ERROR_CODES.networkFailure],
    [new TypeError('fetch failed'), ERROR_CODES.networkFailure],
    [{ message: 'network disconnected' }, ERROR_CODES.networkFailure],
    [{ message: 'strange provider response' }, ERROR_CODES.providerUnknown],
    ['not-an-error', ERROR_CODES.providerUnknown],
  ])('maps provider failures to friendly stable codes', (error, code) => {
    expect(mapGeminiError(error, normal).code).toBe(code);
  });

  it('prioritizes timeout, cancellation, and existing platform errors', () => {
    expect(mapGeminiError(new Error('aborted'), { cancelled: false, timedOut: true }).code).toBe(
      ERROR_CODES.timeout,
    );
    expect(mapGeminiError(new Error('aborted'), { cancelled: true, timedOut: false }).code).toBe(
      ERROR_CODES.generationCancelled,
    );
    const existing = new PlatformError(ERROR_CODES.quotaExceeded, 'quota');
    expect(mapGeminiError(existing, normal)).toBe(existing);
  });

  it('retries only transient network and rate failures', () => {
    expect(isRetryableGeminiError(new PlatformError(ERROR_CODES.networkFailure, 'network'))).toBe(
      true,
    );
    expect(isRetryableGeminiError(new PlatformError(ERROR_CODES.rateLimited, 'rate'))).toBe(true);
    expect(isRetryableGeminiError(new PlatformError(ERROR_CODES.quotaExceeded, 'quota'))).toBe(
      false,
    );
  });
});
