export const ALLOWED_APPLICATION_IDS = [
  'chrome',
  'vscode',
  'calculator',
  'notepad',
  'settings',
] as const;

export const SAFE_COMMAND_IDS = [
  'open-chrome',
  'open-vscode',
  'open-downloads',
  'open-documents',
  'open-calculator',
  'open-notepad',
  'open-settings',
  'take-screenshot',
  'system-ram',
] as const;

export const FILE_OPERATION_KINDS = ['move', 'copy', 'delete'] as const;
export const SCREENSHOT_KINDS = ['screen', 'window', 'region'] as const;
export const NOTIFICATION_KINDS = ['desktop', 'progress', 'reminder', 'ai'] as const;

export type AllowedApplicationId = (typeof ALLOWED_APPLICATION_IDS)[number];
export type SafeCommandId = (typeof SAFE_COMMAND_IDS)[number];
export type FileOperationKind = (typeof FILE_OPERATION_KINDS)[number];
export type ScreenshotKind = (typeof SCREENSHOT_KINDS)[number];
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface AllowedApplication {
  readonly id: AllowedApplicationId;
  readonly name: string;
  readonly favorite: boolean;
  readonly supported: boolean;
}

export interface RunningApplication {
  readonly id: AllowedApplicationId;
  readonly name: string;
  readonly status: 'opened' | 'closed' | 'restarted' | 'front';
  readonly updatedAt: string;
}

export interface ApplicationActionRequest {
  readonly appId: AllowedApplicationId;
  readonly confirm?: true;
}

export interface ApplicationActionResult {
  readonly app: RunningApplication;
  readonly confirmationRequired: boolean;
}

export interface DesktopFileEntry {
  readonly path: string;
  readonly name: string;
  readonly kind: 'file' | 'folder';
  readonly sizeBytes: number;
  readonly modifiedAt: string;
}

export interface DesktopFolderListing {
  readonly path: string;
  readonly entries: readonly DesktopFileEntry[];
  readonly readOnly: true;
}

export interface FilePathRequest {
  readonly path: string;
}

export interface FileOperationRequest {
  readonly kind: FileOperationKind;
  readonly sourcePath: string;
  readonly destinationPath?: string;
  readonly confirm?: true;
}

export interface FileOperationResult {
  readonly kind: FileOperationKind;
  readonly sourcePath: string;
  readonly destinationPath?: string;
  readonly confirmationRequired: boolean;
  readonly completed: boolean;
}

export interface ClipboardSnapshot {
  readonly text: string;
  readonly updatedAt: string;
}

export interface ClipboardWriteRequest {
  readonly text: string;
}

export interface NotificationRequest {
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly progressPercent?: number;
}

export interface DesktopNotification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly progressPercent?: number;
  readonly createdAt: string;
}

export interface ScreenshotRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScreenshotRequest {
  readonly kind: ScreenshotKind;
  readonly region?: ScreenshotRegion;
}

export interface ScreenshotRecord {
  readonly id: string;
  readonly kind: ScreenshotKind;
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly capturedAt: string;
}

export interface SystemInformation {
  readonly cpu: {
    readonly model: string;
    readonly cores: number;
    readonly loadPercent: number;
  };
  readonly ram: {
    readonly totalBytes: number;
    readonly freeBytes: number;
    readonly usedPercent: number;
  };
  readonly disk: {
    readonly label: string;
    readonly totalBytes: number;
    readonly freeBytes: number;
    readonly usedPercent: number;
  };
  readonly battery: {
    readonly available: boolean;
    readonly charging: boolean;
    readonly percent: number;
  };
  readonly gpu: {
    readonly vendor: string;
    readonly model: string;
  };
  readonly operatingSystem: {
    readonly platform: string;
    readonly release: string;
    readonly arch: string;
  };
  readonly network: {
    readonly online: boolean;
    readonly interfaces: readonly string[];
  };
}

export interface AuditLogEntry {
  readonly id: string;
  readonly action: string;
  readonly target: string;
  readonly allowed: boolean;
  readonly createdAt: string;
  readonly detail: string;
}

export interface ToolRouteRequest {
  readonly prompt: string;
}

export interface ToolRouteResult {
  readonly command: SafeCommandId;
  readonly summary: string;
  readonly result:
    | ApplicationActionResult
    | DesktopFolderListing
    | ScreenshotRecord
    | SystemInformation
    | { readonly unsupported: true };
}

export interface DesktopDashboard {
  readonly allowedApplications: readonly AllowedApplication[];
  readonly runningApplications: readonly RunningApplication[];
  readonly recentApplications: readonly AllowedApplication[];
  readonly favoriteApplications: readonly AllowedApplication[];
  readonly recentFiles: readonly DesktopFileEntry[];
  readonly favoriteFolders: readonly DesktopFileEntry[];
  readonly clipboardHistory: readonly ClipboardSnapshot[];
  readonly notifications: readonly DesktopNotification[];
  readonly screenshots: readonly ScreenshotRecord[];
  readonly system: SystemInformation;
  readonly auditLogs: readonly AuditLogEntry[];
}
