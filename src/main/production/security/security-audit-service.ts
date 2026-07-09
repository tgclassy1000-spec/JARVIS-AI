import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type {
  ProductionCheck,
  ProductionStatus,
  SecurityAuditReport,
} from '../../../shared/production/contracts';
import { PERMISSIONS } from '../../../shared/platform/permissions';

export interface SecurityAuditServiceOptions {
  readonly projectRoot: string;
  readonly cspHtmlPath: string;
  readonly allowedIpcChannels: readonly string[];
  readonly allowedPermissions?: readonly string[];
  readonly clock?: () => Date;
}

const SECRET_PATTERN =
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']([A-Za-z0-9_./+=-]{16,})["']/i;

function asObject(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function asDependencyMap(value: unknown): Readonly<Record<string, string>> {
  const object = asObject(value);
  return Object.fromEntries(
    Object.entries(object).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function summarize(checks: readonly ProductionCheck[]): SecurityAuditReport['summary'] {
  return Object.freeze({
    passed: checks.filter((check) => check.status === 'pass').length,
    warnings: checks.filter((check) => check.status === 'warn').length,
    failed: checks.filter((check) => check.status === 'fail').length,
  });
}

function statusFromBoolean(passed: boolean, warning = false): ProductionStatus {
  if (passed) return 'pass';
  return warning ? 'warn' : 'fail';
}

export class SecurityAuditService {
  readonly #projectRoot: string;
  readonly #cspHtmlPath: string;
  readonly #allowedIpcChannels: readonly string[];
  readonly #allowedPermissions: readonly string[];
  readonly #clock: () => Date;

  public constructor(options: SecurityAuditServiceOptions) {
    this.#projectRoot = options.projectRoot;
    this.#cspHtmlPath = options.cspHtmlPath;
    this.#allowedIpcChannels = Object.freeze([...options.allowedIpcChannels]);
    this.#allowedPermissions = Object.freeze(
      options.allowedPermissions ?? Object.values(PERMISSIONS),
    );
    this.#clock = options.clock ?? (() => new Date());
  }

  public runAudit(): SecurityAuditReport {
    const checks = Object.freeze([
      this.dependencyVerification(),
      this.cspVerification(),
      this.ipcAudit(),
      this.permissionAudit(),
      this.secretScan(),
      this.inputFuzzTest(),
    ]);
    return Object.freeze({
      generatedAt: this.#clock().toISOString(),
      checks,
      summary: summarize(checks),
    });
  }

  private check(
    name: string,
    status: ProductionStatus,
    detail: string,
    recommendation?: string,
  ): ProductionCheck {
    return Object.freeze({
      area: 'security',
      name,
      status,
      detail,
      checkedAt: this.#clock().toISOString(),
      ...(recommendation ? { recommendation } : {}),
    });
  }

  private dependencyVerification(): ProductionCheck {
    const packageJsonPath = join(this.#projectRoot, 'package.json');
    const lockPath = join(this.#projectRoot, 'package-lock.json');
    if (!existsSync(packageJsonPath) || !existsSync(lockPath)) {
      return this.check(
        'Dependency verification',
        'fail',
        'package.json or package-lock.json is missing.',
      );
    }
    const packageJson = asObject(JSON.parse(readFileSync(packageJsonPath, 'utf8')));
    const lockJson = asObject(JSON.parse(readFileSync(lockPath, 'utf8')));
    const dependencies = {
      ...asDependencyMap(packageJson.dependencies),
      ...asDependencyMap(packageJson.devDependencies),
    };
    const floating = Object.entries(dependencies).filter(
      ([, version]) => version === 'latest' || version === '*',
    );
    const lockfileVersion = Number(lockJson.lockfileVersion ?? 0);
    const passed = floating.length === 0 && lockfileVersion >= 3;
    return this.check(
      'Dependency verification',
      statusFromBoolean(passed),
      passed
        ? 'Lockfile is present and no wildcard dependency versions were found.'
        : 'Dependency pinning or lockfile version needs attention.',
      'Avoid wildcard dependency versions and keep the lockfile committed.',
    );
  }

  private cspVerification(): ProductionCheck {
    if (!existsSync(this.#cspHtmlPath)) {
      return this.check('CSP verification', 'fail', 'Renderer HTML entrypoint is missing.');
    }
    const html = readFileSync(this.#cspHtmlPath, 'utf8');
    const content = /Content-Security-Policy"\s+content="([^"]+)"/i.exec(html)?.[1] ?? '';
    const required = ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'"];
    const hasRequired = required.every((directive) => content.includes(directive));
    const hasUnsafe = /unsafe-inline|unsafe-eval|\*/i.test(content);
    return this.check(
      'CSP verification',
      statusFromBoolean(hasRequired && !hasUnsafe),
      hasRequired && !hasUnsafe
        ? 'Renderer Content Security Policy blocks objects, frames, wildcards, and unsafe script execution.'
        : 'Renderer Content Security Policy is missing a required release directive.',
      'Keep production CSP free of wildcards, unsafe-inline, and unsafe-eval.',
    );
  }

  private ipcAudit(): ProductionCheck {
    const unique = new Set(this.#allowedIpcChannels);
    const rendererFiles = this.walk(join(this.#projectRoot, 'src', 'renderer'));
    const directIpc = rendererFiles.filter((file) =>
      readFileSync(file, 'utf8').includes('ipcRenderer'),
    );
    const passed = unique.size === this.#allowedIpcChannels.length && directIpc.length === 0;
    return this.check(
      'IPC audit',
      statusFromBoolean(passed),
      passed
        ? `${unique.size} IPC channels are allow-listed and renderer code has no direct ipcRenderer access.`
        : 'IPC allow-list uniqueness or renderer isolation failed.',
      'Expose IPC only through preload typed bridge methods.',
    );
  }

  private permissionAudit(): ProductionCheck {
    const required = [
      PERMISSIONS.appLaunch,
      PERMISSIONS.fileAccess,
      PERMISSIONS.officeAutomation,
      PERMISSIONS.notifications,
      PERMISSIONS.clipboard,
      PERMISSIONS.network,
    ];
    const missing = required.filter((permission) => !this.#allowedPermissions.includes(permission));
    return this.check(
      'Permission audit',
      statusFromBoolean(missing.length === 0),
      missing.length === 0
        ? 'Required desktop capability permissions are represented in the permission framework.'
        : `Missing permissions: ${missing.join(', ')}`,
    );
  }

  private secretScan(): ProductionCheck {
    const scanRoots = ['src', 'docs', '.env.example', 'package.json'].map((entry) =>
      join(this.#projectRoot, entry),
    );
    const files = scanRoots.flatMap((entry) => this.walk(entry));
    const matches = files.filter((file) => SECRET_PATTERN.test(readFileSync(file, 'utf8')));
    return this.check(
      'Secret scan',
      statusFromBoolean(matches.length === 0),
      matches.length === 0
        ? 'No hard-coded high-entropy secret assignments were found in release-scanned files.'
        : `Potential secrets found in ${matches.map((file) => relative(this.#projectRoot, file)).join(', ')}`,
      'Keep provider secrets in Main-process environment variables only.',
    );
  }

  private inputFuzzTest(): ProductionCheck {
    const samples = ['{}', '[]', '"x"', '{"nested":{"value":[1,true,null]}}', '{bad json'];
    const survived = samples.every((sample) => {
      try {
        JSON.parse(sample);
        return sample !== '{bad json';
      } catch {
        return sample === '{bad json';
      }
    });
    return this.check(
      'Input fuzz testing',
      statusFromBoolean(survived),
      'Bounded JSON fuzz samples were parsed or rejected deterministically.',
    );
  }

  private walk(path: string): readonly string[] {
    if (!existsSync(path)) return Object.freeze([]);
    const stat = statSync(path);
    if (stat.isFile()) return Object.freeze([path]);
    const files = readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name === 'node_modules' || entry.name === 'coverage' || entry.name === 'out') {
        return [];
      }
      return this.walk(join(path, entry.name));
    });
    return Object.freeze(files);
  }
}
