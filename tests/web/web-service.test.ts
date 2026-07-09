// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  AIProvider,
  ChatSession,
  StreamChunk,
  StreamResponse,
} from '../../src/main/conversation/provider/contracts';
import { SqliteWebRepository } from '../../src/main/web/persistence/sqlite-web-repository';
import type { WebProviders } from '../../src/main/web/providers/contracts';
import { WebIntelligenceService } from '../../src/main/web/service/web-intelligence-service';

class SequenceStream implements StreamResponse {
  public constructor(
    private readonly text: string,
    private readonly shouldThrow = false,
  ) {}
  public cancel(): void {
    return undefined;
  }
  public [Symbol.asyncIterator](): AsyncIterator<StreamChunk> {
    let emitted = false;
    return {
      next: () => {
        if (this.shouldThrow) return Promise.reject(new Error('stream failed'));
        if (emitted) return Promise.resolve({ done: true, value: undefined });
        emitted = true;
        return Promise.resolve({ done: false, value: { text: this.text } });
      },
    };
  }
}

function sequenceProvider(responses: readonly string[]): AIProvider {
  const queue = [...responses];
  const session: ChatSession = {
    stream: () => new SequenceStream(queue.shift() ?? ''),
  };
  return {
    id: 'mock-ai',
    model: 'mock',
    tokenEstimator: { estimate: () => Promise.resolve(1) },
    createSession: () => session,
  };
}

function throwingAnswerProvider(decision: string): AIProvider {
  let calls = 0;
  const session: ChatSession = {
    stream: () => {
      calls += 1;
      return new SequenceStream(calls === 1 ? decision : '', calls > 1);
    },
  };
  return {
    id: 'throwing-ai',
    model: 'mock',
    tokenEstimator: { estimate: () => Promise.resolve(1) },
    createSession: () => session,
  };
}

function createProviders(counts: Map<string, number> = new Map()): WebProviders {
  const tick = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  return {
    search: {
      id: 'search',
      search: (request, runtime) => {
        tick('search');
        return Promise.resolve({
          query: request.query,
          results: [
            {
              id: 'result',
              title: `Result for ${request.query}`,
              url: 'https://example.com/result',
              snippet: 'Search snippet',
              source: 'example.com',
              rank: 1,
              score: 1,
            },
          ],
          citations: [
            {
              title: 'Result',
              url: 'https://example.com/result',
              source: 'example.com',
              accessedAt: runtime.now().toISOString(),
            },
          ],
          summary: 'Search snippet',
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
    weather: {
      id: 'weather',
      weather: (request, runtime) => {
        tick('weather');
        return Promise.resolve({
          location: request.location,
          latitude: 1,
          longitude: 2,
          current: {
            temperatureCelsius: 25,
            condition: 'Clear sky',
            humidityPercent: 40,
            windKph: 8,
            observedAt: runtime.now().toISOString(),
          },
          forecast: [],
          provider: 'weather',
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
    news: {
      id: 'news',
      news: (request, runtime) => {
        tick('news');
        return Promise.resolve({
          category: request.category ?? 'top',
          country: request.country,
          articles: [
            {
              id: 'article',
              title: 'AI headline',
              url: 'https://example.com/news',
              source: 'example.com',
              summary: 'AI summary',
              category: request.category ?? 'top',
              country: request.country,
              publishedAt: runtime.now().toISOString(),
            },
          ],
          citations: [
            {
              title: 'AI headline',
              url: 'https://example.com/news',
              source: 'example.com',
              accessedAt: runtime.now().toISOString(),
            },
          ],
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
    currency: {
      id: 'currency',
      convert: (request) => {
        tick('currency');
        return Promise.resolve({
          amount: request.amount,
          from: request.from,
          to: request.to,
          rate: 83,
          converted: request.amount * 83,
          asOf: '2026-01-01',
          provider: 'currency',
          cached: false,
        });
      },
    },
    maps: {
      id: 'maps',
      lookup: (request, runtime) => {
        tick('maps');
        return Promise.resolve({
          query: request.query,
          places: [
            {
              id: 'place',
              name: 'Stark Tower',
              address: 'NYC',
              latitude: 40.7,
              longitude: -74,
            },
          ],
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
    time: {
      id: 'time',
      time: (request, runtime) => {
        tick('time');
        return Promise.resolve({
          timeZone: request.timeZone,
          isoDateTime: runtime.now().toISOString(),
          displayTime: '12:00 AM',
          offsetMinutes: 0,
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
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
      lookup: (request, runtime) => {
        tick('knowledge');
        return Promise.resolve({
          topic: request.topic,
          title: request.topic,
          summary: 'Knowledge summary',
          url: 'https://example.com/wiki',
          citation: {
            title: request.topic,
            url: 'https://example.com/wiki',
            source: 'example.com',
            accessedAt: runtime.now().toISOString(),
          },
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
  };
}

function createEmptyProviders(counts: Map<string, number> = new Map()): WebProviders {
  const tick = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  return {
    ...createProviders(counts),
    search: {
      id: 'empty-search',
      search: (request, runtime) => {
        tick('empty-search');
        return Promise.resolve({
          query: request.query,
          results: [],
          citations: [],
          summary: 'No web search results were returned.',
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
    news: {
      id: 'empty-news',
      news: (request, runtime) => {
        tick('empty-news');
        return Promise.resolve({
          category: request.category ?? 'top',
          country: request.country,
          articles: [],
          citations: [],
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
    maps: {
      id: 'empty-maps',
      lookup: (request, runtime) => {
        tick('empty-maps');
        return Promise.resolve({
          query: request.query,
          places: [],
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
    knowledge: {
      id: 'empty-knowledge',
      lookup: (request, runtime) => {
        tick('empty-knowledge');
        return Promise.resolve({
          topic: request.topic,
          title: request.topic,
          summary: '',
          url: 'https://example.com/wiki',
          citation: {
            title: request.topic,
            url: 'https://example.com/wiki',
            source: 'example.com',
            accessedAt: runtime.now().toISOString(),
          },
          generatedAt: runtime.now().toISOString(),
          cached: false,
        });
      },
    },
  };
}

function createService(
  options: {
    readonly provider?: AIProvider;
    readonly limit?: number;
    readonly providers?: WebProviders;
  } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'jarvis-web-service-'));
  const counts = new Map<string, number>();
  let tick = 0;
  const service = new WebIntelligenceService({
    repository: new SqliteWebRepository(join(directory, 'web.sqlite')),
    providers: options.providers ?? createProviders(counts),
    aiProvider: options.provider ? () => options.provider! : undefined,
    cacheTtlMs: 60_000,
    rateLimitPerMinute: options.limit ?? 100,
    clock: () => new Date(`2026-01-01T00:00:0${Math.min(tick++, 9)}.000Z`),
    idFactory: () => `id-${tick}`,
  });
  return {
    service,
    counts,
    cleanup: () => {
      service.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

describe('WebIntelligenceService', () => {
  it('caches provider responses and records history', async () => {
    const { service, counts, cleanup } = createService();
    try {
      const first = await service.search({ query: 'latest ai', limit: 3 });
      const second = await service.search({ query: 'latest ai', limit: 3 });
      expect(first.cached).toBe(false);
      expect(second.cached).toBe(true);
      expect(counts.get('search')).toBe(1);
      expect(service.dashboard().history).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it('lets AI choose tools and synthesize grounded answers', async () => {
    const { service, counts, cleanup } = createService({
      provider: sequenceProvider([
        '{"intent":"currency","amount":2,"from":"USD","to":"INR","query":"USD to INR"}',
        '2 USD equals 166 INR.',
      ]),
    });
    try {
      const response = await service.ask({ prompt: 'USD to INR' });
      expect(response.intent).toBe('currency');
      expect(response.answer).toBe('2 USD equals 166 INR.');
      expect(counts.get('currency')).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('falls back to deterministic routing for weather, news, time, maps and knowledge', async () => {
    const { service, counts, cleanup } = createService();
    try {
      await service.ask({ prompt: 'Weather tomorrow in Delhi' });
      await service.ask({ prompt: 'Latest AI news' });
      await service.ask({ prompt: 'What time is it in India?' });
      await service.ask({ prompt: 'Where is Stark Tower map' });
      await service.ask({ prompt: 'What is Arc Reactor' });
      await service.ask({ prompt: '2 USD to INR' });
      await service.ask({ prompt: 'weather' });
      await service.ask({ prompt: 'time zone' });
      await service.ask({ prompt: 'JARVIS web architecture' });
      expect(counts.get('weather')).toBe(2);
      expect(counts.get('news')).toBe(1);
      expect(counts.get('time')).toBe(2);
      expect(counts.get('maps')).toBe(1);
      expect(counts.get('knowledge')).toBe(1);
      expect(counts.get('currency')).toBe(1);
      expect(counts.get('search')).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('handles AI parse failures, synthesis failures and empty tool responses', async () => {
    const emptyCounts = new Map<string, number>();
    const { service, cleanup } = createService({
      provider: sequenceProvider(['not json']),
      providers: createEmptyProviders(emptyCounts),
    });
    try {
      const news = await service.ask({ prompt: 'latest AI news' });
      expect(news.intent).toBe('news');
      expect(news.answer).toBe('No news articles were returned.');
      expect(emptyCounts.get('empty-news')).toBe(1);
    } finally {
      cleanup();
    }

    const emptySearchCounts = new Map<string, number>();
    const emptySearch = createService({
      providers: createEmptyProviders(emptySearchCounts),
    });
    try {
      await expect(
        emptySearch.service.ask({ prompt: 'search for nothing' }),
      ).resolves.toMatchObject({
        answer: 'No search results were returned.',
        intent: 'search',
      });
      await expect(
        emptySearch.service.ask({ prompt: 'Where is nowhere map' }),
      ).resolves.toMatchObject({
        answer: 'No places found for Where is nowhere map.',
        intent: 'maps',
      });
      await expect(emptySearch.service.ask({ prompt: 'What is emptiness' })).resolves.toMatchObject(
        {
          answer: '',
          intent: 'knowledge',
        },
      );
    } finally {
      emptySearch.cleanup();
    }

    const fallback = createService({
      provider: throwingAnswerProvider(
        '{"intent":"weather","location":"Delhi","query":"Weather in Delhi"}',
      ),
    });
    try {
      await expect(fallback.service.ask({ prompt: 'Weather in Delhi' })).resolves.toMatchObject({
        answer: 'Delhi: 25°C, Clear sky, humidity 40%, wind 8 kph.',
        intent: 'weather',
      });
    } finally {
      fallback.cleanup();
    }
  });

  it('covers AI decision optional fields and direct service defaults', async () => {
    const { service, counts, cleanup } = createService({
      provider: sequenceProvider([
        '{"intent":"news","category":"sports","country":"in"}',
        '',
        '{"intent":"time"}',
        '',
        '{"intent":"maps"}',
        '',
        '{"intent":"knowledge"}',
        '',
        '{"intent":"currency"}',
        '',
        '{"intent":"weather"}',
        '',
        '{"intent":"calendar","query":"business news"}',
        '',
        '{bad json',
        '',
      ]),
    });
    try {
      await expect(service.ask({ prompt: 'sports headlines India' })).resolves.toMatchObject({
        intent: 'news',
      });
      await expect(service.ask({ prompt: 'time please' })).resolves.toMatchObject({
        intent: 'time',
      });
      await expect(service.ask({ prompt: 'map Stark Tower' })).resolves.toMatchObject({
        intent: 'maps',
      });
      await expect(service.ask({ prompt: 'what is Arc Reactor' })).resolves.toMatchObject({
        intent: 'knowledge',
      });
      await expect(service.ask({ prompt: 'convert money' })).resolves.toMatchObject({
        intent: 'currency',
      });
      await expect(service.ask({ prompt: 'weather in Paris' })).resolves.toMatchObject({
        intent: 'weather',
      });
      await expect(service.ask({ prompt: 'business news' })).resolves.toMatchObject({
        intent: 'news',
      });
      await expect(service.ask({ prompt: 'sports news' })).resolves.toMatchObject({
        intent: 'news',
      });
      await service.search({ query: 'default search' });
      await service.weather({ location: 'Delhi' });
      await service.news({});
      expect(counts.get('news')).toBe(4);
      expect(counts.get('time')).toBe(1);
      expect(counts.get('maps')).toBe(1);
      expect(counts.get('knowledge')).toBe(1);
      expect(counts.get('currency')).toBe(1);
      expect(counts.get('weather')).toBe(2);
      expect(counts.get('search')).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('supports default clock and id generation', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-web-defaults-'));
    const service = new WebIntelligenceService({
      repository: new SqliteWebRepository(join(directory, 'web.sqlite')),
      providers: createProviders(),
      cacheTtlMs: 60_000,
      rateLimitPerMinute: 100,
    });
    try {
      const bookmark = service.saveBookmark({
        kind: 'knowledge',
        title: 'Arc Reactor',
        query: 'Arc Reactor',
      });
      expect(bookmark.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
      );
      expect(new Date(bookmark.createdAt).getTime()).not.toBeNaN();
    } finally {
      service.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rate-limits requests and manages bookmarks', async () => {
    const { service, cleanup } = createService({ limit: 1 });
    try {
      await service.search({ query: 'one' });
      await expect(service.search({ query: 'two' })).rejects.toMatchObject({
        code: 'RATE_LIMITED',
      });
      const bookmark = service.saveBookmark({
        kind: 'search',
        title: 'One',
        query: 'one',
        url: 'https://example.com/one',
      });
      expect(service.bookmarks()[0]?.id).toBe(bookmark.id);
      service.deleteBookmark(bookmark.id);
      expect(() => service.deleteBookmark(bookmark.id)).toThrow('Web bookmark was not found.');
    } finally {
      cleanup();
    }
  });

  it('converts time and stores bookmarks without optional fields', async () => {
    const { service, cleanup } = createService();
    try {
      await expect(
        service.convertTime({ fromTimeZone: 'UTC', toTimeZone: 'Asia/Kolkata' }),
      ).resolves.toMatchObject({ toTimeZone: 'Asia/Kolkata' });
      const bookmark = service.saveBookmark({
        kind: 'news',
        title: 'Headlines',
      });
      expect(bookmark.query).toBeUndefined();
      expect(bookmark.url).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
