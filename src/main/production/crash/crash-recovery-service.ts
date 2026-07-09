import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  CrashReport,
  CrashReportKind,
  RecoveryReport,
  RendererCrashReportRequest,
  SafeRestartResult,
} from '../../../shared/production/contracts';
import type { Logger } from '../../platform/logging/logger';

export interface CrashRecoveryServiceOptions {
  readonly reportDirectory: string;
  readonly appVersion: string;
  readonly restart?: () => void;
  readonly logger?: Logger;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}

export interface RendererCrashDetails {
  readonly reason: string;
  readonly exitCode?: number;
  readonly processType?: string;
}

export interface CrashAwareWebContents {
  on(
    event: 'render-process-gone',
    listener: (event: unknown, details: RendererCrashDetails) => void,
  ): void;
  on(event: 'unresponsive', listener: () => void): void;
}

export interface CrashAwareWindow {
  readonly webContents: CrashAwareWebContents;
  reload(): void;
}

export interface CrashAwareProcess {
  on(event: 'uncaughtException', listener: (error: Error, origin: string) => void): void;
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
}

function messageFromUnknown(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  return JSON.stringify(reason);
}

function stackFromUnknown(reason: unknown): string | undefined {
  return reason instanceof Error ? reason.stack : undefined;
}

export class CrashRecoveryService {
  readonly #reportDirectory: string;
  readonly #appVersion: string;
  readonly #restart: (() => void) | undefined;
  readonly #logger: Logger | undefined;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #reports: CrashReport[] = [];
  #installed = false;

  public constructor(options: CrashRecoveryServiceOptions) {
    this.#reportDirectory = options.reportDirectory;
    this.#appVersion = options.appVersion;
    this.#restart = options.restart;
    this.#logger = options.logger;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
    mkdirSync(this.#reportDirectory, { recursive: true });
    this.loadReports();
  }

  public installGlobalHandlers(source: CrashAwareProcess = process): void {
    if (this.#installed) return;
    this.#installed = true;
    source.on('uncaughtException', (error, origin) => {
      this.recordMainException(error, origin);
    });
    source.on('unhandledRejection', (reason) => {
      this.recordUnhandledRejection(reason);
    });
  }

  public attachWindow(window: CrashAwareWindow): void {
    window.webContents.on('render-process-gone', (_event, details) => {
      this.recordRendererCrash({
        kind: 'renderer-gone',
        reason: details.reason,
        message: `Renderer process ended: ${details.reason}`,
        exitCode: details.exitCode,
        processType: details.processType,
      });
      window.reload();
    });
    window.webContents.on('unresponsive', () => {
      this.recordRendererCrash({
        kind: 'renderer-crash',
        reason: 'unresponsive',
        message: 'Renderer became unresponsive and was marked for recovery.',
      });
    });
  }

  public recordMainException(error: Error, origin = 'uncaughtException'): CrashReport {
    return this.record({
      kind: 'main-exception',
      process: 'main',
      reason: origin,
      message: error.message,
      stack: error.stack,
      recovered: true,
      metadata: { appVersion: this.#appVersion },
    });
  }

  public recordUnhandledRejection(reason: unknown): CrashReport {
    return this.record({
      kind: 'unhandled-rejection',
      process: 'main',
      reason: 'unhandledRejection',
      message: messageFromUnknown(reason),
      stack: stackFromUnknown(reason),
      recovered: true,
      metadata: { appVersion: this.#appVersion },
    });
  }

  public recordRendererCrash(request: RendererCrashReportRequest): CrashReport {
    return this.record({
      kind: request.kind,
      process: 'renderer',
      reason: request.reason,
      message: request.message ?? request.reason,
      recovered: true,
      metadata: {
        appVersion: this.#appVersion,
        ...(request.exitCode === undefined ? {} : { exitCode: request.exitCode }),
        ...(request.processType ? { processType: request.processType } : {}),
      },
    });
  }

  public safeRestart(): SafeRestartResult {
    const report = this.record({
      kind: 'safe-restart',
      process: 'main',
      reason: 'user-requested',
      message: 'Safe restart requested after diagnostics were captured.',
      recovered: true,
      metadata: { appVersion: this.#appVersion },
    });
    this.#restart?.();
    return Object.freeze({ accepted: true, report });
  }

  public recoveryReport(): RecoveryReport {
    const reports = Object.freeze(
      [...this.#reports].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
    return Object.freeze({
      generatedAt: this.#clock().toISOString(),
      restartAvailable: Boolean(this.#restart),
      reports,
      recommendations: Object.freeze(this.recommendations(reports)),
    });
  }

  public reports(): readonly CrashReport[] {
    return this.recoveryReport().reports;
  }

  private record(input: {
    readonly kind: CrashReportKind;
    readonly process: 'main' | 'renderer';
    readonly reason: string;
    readonly message: string;
    readonly stack?: string;
    readonly recovered: boolean;
    readonly metadata: CrashReport['metadata'];
  }): CrashReport {
    const report: CrashReport = Object.freeze({
      id: this.#idFactory(),
      kind: input.kind,
      process: input.process,
      reason: input.reason,
      message: input.message,
      ...(input.stack ? { stack: input.stack.slice(0, 8_000) } : {}),
      recovered: input.recovered,
      createdAt: this.#clock().toISOString(),
      metadata: Object.freeze(input.metadata),
    });
    this.#reports.push(report);
    writeFileSync(
      join(this.#reportDirectory, `${report.id}.json`),
      JSON.stringify(report, null, 2),
    );
    this.#logger?.error('Crash recovery report recorded.', {
      kind: report.kind,
      reason: report.reason,
      recovered: report.recovered,
    });
    return report;
  }

  private loadReports(): void {
    for (const entry of readdirSync(this.#reportDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const parsed = JSON.parse(
          readFileSync(join(this.#reportDirectory, entry.name), 'utf8'),
        ) as unknown;
        if (this.isCrashReport(parsed)) this.#reports.push(parsed);
      } catch {
        this.#logger?.warn('Ignoring unreadable crash report.', { file: entry.name });
      }
    }
  }

  private isCrashReport(value: unknown): value is CrashReport {
    return Boolean(
      value &&
      typeof value === 'object' &&
      'id' in value &&
      'kind' in value &&
      'createdAt' in value,
    );
  }

  private recommendations(reports: readonly CrashReport[]): readonly string[] {
    const rendererFailures = reports.filter((report) => report.process === 'renderer').length;
    const mainFailures = reports.filter((report) => report.process === 'main').length;
    const recommendations = [
      rendererFailures > 0
        ? 'Renderer recovery is active; inspect renderer crash details before release.'
        : '',
      mainFailures > 0
        ? 'Main-process crash reports exist; review stack traces before release.'
        : '',
      reports.length === 0 ? 'No crash reports recorded in this profile.' : '',
    ].filter((item) => item.length > 0);
    return Object.freeze(recommendations);
  }
}
