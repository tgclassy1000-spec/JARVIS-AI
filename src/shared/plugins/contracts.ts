export const PLUGIN_PERMISSIONS = [
  'network',
  'filesystem',
  'clipboard',
  'desktop',
  'notifications',
  'storage',
] as const;

export const PLUGIN_CAPABILITY_KINDS = [
  'translate',
  'summarize',
  'create-pdf',
  'generate-report',
  'convert-file',
  'calendar',
  'email',
  'github',
  'slack',
  'notion',
  'weather',
  'finance',
  'custom-company-tools',
] as const;

export const PLUGIN_SOURCES = ['local', 'future-store'] as const;
export const PLUGIN_STATUS = ['installed', 'enabled', 'disabled', 'update-available'] as const;
export const PLUGIN_VERIFICATION_STATUS = ['verified', 'missing', 'untrusted'] as const;
export const PLUGIN_LOG_LEVELS = ['info', 'warn', 'error', 'audit'] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];
export type PluginCapabilityKind = (typeof PLUGIN_CAPABILITY_KINDS)[number];
export type PluginSource = (typeof PLUGIN_SOURCES)[number];
export type PluginStatus = (typeof PLUGIN_STATUS)[number];
export type PluginVerificationStatus = (typeof PLUGIN_VERIFICATION_STATUS)[number];
export type PluginLogLevel = (typeof PLUGIN_LOG_LEVELS)[number];

export type PluginJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly PluginJsonValue[]
  | { readonly [key: string]: PluginJsonValue };

export type PluginJsonObject = { readonly [key: string]: PluginJsonValue };

export interface PluginCapability {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: PluginCapabilityKind;
  readonly requiredPermissions: readonly PluginPermission[];
}

export interface PluginManifest {
  readonly name: string;
  readonly id: string;
  readonly version: string;
  readonly author: string;
  readonly description: string;
  readonly permissions: readonly PluginPermission[];
  readonly capabilities: readonly PluginCapability[];
  readonly minimumJarvisVersion: string;
}

export interface PluginSignature {
  readonly algorithm: 'ed25519';
  readonly value: string;
  readonly trusted: boolean;
}

export interface PluginVerification {
  readonly status: PluginVerificationStatus;
  readonly reason: string;
  readonly checkedAt: string;
}

export interface PluginSettings {
  readonly configuration: PluginJsonObject;
  readonly grantedPermissions: readonly PluginPermission[];
  readonly storage: PluginJsonObject;
  readonly storageBytes: number;
}

export interface PluginLogEntry {
  readonly id: string;
  readonly pluginId: string;
  readonly level: PluginLogLevel;
  readonly message: string;
  readonly createdAt: string;
}

export interface PluginAuditEntry {
  readonly id: string;
  readonly pluginId: string;
  readonly action: string;
  readonly allowed: boolean;
  readonly detail: string;
  readonly createdAt: string;
}

export interface InstalledPlugin {
  readonly manifest: PluginManifest;
  readonly source: PluginSource;
  readonly status: PluginStatus;
  readonly installedAt: string;
  readonly updatedAt: string;
  readonly verification: PluginVerification;
  readonly settings: PluginSettings;
}

export interface PluginValidationIssue {
  readonly field: string;
  readonly message: string;
}

export interface PluginValidationReport {
  readonly valid: boolean;
  readonly issues: readonly PluginValidationIssue[];
}

export interface PluginInstallRequest {
  readonly manifest: PluginManifest;
  readonly source?: PluginSource;
  readonly signature?: PluginSignature;
}

export interface PluginUpdateRequest {
  readonly pluginId: string;
  readonly manifest: PluginManifest;
  readonly signature?: PluginSignature;
}

export interface PluginIdRequest {
  readonly pluginId: string;
}

export interface PluginRemoveRequest {
  readonly pluginId: string;
  readonly confirm?: true;
}

export interface PluginRemoveResult {
  readonly pluginId: string;
  readonly confirmationRequired: boolean;
  readonly removed: boolean;
}

export interface PluginSettingsUpdateRequest {
  readonly pluginId: string;
  readonly configuration?: PluginJsonObject;
  readonly grantedPermissions?: readonly PluginPermission[];
}

export interface PluginToolInvokeRequest {
  readonly pluginId: string;
  readonly capabilityId: string;
  readonly input: PluginJsonObject;
}

export interface PluginToolRouteRequest {
  readonly prompt: string;
  readonly input?: PluginJsonObject;
}

export interface PluginToolResult {
  readonly pluginId: string;
  readonly capabilityId: string;
  readonly capabilityKind: PluginCapabilityKind;
  readonly executedBy: 'tool-registry';
  readonly output: PluginJsonObject;
}

export interface PluginRouteResult {
  readonly selected: boolean;
  readonly reason: string;
  readonly tool?: PluginToolResult;
}

export interface PluginDashboard {
  readonly installed: readonly InstalledPlugin[];
  readonly registry: readonly PluginManifest[];
  readonly availableSkills: readonly PluginCapability[];
  readonly updates: readonly InstalledPlugin[];
  readonly logs: readonly PluginLogEntry[];
  readonly audit: readonly PluginAuditEntry[];
}
