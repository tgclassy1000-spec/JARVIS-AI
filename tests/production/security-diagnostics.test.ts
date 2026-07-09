// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { CrashRecoveryService } from '../../src/main/production/crash/crash-recovery-service';
import { DatabaseProtectionService } from '../../src/main/production/data/database-protection-service';
import { DiagnosticsService } from '../../src/main/production/diagnostics/diagnostics-service';
import { PerformanceMonitor } from '../../src/main/production/performance/performance-monitor';
import { SecurityAuditService } from '../../src/main/production/security/security-audit-service';
import { ALLOWED_IPC_CHANNELS } from '../../src/shared/platform/ipc';

function createProject(root: string, options: { readonly unsafe?: boolean } = {}): string {
  mkdirSync(join(root, 'src', 'renderer'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      dependencies: { react: options.unsafe ? '*' : '^19.0.0' },
      devDependencies: {},
    }),
  );
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify({ lockfileVersion: options.unsafe ? 2 : 3 }),
  );
  writeFileSync(
    join(root, 'src', 'renderer', 'index.html'),
    options.unsafe
      ? '<meta http-equiv="Content-Security-Policy" content="default-src *; script-src unsafe-inline">'
      : "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'\">",
  );
  writeFileSync(
    join(root, 'src', 'renderer', 'unsafe.ts'),
    options.unsafe
      ? 'ipcRenderer.invoke("anything"); const api_key = "12345678901234567890";'
      : 'export const safe = true;',
  );
  return join(root, 'src', 'renderer', 'index.html');
}

function createDatabase(path: string): void {
  const database = new DatabaseSync(path);
  database.exec('CREATE TABLE health (id TEXT PRIMARY KEY);');
  database.close();
}

describe('SecurityAuditService and DiagnosticsService', () => {
  it('passes release checks for a hardened project and flags unsafe regressions', () => {
    const safeRoot = mkdtempSync(join(tmpdir(), 'jarvis-safe-audit-'));
    const unsafeRoot = mkdtempSync(join(tmpdir(), 'jarvis-unsafe-audit-'));
    try {
      const safeCsp = createProject(safeRoot);
      const unsafeCsp = createProject(unsafeRoot, { unsafe: true });
      const safeAudit = new SecurityAuditService({
        projectRoot: safeRoot,
        cspHtmlPath: safeCsp,
        allowedIpcChannels: ALLOWED_IPC_CHANNELS,
        clock: () => new Date('2026-01-01T00:00:00.000Z'),
      }).runAudit();
      expect(safeAudit.summary.failed).toBe(0);
      expect(safeAudit.checks.map((check) => check.name)).toContain('CSP verification');

      const unsafeAudit = new SecurityAuditService({
        projectRoot: unsafeRoot,
        cspHtmlPath: unsafeCsp,
        allowedIpcChannels: ['duplicate', 'duplicate'],
        allowedPermissions: [],
        clock: () => new Date('2026-01-01T00:00:00.000Z'),
      }).runAudit();
      expect(unsafeAudit.summary.failed).toBeGreaterThan(0);
      expect(unsafeAudit.checks.find((check) => check.name === 'Secret scan')?.status).toBe('fail');
      expect(unsafeAudit.checks.find((check) => check.name === 'IPC audit')?.status).toBe('fail');
    } finally {
      rmSync(safeRoot, { recursive: true, force: true });
      rmSync(unsafeRoot, { recursive: true, force: true });
    }
  });

  it('exports local diagnostic bundles with optional logs, crashes and security audit sections', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-diagnostics-'));
    const databasePath = join(directory, 'db.sqlite');
    const projectRoot = join(directory, 'project');
    const cspPath = createProject(projectRoot);
    const logDirectory = join(directory, 'logs');
    mkdirSync(logDirectory, { recursive: true });
    writeFileSync(join(logDirectory, 'jarvis.log'), '{"level":"info"}\n');
    createDatabase(databasePath);

    const crashRecovery = new CrashRecoveryService({
      reportDirectory: join(directory, 'crashes'),
      appVersion: '0.11.0',
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
      idFactory: () => 'crash',
    });
    crashRecovery.recordMainException(new Error('boom'));
    const dataProtection = new DatabaseProtectionService({
      databasePaths: [databasePath],
      backupDirectory: join(directory, 'backups'),
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const performance = new PerformanceMonitor({
      leakThresholdBytes: 1_000_000,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
      memoryUsage: () =>
        ({
          rss: 1,
          heapTotal: 1,
          heapUsed: 1,
          external: 1,
          arrayBuffers: 1,
        }) satisfies NodeJS.MemoryUsage,
    });
    const securityAudit = new SecurityAuditService({
      projectRoot,
      cspHtmlPath: cspPath,
      allowedIpcChannels: ALLOWED_IPC_CHANNELS,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const diagnostics = new DiagnosticsService({
      logDirectory,
      crashRecovery,
      dataProtection,
      performance,
      securityAudit,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    diagnostics.reportError(new Error('captured'));

    try {
      const bundle = diagnostics.exportBundle();
      expect(bundle.filename).toContain('jarvis-diagnostics');
      expect(bundle.sections).toEqual([
        'performance',
        'dataProtection',
        'errors',
        'crashReports',
        'logs',
        'securityAudit',
      ]);
      expect(bundle.content).toContain('captured');

      const minimal = diagnostics.exportBundle({
        includeCrashReports: false,
        includeLogs: false,
        includeSecurityAudit: false,
      });
      expect(minimal.sections).toEqual(['performance', 'dataProtection', 'errors']);
    } finally {
      performance.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
