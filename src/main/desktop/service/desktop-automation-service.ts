import { cp, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, normalize, resolve } from 'node:path';
import { cpus, freemem, networkInterfaces, platform, release, totalmem, type } from 'node:os';
import { randomUUID } from 'node:crypto';

import {
  ALLOWED_APPLICATION_IDS,
  type AllowedApplication,
  type AllowedApplicationId,
  type ApplicationActionResult,
  type AuditLogEntry,
  type ClipboardSnapshot,
  type DesktopDashboard,
  type DesktopFileEntry,
  type DesktopFolderListing,
  type DesktopNotification,
  type FileOperationRequest,
  type FileOperationResult,
  type NotificationRequest,
  type RunningApplication,
  type SafeCommandId,
  type ScreenshotRecord,
  type ScreenshotRequest,
  type SystemInformation,
  type ToolRouteResult,
} from '../../../shared/desktop/contracts';
import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError } from '../../platform/errors/platform-error';

interface ApplicationDefinition {
  readonly id: AllowedApplicationId;
  readonly name: string;
  readonly favorite: boolean;
  readonly launchTarget: string;
  readonly supportedPlatforms: readonly NodeJS.Platform[];
}

export interface DesktopScreenshotCapture {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

export interface DesktopAutomationHost {
  openApplication(target: string): Promise<void>;
  openPath(path: string): Promise<void>;
  showNotification(notification: DesktopNotification): void;
  readClipboard(): string;
  writeClipboard(text: string): void;
  captureScreenshot(request: ScreenshotRequest): Promise<DesktopScreenshotCapture>;
  getBattery(): Promise<SystemInformation['battery']>;
  getGpu(): Promise<SystemInformation['gpu']>;
  getDisk(rootPath: string): Promise<SystemInformation['disk']>;
  isOnline(): boolean;
}

export interface DesktopAutomationOptions {
  readonly host: DesktopAutomationHost;
  readonly homeDirectory: string;
  readonly allowedRoots: readonly string[];
  readonly downloadsPath: string;
  readonly documentsPath: string;
  readonly desktopPath: string;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}

const MAX_HISTORY = 20;

const APPLICATIONS: readonly ApplicationDefinition[] = [
  {
    id: 'chrome',
    name: 'Google Chrome',
    favorite: true,
    launchTarget: 'chrome',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    favorite: true,
    launchTarget: 'code',
    supportedPlatforms: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'calculator',
    name: 'Calculator',
    favorite: true,
    launchTarget: 'calc',
    supportedPlatforms: ['win32'],
  },
  {
    id: 'notepad',
    name: 'Notepad',
    favorite: false,
    launchTarget: 'notepad',
    supportedPlatforms: ['win32'],
  },
  {
    id: 'settings',
    name: 'Settings',
    favorite: false,
    launchTarget: 'ms-settings:',
    supportedPlatforms: ['win32'],
  },
];

function assertNever(value: never): never {
  void value;
  throw new PlatformError(ERROR_CODES.validationFailed, 'Unsupported desktop request.');
}

function toPercent(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((used / total) * 1000) / 10;
}

function isChildPath(candidate: string, root: string): boolean {
  const resolvedCandidate = resolve(candidate);
  const resolvedRoot = resolve(root);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}\\`);
}

function latestFirst<T extends { readonly updatedAt?: string; readonly createdAt?: string }>(
  values: readonly T[],
): readonly T[] {
  return [...values].sort((left, right) => {
    const leftDate = left.updatedAt ?? left.createdAt ?? '';
    const rightDate = right.updatedAt ?? right.createdAt ?? '';
    return rightDate.localeCompare(leftDate);
  });
}

export class DesktopAutomationService {
  readonly #host: DesktopAutomationHost;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #allowedRoots: readonly string[];
  readonly #downloadsPath: string;
  readonly #documentsPath: string;
  readonly #desktopPath: string;
  readonly #runningApplications = new Map<AllowedApplicationId, RunningApplication>();
  readonly #recentApplications: AllowedApplicationId[] = [];
  readonly #recentFiles: DesktopFileEntry[] = [];
  readonly #clipboardHistory: ClipboardSnapshot[] = [];
  readonly #notifications: DesktopNotification[] = [];
  readonly #screenshots: ScreenshotRecord[] = [];
  readonly #auditLogs: AuditLogEntry[] = [];

  public constructor(options: DesktopAutomationOptions) {
    this.#host = options.host;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#allowedRoots = options.allowedRoots.map((root) => resolve(root));
    this.#downloadsPath = options.downloadsPath;
    this.#documentsPath = options.documentsPath;
    this.#desktopPath = options.desktopPath;
  }

  public allowedApplications(): readonly AllowedApplication[] {
    return APPLICATIONS.map((definition) => ({
      id: definition.id,
      name: definition.name,
      favorite: definition.favorite,
      supported: definition.supportedPlatforms.includes(process.platform),
    }));
  }

  public async dashboard(): Promise<DesktopDashboard> {
    const system = await this.systemInformation();
    return {
      allowedApplications: this.allowedApplications(),
      runningApplications: latestFirst([...this.#runningApplications.values()]),
      recentApplications: this.#recentApplications
        .map((id) => this.allowedApplications().find((app) => app.id === id))
        .filter((app): app is AllowedApplication => Boolean(app)),
      favoriteApplications: this.allowedApplications().filter((app) => app.favorite),
      recentFiles: this.#recentFiles,
      favoriteFolders: await Promise.all(
        [this.#downloadsPath, this.#documentsPath, this.#desktopPath].map((path) =>
          this.describePath(path),
        ),
      ),
      clipboardHistory: this.#clipboardHistory,
      notifications: this.#notifications,
      screenshots: this.#screenshots,
      system,
      auditLogs: this.#auditLogs,
    };
  }

  public async openApplication(appId: AllowedApplicationId): Promise<ApplicationActionResult> {
    const definition = this.applicationDefinition(appId);
    await this.#host.openApplication(definition.launchTarget);
    return this.recordApplication(definition, 'opened', false);
  }

  public closeApplication(appId: AllowedApplicationId, confirm?: true): ApplicationActionResult {
    const definition = this.applicationDefinition(appId);
    if (!confirm) return this.recordApplication(definition, 'closed', true);
    this.#runningApplications.delete(appId);
    this.audit('application.close', appId, true, 'Confirmed close request recorded.');
    return this.recordApplication(definition, 'closed', false);
  }

  public async restartApplication(
    appId: AllowedApplicationId,
    confirm?: true,
  ): Promise<ApplicationActionResult> {
    const definition = this.applicationDefinition(appId);
    if (!confirm) return this.recordApplication(definition, 'restarted', true);
    await this.#host.openApplication(definition.launchTarget);
    return this.recordApplication(definition, 'restarted', false);
  }

  public bringApplicationToFront(appId: AllowedApplicationId): ApplicationActionResult {
    const definition = this.applicationDefinition(appId);
    return this.recordApplication(definition, 'front', false);
  }

  public async openFile(path: string): Promise<DesktopFileEntry> {
    const entry = await this.describePath(path);
    if (entry.kind !== 'file') {
      throw new PlatformError(ERROR_CODES.validationFailed, 'Requested path is not a file.');
    }
    await this.#host.openPath(entry.path);
    this.pushRecentFile(entry);
    this.audit('file.open', entry.path, true, 'Allowed file opened.');
    return entry;
  }

  public async openFolder(path: string): Promise<DesktopFolderListing> {
    this.assertAllowedPath(path);
    await this.#host.openPath(resolve(path));
    this.audit('folder.open', path, true, 'Allowed folder opened.');
    return this.browseFolder(path);
  }

  public async browseFolder(path: string): Promise<DesktopFolderListing> {
    this.assertAllowedPath(path);
    const folderPath = resolve(path);
    const entries = await readdir(folderPath, { withFileTypes: true });
    const listed = await Promise.all(
      entries
        .slice(0, 100)
        .map(async (entry) => this.describePath(resolve(folderPath, entry.name))),
    );
    this.audit('folder.browse', folderPath, true, 'Read-only folder listing returned.');
    return { path: folderPath, entries: listed, readOnly: true };
  }

  public async operateFile(request: FileOperationRequest): Promise<FileOperationResult> {
    this.assertAllowedPath(request.sourcePath);
    if (request.destinationPath) this.assertAllowedPath(request.destinationPath);
    if (!request.confirm) {
      this.audit('file.operation.confirmation', request.kind, true, 'Confirmation required.');
      return {
        kind: request.kind,
        sourcePath: resolve(request.sourcePath),
        destinationPath: request.destinationPath ? resolve(request.destinationPath) : undefined,
        confirmationRequired: true,
        completed: false,
      };
    }

    const sourcePath = resolve(request.sourcePath);
    const destinationPath = request.destinationPath ? resolve(request.destinationPath) : undefined;
    switch (request.kind) {
      case 'move':
        if (!destinationPath) {
          throw new PlatformError(
            ERROR_CODES.validationFailed,
            'Move requires a destination path.',
          );
        }
        await rename(sourcePath, destinationPath);
        break;
      case 'copy':
        if (!destinationPath) {
          throw new PlatformError(
            ERROR_CODES.validationFailed,
            'Copy requires a destination path.',
          );
        }
        await cp(sourcePath, destinationPath, { recursive: true, force: false });
        break;
      case 'delete':
        await rm(sourcePath, { recursive: true, force: false });
        break;
      default:
        assertNever(request.kind);
    }

    this.audit('file.operation', request.kind, true, 'Confirmed file operation completed.');
    return {
      kind: request.kind,
      sourcePath,
      destinationPath,
      confirmationRequired: false,
      completed: true,
    };
  }

  public readClipboard(): ClipboardSnapshot {
    const snapshot = { text: this.#host.readClipboard(), updatedAt: this.now() };
    this.pushClipboard(snapshot);
    this.audit('clipboard.read', 'clipboard', true, 'Clipboard read with permission.');
    return snapshot;
  }

  public writeClipboard(text: string): ClipboardSnapshot {
    this.#host.writeClipboard(text);
    const snapshot = { text, updatedAt: this.now() };
    this.pushClipboard(snapshot);
    this.audit('clipboard.write', 'clipboard', true, 'Clipboard write with permission.');
    return snapshot;
  }

  public sendNotification(request: NotificationRequest): DesktopNotification {
    const notification: DesktopNotification = {
      id: this.#idFactory(),
      kind: request.kind,
      title: request.title,
      body: request.body,
      progressPercent: request.progressPercent,
      createdAt: this.now(),
    };
    this.#notifications.unshift(notification);
    this.trim(this.#notifications);
    this.#host.showNotification(notification);
    this.audit('notification.send', request.kind, true, 'Notification emitted.');
    return notification;
  }

  public async captureScreenshot(request: ScreenshotRequest): Promise<ScreenshotRecord> {
    const capture = await this.#host.captureScreenshot(request);
    const screenshot: ScreenshotRecord = {
      id: this.#idFactory(),
      kind: request.kind,
      dataUrl: capture.dataUrl,
      width: capture.width,
      height: capture.height,
      capturedAt: this.now(),
    };
    this.#screenshots.unshift(screenshot);
    this.trim(this.#screenshots);
    this.audit('screenshot.capture', request.kind, true, 'Screenshot captured with permission.');
    return screenshot;
  }

  public async systemInformation(): Promise<SystemInformation> {
    const cpuList = cpus();
    const totalMemory = totalmem();
    const freeMemory = freemem();
    const networkNames = Object.entries(networkInterfaces())
      .filter(([, entries]) => (entries ?? []).some((entry) => !entry.internal))
      .map(([name]) => name);
    const disk = await this.#host.getDisk(this.#documentsPath);
    return {
      cpu: {
        model: cpuList[0]?.model ?? 'Unknown CPU',
        cores: cpuList.length,
        loadPercent: 0,
      },
      ram: {
        totalBytes: totalMemory,
        freeBytes: freeMemory,
        usedPercent: toPercent(totalMemory - freeMemory, totalMemory),
      },
      disk,
      battery: await this.#host.getBattery(),
      gpu: await this.#host.getGpu(),
      operatingSystem: {
        platform: `${type()} (${platform()})`,
        release: release(),
        arch: process.arch,
      },
      network: {
        online: this.#host.isOnline(),
        interfaces: networkNames,
      },
    };
  }

  public async routeTool(prompt: string): Promise<ToolRouteResult> {
    const normalizedPrompt = prompt.trim().toLowerCase();
    const command = this.matchCommand(normalizedPrompt);
    switch (command) {
      case 'open-chrome':
        return {
          command,
          summary: 'Opening Chrome from the allow-list.',
          result: await this.openApplication('chrome'),
        };
      case 'open-vscode':
        return {
          command,
          summary: 'Opening VS Code from the allow-list.',
          result: await this.openApplication('vscode'),
        };
      case 'open-downloads':
        return {
          command,
          summary: 'Showing Downloads with read-only browsing.',
          result: await this.openFolder(this.#downloadsPath),
        };
      case 'open-documents':
        return {
          command,
          summary: 'Showing Documents with read-only browsing.',
          result: await this.openFolder(this.#documentsPath),
        };
      case 'open-calculator':
        return {
          command,
          summary: 'Opening Calculator from the allow-list.',
          result: await this.openApplication('calculator'),
        };
      case 'open-notepad':
        return {
          command,
          summary: 'Opening Notepad from the allow-list.',
          result: await this.openApplication('notepad'),
        };
      case 'open-settings':
        return {
          command,
          summary: 'Opening Settings from the allow-list.',
          result: await this.openApplication('settings'),
        };
      case 'take-screenshot':
        return {
          command,
          summary: 'Capturing the screen with screenshot permission.',
          result: await this.captureScreenshot({ kind: 'screen' }),
        };
      case 'system-ram':
        return {
          command,
          summary: 'Reading system RAM information.',
          result: await this.systemInformation(),
        };
      default:
        assertNever(command);
    }
  }

  public auditLogs(): readonly AuditLogEntry[] {
    return this.#auditLogs;
  }

  private matchCommand(prompt: string): SafeCommandId {
    if (prompt.includes('vs code') || prompt.includes('vscode')) return 'open-vscode';
    if (prompt.includes('download')) return 'open-downloads';
    if (prompt.includes('document')) return 'open-documents';
    if (prompt.includes('calculator') || prompt.includes('calc')) return 'open-calculator';
    if (prompt.includes('notepad')) return 'open-notepad';
    if (prompt.includes('setting')) return 'open-settings';
    if (prompt.includes('screenshot') || prompt.includes('screen shot')) return 'take-screenshot';
    if (prompt.includes('ram') || prompt.includes('memory usage')) return 'system-ram';
    if (prompt.includes('chrome')) return 'open-chrome';
    return 'open-chrome';
  }

  private applicationDefinition(appId: AllowedApplicationId): ApplicationDefinition {
    if (!ALLOWED_APPLICATION_IDS.includes(appId)) {
      throw new PlatformError(ERROR_CODES.permissionDenied, 'Application is not allow-listed.');
    }
    const definition = APPLICATIONS.find((app) => app.id === appId);
    if (!definition) {
      throw new PlatformError(ERROR_CODES.permissionDenied, 'Application is not allow-listed.');
    }
    if (!definition.supportedPlatforms.includes(process.platform)) {
      throw new PlatformError(
        ERROR_CODES.validationFailed,
        `${definition.name} is not supported on this platform.`,
      );
    }
    return definition;
  }

  private recordApplication(
    definition: ApplicationDefinition,
    status: RunningApplication['status'],
    confirmationRequired: boolean,
  ): ApplicationActionResult {
    const app: RunningApplication = {
      id: definition.id,
      name: definition.name,
      status,
      updatedAt: this.now(),
    };
    if (!confirmationRequired) this.#runningApplications.set(definition.id, app);
    this.pushRecentApplication(definition.id);
    this.audit(
      `application.${status}`,
      definition.id,
      true,
      confirmationRequired ? 'Confirmation required.' : 'Allowed application action completed.',
    );
    return { app, confirmationRequired };
  }

  private async describePath(path: string): Promise<DesktopFileEntry> {
    this.assertAllowedPath(path);
    const resolvedPath = resolve(path);
    const metadata = await stat(resolvedPath);
    return {
      path: resolvedPath,
      name: basename(resolvedPath),
      kind: metadata.isDirectory() ? 'folder' : 'file',
      sizeBytes: metadata.size,
      modifiedAt: metadata.mtime.toISOString(),
    };
  }

  private assertAllowedPath(path: string): void {
    const resolvedPath = resolve(normalize(path));
    if (this.#allowedRoots.some((root) => isChildPath(resolvedPath, root))) return;
    this.audit('path.reject', resolvedPath, false, 'Path is outside the file allow-list.');
    throw new PlatformError(ERROR_CODES.permissionDenied, 'Path is outside the file allow-list.');
  }

  private pushRecentApplication(appId: AllowedApplicationId): void {
    const next = [appId, ...this.#recentApplications.filter((id) => id !== appId)];
    this.#recentApplications.splice(0, this.#recentApplications.length, ...next.slice(0, 8));
  }

  private pushRecentFile(entry: DesktopFileEntry): void {
    const next = [entry, ...this.#recentFiles.filter((file) => file.path !== entry.path)];
    this.#recentFiles.splice(0, this.#recentFiles.length, ...next.slice(0, 10));
  }

  private pushClipboard(snapshot: ClipboardSnapshot): void {
    this.#clipboardHistory.unshift(snapshot);
    this.trim(this.#clipboardHistory);
  }

  private trim<T>(values: T[]): void {
    values.splice(MAX_HISTORY);
  }

  private audit(action: string, target: string, allowed: boolean, detail: string): void {
    this.#auditLogs.unshift({
      id: this.#idFactory(),
      action,
      target,
      allowed,
      createdAt: this.now(),
      detail,
    });
    this.trim(this.#auditLogs);
  }

  private now(): string {
    return this.#clock().toISOString();
  }
}
