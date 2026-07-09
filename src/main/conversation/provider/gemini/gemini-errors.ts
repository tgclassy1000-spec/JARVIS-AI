import { ERROR_CODES } from '../../../../shared/platform/errors';
import { PlatformError } from '../../../platform/errors/platform-error';

interface ErrorShape {
  readonly name?: string;
  readonly message?: string;
  readonly status?: number | string;
  readonly code?: number | string;
}

function errorShape(error: unknown): ErrorShape {
  if (error === null || typeof error !== 'object') return {};
  const value = error as Readonly<Record<string, unknown>>;
  return {
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
    ...(typeof value.message === 'string' ? { message: value.message } : {}),
    ...(typeof value.status === 'string' || typeof value.status === 'number'
      ? { status: value.status }
      : {}),
    ...(typeof value.code === 'string' || typeof value.code === 'number'
      ? { code: value.code }
      : {}),
  };
}

export interface GeminiErrorContext {
  readonly cancelled: boolean;
  readonly timedOut: boolean;
}

export function mapGeminiError(error: unknown, context: GeminiErrorContext): PlatformError {
  if (error instanceof PlatformError) return error;
  if (context.timedOut) {
    return new PlatformError(
      ERROR_CODES.timeout,
      'Gemini took too long to respond. Please try again.',
      {
        cause: error,
      },
    );
  }
  if (context.cancelled) {
    return new PlatformError(ERROR_CODES.generationCancelled, 'Generation was stopped.', {
      cause: error,
    });
  }

  const shape = errorShape(error);
  const message = shape.message?.toLowerCase() ?? '';
  const status = String(shape.status ?? shape.code ?? '').toUpperCase();

  if (status === '401' || status === '403' || message.includes('api key')) {
    return new PlatformError(
      ERROR_CODES.invalidApiKey,
      'The Gemini API key is invalid or unauthorized. Check your local configuration.',
      { cause: error },
    );
  }
  if (status === '429' || status.includes('RESOURCE_EXHAUSTED')) {
    const quota = /quota|billing|daily|resource exhausted/.test(message);
    return new PlatformError(
      quota ? ERROR_CODES.quotaExceeded : ERROR_CODES.rateLimited,
      quota
        ? 'The Gemini quota has been exhausted. Check your API plan or try again later.'
        : 'Gemini is receiving too many requests. Please wait and retry.',
      { cause: error },
    );
  }
  if (
    error instanceof TypeError ||
    status === '500' ||
    status === '502' ||
    status === '503' ||
    status === '504' ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return new PlatformError(
      ERROR_CODES.networkFailure,
      'JARVIS could not reach Gemini. Check your connection and try again.',
      { cause: error },
    );
  }
  return new PlatformError(
    ERROR_CODES.providerUnknown,
    'Gemini returned an unexpected error. Please try again.',
    { cause: error },
  );
}

export function isRetryableGeminiError(error: PlatformError): boolean {
  return error.code === ERROR_CODES.networkFailure || error.code === ERROR_CODES.rateLimited;
}
