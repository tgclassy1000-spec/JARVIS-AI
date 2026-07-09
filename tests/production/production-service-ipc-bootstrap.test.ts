// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { bootstrapProduction } from '../../src/main/production/bootstrap';
import { CrashRecoveryService } from '../../src/main/production/crash/crash-recovery-service';
import { DatabaseProtectionService } from '../../src/main/production/data/database-protection-service';
import {
  EncryptedCredentialVault,
  SensitiveDataProtector,
} from '../../src/main/production/data/sensitive-data-protector';
import { DiagnosticsService } from '../../src/main/production/diagnostics/diagnostics-service';
import { registerProductionEndpoints } from '../../src/main/production/ipc/production.endpoints';
import { PerformanceMonitor } from '../../src/main/production/performance/performance-monitor';
import { SecurityAuditService } from '../../src/main/production/security/security-audit-service';
import { ProductionHardeningService } from '../../src/main/production/service/production-hardening-service';
import type { AppConfig } from '../../src/main/platform/config/configuration';
import { ServiceContainer } from '../../src/main/platform/di/service-container';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import { createPermissionMiddleware } from '../../src/main/platform/ipc/middleware';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';
import { PermissionManager } from '../../src/main/platform/permissions/permission-manager';
import { SERVICE_TOKENS } from '../../src/main/services/tokens';
import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
} from '../../src/shared/platform/ipc';
import { PERMISSIONS, type PermissionDecision } from '../../src/shared/platform/permissions';

class Adapter implements IpcMainAdapter {
  public readonly handlers = new Map<string, IpcListener>();
  public handle(channel: string, listener: IpcListener): void {
    this.handlers.set(channel, listener);
  }
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child() {
    return this;
  },
};

const config: AppConfig = {
  environment: 'test',
  logging: { level: 'error' },
  ipc: { maxRequestBytes: 65_536, rateLimitPerMinute: 120 },
  ai: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    timeoutMs: 1000,
    maxAttempts: 1,
    contextTokenBudget: 4096,
  },
  web: {
    timeoutMs: 1000,
    maxAttempts: 1,
    cacheTtlMs: 60_000,
    rateLimitPerMinute: 100,
  },
  production: {
    debugMode: false,
    logMaxBytes: 1_048_576,
    logMaxFiles: 5,
    diagnosticRetentionDays: 30,
    backupRetentionDays: 14,
    leakThresholdBytes: 64_000_000,
  },
  release: {
    channel: 'stable',
    unsignedDevelopmentFallback: true,
  },
};

function createDatabase(path: string): void {
  const database = new DatabaseSync(path);
  database.exec('CREATE TABLE health (id TEXT PRIMARY KEY);');
  database.close();
}

function createProject(root: string): string {
  mkdirSync(join(root, 'src', 'renderer'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: {} }),
  );
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }));
  const cspPath = join(root, 'src', 'renderer', 'index.html');
  writeFileSync(
    cspPath,
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'\">",
  );
  writeFileSync(join(root, 'src', 'renderer', 'safe.ts'), 'export const safe = true;');
  return cspPath;
}

function createRouter(decision: PermissionDecision = 'allow') {
  const adapter = new Adapter();
  const permissions = new Map(
    Object.values(PERMISSIONS).map((permission) => [permission, decision] as const),
  );
  const router = new IpcRouter(
    adapter,
    ALLOWED_IPC_CHANNELS,
    ALLOWED_IPC_EVENTS,
    [createPermissionMiddleware(new PermissionManager(permissions))],
    logger,
    () => 'production-request',
  );
  return { adapter, router };
}

function createService(root: string) {
  const databasePath = join(root, 'db.sqlite');
  createDatabase(databasePath);
  const projectRoot = join(root, 'project');
  const cspPath = createProject(projectRoot);
  const crashRecovery = new CrashRecoveryService({
    reportDirectory: join(root, 'crashes'),
    appVersion: '0.11.0',
    restart: vi.fn(),
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
    idFactory: () => 'crash-id',
  });
  const dataProtection = new DatabaseProtectionService({
    databasePaths: [databasePath],
    backupDirectory: join(root, 'backups'),
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  const performance = new PerformanceMonitor({
    leakThresholdBytes: 1_000_000,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  const securityAudit = new SecurityAuditService({
    projectRoot,
    cspHtmlPath: cspPath,
    allowedIpcChannels: ALLOWED_IPC_CHANNELS,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  const diagnostics = new DiagnosticsService({
    logDirectory: join(root, 'logs'),
    crashRecovery,
    dataProtection,
    performance,
    securityAudit,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  const service = new ProductionHardeningService({
    crashRecovery,
    dataProtection,
    credentialVault: new EncryptedCredentialVault(
      new SensitiveDataProtector({ applicationSecret: 'app', machineSecret: 'machine' }),
    ),
    diagnostics,
    performance,
    securityAudit,
    debugMode: false,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  return { service, databasePath };
}

describe('production hardening service, IPC and bootstrap', () => {
  it('composes dashboards, diagnostics, audits, backup validation and debug mode', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-production-service-'));
    const { service, databasePath } = createService(directory);
    try {
      expect(service.dashboard().overallStatus).toBe('pass');
      expect(service.setDebugMode(true)).toMatchObject({ enabled: true });
      expect(service.runSecurityAudit().summary.failed).toBe(0);
      expect(service.validateBackups({ databasePaths: [databasePath] }).results[0]?.valid).toBe(
        true,
      );
      expect(service.exportDiagnostics({ includeLogs: false }).sections).toContain('securityAudit');
      expect(
        service.recordRendererCrash({
          kind: 'renderer-crash',
          reason: 'test',
          message: 'Renderer test crash',
        }).reports,
      ).toHaveLength(1);
      expect(service.safeRestart().accepted).toBe(true);
    } finally {
      service.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('registers allow-listed production IPC endpoints with permissions and validation', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-production-ipc-'));
    const { service, databasePath } = createService(directory);
    const { adapter, router } = createRouter();
    try {
      registerProductionEndpoints(router, service);
      expect(adapter.handlers.size).toBe(8);
      const event = { senderUrl: 'file:///app', send: vi.fn() };
      const invoke = (channel: string, payload: unknown) =>
        adapter.handlers.get(channel)?.(event, payload);
      await expect(invoke(IPC_CHANNELS.productionDashboard, {})).resolves.toMatchObject({
        ok: true,
      });
      await expect(invoke(IPC_CHANNELS.productionRecoveryReport, {})).resolves.toMatchObject({
        ok: true,
      });
      await expect(
        invoke(IPC_CHANNELS.productionExportDiagnostics, { includeLogs: false }),
      ).resolves.toMatchObject({ ok: true });
      await expect(invoke(IPC_CHANNELS.productionRunSecurityAudit, {})).resolves.toMatchObject({
        ok: true,
      });
      await expect(
        invoke(IPC_CHANNELS.productionValidateBackups, { databasePaths: [databasePath] }),
      ).resolves.toMatchObject({ ok: true });
      await expect(
        invoke(IPC_CHANNELS.productionSetDebugMode, { enabled: true }),
      ).resolves.toMatchObject({ ok: true, data: { enabled: true } });
      await expect(
        invoke(IPC_CHANNELS.productionRecordRendererCrash, {
          kind: 'renderer-gone',
          reason: 'gone',
        }),
      ).resolves.toMatchObject({ ok: true });
      await expect(
        invoke(IPC_CHANNELS.productionSafeRestart, { confirm: true }),
      ).resolves.toMatchObject({ ok: true });
      await expect(
        invoke(IPC_CHANNELS.productionSafeRestart, { confirm: false }),
      ).resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    } finally {
      router.dispose();
      service.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects permission-gated production IPC when denied', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-production-ipc-deny-'));
    const { service } = createService(directory);
    const { adapter } = createRouter('deny');
    const router = new IpcRouter(
      adapter,
      ALLOWED_IPC_CHANNELS,
      ALLOWED_IPC_EVENTS,
      [
        createPermissionMiddleware(
          new PermissionManager(new Map([[PERMISSIONS.systemInformation, 'deny']])),
        ),
      ],
      logger,
      () => 'production-request',
    );
    try {
      registerProductionEndpoints(router, service);
      const event = { senderUrl: 'file:///app', send: vi.fn() };
      await expect(
        adapter.handlers.get(IPC_CHANNELS.productionDashboard)?.(event, {}),
      ).resolves.toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
      await expect(
        adapter.handlers.get(IPC_CHANNELS.productionRecordRendererCrash)?.(event, {
          kind: 'renderer-crash',
          reason: 'client-report',
        }),
      ).resolves.toMatchObject({ ok: true });
    } finally {
      router.dispose();
      service.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('bootstraps and registers the production service', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-production-bootstrap-'));
    const databasePath = join(directory, 'db.sqlite');
    createDatabase(databasePath);
    createProject(directory);
    const services = new ServiceContainer();
    const { adapter, router } = createRouter();
    const runtime = bootstrapProduction({
      appVersion: '0.11.0',
      config,
      userDataPath: directory,
      databasePaths: [databasePath],
      projectRoot: directory,
      logger,
      router,
      services,
      restart: vi.fn(),
    });
    try {
      expect(services.resolve(SERVICE_TOKENS.production)).toBe(runtime.service);
      expect(adapter.handlers.has(IPC_CHANNELS.productionDashboard)).toBe(true);
    } finally {
      runtime.dispose();
      router.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
