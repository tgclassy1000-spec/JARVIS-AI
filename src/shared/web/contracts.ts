export const NEWS_CATEGORIES = [
  'top',
  'technology',
  'business',
  'sports',
  'entertainment',
  'science',
] as const;

export const WEB_TOOL_KINDS = [
  'search',
  'weather',
  'news',
  'currency',
  'maps',
  'time',
  'knowledge',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
export type WebToolKind = (typeof WEB_TOOL_KINDS)[number];

export interface Citation {
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly accessedAt: string;
}

export interface PageMetadata {
  readonly url: string;
  readonly title?: string;
  readonly description?: string;
  readonly siteName?: string;
  readonly fetchedAt: string;
}

export interface WebSearchRequest {
  readonly query: string;
  readonly limit?: number;
}

export interface WebSearchResult {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly source: string;
  readonly rank: number;
  readonly score: number;
  readonly publishedAt?: string;
  readonly metadata?: PageMetadata;
}

export interface WebSearchResponse {
  readonly query: string;
  readonly results: readonly WebSearchResult[];
  readonly citations: readonly Citation[];
  readonly summary: string;
  readonly generatedAt: string;
  readonly cached: boolean;
}

export interface WeatherRequest {
  readonly location: string;
  readonly days?: number;
}

export interface WeatherCurrent {
  readonly temperatureCelsius: number;
  readonly condition: string;
  readonly humidityPercent: number;
  readonly windKph: number;
  readonly airQualityIndex?: number;
  readonly observedAt: string;
}

export interface WeatherForecastDay {
  readonly date: string;
  readonly minCelsius: number;
  readonly maxCelsius: number;
  readonly precipitationProbabilityPercent: number;
  readonly sunrise?: string;
  readonly sunset?: string;
}

export interface WeatherResponse {
  readonly location: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly current: WeatherCurrent;
  readonly forecast: readonly WeatherForecastDay[];
  readonly provider: string;
  readonly generatedAt: string;
  readonly cached: boolean;
}

export interface NewsRequest {
  readonly category?: NewsCategory;
  readonly country?: string;
  readonly query?: string;
  readonly limit?: number;
}

export interface NewsArticle {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly summary: string;
  readonly category: NewsCategory;
  readonly country?: string;
  readonly publishedAt: string;
}

export interface NewsResponse {
  readonly category: NewsCategory;
  readonly country?: string;
  readonly articles: readonly NewsArticle[];
  readonly citations: readonly Citation[];
  readonly generatedAt: string;
  readonly cached: boolean;
}

export interface CurrencyConversionRequest {
  readonly amount: number;
  readonly from: string;
  readonly to: string;
}

export interface CurrencyConversionResponse {
  readonly amount: number;
  readonly from: string;
  readonly to: string;
  readonly rate: number;
  readonly converted: number;
  readonly asOf: string;
  readonly provider: string;
  readonly cached: boolean;
}

export interface TimeRequest {
  readonly timeZone: string;
}

export interface TimeConversionRequest {
  readonly fromTimeZone: string;
  readonly toTimeZone: string;
  readonly isoDateTime?: string;
}

export interface TimeResponse {
  readonly timeZone: string;
  readonly isoDateTime: string;
  readonly displayTime: string;
  readonly offsetMinutes: number;
  readonly generatedAt: string;
  readonly cached: boolean;
}

export interface TimeConversionResponse {
  readonly fromTimeZone: string;
  readonly toTimeZone: string;
  readonly sourceIsoDateTime: string;
  readonly convertedIsoDateTime: string;
  readonly displayTime: string;
}

export interface MapLookupRequest {
  readonly query: string;
  readonly limit?: number;
}

export interface MapPlace {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface MapLookupResponse {
  readonly query: string;
  readonly places: readonly MapPlace[];
  readonly generatedAt: string;
  readonly cached: boolean;
}

export interface KnowledgeRequest {
  readonly topic: string;
}

export interface KnowledgeResponse {
  readonly topic: string;
  readonly title: string;
  readonly summary: string;
  readonly url: string;
  readonly citation: Citation;
  readonly generatedAt: string;
  readonly cached: boolean;
}

export type WebIntent = 'search' | 'weather' | 'news' | 'currency' | 'time' | 'maps' | 'knowledge';

export interface WebAssistantRequest {
  readonly prompt: string;
}

export interface WebAssistantResponse {
  readonly prompt: string;
  readonly intent: WebIntent;
  readonly answer: string;
  readonly usedTools: readonly WebToolKind[];
  readonly citations: readonly Citation[];
  readonly generatedAt: string;
}

export interface WebHistoryEntry {
  readonly id: string;
  readonly kind: WebToolKind;
  readonly title: string;
  readonly query: string;
  readonly createdAt: string;
}

export interface WebBookmark {
  readonly id: string;
  readonly kind: WebToolKind;
  readonly title: string;
  readonly query?: string;
  readonly url?: string;
  readonly createdAt: string;
}

export interface WebBookmarkRequest {
  readonly kind: WebToolKind;
  readonly title: string;
  readonly query?: string;
  readonly url?: string;
}

export interface WebBookmarkIdRequest {
  readonly id: string;
}

export interface WebDashboard {
  readonly history: readonly WebHistoryEntry[];
  readonly bookmarks: readonly WebBookmark[];
  readonly tools: readonly WebToolKind[];
}
