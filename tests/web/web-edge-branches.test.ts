// @vitest-environment node

import { TtlCache } from '../../src/main/web/cache/ttl-cache';
import { FrankfurterCurrencyProvider } from '../../src/main/web/providers/currency-provider';
import { createDefaultWebProviders } from '../../src/main/web/providers/default-providers';
import { FetchWebHttpClient, type WebHttpClient } from '../../src/main/web/providers/http-client';
import { asString, hostname } from '../../src/main/web/providers/json';
import { WikipediaKnowledgeProvider } from '../../src/main/web/providers/knowledge-provider';
import { OpenStreetMapProvider } from '../../src/main/web/providers/maps-provider';
import { HackerNewsNewsProvider } from '../../src/main/web/providers/news-provider';
import { DuckDuckGoSearchProvider } from '../../src/main/web/providers/search-provider';
import { IntlTimeProvider } from '../../src/main/web/providers/time-provider';
import { OpenMeteoWeatherProvider } from '../../src/main/web/providers/weather-provider';
import { PlatformError } from '../../src/main/platform/errors/platform-error';

class QueueHttpClient implements WebHttpClient {
  public constructor(private readonly payloads: unknown[]) {}

  public getJson(): Promise<unknown> {
    return Promise.resolve(this.payloads.shift() ?? {});
  }

  public getText(): Promise<string> {
    return Promise.resolve('');
  }
}

const runtime = {
  now: () => new Date('2026-01-01T00:00:00.000Z'),
};

function weatherPayload(code: number) {
  return [
    { results: [{ name: 'Delhi', latitude: 28.61, longitude: 77.2 }] },
    {
      current: {
        temperature_2m: 30,
        relative_humidity_2m: 40,
        wind_speed_10m: 9,
        weather_code: code,
        time: '2026-01-01T12:00',
      },
      daily: {
        time: ['2026-01-01'],
        temperature_2m_min: [21],
        temperature_2m_max: [31],
        precipitation_probability_max: [5],
        sunrise: [null],
        sunset: ['2026-01-01T18:00'],
      },
    },
  ];
}

describe('web edge branches', () => {
  it('expires cached values and keeps live values', () => {
    let now = 1_000;
    const cache = new TtlCache<string>(100, () => now);
    expect(cache.get('missing')).toBeUndefined();
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
    now = 1_100;
    expect(cache.get('key')).toBeUndefined();
  });

  it('covers default providers and JSON helper fallbacks', () => {
    const providers = createDefaultWebProviders({ timeoutMs: 500, maxAttempts: 1 });
    expect(providers.search.id).toBe('duckduckgo-instant-answer');
    expect(providers.weather.id).toBe('open-meteo');
    expect(providers.news.id).toBe('hacker-news-algolia');
    expect(providers.currency.id).toBe('frankfurter');
    expect(providers.maps.id).toBe('openstreetmap-nominatim');
    expect(providers.time.id).toBe('intl');
    expect(providers.knowledge.id).toBe('wikipedia-summary');
    expect(asString(42, 'fallback')).toBe('fallback');
    expect(hostname('not a url')).toBe('unknown');
  });

  it('redacts credentials, maps timeouts and uses default fetch options', async () => {
    const failing = new FetchWebHttpClient({
      timeoutMs: 100,
      maxAttempts: 1,
      fetcher: () => Promise.resolve(new Response('failure', { status: 500 })),
      backoffMs: 0,
    });
    await failing
      .getText(new URL('https://example.com/data?api_key=secret&token=value&safe=yes'))
      .catch((error: unknown) => {
        expect(error).toBeInstanceOf(PlatformError);
        if (error instanceof PlatformError) {
          expect(String(error.metadata.url)).not.toContain('secret');
          expect(String(error.metadata.url)).not.toContain('value');
          expect(String(error.metadata.url)).toContain('safe=yes');
        }
      });

    const abortingFetcher: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        );
      });
    const timingOut = new FetchWebHttpClient({
      timeoutMs: 1,
      maxAttempts: 1,
      fetcher: abortingFetcher,
      backoffMs: 0,
    });
    await expect(timingOut.getText(new URL('https://example.com/slow'))).rejects.toMatchObject({
      code: 'TIMEOUT',
    });

    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('{"ok":true}', { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const defaults = new FetchWebHttpClient({ timeoutMs: 100, maxAttempts: 1 });
      await expect(defaults.getJson(new URL('https://example.com/json'))).resolves.toEqual({
        ok: true,
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('handles search, news, maps and knowledge fallback shapes', async () => {
    const search = await new DuckDuckGoSearchProvider(
      new QueueHttpClient([
        {
          RelatedTopics: [
            {
              FirstURL: 'https://www.example.com/html',
              Result: '<a>HTML Result</a> - <b>Snippet</b>',
            },
            { Text: 'Missing URL - skipped' },
            {
              Topics: [{ FirstURL: 'notaurl', Text: 'Unknown Source - Result snippet' }],
            },
          ],
        },
      ]),
    ).search({ query: 'jarvis' }, runtime);
    expect(search.results).toHaveLength(2);
    expect(search.results[0]?.source).toBe('example.com');
    expect(search.results[1]?.source).toBe('unknown');

    const emptySearch = await new DuckDuckGoSearchProvider(new QueueHttpClient([{}])).search(
      { query: 'empty', limit: 2 },
      runtime,
    );
    expect(emptySearch.summary).toBe('No web search results were returned.');

    const news = await new HackerNewsNewsProvider(
      new QueueHttpClient([
        {
          hits: [
            { objectID: '42', story_title: 'Story fallback' },
            { created_at: '2026-01-02T00:00:00.000Z' },
          ],
        },
      ]),
    ).news({}, runtime);
    expect(news.category).toBe('top');
    expect(news.articles[0]?.url).toContain('id=42');
    expect(news.articles[1]?.title).toBe('Untitled');

    const maps = await new OpenStreetMapProvider(
      new QueueHttpClient([
        [
          { place_id: 99, display_name: 'Display Name', lat: 1, lon: 2 },
          { name: 'Invalid', lat: 'north', lon: 'east' },
        ],
      ]),
    ).lookup({ query: 'Display Name' }, runtime);
    expect(maps.places).toHaveLength(1);
    expect(maps.places[0]?.id).toBe('place:0');
    expect(maps.places[0]?.name).toBe('Display Name');

    const knowledge = await new WikipediaKnowledgeProvider(
      new QueueHttpClient([{ extract: 'Fallback summary.' }]),
    ).lookup({ topic: 'Fallback Topic' }, runtime);
    expect(knowledge.title).toBe('Fallback Topic');
    expect(knowledge.url).toContain('Fallback%20Topic');
  });

  it('maps weather codes and provider validation branches', async () => {
    await expect(
      new OpenMeteoWeatherProvider(
        new QueueHttpClient([{ results: [{ name: 'Bad', latitude: 'x', longitude: 0 }] }]),
      ).weather({ location: 'Bad' }, runtime),
    ).rejects.toMatchObject({ code: 'WEB_PROVIDER_UNAVAILABLE' });

    const conditions = await Promise.all(
      [1, 45, 61, 71, 95, 999].map((code) =>
        new OpenMeteoWeatherProvider(new QueueHttpClient(weatherPayload(code))).weather(
          { location: 'Delhi' },
          runtime,
        ),
      ),
    );
    expect(conditions.map((response) => response.current.condition)).toEqual([
      'Partly cloudy',
      'Fog',
      'Rain',
      'Snow',
      'Thunderstorm',
      'Variable conditions',
    ]);
    expect(conditions[0]?.forecast[0]?.sunrise).toBeUndefined();
  });

  it('handles currency and time validation fallbacks', async () => {
    const currency = await new FrankfurterCurrencyProvider(
      new QueueHttpClient([{ rates: { INR: 83 } }]),
    ).convert({ amount: 2, from: 'usd', to: 'inr' }, runtime);
    expect(currency.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await expect(
      new FrankfurterCurrencyProvider(new QueueHttpClient([{ rates: {} }])).convert(
        { amount: 1, from: 'USD', to: 'INR' },
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'WEB_PROVIDER_UNAVAILABLE' });

    const time = new IntlTimeProvider();
    await expect(
      time.convert({ fromTimeZone: 'UTC', toTimeZone: 'Asia/Kolkata' }, runtime),
    ).resolves.toMatchObject({ sourceIsoDateTime: '2026-01-01T00:00:00.000Z' });
    expect(() =>
      time.convert(
        {
          fromTimeZone: 'UTC',
          toTimeZone: 'Asia/Kolkata',
          isoDateTime: 'not a date',
        },
        runtime,
      ),
    ).toThrow('Date/time is invalid.');
    expect(() => time.time({ timeZone: 'Mars/Olympus' }, runtime)).toThrow('Timezone is invalid.');
  });
});
