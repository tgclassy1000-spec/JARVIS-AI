// @vitest-environment node

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CrashRecoveryService,
  type CrashAwareProcess,
  type CrashAwareWindow,
  type RendererCrashDetails,
} from '../../src/main/production/crash/crash-recovery-service';

class FakeProcess implements CrashAwareProcess {
  public uncaughtException: ((error: Error, origin: string) => void) | undefined;
  public unhandledRejection: ((reason: unknown) => void) | undefined;

  public on(event: 'uncaughtException', listener: (error: Error, origin: string) => void): void;
  public on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
  public on(event: 'uncaughtException' | 'unhandledRejection', listener: unknown): void {
    if (event === 'uncaughtException') {
      this.uncaughtException = listener as (error: Error, origin: string) => void;
    } else {
      this.unhandledRejection = listener as (reason: unknown) => void;
    }
  }
}

class FakeWindow implements CrashAwareWindow {
  public reloadCount = 0;
  public renderProcessGone: ((event: unknown, details: RendererCrashDetails) => void) | undefined;
  public unresponsive: (() => void) | undefined;
  public readonly webContents = {
    on: (event: 'render-process-gone' | 'unresponsive', listener: unknown) => {
      if (event === 'render-process-gone') {
        this.renderProcessGone = listener as (
          event: unknown,
          details: RendererCrashDetails,
        ) => void;
      } else {
        this.unresponsive = listener as () => void;
      }
    },
  };

  public reload(): void {
    this.reloadCount += 1;
  }
}

describe('CrashRecoveryService', () => {
  it('records main and renderer crashes, reloads renderer, and writes recovery reports', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-crash-'));
    const fakeProcess = new FakeProcess();
    const fakeWindow = new FakeWindow();
    const restart = vi.fn();
    let sequence = 0;
    const service = new CrashRecoveryService({
      reportDirectory: directory,
      appVersion: '0.11.0',
      restart,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
      idFactory: () => `crash-${sequence++}`,
    });

    try {
      service.installGlobalHandlers(fakeProcess);
      service.installGlobalHandlers(fakeProcess);
      fakeProcess.uncaughtException?.(new Error('main failed'), 'origin');
      fakeProcess.unhandledRejection?.('promise failed');
      service.attachWindow(fakeWindow);
      fakeWindow.renderProcessGone?.({}, {
        reason: 'crashed',
        exitCode: 9,
        processType: 'renderer',
      } satisfies RendererCrashDetails);
      fakeWindow.unresponsive?.();

      const restartResult = service.safeRestart();
      const report = service.recoveryReport();
      expect(restart).toHaveBeenCalledOnce();
      expect(restartResult.accepted).toBe(true);
      expect(fakeWindow.reloadCount).toBe(1);
      expect(report.reports).toHaveLength(5);
      expect(report.recommendations.join(' ')).toContain('Renderer recovery is active');
      expect(report.restartAvailable).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('loads existing reports and ignores unreadable report files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-crash-load-'));
    writeFileSync(
      join(directory, 'existing.json'),
      JSON.stringify({
        id: 'existing',
        kind: 'main-exception',
        process: 'main',
        reason: 'previous',
        message: 'Previous crash',
        recovered: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        metadata: {},
      }),
    );
    writeFileSync(join(directory, 'broken.json'), '{bad');
    const service = new CrashRecoveryService({
      reportDirectory: directory,
      appVersion: '0.11.0',
      clock: () => new Date('2026-01-02T00:00:00.000Z'),
    });
    try {
      expect(service.reports()[0]?.id).toBe('existing');
      expect(service.recoveryReport().recommendations.join(' ')).toContain('Main-process');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
