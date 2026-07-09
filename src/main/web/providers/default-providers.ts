import type { WebProviders } from './contracts';
import { FrankfurterCurrencyProvider } from './currency-provider';
import { FetchWebHttpClient } from './http-client';
import { WikipediaKnowledgeProvider } from './knowledge-provider';
import { OpenStreetMapProvider } from './maps-provider';
import { HackerNewsNewsProvider } from './news-provider';
import { DuckDuckGoSearchProvider } from './search-provider';
import { IntlTimeProvider } from './time-provider';
import { OpenMeteoWeatherProvider } from './weather-provider';

export interface DefaultWebProviderOptions {
  readonly timeoutMs: number;
  readonly maxAttempts: number;
}

export function createDefaultWebProviders(options: DefaultWebProviderOptions): WebProviders {
  const http = new FetchWebHttpClient({
    timeoutMs: options.timeoutMs,
    maxAttempts: options.maxAttempts,
  });
  return Object.freeze({
    search: new DuckDuckGoSearchProvider(http),
    weather: new OpenMeteoWeatherProvider(http),
    news: new HackerNewsNewsProvider(http),
    currency: new FrankfurterCurrencyProvider(http),
    maps: new OpenStreetMapProvider(http),
    time: new IntlTimeProvider(),
    knowledge: new WikipediaKnowledgeProvider(http),
  });
}
