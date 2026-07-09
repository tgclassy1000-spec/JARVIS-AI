// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import type { DesktopController } from '../../src/main/desktop/ipc/desktop.endpoints';
import { registerDesktopEndpoints } from '../../src/main/desktop/ipc/desktop.endpoints';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import { createPermissionMiddleware } from '../../src/main/platform/ipc/middleware';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';
import { PermissionManager } from '../../src/main/platform/permissions/permission-manager';
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
    () => 'desktop-request',
  );
  return { adapter, router };
}

function controller(): DesktopController {
  return {
    dashboard: () =>
      Promise.resolve({
        allowedApplications: [],
        runningApplications: [],
        recentApplications: [],
        favoriteApplications: [],
        recentFiles: [],
        favoriteFolders: [],
        clipboardHistory: [],
        notifications: [],
        screenshots: [],
        system: {
          cpu: { model: 'Test CPU', cores: 1, loadPercent: 0 },
          ram: { totalBytes: 2, freeBytes: 1, usedPercent: 50 },
          disk: { label: 'disk', totalBytes: 2, freeBytes: 1, usedPercent: 50 },
          battery: { available: false, charging: false, percent: 0 },
          gpu: { vendor: 'test', model: 'gpu' },
          operatingSystem: { platform: 'test', release: 'test', arch: 'x64' },
          network: { online: true, interfaces: [] },
        },
        auditLogs: [],
      }),
    openApplication: (appId) =>
      Promise.resolve({
        app: { id: appId, name: appId, status: 'opened', updatedAt: '2026-01-01T00:00:00.000Z' },
        confirmationRequired: false,
      }),
    closeApplication: (appId, confirm) => ({
      app: { id: appId, name: appId, status: 'closed', updatedAt: '2026-01-01T00:00:00.000Z' },
      confirmationRequired: !confirm,
    }),
    restartApplication: (appId, confirm) =>
      Promise.resolve({
        app: {
          id: appId,
          name: appId,
          status: 'restarted',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        confirmationRequired: !confirm,
      }),
    bringApplicationToFront: (appId) => ({
      app: { id: appId, name: appId, status: 'front', updatedAt: '2026-01-01T00:00:00.000Z' },
      confirmationRequired: false,
    }),
    openFile: (path) =>
      Promise.resolve({
        path,
        name: path,
        kind: 'file',
        sizeBytes: 1,
        modifiedAt: '2026-01-01T00:00:00.000Z',
      }),
    openFolder: (path) => Promise.resolve({ path, entries: [], readOnly: true }),
    browseFolder: (path) => Promise.resolve({ path, entries: [], readOnly: true }),
    operateFile: (request) =>
      Promise.resolve({
        kind: request.kind,
        sourcePath: request.sourcePath,
        destinationPath: request.destinationPath,
        confirmationRequired: !request.confirm,
        completed: Boolean(request.confirm),
      }),
    readClipboard: () => ({ text: 'clip', updatedAt: '2026-01-01T00:00:00.000Z' }),
    writeClipboard: (text) => ({ text, updatedAt: '2026-01-01T00:00:00.000Z' }),
    sendNotification: (request) => ({
      id: 'notification',
      kind: request.kind,
      title: request.title,
      body: request.body,
      progressPercent: request.progressPercent,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    captureScreenshot: (request) =>
      Promise.resolve({
        id: 'screenshot',
        kind: request.kind,
        dataUrl: 'data:image/png;base64,test',
        width: 10,
        height: 10,
        capturedAt: '2026-01-01T00:00:00.000Z',
      }),
    systemInformation: () =>
      Promise.resolve({
        cpu: { model: 'Test CPU', cores: 1, loadPercent: 0 },
        ram: { totalBytes: 2, freeBytes: 1, usedPercent: 50 },
        disk: { label: 'disk', totalBytes: 2, freeBytes: 1, usedPercent: 50 },
        battery: { available: false, charging: false, percent: 0 },
        gpu: { vendor: 'test', model: 'gpu' },
        operatingSystem: { platform: 'test', release: 'test', arch: 'x64' },
        network: { online: true, interfaces: [] },
      }),
    routeTool: () =>
      Promise.resolve({
        command: 'open-vscode',
        summary: 'Opening VS Code from the allow-list.',
        result: {
          app: {
            id: 'vscode',
            name: 'Visual Studio Code',
            status: 'opened',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          confirmationRequired: false,
        },
      }),
    auditLogs: () => [],
  };
}

describe('desktop IPC endpoints', () => {
  it('registers allow-listed desktop endpoints', async () => {
    const { adapter, router } = createRouter();
    registerDesktopEndpoints(router, controller());
    const event = { senderUrl: 'file:///app', send: vi.fn() };
    const invoke = (channel: string, payload: unknown) =>
      adapter.handlers.get(channel)?.(event, payload);

    expect(adapter.handlers.size).toBe(16);
    await expect(invoke(IPC_CHANNELS.desktopDashboard, {})).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopOpenApplication, { appId: 'vscode' }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopCloseApplication, { appId: 'vscode', confirm: true }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopRestartApplication, { appId: 'vscode', confirm: true }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopFrontApplication, { appId: 'vscode' }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopOpenFile, { path: 'A:\\safe.txt' }),
    ).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      invoke(IPC_CHANNELS.desktopOpenFolder, { path: 'A:\\Downloads' }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopBrowseFolder, { path: 'A:\\Downloads' }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopFileOperation, { kind: 'delete', sourcePath: 'A:\\safe.txt' }),
    ).resolves.toMatchObject({
      ok: true,
      data: { confirmationRequired: true, completed: false },
    });
    await expect(invoke(IPC_CHANNELS.desktopClipboardRead, {})).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      invoke(IPC_CHANNELS.desktopClipboardWrite, { text: 'safe' }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopNotify, {
        kind: 'desktop',
        title: 'JARVIS',
        body: 'Safe notification',
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.desktopScreenshot, { kind: 'screen' })).resolves.toMatchObject(
      { ok: true },
    );
    await expect(invoke(IPC_CHANNELS.desktopSystem, {})).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.desktopRouteTool, { prompt: 'Open VS Code' }),
    ).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.desktopAuditLogs, {})).resolves.toMatchObject({ ok: true });
    router.dispose();
  });

  it('rejects invalid payloads and denied permissions', async () => {
    const { adapter, router } = createRouter('deny');
    registerDesktopEndpoints(router, controller());
    const event = { senderUrl: 'file:///app', send: vi.fn() };

    await expect(
      adapter.handlers.get(IPC_CHANNELS.desktopOpenApplication)?.(event, { appId: 'terminal' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    await expect(
      adapter.handlers.get(IPC_CHANNELS.desktopDashboard)?.(event, {}),
    ).resolves.toMatchObject({ ok: true });
  });
});
