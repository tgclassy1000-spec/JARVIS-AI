export const ERROR_CODES = {
  configInvalid: 'CONFIG_INVALID',
  conversationNotFound: 'CONVERSATION_NOT_FOUND',
  generationCancelled: 'GENERATION_CANCELLED',
  generationActive: 'GENERATION_ACTIVE',
  generationNotFound: 'GENERATION_NOT_FOUND',
  internal: 'INTERNAL_ERROR',
  invalidApiKey: 'INVALID_API_KEY',
  ipcDuplicate: 'IPC_DUPLICATE',
  ipcForbidden: 'IPC_FORBIDDEN',
  ipcNotAllowed: 'IPC_NOT_ALLOWED',
  messageNotFound: 'MESSAGE_NOT_FOUND',
  memoryDisabled: 'MEMORY_DISABLED',
  memoryNotFound: 'MEMORY_NOT_FOUND',
  networkFailure: 'NETWORK_FAILURE',
  permissionDenied: 'PERMISSION_DENIED',
  providerNotConfigured: 'PROVIDER_NOT_CONFIGURED',
  providerUnknown: 'PROVIDER_UNKNOWN',
  officeItemNotFound: 'OFFICE_ITEM_NOT_FOUND',
  officeCommandUnsupported: 'OFFICE_COMMAND_UNSUPPORTED',
  documentNotFound: 'DOCUMENT_NOT_FOUND',
  documentUnsupported: 'DOCUMENT_UNSUPPORTED',
  documentTooLarge: 'DOCUMENT_TOO_LARGE',
  documentOcrUnavailable: 'DOCUMENT_OCR_UNAVAILABLE',
  webBookmarkNotFound: 'WEB_BOOKMARK_NOT_FOUND',
  webProviderUnavailable: 'WEB_PROVIDER_UNAVAILABLE',
  productionRecoveryFailed: 'PRODUCTION_RECOVERY_FAILED',
  diagnosticExportFailed: 'DIAGNOSTIC_EXPORT_FAILED',
  dataIntegrityFailed: 'DATA_INTEGRITY_FAILED',
  securityAuditFailed: 'SECURITY_AUDIT_FAILED',
  quotaExceeded: 'QUOTA_EXCEEDED',
  rateLimited: 'RATE_LIMITED',
  requestTooLarge: 'REQUEST_TOO_LARGE',
  serviceCycle: 'SERVICE_CYCLE',
  serviceDuplicate: 'SERVICE_DUPLICATE',
  serviceNotFound: 'SERVICE_NOT_FOUND',
  timeout: 'TIMEOUT',
  validationFailed: 'VALIDATION_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface PublicError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly requestId?: string;
}

export type IpcResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: PublicError };
