// @vitest-environment node

import type { WebController } from '../../src/main/web/ipc/web.endpoints';
import { registerWebEndpoints } from '../../src/main/web/ipc/web.endpoints';
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
import { PERMISSIONS } from '../../src/shared/platform/permissions';

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

function createRouter(decision: 'allow' | 'deny' = 'allow') {
  const adapter = new Adapter();
  const router = new IpcRouter(
    adapter,
    ALLOWED_IPC_CHANNELS,
    ALLOWED_IPC_EVENTS,
    [createPermissionMiddleware(new PermissionManager(new Map([[PERMISSIONS.network, decision]])))],
    logger,
    () => 'web-request',
  );
  return { adapter, router };
}

function controller(): WebController {
  const deleteBookmark = vi.fn<(id: string) => void>();
  return {
    dashboard: () => ({ history: [], bookmarks: [], tools: ['search'] as const }),
    ask: (request) =>
      Promise.resolve({
        prompt: request.prompt,
        intent: 'search' as const,
        answer: 'Answer',
        usedTools: ['search'] as const,
        citations: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
      }),
    search: (request) =>
      Promise.resolve({
        query: request.query,
        results: [],
        citations: [],
        summary: '',
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    weather: (request) =>
      Promise.resolve({
        location: request.location,
        latitude: 0,
        longitude: 0,
        current: {
          temperatureCelsius: 0,
          condition: 'Clear',
          humidityPercent: 0,
          windKph: 0,
          observedAt: '2026-01-01T00:00:00.000Z',
        },
        forecast: [],
        provider: 'test',
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    news: (request) =>
      Promise.resolve({
        category: request.category ?? 'top',
        articles: [],
        citations: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    convertCurrency: (request) =>
      Promise.resolve({
        amount: request.amount,
        from: request.from,
        to: request.to,
        rate: 1,
        converted: request.amount,
        asOf: '2026-01-01',
        provider: 'test',
        cached: false,
      }),
    time: (request) =>
      Promise.resolve({
        timeZone: request.timeZone,
        isoDateTime: '2026-01-01T00:00:00.000Z',
        displayTime: '12:00 AM',
        offsetMinutes: 0,
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    convertTime: (request) =>
      Promise.resolve({
        fromTimeZone: request.fromTimeZone,
        toTimeZone: request.toTimeZone,
        sourceIsoDateTime: request.isoDateTime ?? '2026-01-01T00:00:00.000Z',
        convertedIsoDateTime: '2026-01-01T00:00:00.000Z',
        displayTime: '12:00 AM',
      }),
    maps: (request) =>
      Promise.resolve({
        query: request.query,
        places: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    knowledge: (request) =>
      Promise.resolve({
        topic: request.topic,
        title: request.topic,
        summary: 'Summary',
        url: 'https://example.com',
        citation: {
          title: request.topic,
          url: 'https://example.com',
          source: 'example.com',
          accessedAt: '2026-01-01T00:00:00.000Z',
        },
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    history: () => [],
    bookmarks: () => [],
    saveBookmark: (request) => ({
      id: 'bookmark',
      kind: request.kind,
      title: request.title,
      query: request.query,
      url: request.url,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    deleteBookmark,
  };
}

describe('web IPC endpoints', () => {
  it('registers allow-listed endpoints and handles typed contracts', async () => {
    const { adapter, router } = createRouter();
    const web = controller();
    registerWebEndpoints(router, web);
    expect(adapter.handlers.size).toBe(14);
    const event = { senderUrl: 'file:///app', send: vi.fn() };
    const invoke = (channel: string, payload: unknown) =>
      adapter.handlers.get(channel)?.(event, payload);
    await expect(invoke(IPC_CHANNELS.webDashboard, {})).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.webAsk, { prompt: 'Latest AI news' })).resolves.toMatchObject({
      ok: true,
    });
    await invoke(IPC_CHANNELS.webSearch, { query: 'jarvis' });
    await invoke(IPC_CHANNELS.webWeather, { location: 'Delhi' });
    await invoke(IPC_CHANNELS.webNews, { category: 'technology' });
    await invoke(IPC_CHANNELS.webCurrencyConvert, { amount: 1, from: 'USD', to: 'INR' });
    await invoke(IPC_CHANNELS.webTime, { timeZone: 'UTC' });
    await invoke(IPC_CHANNELS.webTimeConvert, { fromTimeZone: 'UTC', toTimeZone: 'Asia/Kolkata' });
    await invoke(IPC_CHANNELS.webMaps, { query: 'New York' });
    await invoke(IPC_CHANNELS.webKnowledge, { topic: 'JARVIS' });
    await invoke(IPC_CHANNELS.webHistory, {});
    await invoke(IPC_CHANNELS.webBookmarkList, {});
    await invoke(IPC_CHANNELS.webBookmarkSave, {
      kind: 'search',
      title: 'JARVIS',
      url: 'https://example.com',
    });
    await invoke(IPC_CHANNELS.webBookmarkDelete, { id: 'bookmark' });
    expect(web.deleteBookmark).toHaveBeenCalledWith('bookmark');
    router.dispose();
  });

  it('rejects invalid payloads and denied network access', async () => {
    const { adapter, router } = createRouter('deny');
    registerWebEndpoints(router, controller());
    const event = { senderUrl: 'file:///app', send: vi.fn() };
    await expect(
      adapter.handlers.get(IPC_CHANNELS.webSearch)?.(event, { query: '' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    await expect(
      adapter.handlers.get(IPC_CHANNELS.webTime)?.(event, { timeZone: '' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
  });
});
