import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ERROR_CODES } from '../../../shared/platform/errors';
import type {
  DiagnosticBundle,
  DiagnosticBundleRequest,
  ProductionJsonValue,
} from '../../../shared/production/contracts';
import { PlatformError } from '../../platform/errors/platform-error';
import type { CrashRecoveryService } from '../crash/crash-recovery-service';
import type { DatabaseProtectionService } from '../data/database-protection-service';
import type { PerformanceMonitor } from '../performance/performance-monitor';
import type { SecurityAuditService } from '../security/security-audit-service';

export interface DiagnosticsServiceOptions {
  readonly logDirectory: string;
  readonly crashRecovery: CrashRecoveryService;
  readonly dataProtection: DatabaseProtectionService;
  readonly performance: PerformanceMonitor;
  readonly securityAudit: SecurityAuditService;
  readonly clock?: () => Date;
}

function readLogFiles(directory: string): readonly string[] {
  if (!existsSync(directory)) return Object.freeze([]);
  const logs = readdirSync(directory)
    .filter((entry) => entry.endsWith('.log') || entry.includes('.log.'))
    .sort()
    .map((entry) => readFileSync(join(directory, entry), 'utf8').slice(-50_000));
  return Object.freeze(logs);
}

export class DiagnosticsService {
  readonly #logDirectory: string;
  readonly #crashRecovery: CrashRecoveryService;
  readonly #dataProtection: DatabaseProtectionService;
  readonly #performance: PerformanceMonitor;
  readonly #securityAudit: SecurityAuditService;
  readonly #clock: () => Date;
  readonly #errors: string[] = [];

  public constructor(options: DiagnosticsServiceOptions) {
    this.#logDirectory = options.logDirectory;
    this.#crashRecovery = options.crashRecovery;
    this.#dataProtection = options.dataProtection;
    this.#performance = options.performance;
    this.#securityAudit = options.securityAudit;
    this.#clock = options.clock ?? (() => new Date());
  }

  public reportError(error: unknown): void {
    this.#errors.push(error instanceof Error ? error.message : String(error));
  }

  public exportBundle(request: DiagnosticBundleRequest = {}): DiagnosticBundle {
    const generatedAt = this.#clock().toISOString();
    const sections: string[] = ['performance', 'dataProtection', 'errors'];
    const bundle: Record<string, ProductionJsonValue> = {
      generatedAt,
      performance: this.#performance.snapshot() as unknown as ProductionJsonValue,
      dataProtection: this.#dataProtection.checkIntegrity() as unknown as ProductionJsonValue,
      errors: Object.freeze([...this.#errors]),
    };

    if (request.includeCrashReports ?? true) {
      sections.push('crashReports');
      bundle.crashReports = this.#crashRecovery.recoveryReport() as unknown as ProductionJsonValue;
    }
    if (request.includeLogs ?? true) {
      sections.push('logs');
      bundle.logs = readLogFiles(this.#logDirectory);
    }
    if (request.includeSecurityAudit ?? true) {
      sections.push('securityAudit');
      bundle.securityAudit = this.#securityAudit.runAudit() as unknown as ProductionJsonValue;
    }

    try {
      return Object.freeze({
        filename: `jarvis-diagnostics-${generatedAt.replace(/[:.]/g, '-')}.json`,
        mimeType: 'application/json',
        content: JSON.stringify(bundle, null, 2),
        generatedAt,
        sections: Object.freeze(sections),
      });
    } catch (error) {
      throw new PlatformError(
        ERROR_CODES.diagnosticExportFailed,
        'Diagnostic bundle export failed.',
        {
          cause: error,
        },
      );
    }
  }
}
