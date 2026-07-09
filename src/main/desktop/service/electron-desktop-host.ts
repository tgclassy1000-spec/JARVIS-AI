import { statfs } from 'node:fs/promises';

import {
  BrowserWindow,
  Notification,
  app,
  clipboard,
  desktopCapturer,
  nativeImage,
  shell,
} from 'electron';

import type {
  DesktopNotification,
  ScreenshotRequest,
  SystemInformation,
} from '../../../shared/desktop/contracts';
import type { DesktopAutomationHost, DesktopScreenshotCapture } from './desktop-automation-service';

function fallbackPng(): DesktopScreenshotCapture {
  const image = nativeImage.createEmpty();
  return {
    dataUrl: image.toDataURL(),
    width: 1,
    height: 1,
  };
}

function readGpuDevices(info: unknown): readonly Record<string, unknown>[] {
  if (info === null || typeof info !== 'object') return [];
  const devices = (info as Readonly<Record<string, unknown>>).gpuDevice;
  return Array.isArray(devices)
    ? (devices.filter((device) => typeof device === 'object' && device !== null) as Record<
        string,
        unknown
      >[])
    : [];
}

function scalarToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'unknown';
}

export class ElectronDesktopHost implements DesktopAutomationHost {
  public async openApplication(target: string): Promise<void> {
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
  }

  public async openPath(path: string): Promise<void> {
    const error = await shell.openPath(path);
    if (error) throw new Error(error);
  }

  public showNotification(notification: DesktopNotification): void {
    if (!Notification.isSupported()) return;
    new Notification({ title: notification.title, body: notification.body }).show();
  }

  public readClipboard(): string {
    return clipboard.readText();
  }

  public writeClipboard(text: string): void {
    clipboard.writeText(text);
  }

  public async captureScreenshot(request: ScreenshotRequest): Promise<DesktopScreenshotCapture> {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (request.kind === 'window' && window) {
      const image = await window.capturePage();
      const size = image.getSize();
      return { dataUrl: image.toDataURL(), width: size.width, height: size.height };
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: request.region
        ? { width: request.region.width, height: request.region.height }
        : { width: 1440, height: 900 },
    });
    const source = sources.find((item) => item.name === 'Entire Screen') ?? sources[0];
    if (!source) return fallbackPng();
    const size = source.thumbnail.getSize();
    return { dataUrl: source.thumbnail.toDataURL(), width: size.width, height: size.height };
  }

  public getBattery(): Promise<SystemInformation['battery']> {
    return Promise.resolve({ available: false, charging: false, percent: 0 });
  }

  public async getGpu(): Promise<SystemInformation['gpu']> {
    const info = await app.getGPUInfo('basic');
    const firstDevice = readGpuDevices(info)[0];
    return {
      vendor: scalarToString(firstDevice?.vendorId),
      model: scalarToString(firstDevice?.deviceId),
    };
  }

  public async getDisk(rootPath: string): Promise<SystemInformation['disk']> {
    const stats = await statfs(rootPath);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    return {
      label: rootPath,
      totalBytes,
      freeBytes,
      usedPercent:
        totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 1000) / 10 : 0,
    };
  }

  public isOnline(): boolean {
    return true;
  }
}
