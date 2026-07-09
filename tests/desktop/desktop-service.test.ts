import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type {
  AllowedApplicationId,
  DesktopNotification,
  SystemInformation,
} from '../../src/shared/desktop/contracts';
import {
  DesktopAutomationService,
  type DesktopAutomationHost,
} from '../../src/main/desktop/service/desktop-automation-service';

function createHost(): DesktopAutomationHost & {
  readonly openedApplications: string[];
  readonly openedPaths: string[];
  clipboardText: string;
} {
  return {
    openedApplications: [],
    openedPaths: [],
    clipboardText: '',
    openApplication(target) {
      this.openedApplications.push(target);
      return Promise.resolve();
    },
    openPath(path) {
      this.openedPaths.push(path);
      return Promise.resolve();
    },
    showNotification(notification: DesktopNotification) {
      void notification;
      return undefined;
    },
    readClipboard() {
      return this.clipboardText;
    },
    writeClipboard(text) {
      this.clipboardText = text;
    },
    captureScreenshot() {
      return Promise.resolve({
        dataUrl: 'data:image/png;base64,test',
        width: 120,
        height: 80,
      });
    },
    getBattery(): Promise<SystemInformation['battery']> {
      return Promise.resolve({ available: true, charging: false, percent: 82 });
    },
    getGpu(): Promise<SystemInformation['gpu']> {
      return Promise.resolve({ vendor: 'test', model: 'gpu' });
    },
    getDisk(rootPath): Promise<SystemInformation['disk']> {
      return Promise.resolve({
        label: rootPath,
        totalBytes: 100,
        freeBytes: 40,
        usedPercent: 60,
      });
    },
    isOnline() {
      return true;
    },
  };
}

async function createService() {
  const root = join(process.cwd(), '.tmp-desktop-tests');
  const downloads = join(root, 'Downloads');
  const documents = join(root, 'Documents');
  const desktop = join(root, 'Desktop');
  await mkdir(downloads, { recursive: true });
  await mkdir(documents, { recursive: true });
  await mkdir(desktop, { recursive: true });
  const host = createHost();
  const service = new DesktopAutomationService({
    host,
    homeDirectory: root,
    allowedRoots: [downloads, documents, desktop],
    downloadsPath: downloads,
    documentsPath: documents,
    desktopPath: desktop,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
    idFactory: () => 'id',
  });
  return { service, host, root, downloads, documents };
}

describe('DesktopAutomationService', () => {
  it('opens only allow-listed applications', async () => {
    const { service, host } = await createService();

    const result = await service.openApplication('chrome');

    expect(result.confirmationRequired).toBe(false);
    expect(result.app.id).toBe('chrome');
    expect(host.openedApplications).toContain('chrome');
  });

  it('rejects application IDs outside the allow-list', async () => {
    const { service } = await createService();

    await expect(service.openApplication('terminal' as AllowedApplicationId)).rejects.toThrow(
      /allow-listed/,
    );
  });

  it('tracks application lifecycle, recents, favorites, and dashboard state', async () => {
    const { service } = await createService();

    await service.openApplication('chrome');
    expect(service.closeApplication('chrome').confirmationRequired).toBe(true);
    expect(service.closeApplication('chrome', true).confirmationRequired).toBe(false);
    expect((await service.restartApplication('vscode')).confirmationRequired).toBe(true);
    expect((await service.restartApplication('vscode', true)).confirmationRequired).toBe(false);
    expect(service.bringApplicationToFront('vscode').app.status).toBe('front');

    const dashboard = await service.dashboard();

    expect(dashboard.favoriteApplications.map((app) => app.id)).toContain('chrome');
    expect(dashboard.recentApplications.map((app) => app.id)).toContain('vscode');
    expect(dashboard.runningApplications.map((app) => app.id)).toContain('vscode');
  });

  it('opens files and folders as read-only allow-listed resources', async () => {
    const { service, host, documents } = await createService();
    const sourcePath = join(documents, 'open-me.txt');
    await writeFile(sourcePath, 'safe');

    const file = await service.openFile(sourcePath);
    const folder = await service.openFolder(documents);

    expect(file.kind).toBe('file');
    expect(folder.readOnly).toBe(true);
    expect(folder.entries.map((entry) => entry.name)).toContain('open-me.txt');
    expect(host.openedPaths).toContain(file.path);
  });

  it('requires confirmation before destructive file operations', async () => {
    const { service, documents } = await createService();
    const sourcePath = join(documents, 'note.txt');
    await writeFile(sourcePath, 'safe');

    const unconfirmed = await service.operateFile({ kind: 'delete', sourcePath });

    expect(unconfirmed.confirmationRequired).toBe(true);
    expect(unconfirmed.completed).toBe(false);
  });

  it('executes confirmed copy, move, and delete operations within allowed roots', async () => {
    const { service, documents, downloads } = await createService();
    const sourcePath = join(documents, 'copy-source.txt');
    const copiedPath = join(downloads, 'copied.txt');
    const movedPath = join(downloads, 'moved.txt');
    await writeFile(sourcePath, 'safe');

    const copied = await service.operateFile({
      kind: 'copy',
      sourcePath,
      destinationPath: copiedPath,
      confirm: true,
    });
    const moved = await service.operateFile({
      kind: 'move',
      sourcePath: copiedPath,
      destinationPath: movedPath,
      confirm: true,
    });
    const deleted = await service.operateFile({
      kind: 'delete',
      sourcePath: movedPath,
      confirm: true,
    });

    expect(copied.completed).toBe(true);
    expect(moved.destinationPath).toBe(movedPath);
    expect(deleted.completed).toBe(true);
    await expect(stat(movedPath)).rejects.toThrow();
    expect(await readFile(sourcePath, 'utf8')).toBe('safe');
  });

  it('rejects confirmed move and copy requests without destinations', async () => {
    const { service, documents } = await createService();
    const sourcePath = join(documents, 'missing-destination.txt');
    await writeFile(sourcePath, 'safe');

    await expect(service.operateFile({ kind: 'move', sourcePath, confirm: true })).rejects.toThrow(
      /destination/,
    );
    await expect(service.operateFile({ kind: 'copy', sourcePath, confirm: true })).rejects.toThrow(
      /destination/,
    );
  });

  it('rejects file paths outside the allow-list', async () => {
    const { service, root } = await createService();

    await expect(service.browseFolder(join(root, '..'))).rejects.toThrow(/allow-list/);
    expect(service.auditLogs()[0]?.allowed).toBe(false);
  });

  it('captures clipboard history and screenshots with audit entries', async () => {
    const { service } = await createService();

    service.writeClipboard('hello');
    const clipboard = service.readClipboard();
    const screenshot = await service.captureScreenshot({ kind: 'screen' });

    expect(clipboard.text).toBe('hello');
    expect(screenshot.width).toBe(120);
    expect(service.auditLogs().some((entry) => entry.action === 'screenshot.capture')).toBe(true);
  });

  it('sends notifications and keeps bounded dashboard history', async () => {
    const { service } = await createService();

    const notification = service.sendNotification({
      kind: 'progress',
      title: 'Progress',
      body: 'Working',
      progressPercent: 42,
    });
    for (let index = 0; index < 25; index += 1) {
      service.writeClipboard(`clip-${index}`);
    }
    const dashboard = await service.dashboard();

    expect(notification.progressPercent).toBe(42);
    expect(dashboard.notifications[0]?.kind).toBe('progress');
    expect(dashboard.clipboardHistory).toHaveLength(20);
  });

  it('routes natural language to safe commands', async () => {
    const { service } = await createService();

    const result = await service.routeTool('How much RAM am I using?');

    expect(result.command).toBe('system-ram');
    expect(result.summary).toMatch(/RAM/);
  });

  it('routes every safe desktop command through allow-listed tools', async () => {
    const { service } = await createService();
    const prompts = [
      'Open Chrome',
      'Open VS Code',
      'Show Downloads',
      'Open Documents',
      'Take Screenshot',
      'Open Chrome again',
    ];

    const commands = await Promise.all(prompts.map((prompt) => service.routeTool(prompt)));

    expect(commands.map((result) => result.command)).toEqual([
      'open-chrome',
      'open-vscode',
      'open-downloads',
      'open-documents',
      'take-screenshot',
      'open-chrome',
    ]);
  });

  it('falls back to the safest open Chrome command for unknown prompts', async () => {
    const { service } = await createService();

    const result = await service.routeTool('Please do the safe default thing');

    expect(result.command).toBe('open-chrome');
  });

  it('routes Windows-only safe commands when the platform supports them', async () => {
    const { service } = await createService();
    if (process.platform !== 'win32') return;

    const commands = await Promise.all(
      ['Open Calculator', 'Open Notepad', 'Open Settings'].map((prompt) =>
        service.routeTool(prompt),
      ),
    );

    expect(commands.map((result) => result.command)).toEqual([
      'open-calculator',
      'open-notepad',
      'open-settings',
    ]);
  });

  it('handles zero-sized disk totals defensively', async () => {
    const { service, host } = await createService();
    host.getDisk = (rootPath) =>
      Promise.resolve({ label: rootPath, totalBytes: 0, freeBytes: 0, usedPercent: 0 });

    const system = await service.systemInformation();

    expect(system.disk.usedPercent).toBe(0);
  });

  it('uses production clock and id factories when test overrides are absent', async () => {
    const root = join(process.cwd(), '.tmp-desktop-defaults');
    const downloads = join(root, 'Downloads');
    const documents = join(root, 'Documents');
    const desktop = join(root, 'Desktop');
    await mkdir(downloads, { recursive: true });
    await mkdir(documents, { recursive: true });
    await mkdir(desktop, { recursive: true });
    const service = new DesktopAutomationService({
      host: createHost(),
      homeDirectory: root,
      allowedRoots: [downloads, documents, desktop],
      downloadsPath: downloads,
      documentsPath: documents,
      desktopPath: desktop,
    });

    const notification = service.sendNotification({
      kind: 'desktop',
      title: 'Default',
      body: 'Factories',
    });

    expect(notification.id).toHaveLength(36);
    expect(Date.parse(notification.createdAt)).not.toBeNaN();
  });

  it('reports system information without shell execution', async () => {
    const { service } = await createService();

    const system = await service.systemInformation();

    expect(system.ram.totalBytes).toBeGreaterThan(0);
    expect(system.disk.usedPercent).toBe(60);
    expect(system.network.online).toBe(true);
  });
});
