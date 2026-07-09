import type {
  BackgroundTaskStatus,
  LeakDetectionReport,
  MemoryProfile,
  PerformanceSnapshot,
  ProductionStatus,
  StartupMark,
} from '../../../shared/production/contracts';
import type { Logger } from '../../platform/logging/logger';

type TimerHandle = ReturnType<typeof setInterval>;

export interface PerformanceMonitorOptions {
  readonly leakThresholdBytes: number;
  readonly logger?: Logger;
  readonly clock?: () => Date;
  readonly nowMs?: () => number;
  readonly memoryUsage?: () => NodeJS.MemoryUsage;
  readonly setIntervalFn?: typeof setInterval;
  readonly clearIntervalFn?: typeof clearInterval;
}

export interface BackgroundTaskDefinition {
  readonly id: string;
  readonly intervalMs: number;
  readonly run: () => void | Promise<void>;
}

interface BackgroundTaskRuntime {
  readonly definition: BackgroundTaskDefinition;
  readonly handle: TimerHandle;
  runCount: number;
  failureCount: number;
  lastRunAt?: string;
  lastError?: string;
}

function memoryProfile(memory: NodeJS.MemoryUsage): MemoryProfile {
  return Object.freeze({
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
  });
}

export class PerformanceMonitor {
  readonly #startedAtMs: number;
  readonly #leakThresholdBytes: number;
  readonly #logger: Logger | undefined;
  readonly #clock: () => Date;
  readonly #nowMs: () => number;
  readonly #memoryUsage: () => NodeJS.MemoryUsage;
  readonly #setInterval: typeof setInterval;
  readonly #clearInterval: typeof clearInterval;
  readonly #marks: StartupMark[] = [];
  readonly #tasks = new Map<string, BackgroundTaskRuntime>();
  readonly #cleanupHandlers = new Map<string, () => void>();
  readonly #memorySamples: MemoryProfile[] = [];

  public constructor(options: PerformanceMonitorOptions) {
    this.#leakThresholdBytes = options.leakThresholdBytes;
    this.#logger = options.logger;
    this.#clock = options.clock ?? (() => new Date());
    this.#nowMs = options.nowMs ?? (() => performance.now());
    this.#startedAtMs = this.#nowMs();
    this.#memoryUsage = options.memoryUsage ?? process.memoryUsage;
    this.#setInterval = options.setIntervalFn ?? setInterval;
    this.#clearInterval = options.clearIntervalFn ?? clearInterval;
  }

  public markStartup(name: string): StartupMark {
    const mark = Object.freeze({ name, elapsedMs: Math.max(0, this.#nowMs() - this.#startedAtMs) });
    this.#marks.push(mark);
    return mark;
  }

  public recordMemorySample(
    profile: MemoryProfile = memoryProfile(this.#memoryUsage()),
  ): MemoryProfile {
    this.#memorySamples.push(profile);
    return profile;
  }

  public scheduleTask(definition: BackgroundTaskDefinition): BackgroundTaskStatus {
    this.cancelTask(definition.id);
    const runtime: BackgroundTaskRuntime = {
      definition,
      handle: this.#setInterval(() => void this.runTask(definition.id), definition.intervalMs),
      runCount: 0,
      failureCount: 0,
    };
    this.#tasks.set(definition.id, runtime);
    return this.taskStatus(runtime);
  }

  public async runTask(id: string): Promise<BackgroundTaskStatus | undefined> {
    const task = this.#tasks.get(id);
    if (!task) return undefined;
    try {
      await task.definition.run();
      task.runCount += 1;
      task.lastRunAt = this.#clock().toISOString();
      task.lastError = undefined;
    } catch (error) {
      task.failureCount += 1;
      task.lastError = error instanceof Error ? error.message : 'Background task failed.';
      this.#logger?.warn('Background task failed.', { taskId: id, error: task.lastError });
    }
    return this.taskStatus(task);
  }

  public cancelTask(id: string): boolean {
    const task = this.#tasks.get(id);
    if (!task) return false;
    this.#clearInterval(task.handle);
    return this.#tasks.delete(id);
  }

  public registerCleanup(id: string, cleanup: () => void): void {
    this.#cleanupHandlers.set(id, cleanup);
  }

  public cleanupAll(): void {
    for (const cleanup of this.#cleanupHandlers.values()) {
      try {
        cleanup();
      } catch (error) {
        this.#logger?.warn('Resource cleanup failed.', {
          error: error instanceof Error ? error.message : 'Unknown cleanup error.',
        });
      }
    }
    this.#cleanupHandlers.clear();
  }

  public snapshot(): PerformanceSnapshot {
    const memory = this.recordMemorySample();
    return Object.freeze({
      capturedAt: this.#clock().toISOString(),
      uptimeMs: Math.max(0, this.#nowMs() - this.#startedAtMs),
      startup: Object.freeze([...this.#marks]),
      memory,
      backgroundTasks: Object.freeze(
        [...this.#tasks.values()].map((task) => this.taskStatus(task)),
      ),
      cleanupHandlers: this.#cleanupHandlers.size,
      leakDetection: this.leakDetection(),
    });
  }

  public dispose(): void {
    for (const id of [...this.#tasks.keys()]) this.cancelTask(id);
    this.cleanupAll();
  }

  private leakDetection(): LeakDetectionReport {
    const first = this.#memorySamples[0];
    const last = this.#memorySamples.at(-1);
    if (!first || !last || this.#memorySamples.length < 2) {
      return this.reportLeak('pass', 0, 'Not enough samples for leak detection yet.');
    }
    const heapGrowthBytes = last.heapUsedBytes - first.heapUsedBytes;
    const status: ProductionStatus = heapGrowthBytes > this.#leakThresholdBytes ? 'warn' : 'pass';
    return this.reportLeak(
      status,
      heapGrowthBytes,
      status === 'pass'
        ? 'Heap growth is within the configured threshold.'
        : 'Heap growth exceeded the configured threshold.',
    );
  }

  private reportLeak(
    status: ProductionStatus,
    heapGrowthBytes: number,
    detail: string,
  ): LeakDetectionReport {
    return Object.freeze({
      status,
      sampleCount: this.#memorySamples.length,
      heapGrowthBytes,
      detail,
    });
  }

  private taskStatus(task: BackgroundTaskRuntime): BackgroundTaskStatus {
    return Object.freeze({
      id: task.definition.id,
      intervalMs: task.definition.intervalMs,
      runCount: task.runCount,
      failureCount: task.failureCount,
      ...(task.lastRunAt ? { lastRunAt: task.lastRunAt } : {}),
      ...(task.lastError ? { lastError: task.lastError } : {}),
    });
  }
}
