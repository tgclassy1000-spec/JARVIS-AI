// @vitest-environment node

import { FrankfurterCurrencyProvider } from '../../src/main/web/providers/currency-provider';
import type { WebHttpClient } from '../../src/main/web/providers/http-client';
import { WikipediaKnowledgeProvider } from '../../src/main/web/providers/knowledge-provider';
import { OpenStreetMapProvider } from '../../src/main/web/providers/maps-provider';
import { HackerNewsNewsProvider } from '../../src/main/web/providers/news-provider';
import { DuckDuckGoSearchProvider } from '../../src/main/web/providers/search-provider';
import { IntlTimeProvider } from '../../src/main/web/providers/time-provider';
import { OpenMeteoWeatherProvider } from '../../src/main/web/providers/weather-provider';

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

describe('web providers', () => {
  it('parses search results with metadata and citations', async () => {
    const provider = new DuckDuckGoSearchProvider(
      new QueueHttpClient([
        {
          Heading: 'JARVIS',
          AbstractURL: 'https://example.com/jarvis',
          AbstractText: 'AI assistant summary',
          RelatedTopics: [
            { FirstURL: 'https://example.com/one', Text: 'One - Result one' },
            { Topics: [{ FirstURL: 'https://example.com/two', Text: 'Two - Result two' }] },
          ],
        },
      ]),
    );
    const response = await provider.search({ query: 'jarvis', limit: 3 }, runtime);
    expect(response.results).toHaveLength(3);
    expect(response.citations[0]?.source).toBe('example.com');
    expect(response.summary).toBe('AI assistant summary');
  });

  it('parses weather, news, currency, maps, knowledge and time providers', async () => {
    const weather = await new OpenMeteoWeatherProvider(
      new QueueHttpClient([
        { results: [{ name: 'Delhi', latitude: 28.61, longitude: 77.2 }] },
        {
          current: {
            temperature_2m: 30,
            relative_humidity_2m: 40,
            wind_speed_10m: 9,
            weather_code: 0,
            time: '2026-01-01T12:00',
          },
          daily: {
            time: ['2026-01-01'],
            temperature_2m_min: [21],
            temperature_2m_max: [31],
            precipitation_probability_max: [5],
            sunrise: ['2026-01-01T06:00'],
            sunset: ['2026-01-01T18:00'],
          },
        },
      ]),
    ).weather({ location: 'Delhi', days: 1 }, runtime);
    expect(weather.current.condition).toBe('Clear sky');
    expect(weather.forecast[0]?.sunrise).toContain('06:00');

    const news = await new HackerNewsNewsProvider(
      new QueueHttpClient([
        {
          hits: [
            {
              objectID: '1',
              title: 'AI headline',
              url: 'https://news.example/ai',
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      ]),
    ).news({ category: 'technology', country: 'us' }, runtime);
    expect(news.articles[0]?.country).toBe('US');

    const currency = await new FrankfurterCurrencyProvider(
      new QueueHttpClient([{ rates: { INR: 83 }, date: '2026-01-01' }]),
    ).convert({ amount: 2, from: 'usd', to: 'inr' }, runtime);
    expect(currency.converted).toBe(83);
    expect(currency.rate).toBe(41.5);

    const maps = await new OpenStreetMapProvider(
      new QueueHttpClient([
        [
          {
            place_id: '1',
            name: 'Stark Tower',
            display_name: 'Stark Tower, NYC',
            lat: '40.7',
            lon: '-74.0',
          },
        ],
      ]),
    ).lookup({ query: 'Stark Tower' }, runtime);
    expect(maps.places[0]?.latitude).toBe(40.7);

    const knowledge = await new WikipediaKnowledgeProvider(
      new QueueHttpClient([
        {
          title: 'Arc reactor',
          extract: 'A fictional power source.',
          content_urls: { desktop: { page: 'https://example.com/wiki/Arc_reactor' } },
        },
      ]),
    ).lookup({ topic: 'Arc reactor' }, runtime);
    expect(knowledge.summary).toContain('fictional');

    const time = await new IntlTimeProvider().time({ timeZone: 'UTC' }, runtime);
    expect(time.offsetMinutes).toBe(0);
    await expect(
      new IntlTimeProvider().convert(
        {
          fromTimeZone: 'UTC',
          toTimeZone: 'Asia/Kolkata',
          isoDateTime: '2026-01-01T00:00:00.000Z',
        },
        runtime,
      ),
    ).resolves.toMatchObject({ toTimeZone: 'Asia/Kolkata' });
  });

  it('fails clearly for unknown provider lookups', async () => {
    await expect(
      new OpenMeteoWeatherProvider(new QueueHttpClient([{ results: [] }])).weather(
        { location: 'Nowhere' },
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'WEB_PROVIDER_UNAVAILABLE' });
    await expect(
      new WikipediaKnowledgeProvider(new QueueHttpClient([{ title: 'Missing' }])).lookup(
        { topic: 'Missing' },
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'WEB_PROVIDER_UNAVAILABLE' });
  });
});
