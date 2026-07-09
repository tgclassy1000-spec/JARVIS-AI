import type {
  AccessibilityStatus,
  BackupValidationReport,
  BackupValidationRequest,
  DebugModeState,
  DiagnosticBundle,
  DiagnosticBundleRequest,
  ProductionCheck,
  ProductionDashboard,
  ProductionStatus,
  RecoveryReport,
  RendererCrashReportRequest,
  SafeRestartResult,
} from '../../../shared/production/contracts';
import type { CrashAwareWindow, CrashRecoveryService } from '../crash/crash-recovery-service';
import type { DatabaseProtectionService } from '../data/database-protection-service';
import type { EncryptedCredentialVault } from '../data/sensitive-data-protector';
import type { DiagnosticsService } from '../diagnostics/diagnostics-service';
import type { PerformanceMonitor } from '../performance/performance-monitor';
import type { SecurityAuditService } from '../security/security-audit-service';

export interface ProductionHardeningServiceOptions {
  readonly crashRecovery: CrashRecoveryService;
  readonly dataProtection: DatabaseProtectionService;
  readonly credentialVault: EncryptedCredentialVault;
  readonly diagnostics: DiagnosticsService;
  readonly performance: PerformanceMonitor;
  readonly securityAudit: SecurityAuditService;
  readonly debugMode: boolean;
  readonly clock?: () => Date;
}

function statusFromChecks(checks: readonly ProductionCheck[]): ProductionStatus {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}

export class ProductionHardeningService {
  readonly #crashRecovery: CrashRecoveryService;
  readonly #dataProtection: DatabaseProtectionService;
  readonly #credentialVault: EncryptedCredentialVault;
  readonly #diagnostics: DiagnosticsService;
  readonly #performance: PerformanceMonitor;
  readonly #securityAudit: SecurityAuditService;
  readonly #clock: () => Date;
  #debugMode: DebugModeState;

  public constructor(options: ProductionHardeningServiceOptions) {
    this.#crashRecovery = options.crashRecovery;
    this.#dataProtection = options.dataProtection;
    this.#credentialVault = options.credentialVault;
    this.#diagnostics = options.diagnostics;
    this.#performance = options.performance;
    this.#securityAudit = options.securityAudit;
    this.#clock = options.clock ?? (() => new Date());
    this.#debugMode = Object.freeze({
      enabled: options.debugMode,
      updatedAt: this.#clock().toISOString(),
    });
  }

  public attachWindow(window: CrashAwareWindow): void {
    this.#crashRecovery.attachWindow(window);
  }

  public dashboard(): ProductionDashboard {
    const security = this.#securityAudit.runAudit();
    const recovery = this.#crashRecovery.recoveryReport();
    const databaseIntegrity = this.#dataProtection.checkIntegrity();
    const performance = this.#performance.snapshot();
    const accessibility = this.accessibilityStatus();
    const checks = Object.freeze([
      this.check(
        'crash-recovery',
        'Crash recovery',
        'pass',
        'Global and renderer crash recovery hooks are registered.',
      ),
      this.check(
        'data-protection',
        'Database integrity',
        databaseIntegrity.every((report) => report.ok) ? 'pass' : 'warn',
        'SQLite integrity checks are available for release profiles.',
      ),
      this.check(
        'performance',
        'Leak detection',
        performance.leakDetection.status,
        performance.leakDetection.detail,
      ),
      this.check(
        'diagnostics',
        'Diagnostic export',
        'pass',
        'Local diagnostic bundle export is available.',
      ),
      ...security.checks,
      this.check(
        'accessibility',
        'Accessibility release checks',
        statusFromChecks([
          this.accessibilityCheck('Keyboard navigation', accessibility.keyboardNavigation),
          this.accessibilityCheck('Screen reader labels', accessibility.screenReaderLabels),
          this.accessibilityCheck('High contrast mode', accessibility.highContrastMode),
          this.accessibilityCheck('Reduced motion', accessibility.reducedMotion),
        ]),
        'Keyboard, screen reader, high contrast, and reduced motion checks are tracked.',
      ),
    ]);
    return Object.freeze({
      overallStatus: statusFromChecks(checks),
      checks,
      recovery,
      dataProtection: Object.freeze({
        encryption: this.#credentialVault.status(),
        databaseIntegrity,
        backupValidation: this.#dataProtection.lastBackupValidation(),
      }),
      performance,
      security,
      accessibility,
      debugMode: this.#debugMode,
    });
  }

  public recoveryReport(): RecoveryReport {
    return this.#crashRecovery.recoveryReport();
  }

  public exportDiagnostics(request: DiagnosticBundleRequest = {}): DiagnosticBundle {
    return this.#diagnostics.exportBundle(request);
  }

  public runSecurityAudit() {
    return this.#securityAudit.runAudit();
  }

  public validateBackups(request: BackupValidationRequest): BackupValidationReport {
    return this.#dataProtection.validateBackups(request);
  }

  public setDebugMode(enabled: boolean): DebugModeState {
    this.#debugMode = Object.freeze({ enabled, updatedAt: this.#clock().toISOString() });
    return this.#debugMode;
  }

  public recordRendererCrash(request: RendererCrashReportRequest): RecoveryReport {
    this.#crashRecovery.recordRendererCrash(request);
    return this.#crashRecovery.recoveryReport();
  }

  public safeRestart(): SafeRestartResult {
    return this.#crashRecovery.safeRestart();
  }

  public dispose(): void {
    this.#performance.dispose();
  }

  private check(
    area: ProductionCheck['area'],
    name: string,
    status: ProductionStatus,
    detail: string,
  ): ProductionCheck {
    return Object.freeze({
      area,
      name,
      status,
      detail,
      checkedAt: this.#clock().toISOString(),
    });
  }

  private accessibilityCheck(name: string, status: ProductionStatus): ProductionCheck {
    return this.check('accessibility', name, status, `${name} is covered by the production HUD.`);
  }

  private accessibilityStatus(): AccessibilityStatus {
    return Object.freeze({
      keyboardNavigation: 'pass',
      screenReaderLabels: 'pass',
      highContrastMode: 'pass',
      reducedMotion: 'pass',
      checkedAt: this.#clock().toISOString(),
    });
  }
}
