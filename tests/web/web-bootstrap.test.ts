// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bootstrapWeb } from '../../src/main/web/bootstrap';
import { SERVICE_TOKENS } from '../../src/main/services/tokens';
import { ServiceContainer } from '../../src/main/platform/di/service-container';
import type { IpcEndpoint, IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import type { Logger } from '../../src/main/platform/logging/logger';
import type { IpcChannel } from '../../src/shared/platform/ipc';
import type { WebProviders } from '../../src/main/web/providers/contracts';

class RouterStub {
  public readonly endpoints: string[] = [];
  public register<C extends IpcChannel>(endpoint: IpcEndpoint<C>): void {
    this.endpoints.push(endpoint.channel);
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

const providers: WebProviders = {
  search: {
    id: 'search',
    search: (request, runtime) =>
      Promise.resolve({
        query: request.query,
        results: [],
        citations: [],
        summary: '',
        generatedAt: runtime.now().toISOString(),
        cached: false,
      }),
  },
  weather: {
    id: 'weather',
    weather: (request, runtime) =>
      Promise.resolve({
        location: request.location,
        latitude: 0,
        longitude: 0,
        current: {
          temperatureCelsius: 0,
          condition: 'Clear',
          humidityPercent: 0,
          windKph: 0,
          observedAt: runtime.now().toISOString(),
        },
        forecast: [],
        provider: 'weather',
        generatedAt: runtime.now().toISOString(),
        cached: false,
      }),
  },
  news: {
    id: 'news',
    news: (request, runtime) =>
      Promise.resolve({
        category: request.category ?? 'top',
        articles: [],
        citations: [],
        generatedAt: runtime.now().toISOString(),
        cached: false,
      }),
  },
  currency: {
    id: 'currency',
    convert: (request) =>
      Promise.resolve({
        amount: request.amount,
        from: request.from,
        to: request.to,
        rate: 1,
        converted: request.amount,
        asOf: '2026-01-01',
        provider: 'currency',
        cached: false,
      }),
  },
  maps: {
    id: 'maps',
    lookup: (request, runtime) =>
      Promise.resolve({
        query: request.query,
        places: [],
        generatedAt: runtime.now().toISOString(),
        cached: false,
      }),
  },
  time: {
    id: 'time',
    time: (request, runtime) =>
      Promise.resolve({
        timeZone: request.timeZone,
        isoDateTime: runtime.now().toISOString(),
        displayTime: '12:00 AM',
        offsetMinutes: 0,
        generatedAt: runtime.now().toISOString(),
        cached: false,
      }),
    convert: (request) =>
      Promise.resolve({
        fromTimeZone: request.fromTimeZone,
        toTimeZone: request.toTimeZone,
        sourceIsoDateTime: request.isoDateTime ?? '2026-01-01T00:00:00.000Z',
        convertedIsoDateTime: '2026-01-01T00:00:00.000Z',
        displayTime: '12:00 AM',
      }),
  },
  knowledge: {
    id: 'knowledge',
    lookup: (request, runtime) =>
      Promise.resolve({
        topic: request.topic,
        title: request.topic,
        summary: 'Summary',
        url: 'https://example.com',
        citation: {
          title: request.topic,
          url: 'https://example.com',
          source: 'example.com',
          accessedAt: runtime.now().toISOString(),
        },
        generatedAt: runtime.now().toISOString(),
        cached: false,
      }),
  },
};

describe('bootstrapWeb', () => {
  it('registers service and IPC endpoints', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-web-bootstrap-'));
    const services = new ServiceContainer();
    const router = new RouterStub();
    const runtime = bootstrapWeb({
      config: {
        environment: 'test',
        logging: { level: 'error' },
        ipc: { maxRequestBytes: 65_536, rateLimitPerMinute: 120 },
        ai: {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          timeoutMs: 1000,
          maxAttempts: 1,
          contextTokenBudget: 4096,
        },
        web: {
          timeoutMs: 1000,
          maxAttempts: 1,
          cacheTtlMs: 60_000,
          rateLimitPerMinute: 100,
        },
        production: {
          debugMode: false,
          logMaxBytes: 1_048_576,
          logMaxFiles: 5,
          diagnosticRetentionDays: 30,
          backupRetentionDays: 14,
          leakThresholdBytes: 64_000_000,
        },
        release: {
          channel: 'stable',
          unsignedDevelopmentFallback: true,
        },
      },
      databasePath: join(directory, 'web.sqlite'),
      logger,
      router: router as unknown as IpcRouter,
      services,
      providers,
    });
    expect(router.endpoints).toHaveLength(14);
    expect(services.resolve(SERVICE_TOKENS.web)).toBe(runtime.service);
    expect(runtime.service.dashboard().tools).toContain('search');
    runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  });

  it('bootstraps default providers when no test providers are injected', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-web-bootstrap-defaults-'));
    const services = new ServiceContainer();
    const router = new RouterStub();
    const runtime = bootstrapWeb({
      config: {
        environment: 'test',
        logging: { level: 'error' },
        ipc: { maxRequestBytes: 65_536, rateLimitPerMinute: 120 },
        ai: {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          timeoutMs: 1000,
          maxAttempts: 1,
          contextTokenBudget: 4096,
        },
        web: {
          timeoutMs: 1000,
          maxAttempts: 1,
          cacheTtlMs: 60_000,
          rateLimitPerMinute: 100,
        },
        production: {
          debugMode: false,
          logMaxBytes: 1_048_576,
          logMaxFiles: 5,
          diagnosticRetentionDays: 30,
          backupRetentionDays: 14,
          leakThresholdBytes: 64_000_000,
        },
        release: {
          channel: 'stable',
          unsignedDevelopmentFallback: true,
        },
      },
      databasePath: join(directory, 'web.sqlite'),
      logger,
      router: router as unknown as IpcRouter,
      services,
    });
    expect(router.endpoints).toHaveLength(14);
    expect(runtime.service.dashboard().tools).toContain('knowledge');
    runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  });
});
