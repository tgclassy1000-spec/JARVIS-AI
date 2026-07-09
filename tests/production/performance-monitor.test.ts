// @vitest-environment node

import { LazyResource } from '../../src/main/production/performance/lazy-resource';
import { PerformanceMonitor } from '../../src/main/production/performance/performance-monitor';

type IntervalCallback = () => void;

describe('PerformanceMonitor', () => {
  it('records startup, schedules background work, cleans resources, and detects leaks', async () => {
    const callbacks = new Map<number, IntervalCallback>();
    const cleared: number[] = [];
    let nextHandle = 1;
    let nowMs = 100;
    let heapUsed = 10_000;
    const monitor = new PerformanceMonitor({
      leakThresholdBytes: 1_000,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
      nowMs: () => nowMs,
      memoryUsage: () =>
        ({
          rss: 100_000,
          heapTotal: 40_000,
          heapUsed,
          external: 1_000,
          arrayBuffers: 500,
        }) satisfies NodeJS.MemoryUsage,
      setIntervalFn: ((callback: IntervalCallback) => {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
      }) as unknown as typeof setInterval,
      clearIntervalFn: ((handle: number) => {
        cleared.push(handle);
      }) as unknown as typeof clearInterval,
    });

    nowMs = 125;
    expect(monitor.markStartup('main-ready')).toEqual({ name: 'main-ready', elapsedMs: 25 });
    let shouldFail = false;
    monitor.scheduleTask({
      id: 'integrity',
      intervalMs: 1000,
      run: () => {
        if (shouldFail) throw new Error('task failed');
      },
    });
    await monitor.runTask('integrity');
    shouldFail = true;
    await monitor.runTask('integrity');
    expect(await monitor.runTask('missing')).toBeUndefined();

    let cleaned = 0;
    monitor.registerCleanup('ok', () => {
      cleaned += 1;
    });
    monitor.registerCleanup('bad', () => {
      throw new Error('cleanup failed');
    });
    monitor.recordMemorySample();
    heapUsed = 12_000;
    const snapshot = monitor.snapshot();
    expect(snapshot.startup).toEqual([{ name: 'main-ready', elapsedMs: 25 }]);
    expect(snapshot.backgroundTasks[0]).toMatchObject({
      id: 'integrity',
      runCount: 1,
      failureCount: 1,
      lastError: 'task failed',
    });
    expect(snapshot.leakDetection.status).toBe('warn');
    expect(monitor.cancelTask('missing')).toBe(false);
    expect(monitor.cancelTask('integrity')).toBe(true);
    expect(cleared).toEqual([1]);
    monitor.cleanupAll();
    expect(cleaned).toBe(1);
    monitor.dispose();
  });

  it('lazy-loads expensive resources only when accessed', () => {
    let loads = 0;
    const lazy = new LazyResource(() => {
      loads += 1;
      return { ready: true };
    });
    expect(lazy.loaded).toBe(false);
    expect(lazy.value.ready).toBe(true);
    expect(lazy.value.ready).toBe(true);
    expect(loads).toBe(1);
    lazy.clear();
    expect(lazy.loaded).toBe(false);
    expect(lazy.value.ready).toBe(true);
    expect(loads).toBe(2);
  });
});
