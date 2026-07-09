import type {
  CurrencyConversionRequest,
  CurrencyConversionResponse,
  KnowledgeRequest,
  KnowledgeResponse,
  MapLookupRequest,
  MapLookupResponse,
  NewsRequest,
  NewsResponse,
  TimeConversionRequest,
  TimeConversionResponse,
  TimeRequest,
  TimeResponse,
  WeatherRequest,
  WeatherResponse,
  WebSearchRequest,
  WebSearchResponse,
} from '../../../shared/web/contracts';

export interface ProviderRuntime {
  readonly now: () => Date;
}

export interface WebSearchProvider {
  readonly id: string;
  search(request: WebSearchRequest, runtime: ProviderRuntime): Promise<WebSearchResponse>;
}

export interface WeatherProvider {
  readonly id: string;
  weather(request: WeatherRequest, runtime: ProviderRuntime): Promise<WeatherResponse>;
}

export interface NewsProvider {
  readonly id: string;
  news(request: NewsRequest, runtime: ProviderRuntime): Promise<NewsResponse>;
}

export interface CurrencyProvider {
  readonly id: string;
  convert(
    request: CurrencyConversionRequest,
    runtime: ProviderRuntime,
  ): Promise<CurrencyConversionResponse>;
}

export interface MapsProvider {
  readonly id: string;
  lookup(request: MapLookupRequest, runtime: ProviderRuntime): Promise<MapLookupResponse>;
}

export interface TimeProvider {
  readonly id: string;
  time(request: TimeRequest, runtime: ProviderRuntime): Promise<TimeResponse>;
  convert(
    request: TimeConversionRequest,
    runtime: ProviderRuntime,
  ): Promise<TimeConversionResponse>;
}

export interface KnowledgeProvider {
  readonly id: string;
  lookup(request: KnowledgeRequest, runtime: ProviderRuntime): Promise<KnowledgeResponse>;
}

export interface WebProviders {
  readonly search: WebSearchProvider;
  readonly weather: WeatherProvider;
  readonly news: NewsProvider;
  readonly currency: CurrencyProvider;
  readonly maps: MapsProvider;
  readonly time: TimeProvider;
  readonly knowledge: KnowledgeProvider;
}
