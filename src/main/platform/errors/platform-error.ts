import { ERROR_CODES, type ErrorCode, type PublicError } from '../../../shared/platform/errors';

export type ErrorMetadata = Readonly<Record<string, unknown>>;

export class PlatformError extends Error {
  public readonly code: ErrorCode;
  public readonly metadata: ErrorMetadata;
  public readonly exposeMessage: boolean;

  public constructor(
    code: ErrorCode,
    message: string,
    options: {
      readonly cause?: unknown;
      readonly metadata?: ErrorMetadata;
      readonly exposeMessage?: boolean;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'PlatformError';
    this.code = code;
    this.metadata = Object.freeze({ ...options.metadata });
    this.exposeMessage = options.exposeMessage ?? true;
  }
}

export function toPublicError(error: unknown, requestId?: string): PublicError {
  if (error instanceof PlatformError) {
    return {
      code: error.code,
      message: error.exposeMessage ? error.message : 'The request could not be completed.',
      ...(requestId ? { requestId } : {}),
    };
  }

  return {
    code: ERROR_CODES.internal,
    message: 'An unexpected internal error occurred.',
    ...(requestId ? { requestId } : {}),
  };
}
