import { randomUUID } from 'node:crypto';

import {
  PLUGIN_CAPABILITY_KINDS,
  PLUGIN_PERMISSIONS,
  type InstalledPlugin,
  type PluginAuditEntry,
  type PluginCapability,
  type PluginInstallRequest,
  type PluginJsonObject,
  type PluginLogEntry,
  type PluginManifest,
  type PluginRemoveRequest,
  type PluginRemoveResult,
  type PluginRouteResult,
  type PluginSettings,
  type PluginSettingsUpdateRequest,
  type PluginSignature,
  type PluginToolInvokeRequest,
  type PluginToolResult,
  type PluginUpdateRequest,
  type PluginValidationIssue,
  type PluginValidationReport,
  type PluginVerification,
} from '../../../shared/plugins/contracts';
import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError } from '../../platform/errors/platform-error';
import type { PluginService } from '../../services/contracts';

export interface PluginManagerOptions {
  readonly appVersion: string;
  readonly registry?: readonly PluginManifest[];
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
  readonly rateLimitPerMinute?: number;
}

const DEFAULT_RATE_LIMIT_PER_MINUTE = 20;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;

const DEFAULT_REGISTRY: readonly PluginManifest[] = [
  {
    name: 'JARVIS Translate',
    id: 'jarvis-translate',
    version: '1.0.0',
    author: 'JARVIS Core',
    description: 'Adds isolated translation and summarization skills.',
    permissions: ['storage'],
    capabilities: [
      {
        id: 'translate-text',
        name: 'Translate',
        description: 'Translate text between languages.',
        kind: 'translate',
        requiredPermissions: [],
      },
      {
        id: 'summarize-text',
        name: 'Summarize',
        description: 'Summarize text in a controlled skill boundary.',
        kind: 'summarize',
        requiredPermissions: [],
      },
    ],
    minimumJarvisVersion: '0.8.0',
  },
  {
    name: 'Report Builder',
    id: 'report-builder',
    version: '1.0.0',
    author: 'JARVIS Core',
    description: 'Creates reports and PDF-ready outputs through validated tool calls.',
    permissions: ['storage', 'filesystem'],
    capabilities: [
      {
        id: 'generate-report',
        name: 'Generate Report',
        description: 'Generate a structured report from validated input.',
        kind: 'generate-report',
        requiredPermissions: ['storage'],
      },
      {
        id: 'create-pdf',
        name: 'Create PDF',
        description: 'Prepare a PDF creation request without direct filesystem access.',
        kind: 'create-pdf',
        requiredPermissions: ['filesystem'],
      },
    ],
    minimumJarvisVersion: '0.8.0',
  },
  {
    name: 'GitHub Workspace',
    id: 'github-workspace',
    version: '1.0.0',
    author: 'JARVIS Core',
    description: 'Adds GitHub-oriented company workflow skills behind network permission.',
    permissions: ['network', 'storage'],
    capabilities: [
      {
        id: 'github-summary',
        name: 'GitHub',
        description: 'Summarize GitHub work items through a permissioned connector boundary.',
        kind: 'github',
        requiredPermissions: ['network'],
      },
    ],
    minimumJarvisVersion: '0.8.0',
  },
];

function nowIso(clock: () => Date): string {
  return clock().toISOString();
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function jsonSize(value: PluginJsonObject): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function parseVersion(version: string): readonly [number, number, number] | null {
  if (!SEMVER_PATTERN.test(version)) return null;
  const [major, minor, patch] = version.split('.').map(Number);
  if (major === undefined || minor === undefined || patch === undefined) return null;
  return [major, minor, patch];
}

function compareVersions(left: string, right: string): number {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  if (!parsedLeft || !parsedRight) return left.localeCompare(right);
  for (let index = 0; index < parsedLeft.length; index += 1) {
    const difference = parsedLeft[index]! - parsedRight[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

function normalized(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function verificationFor(
  signature: PluginSignature | undefined,
  checkedAt: string,
): PluginVerification {
  if (!signature) {
    return { status: 'missing', reason: 'No digital signature was supplied.', checkedAt };
  }
  if (signature.trusted && signature.value.startsWith('jarvis-signature:')) {
    return { status: 'verified', reason: 'Signature is trusted by the local verifier.', checkedAt };
  }
  return { status: 'untrusted', reason: 'Signature was present but not trusted.', checkedAt };
}

function createSettings(): PluginSettings {
  return {
    configuration: {},
    grantedPermissions: [],
    storage: {},
    storageBytes: 0,
  };
}

export class PluginManager implements PluginService {
  readonly #appVersion: string;
  readonly #registry: PluginManifest[];
  readonly #installed = new Map<string, InstalledPlugin>();
  readonly #logs: PluginLogEntry[] = [];
  readonly #audit: PluginAuditEntry[] = [];
  readonly #toolCalls = new Map<string, number[]>();
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #rateLimitPerMinute: number;

  public constructor(options: PluginManagerOptions) {
    this.#appVersion = options.appVersion;
    this.#registry = [...(options.registry ?? DEFAULT_REGISTRY)];
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#rateLimitPerMinute = options.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE;
  }

  public listPluginIds(): Promise<readonly string[]> {
    return Promise.resolve([...this.#installed.keys()]);
  }

  public registry(): readonly PluginManifest[] {
    return this.#registry;
  }

  public dashboard(): {
    readonly installed: readonly InstalledPlugin[];
    readonly registry: readonly PluginManifest[];
    readonly availableSkills: readonly PluginCapability[];
    readonly updates: readonly InstalledPlugin[];
    readonly logs: readonly PluginLogEntry[];
    readonly audit: readonly PluginAuditEntry[];
  } {
    const installed = [...this.#installed.values()].map((plugin) => this.withUpdateStatus(plugin));
    return {
      installed,
      registry: this.registry(),
      availableSkills: installed.flatMap((plugin) => plugin.manifest.capabilities),
      updates: installed.filter((plugin) => plugin.status === 'update-available'),
      logs: this.#logs,
      audit: this.#audit,
    };
  }

  public validateManifest(manifest: PluginManifest): PluginValidationReport {
    const issues: PluginValidationIssue[] = [];
    if (!ID_PATTERN.test(manifest.id)) {
      issues.push({ field: 'id', message: 'Plugin ID must be lower-case kebab-case.' });
    }
    if (!SEMVER_PATTERN.test(manifest.version)) {
      issues.push({ field: 'version', message: 'Plugin version must use major.minor.patch.' });
    }
    if (!SEMVER_PATTERN.test(manifest.minimumJarvisVersion)) {
      issues.push({
        field: 'minimumJarvisVersion',
        message: 'Minimum JARVIS version must use major.minor.patch.',
      });
    } else if (compareVersions(manifest.minimumJarvisVersion, this.#appVersion) > 0) {
      issues.push({
        field: 'minimumJarvisVersion',
        message: 'Plugin requires a newer JARVIS version.',
      });
    }
    if (manifest.permissions.length !== unique(manifest.permissions).length) {
      issues.push({ field: 'permissions', message: 'Permissions must be unique.' });
    }
    for (const permission of manifest.permissions) {
      if (!PLUGIN_PERMISSIONS.includes(permission)) {
        issues.push({ field: 'permissions', message: `Unsupported permission: ${permission}` });
      }
    }
    if (manifest.capabilities.length === 0) {
      issues.push({ field: 'capabilities', message: 'Plugins must expose at least one skill.' });
    }
    if (
      manifest.capabilities.map((capability) => capability.id).length !==
      unique(manifest.capabilities.map((capability) => capability.id)).length
    ) {
      issues.push({ field: 'capabilities', message: 'Capability IDs must be unique.' });
    }
    for (const capability of manifest.capabilities) {
      if (!ID_PATTERN.test(capability.id)) {
        issues.push({ field: 'capabilities.id', message: 'Capability IDs must be kebab-case.' });
      }
      if (!PLUGIN_CAPABILITY_KINDS.includes(capability.kind)) {
        issues.push({ field: 'capabilities.kind', message: 'Capability kind is unsupported.' });
      }
      for (const permission of capability.requiredPermissions) {
        if (!manifest.permissions.includes(permission)) {
          issues.push({
            field: 'capabilities.requiredPermissions',
            message: `Capability ${capability.id} requires undeclared permission ${permission}.`,
          });
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }

  public installPlugin(request: PluginInstallRequest): InstalledPlugin {
    const report = this.validateManifest(request.manifest);
    if (!report.valid) {
      this.audit(request.manifest.id, 'plugin.install', false, 'Manifest validation failed.');
      throw new PlatformError(ERROR_CODES.validationFailed, 'Plugin manifest validation failed.', {
        metadata: { issues: report.issues },
      });
    }
    if (this.#installed.has(request.manifest.id)) {
      throw new PlatformError(ERROR_CODES.serviceDuplicate, 'Plugin is already installed.');
    }
    const installedAt = this.now();
    const plugin: InstalledPlugin = {
      manifest: request.manifest,
      source: request.source ?? 'local',
      status: 'installed',
      installedAt,
      updatedAt: installedAt,
      verification: verificationFor(request.signature, installedAt),
      settings: createSettings(),
    };
    this.#installed.set(plugin.manifest.id, plugin);
    this.log(plugin.manifest.id, 'info', 'Plugin installed into the isolated registry.');
    this.audit(plugin.manifest.id, 'plugin.install', true, 'Plugin manifest installed.');
    return plugin;
  }

  public enablePlugin(pluginId: string): InstalledPlugin {
    const plugin = this.requirePlugin(pluginId);
    if (plugin.verification.status !== 'verified') {
      this.audit(pluginId, 'plugin.enable', false, 'Digital signature is not verified.');
      throw new PlatformError(ERROR_CODES.permissionDenied, 'Plugin signature is not verified.');
    }
    return this.replacePlugin(
      pluginId,
      {
        ...plugin,
        status: 'enabled',
        updatedAt: this.now(),
      },
      'plugin.enable',
      'Plugin enabled.',
    );
  }

  public disablePlugin(pluginId: string): InstalledPlugin {
    const plugin = this.requirePlugin(pluginId);
    return this.replacePlugin(
      pluginId,
      {
        ...plugin,
        status: 'disabled',
        updatedAt: this.now(),
      },
      'plugin.disable',
      'Plugin disabled.',
    );
  }

  public updatePlugin(request: PluginUpdateRequest): InstalledPlugin {
    const current = this.requirePlugin(request.pluginId);
    if (request.manifest.id !== request.pluginId) {
      throw new PlatformError(
        ERROR_CODES.validationFailed,
        'Updated manifest must keep the same ID.',
      );
    }
    const report = this.validateManifest(request.manifest);
    if (!report.valid) {
      throw new PlatformError(ERROR_CODES.validationFailed, 'Updated manifest validation failed.', {
        metadata: { issues: report.issues },
      });
    }
    if (compareVersions(request.manifest.version, current.manifest.version) <= 0) {
      throw new PlatformError(ERROR_CODES.validationFailed, 'Plugin update must increase version.');
    }
    const nextPermissions = current.settings.grantedPermissions.filter((permission) =>
      request.manifest.permissions.includes(permission),
    );
    const verification = verificationFor(request.signature, this.now());
    const next: InstalledPlugin = {
      ...current,
      manifest: request.manifest,
      status: verification.status === 'verified' ? current.status : 'disabled',
      updatedAt: this.now(),
      verification,
      settings: {
        ...current.settings,
        grantedPermissions: nextPermissions,
      },
    };
    return this.replacePlugin(request.pluginId, next, 'plugin.update', 'Plugin manually updated.');
  }

  public removePlugin(request: PluginRemoveRequest): PluginRemoveResult {
    this.requirePlugin(request.pluginId);
    if (!request.confirm) {
      this.audit(request.pluginId, 'plugin.remove.confirmation', true, 'Confirmation required.');
      return { pluginId: request.pluginId, confirmationRequired: true, removed: false };
    }
    this.#installed.delete(request.pluginId);
    this.audit(request.pluginId, 'plugin.remove', true, 'Plugin removed.');
    return { pluginId: request.pluginId, confirmationRequired: false, removed: true };
  }

  public updateSettings(request: PluginSettingsUpdateRequest): InstalledPlugin {
    const plugin = this.requirePlugin(request.pluginId);
    const grantedPermissions = request.grantedPermissions ?? plugin.settings.grantedPermissions;
    for (const permission of grantedPermissions) {
      if (!plugin.manifest.permissions.includes(permission)) {
        this.audit(plugin.manifest.id, 'plugin.settings', false, 'Permission grant rejected.');
        throw new PlatformError(
          ERROR_CODES.permissionDenied,
          'Cannot grant a permission the plugin did not request.',
        );
      }
    }
    const configuration = request.configuration ?? plugin.settings.configuration;
    const settings: PluginSettings = {
      ...plugin.settings,
      configuration,
      grantedPermissions: unique(grantedPermissions),
      storageBytes: jsonSize(plugin.settings.storage),
    };
    return this.replacePlugin(
      request.pluginId,
      {
        ...plugin,
        settings,
        updatedAt: this.now(),
      },
      'plugin.settings',
      'Plugin settings updated.',
    );
  }

  public resetPlugin(pluginId: string): InstalledPlugin {
    const plugin = this.requirePlugin(pluginId);
    const next: InstalledPlugin = {
      ...plugin,
      settings: createSettings(),
      updatedAt: this.now(),
    };
    this.#logs.splice(
      0,
      this.#logs.length,
      ...this.#logs.filter((log) => log.pluginId !== pluginId),
    );
    return this.replacePlugin(
      pluginId,
      next,
      'plugin.reset',
      'Plugin settings, storage, and logs reset.',
    );
  }

  public logs(pluginId?: string): readonly PluginLogEntry[] {
    return pluginId ? this.#logs.filter((log) => log.pluginId === pluginId) : this.#logs;
  }

  public auditLogs(): readonly PluginAuditEntry[] {
    return this.#audit;
  }

  public invokeTool(request: PluginToolInvokeRequest): PluginToolResult {
    const plugin = this.requirePlugin(request.pluginId);
    if (plugin.status !== 'enabled') {
      this.audit(plugin.manifest.id, 'tool.invoke', false, 'Plugin is not enabled.');
      throw new PlatformError(ERROR_CODES.permissionDenied, 'Plugin is not enabled.');
    }
    const capability = plugin.manifest.capabilities.find(
      (item) => item.id === request.capabilityId,
    );
    if (!capability) {
      throw new PlatformError(ERROR_CODES.serviceNotFound, 'Plugin capability was not found.');
    }
    this.assertSandboxPermissions(plugin, capability);
    this.assertToolInput(request.input);
    this.assertRateLimit(plugin.manifest.id);
    const result: PluginToolResult = {
      pluginId: plugin.manifest.id,
      capabilityId: capability.id,
      capabilityKind: capability.kind,
      executedBy: 'tool-registry',
      output: {
        message: `${capability.name} accepted by the isolated tool registry.`,
        pluginCodeExecuted: false,
        sandbox: 'isolated',
      },
    };
    this.log(plugin.manifest.id, 'audit', `Tool invoked through registry: ${capability.id}`);
    this.audit(plugin.manifest.id, 'tool.invoke', true, `Capability ${capability.id} invoked.`);
    return result;
  }

  public routeTool(prompt: string, input: PluginJsonObject = {}): PluginRouteResult {
    const promptText = normalized(prompt);
    const enabledPlugins = [...this.#installed.values()].filter(
      (plugin) => plugin.status === 'enabled',
    );
    const match = enabledPlugins
      .flatMap((plugin) =>
        plugin.manifest.capabilities.map((capability) => ({ plugin, capability })),
      )
      .find(({ capability }) => {
        const target = normalized(
          `${capability.name} ${capability.description} ${capability.kind}`,
        );
        return target.split(' ').some((word) => word.length > 3 && promptText.includes(word));
      });
    if (!match) {
      this.audit(
        'tool-registry',
        'tool.route',
        false,
        'No enabled plugin skill matched the prompt.',
      );
      return { selected: false, reason: 'No enabled plugin skill matched the prompt.' };
    }
    return {
      selected: true,
      reason: `Selected ${match.capability.name} from ${match.plugin.manifest.name}.`,
      tool: this.invokeTool({
        pluginId: match.plugin.manifest.id,
        capabilityId: match.capability.id,
        input,
      }),
    };
  }

  private assertSandboxPermissions(plugin: InstalledPlugin, capability: PluginCapability): void {
    for (const permission of capability.requiredPermissions) {
      if (!plugin.manifest.permissions.includes(permission)) {
        this.audit(
          plugin.manifest.id,
          'sandbox.permission',
          false,
          'Capability permission missing.',
        );
        throw new PlatformError(
          ERROR_CODES.permissionDenied,
          'Capability permission is not declared.',
        );
      }
      if (!plugin.settings.grantedPermissions.includes(permission)) {
        this.audit(
          plugin.manifest.id,
          'sandbox.permission',
          false,
          `Permission denied: ${permission}`,
        );
        throw new PlatformError(
          ERROR_CODES.permissionDenied,
          `Plugin permission denied: ${permission}`,
        );
      }
    }
  }

  private assertToolInput(input: PluginJsonObject): void {
    if (Object.keys(input).length > 50 || jsonSize(input) > 64_000) {
      throw new PlatformError(ERROR_CODES.validationFailed, 'Plugin tool input is too large.');
    }
  }

  private assertRateLimit(pluginId: string): void {
    const now = this.#clock().getTime();
    const windowStart = now - 60_000;
    const recent = (this.#toolCalls.get(pluginId) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );
    if (recent.length >= this.#rateLimitPerMinute) {
      this.audit(pluginId, 'tool.rate-limit', false, 'Plugin tool rate limit exceeded.');
      throw new PlatformError(ERROR_CODES.rateLimited, 'Plugin tool rate limit exceeded.');
    }
    recent.push(now);
    this.#toolCalls.set(pluginId, recent);
  }

  private requirePlugin(pluginId: string): InstalledPlugin {
    const plugin = this.#installed.get(pluginId);
    if (!plugin) throw new PlatformError(ERROR_CODES.serviceNotFound, 'Plugin is not installed.');
    return plugin;
  }

  private replacePlugin(
    pluginId: string,
    plugin: InstalledPlugin,
    action: string,
    detail: string,
  ): InstalledPlugin {
    this.#installed.set(pluginId, plugin);
    this.log(pluginId, action === 'plugin.reset' ? 'warn' : 'info', detail);
    this.audit(pluginId, action, true, detail);
    return plugin;
  }

  private withUpdateStatus(plugin: InstalledPlugin): InstalledPlugin {
    const available = this.#registry.find((candidate) => candidate.id === plugin.manifest.id);
    if (!available || compareVersions(available.version, plugin.manifest.version) <= 0)
      return plugin;
    return { ...plugin, status: 'update-available' };
  }

  private log(pluginId: string, level: PluginLogEntry['level'], message: string): void {
    this.#logs.unshift({
      id: this.#idFactory(),
      pluginId,
      level,
      message,
      createdAt: this.now(),
    });
    this.#logs.splice(50);
  }

  private audit(pluginId: string, action: string, allowed: boolean, detail: string): void {
    this.#audit.unshift({
      id: this.#idFactory(),
      pluginId,
      action,
      allowed,
      detail,
      createdAt: this.now(),
    });
    this.#audit.splice(100);
  }

  private now(): string {
    return nowIso(this.#clock);
  }
}

export function createTrustedSignature(pluginId: string): PluginSignature {
  return {
    algorithm: 'ed25519',
    value: `jarvis-signature:${pluginId}`,
    trusted: true,
  };
}

export function createDefaultPluginRegistry(): readonly PluginManifest[] {
  return DEFAULT_REGISTRY;
}
