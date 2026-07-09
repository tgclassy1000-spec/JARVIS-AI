export type ProductionStatus = 'pass' | 'warn' | 'fail';

export type ProductionJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly ProductionJsonValue[]
  | { readonly [key: string]: ProductionJsonValue };

export type ProductionMetadata = Readonly<Record<string, ProductionJsonValue>>;

export const PRODUCTION_CHECK_AREAS = [
  'crash-recovery',
  'data-protection',
  'performance',
  'diagnostics',
  'security',
  'accessibility',
] as const;

export type ProductionCheckArea = (typeof PRODUCTION_CHECK_AREAS)[number];

export interface ProductionCheck {
  readonly area: ProductionCheckArea;
  readonly name: string;
  readonly status: ProductionStatus;
  readonly detail: string;
  readonly checkedAt: string;
  readonly recommendation?: string;
  readonly metadata?: ProductionMetadata;
}

export type CrashReportKind =
  'main-exception' | 'unhandled-rejection' | 'renderer-crash' | 'renderer-gone' | 'safe-restart';

export interface CrashReport {
  readonly id: string;
  readonly kind: CrashReportKind;
  readonly process: 'main' | 'renderer';
  readonly reason: string;
  readonly message: string;
  readonly stack?: string;
  readonly recovered: boolean;
  readonly createdAt: string;
  readonly metadata: ProductionMetadata;
}

export interface RendererCrashReportRequest {
  readonly kind: Extract<CrashReportKind, 'renderer-crash' | 'renderer-gone'>;
  readonly reason: string;
  readonly message?: string;
  readonly exitCode?: number;
  readonly processType?: string;
}

export interface RecoveryReport {
  readonly generatedAt: string;
  readonly restartAvailable: boolean;
  readonly reports: readonly CrashReport[];
  readonly recommendations: readonly string[];
}

export interface SafeRestartRequest {
  readonly confirm: true;
}

export interface SafeRestartResult {
  readonly accepted: boolean;
  readonly report: CrashReport;
}

export interface EncryptionStatus {
  readonly available: boolean;
  readonly algorithm: 'aes-256-gcm';
  readonly credentialStore: 'encrypted-local';
  readonly encryptedCredentialCount: number;
}

export interface DatabaseIntegrityReport {
  readonly name: string;
  readonly path: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly checkedAt: string;
  readonly recovered: boolean;
  readonly quarantinePath?: string;
}

export interface BackupValidationRequest {
  readonly databasePaths: readonly string[];
  readonly backupDirectory?: string;
}

export interface BackupValidationResult {
  readonly sourcePath: string;
  readonly backupPath?: string;
  readonly valid: boolean;
  readonly detail: string;
  readonly checkedAt: string;
}

export interface BackupValidationReport {
  readonly generatedAt: string;
  readonly results: readonly BackupValidationResult[];
}

export interface DataProtectionStatus {
  readonly encryption: EncryptionStatus;
  readonly databaseIntegrity: readonly DatabaseIntegrityReport[];
  readonly backupValidation: readonly BackupValidationResult[];
}

export interface StartupMark {
  readonly name: string;
  readonly elapsedMs: number;
}

export interface MemoryProfile {
  readonly rssBytes: number;
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly externalBytes: number;
}

export interface BackgroundTaskStatus {
  readonly id: string;
  readonly intervalMs: number;
  readonly runCount: number;
  readonly failureCount: number;
  readonly lastRunAt?: string;
  readonly lastError?: string;
}

export interface LeakDetectionReport {
  readonly status: ProductionStatus;
  readonly sampleCount: number;
  readonly heapGrowthBytes: number;
  readonly detail: string;
}

export interface PerformanceSnapshot {
  readonly capturedAt: string;
  readonly uptimeMs: number;
  readonly startup: readonly StartupMark[];
  readonly memory: MemoryProfile;
  readonly backgroundTasks: readonly BackgroundTaskStatus[];
  readonly cleanupHandlers: number;
  readonly leakDetection: LeakDetectionReport;
}

export interface DiagnosticBundleRequest {
  readonly includeLogs?: boolean;
  readonly includeCrashReports?: boolean;
  readonly includeSecurityAudit?: boolean;
}

export interface DiagnosticBundle {
  readonly filename: string;
  readonly mimeType: 'application/json';
  readonly content: string;
  readonly generatedAt: string;
  readonly sections: readonly string[];
}

export interface DebugModeRequest {
  readonly enabled: boolean;
}

export interface DebugModeState {
  readonly enabled: boolean;
  readonly updatedAt: string;
}

export interface SecurityAuditReport {
  readonly generatedAt: string;
  readonly checks: readonly ProductionCheck[];
  readonly summary: {
    readonly passed: number;
    readonly warnings: number;
    readonly failed: number;
  };
}

export interface AccessibilityStatus {
  readonly keyboardNavigation: ProductionStatus;
  readonly screenReaderLabels: ProductionStatus;
  readonly highContrastMode: ProductionStatus;
  readonly reducedMotion: ProductionStatus;
  readonly checkedAt: string;
}

export interface ProductionDashboard {
  readonly overallStatus: ProductionStatus;
  readonly checks: readonly ProductionCheck[];
  readonly recovery: RecoveryReport;
  readonly dataProtection: DataProtectionStatus;
  readonly performance: PerformanceSnapshot;
  readonly security: SecurityAuditReport;
  readonly accessibility: AccessibilityStatus;
  readonly debugMode: DebugModeState;
}
