// @vitest-environment node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigurationManager } from '../../src/main/platform/config/configuration';
import {
  RotatingFileLogTransport,
  StructuredLogger,
  type LogRecord,
} from '../../src/main/platform/logging/logger';
import {
  CrashRecoveryService,
  type CrashAwareWindow,
} from '../../src/main/production/crash/crash-recovery-service';
import { DatabaseProtectionService } from '../../src/main/production/data/database-protection-service';
import { DiagnosticsService } from '../../src/main/production/diagnostics/diagnostics-service';
import { PerformanceMonitor } from '../../src/main/production/performance/performance-monitor';
import { SecurityAuditService } from '../../src/main/production/security/security-audit-service';
import { ProductionHardeningService } from '../../src/main/production/service/production-hardening-service';
import {
  EncryptedCredentialVault,
  SensitiveDataProtector,
} from '../../src/main/production/data/sensitive-data-protector';
import { ALLOWED_IPC_CHANNELS } from '../../src/shared/platform/ipc';

function writePackage(root: string, lockfileVersion?: number): void {
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: {} }),
  );
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify(lockfileVersion === undefined ? {} : { lockfileVersion }),
  );
}

function writeCsp(root: string, content: string): string {
  mkdirSync(join(root, 'src', 'renderer'), { recursive: true });
  const path = join(root, 'src', 'renderer', 'index.html');
  writeFileSync(path, `<meta http-equiv="Content-Security-Policy" content="${content}">`);
  return path;
}

function createPerformance(): PerformanceMonitor {
  return new PerformanceMonitor({
    leakThresholdBytes: 1,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
    memoryUsage: () => ({
      rss: 1,
      heapTotal: 1,
      heapUsed: 1,
      external: 1,
      arrayBuffers: 1,
    }),
  });
}

describe('production branch coverage', () => {
  it('covers config boolean variants and log rotation non-rotation/oldest removal paths', () => {
    expect(
      ConfigurationManager.fromEnvironment({ JARVIS_DEBUG_MODE: 'yes' }).value.production.debugMode,
    ).toBe(true);
    expect(
      ConfigurationManager.fromEnvironment({ JARVIS_DEBUG_MODE: '0' }).value.production.debugMode,
    ).toBe(false);

    const directory = mkdtempSync(join(tmpdir(), 'jarvis-rotation-branches-'));
    const transport = new RotatingFileLogTransport({
      directory,
      maxBytes: 10_000,
      maxFiles: 1,
    });
    try {
      transport.write({ timestamp: 'one', level: 'info', message: 'small', context: {} });
      expect(transport.files()).toHaveLength(1);
      const tiny = new RotatingFileLogTransport({
        directory,
        filename: 'tiny.log',
        maxBytes: 40,
        maxFiles: 1,
      });
      writeFileSync(join(directory, 'tiny.log.1'), 'old');
      tiny.write({ timestamp: 'one', level: 'info', message: 'x'.repeat(80), context: {} });
      tiny.write({ timestamp: 'two', level: 'info', message: 'y'.repeat(80), context: {} });
      expect(existsSync(join(directory, 'tiny.log.1'))).toBe(true);
      expect(readFileSync(join(directory, 'tiny.log'), 'utf8')).toContain('two');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('covers crash, diagnostics, performance and database fallback branches', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-production-branches-'));
    const crashRecovery = new CrashRecoveryService({
      reportDirectory: join(directory, 'crashes'),
      appVersion: '0.11.0',
    });
    const dataProtection = new DatabaseProtectionService({
      databasePaths: [join(directory, 'missing.sqlite')],
      backupDirectory: join(directory, 'backups'),
    });
    const cleanupLogRecords: LogRecord[] = [];
    const performance = new PerformanceMonitor({
      leakThresholdBytes: 1_000,
      logger: new StructuredLogger(
        'debug',
        [
          {
            write: (record) => {
              cleanupLogRecords.push(record);
            },
          },
        ],
        {},
        () => new Date('2026-01-01T00:00:00.000Z'),
      ),
      setIntervalFn: ((callback: () => void) => {
        callback();
        return 1;
      }) as unknown as typeof setInterval,
      clearIntervalFn: () => undefined,
    });
    const projectRoot = join(directory, 'project');
    mkdirSync(projectRoot, { recursive: true });
    writePackage(projectRoot, 3);
    const cspPath = writeCsp(
      projectRoot,
      "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
    );
    const securityAudit = new SecurityAuditService({
      projectRoot,
      cspHtmlPath: cspPath,
      allowedIpcChannels: ALLOWED_IPC_CHANNELS,
    });
    const diagnostics = new DiagnosticsService({
      logDirectory: join(directory, 'missing-logs'),
      crashRecovery,
      dataProtection,
      performance,
      securityAudit,
    });
    try {
      crashRecovery.recordUnhandledRejection(new Error('error rejection'));
      crashRecovery.recordUnhandledRejection({ structured: true });
      expect(crashRecovery.recoveryReport().reports).toHaveLength(2);
      expect(dataProtection.recoverCorruption(join(directory, 'missing.sqlite')).recovered).toBe(
        false,
      );
      diagnostics.reportError('string-error');
      expect(diagnostics.exportBundle({ includeLogs: true }).content).toContain('string-error');
      performance.scheduleTask({ id: 'tick', intervalMs: 1, run: () => undefined });
      await expect(performance.runTask('tick')).resolves.toMatchObject({ runCount: 1 });
      performance.scheduleTask({
        id: 'non-error-task',
        intervalMs: 1,
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- verifies defensive handling of non-Error async failures.
        run: () => Promise.reject('string failure'),
      });
      await expect(performance.runTask('non-error-task')).resolves.toMatchObject({
        lastError: 'Background task failed.',
      });
      performance.registerCleanup('non-error-cleanup', () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- verifies defensive handling of non-Error host/runtime failures.
        throw 'cleanup failure';
      });
      performance.cleanupAll();
      expect(cleanupLogRecords.at(-1)?.context).toMatchObject({
        error: 'Unknown cleanup error.',
      });
    } finally {
      performance.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('covers security audit missing files, missing CSP and ignored directories', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-security-branches-'));
    try {
      const missingDependencyAudit = new SecurityAuditService({
        projectRoot: directory,
        cspHtmlPath: join(directory, 'missing.html'),
        allowedIpcChannels: [],
      }).runAudit();
      expect(missingDependencyAudit.summary.failed).toBeGreaterThan(0);

      writePackage(directory);
      mkdirSync(join(directory, 'src', 'renderer', 'node_modules'), { recursive: true });
      writeFileSync(
        join(directory, 'src', 'renderer', 'node_modules', 'ignored.ts'),
        'ipcRenderer',
      );
      const noCspPath = writeCsp(directory, '');
      const noCspAudit = new SecurityAuditService({
        projectRoot: directory,
        cspHtmlPath: noCspPath,
        allowedIpcChannels: ALLOWED_IPC_CHANNELS,
      }).runAudit();
      expect(noCspAudit.checks.find((check) => check.name === 'CSP verification')?.status).toBe(
        'fail',
      );
      expect(noCspAudit.checks.find((check) => check.name === 'IPC audit')?.status).toBe('pass');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('covers production service warning/failure aggregation and window attachment', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-service-branches-'));
    const crashRecovery = new CrashRecoveryService({
      reportDirectory: join(directory, 'crashes'),
      appVersion: '0.11.0',
    });
    const dataProtection = new DatabaseProtectionService({
      databasePaths: [join(directory, 'missing.sqlite')],
      backupDirectory: join(directory, 'backups'),
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const performance = createPerformance();
    performance.recordMemorySample({
      rssBytes: 1,
      heapTotalBytes: 1,
      heapUsedBytes: 1,
      externalBytes: 1,
    });
    performance.recordMemorySample({
      rssBytes: 10,
      heapTotalBytes: 10,
      heapUsedBytes: 10,
      externalBytes: 1,
    });
    const projectRoot = join(directory, 'project');
    mkdirSync(projectRoot, { recursive: true });
    writePackage(projectRoot, 2);
    const cspPath = writeCsp(projectRoot, 'default-src *');
    const securityAudit = new SecurityAuditService({
      projectRoot,
      cspHtmlPath: cspPath,
      allowedIpcChannels: ['same', 'same'],
      allowedPermissions: [],
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = new ProductionHardeningService({
      crashRecovery,
      dataProtection,
      credentialVault: new EncryptedCredentialVault(
        new SensitiveDataProtector({ applicationSecret: 'app', machineSecret: 'machine' }),
      ),
      diagnostics: new DiagnosticsService({
        logDirectory: join(directory, 'logs'),
        crashRecovery,
        dataProtection,
        performance,
        securityAudit,
      }),
      performance,
      securityAudit,
      debugMode: false,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const onSpy = vi.fn();
    const window: CrashAwareWindow = {
      webContents: {
        on: onSpy,
      },
      reload: vi.fn(),
    };
    try {
      service.attachWindow(window);
      expect(onSpy).toHaveBeenCalled();
      expect(service.dashboard().overallStatus).toBe('fail');
    } finally {
      service.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('covers production service warning aggregation without failed checks', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-service-warn-branches-'));
    const crashRecovery = new CrashRecoveryService({
      reportDirectory: join(directory, 'crashes'),
      appVersion: '0.11.0',
    });
    const dataProtection = new DatabaseProtectionService({
      databasePaths: [join(directory, 'missing.sqlite')],
      backupDirectory: join(directory, 'backups'),
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const performance = createPerformance();
    const projectRoot = join(directory, 'project');
    mkdirSync(projectRoot, { recursive: true });
    writePackage(projectRoot, 3);
    const cspPath = writeCsp(
      projectRoot,
      "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
    );
    const securityAudit = new SecurityAuditService({
      projectRoot,
      cspHtmlPath: cspPath,
      allowedIpcChannels: ALLOWED_IPC_CHANNELS,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = new ProductionHardeningService({
      crashRecovery,
      dataProtection,
      credentialVault: new EncryptedCredentialVault(
        new SensitiveDataProtector({ applicationSecret: 'app', machineSecret: 'machine' }),
      ),
      diagnostics: new DiagnosticsService({
        logDirectory: join(directory, 'logs'),
        crashRecovery,
        dataProtection,
        performance,
        securityAudit,
      }),
      performance,
      securityAudit,
      debugMode: false,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    try {
      expect(service.dashboard().overallStatus).toBe('warn');
    } finally {
      service.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
