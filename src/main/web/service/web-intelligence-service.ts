import { randomUUID } from 'node:crypto';

import type { AIProvider } from '../../conversation/provider/contracts';
import { ERROR_CODES } from '../../../shared/platform/errors';
import type {
  Citation,
  CurrencyConversionRequest,
  CurrencyConversionResponse,
  KnowledgeRequest,
  KnowledgeResponse,
  MapLookupRequest,
  MapLookupResponse,
  NewsCategory,
  NewsRequest,
  NewsResponse,
  TimeConversionRequest,
  TimeConversionResponse,
  TimeRequest,
  TimeResponse,
  WeatherRequest,
  WeatherResponse,
  WebAssistantRequest,
  WebAssistantResponse,
  WebBookmark,
  WebBookmarkRequest,
  WebDashboard,
  WebHistoryEntry,
  WebIntent,
  WebSearchRequest,
  WebSearchResponse,
  WebToolKind,
} from '../../../shared/web/contracts';
import { WEB_TOOL_KINDS } from '../../../shared/web/contracts';
import { PlatformError } from '../../platform/errors/platform-error';
import { TtlCache } from '../cache/ttl-cache';
import type { WebProviders } from '../providers/contracts';
import { WebRateLimiter } from '../security/rate-limiter';
import type { WebRepository } from '../persistence/web-repository';

type CacheableResponse =
  | WebSearchResponse
  | WeatherResponse
  | NewsResponse
  | CurrencyConversionResponse
  | TimeResponse
  | MapLookupResponse
  | KnowledgeResponse;

interface ToolDecision {
  readonly intent: WebIntent;
  readonly query: string;
  readonly location?: string;
  readonly category?: NewsCategory;
  readonly country?: string;
  readonly amount?: number;
  readonly from?: string;
  readonly to?: string;
  readonly timeZone?: string;
  readonly topic?: string;
}

export interface WebIntelligenceServiceOptions {
  readonly repository: WebRepository;
  readonly providers: WebProviders;
  readonly aiProvider?: () => AIProvider;
  readonly cacheTtlMs: number;
  readonly rateLimitPerMinute: number;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cacheKey(kind: WebToolKind, payload: object): string {
  return `${kind}:${JSON.stringify(payload)}`;
}

function withCached<T extends CacheableResponse>(value: T, cached: boolean): T {
  return Object.freeze({ ...value, cached }) as unknown as T;
}

function titleFromSearch(response: WebSearchResponse): string {
  return response.results[0]?.title ?? response.query;
}

async function collectProviderText(provider: AIProvider, prompt: string): Promise<string> {
  const session = provider.createSession();
  const stream = session.stream({
    systemInstruction:
      'You are J.A.R.V.I.S. web intelligence. Use only the supplied tool data and cite sources when present.',
    messages: [{ role: 'user', content: prompt }],
  });
  let content = '';
  for await (const chunk of stream) content += chunk.text;
  return content.trim();
}

function parseJsonObject(text: string): Readonly<Record<string, unknown>> | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Readonly<Record<string, unknown>>)
      : undefined;
  } catch {
    return undefined;
  }
}

function currencyDecision(prompt: string): ToolDecision | undefined {
  const match = /(?:\b(\d+(?:\.\d+)?)\s*)?\b([A-Z]{3})\b\s+(?:to|in)\s+\b([A-Z]{3})\b/i.exec(
    prompt,
  );
  if (!match) return undefined;
  return Object.freeze({
    intent: 'currency' as const,
    query: prompt,
    amount: Number(match[1] ?? 1),
    from: match[2]!.toUpperCase(),
    to: match[3]!.toUpperCase(),
  });
}

function categoryFromPrompt(prompt: string): NewsCategory {
  const lower = prompt.toLowerCase();
  if (lower.includes('technology') || lower.includes('ai')) return 'technology';
  if (lower.includes('business') || lower.includes('market')) return 'business';
  if (lower.includes('sports') || lower.includes('match')) return 'sports';
  if (lower.includes('entertainment') || lower.includes('movie')) return 'entertainment';
  if (lower.includes('science')) return 'science';
  return 'top';
}

function fallbackDecision(prompt: string): ToolDecision {
  const normalized = normalize(prompt);
  const currency = currencyDecision(normalized);
  if (currency) return currency;
  const lower = normalized.toLowerCase();
  if (lower.includes('weather') || lower.includes('forecast')) {
    const location = /(?:in|for)\s+([a-zA-Z\s,.-]+)$/i.exec(normalized)?.[1]?.trim();
    return Object.freeze({
      intent: 'weather' as const,
      query: normalized,
      location: location || 'New York',
    });
  }
  if (lower.includes('news') || lower.includes('headline') || lower.includes('today')) {
    return Object.freeze({
      intent: 'news' as const,
      query: normalized,
      category: categoryFromPrompt(normalized),
    });
  }
  if (lower.includes('time') || lower.includes('timezone')) {
    return Object.freeze({
      intent: 'time' as const,
      query: normalized,
      timeZone: lower.includes('india') ? 'Asia/Kolkata' : 'UTC',
    });
  }
  if (lower.startsWith('where is') || lower.includes('map')) {
    return Object.freeze({ intent: 'maps' as const, query: normalized });
  }
  if (lower.startsWith('who is') || lower.startsWith('what is')) {
    return Object.freeze({ intent: 'knowledge' as const, query: normalized, topic: normalized });
  }
  return Object.freeze({ intent: 'search' as const, query: normalized });
}

function decisionFromAi(prompt: string, text: string): ToolDecision | undefined {
  const parsed = parseJsonObject(text);
  if (!parsed) return undefined;
  const intent = parsed.intent;
  if (
    intent !== 'search' &&
    intent !== 'weather' &&
    intent !== 'news' &&
    intent !== 'currency' &&
    intent !== 'time' &&
    intent !== 'maps' &&
    intent !== 'knowledge'
  ) {
    return undefined;
  }
  const query = typeof parsed.query === 'string' ? normalize(parsed.query) : normalize(prompt);
  return Object.freeze({
    intent,
    query,
    location: typeof parsed.location === 'string' ? parsed.location : undefined,
    category:
      parsed.category === 'technology' ||
      parsed.category === 'business' ||
      parsed.category === 'sports' ||
      parsed.category === 'entertainment' ||
      parsed.category === 'science' ||
      parsed.category === 'top'
        ? parsed.category
        : undefined,
    country: typeof parsed.country === 'string' ? parsed.country : undefined,
    amount: typeof parsed.amount === 'number' ? parsed.amount : undefined,
    from: typeof parsed.from === 'string' ? parsed.from.toUpperCase() : undefined,
    to: typeof parsed.to === 'string' ? parsed.to.toUpperCase() : undefined,
    timeZone: typeof parsed.timeZone === 'string' ? parsed.timeZone : undefined,
    topic: typeof parsed.topic === 'string' ? parsed.topic : undefined,
  });
}

function citationsFromResponse(response: CacheableResponse): readonly Citation[] {
  if ('citations' in response) return response.citations;
  if ('citation' in response) return Object.freeze([response.citation]);
  return Object.freeze([]);
}

function fallbackAnswer(decision: ToolDecision, response: CacheableResponse): string {
  if ('results' in response) {
    return response.results.length
      ? response.results
          .slice(0, 3)
          .map((result) => `- ${result.title}: ${result.snippet}`)
          .join('\n')
      : 'No search results were returned.';
  }
  if ('current' in response) {
    return `${response.location}: ${response.current.temperatureCelsius}°C, ${response.current.condition}, humidity ${response.current.humidityPercent}%, wind ${response.current.windKph} kph.`;
  }
  if ('articles' in response) {
    return response.articles.length
      ? response.articles
          .slice(0, 5)
          .map((article) => `- ${article.title}`)
          .join('\n')
      : 'No news articles were returned.';
  }
  if ('converted' in response) {
    return `${response.amount} ${response.from} = ${response.converted.toFixed(2)} ${response.to} (rate ${response.rate.toFixed(4)}).`;
  }
  if ('displayTime' in response && 'timeZone' in response) {
    return `${response.timeZone}: ${response.displayTime}`;
  }
  if ('places' in response) {
    return response.places[0]
      ? `${response.places[0].name}: ${response.places[0].address}`
      : `No places found for ${decision.query}.`;
  }
  if ('summary' in response) return response.summary;
  return 'Web intelligence completed the request.';
}

export class WebIntelligenceService {
  readonly #repository: WebRepository;
  readonly #providers: WebProviders;
  readonly #cache: TtlCache<CacheableResponse>;
  readonly #rateLimiter: WebRateLimiter;
  readonly #aiProvider: (() => AIProvider) | undefined;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  public constructor(options: WebIntelligenceServiceOptions) {
    this.#repository = options.repository;
    this.#providers = options.providers;
    this.#cache = new TtlCache<CacheableResponse>(options.cacheTtlMs, () =>
      this.#clock().getTime(),
    );
    this.#rateLimiter = new WebRateLimiter(options.rateLimitPerMinute, () =>
      this.#clock().getTime(),
    );
    this.#aiProvider = options.aiProvider;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  public dashboard(): WebDashboard {
    return Object.freeze({
      history: this.history(),
      bookmarks: this.bookmarks(),
      tools: WEB_TOOL_KINDS,
    });
  }

  public async search(request: WebSearchRequest): Promise<WebSearchResponse> {
    const normalized = { ...request, query: normalize(request.query), limit: request.limit ?? 8 };
    const response = await this.cached('search', normalized, () =>
      this.#providers.search.search(normalized, this.runtime()),
    );
    this.recordHistory('search', titleFromSearch(response), normalized.query);
    return response;
  }

  public async weather(request: WeatherRequest): Promise<WeatherResponse> {
    const normalized = {
      ...request,
      location: normalize(request.location),
      days: request.days ?? 3,
    };
    const response = await this.cached('weather', normalized, () =>
      this.#providers.weather.weather(normalized, this.runtime()),
    );
    this.recordHistory('weather', `Weather: ${response.location}`, normalized.location);
    return response;
  }

  public async news(request: NewsRequest): Promise<NewsResponse> {
    const normalized = {
      ...request,
      category: request.category ?? 'top',
      limit: request.limit ?? 8,
    };
    const response = await this.cached('news', normalized, () =>
      this.#providers.news.news(normalized, this.runtime()),
    );
    this.recordHistory('news', `${response.category} headlines`, response.category);
    return response;
  }

  public async convertCurrency(
    request: CurrencyConversionRequest,
  ): Promise<CurrencyConversionResponse> {
    const normalized = {
      amount: request.amount,
      from: request.from.toUpperCase(),
      to: request.to.toUpperCase(),
    };
    const response = await this.cached('currency', normalized, () =>
      this.#providers.currency.convert(normalized, this.runtime()),
    );
    this.recordHistory(
      'currency',
      `${response.from} to ${response.to}`,
      `${response.amount} ${response.from} to ${response.to}`,
    );
    return response;
  }

  public async time(request: TimeRequest): Promise<TimeResponse> {
    const normalized = { timeZone: normalize(request.timeZone) };
    const response = await this.cached('time', normalized, () =>
      this.#providers.time.time(normalized, this.runtime()),
    );
    this.recordHistory('time', `Time: ${response.timeZone}`, response.timeZone);
    return response;
  }

  public convertTime(request: TimeConversionRequest): Promise<TimeConversionResponse> {
    this.#rateLimiter.assertAllowed('time');
    return this.#providers.time.convert(request, this.runtime());
  }

  public async maps(request: MapLookupRequest): Promise<MapLookupResponse> {
    const normalized = { ...request, query: normalize(request.query), limit: request.limit ?? 5 };
    const response = await this.cached('maps', normalized, () =>
      this.#providers.maps.lookup(normalized, this.runtime()),
    );
    this.recordHistory('maps', `Map: ${normalized.query}`, normalized.query);
    return response;
  }

  public async knowledge(request: KnowledgeRequest): Promise<KnowledgeResponse> {
    const normalized = { topic: normalize(request.topic) };
    const response = await this.cached('knowledge', normalized, () =>
      this.#providers.knowledge.lookup(normalized, this.runtime()),
    );
    this.recordHistory('knowledge', response.title, normalized.topic);
    return response;
  }

  public async ask(request: WebAssistantRequest): Promise<WebAssistantResponse> {
    const prompt = normalize(request.prompt);
    const decision = await this.decide(prompt);
    const response = await this.runDecision(decision);
    const answer = await this.answerWithAi(decision, response);
    return Object.freeze({
      prompt,
      intent: decision.intent,
      answer,
      usedTools: Object.freeze([decision.intent]),
      citations: citationsFromResponse(response),
      generatedAt: this.#clock().toISOString(),
    });
  }

  public history(): readonly WebHistoryEntry[] {
    return this.#repository.history();
  }

  public bookmarks(): readonly WebBookmark[] {
    return this.#repository.bookmarks();
  }

  public saveBookmark(request: WebBookmarkRequest): WebBookmark {
    return this.#repository.saveBookmark({
      id: this.#idFactory(),
      kind: request.kind,
      title: normalize(request.title),
      query: request.query ? normalize(request.query) : undefined,
      url: request.url ? normalize(request.url) : undefined,
      createdAt: this.#clock().toISOString(),
    });
  }

  public deleteBookmark(id: string): void {
    if (!this.#repository.deleteBookmark(id)) {
      throw new PlatformError(ERROR_CODES.webBookmarkNotFound, 'Web bookmark was not found.', {
        metadata: { id },
      });
    }
  }

  public close(): void {
    this.#repository.close();
    this.#cache.clear();
  }

  private async cached<T extends CacheableResponse>(
    kind: WebToolKind,
    request: object,
    loader: () => Promise<T>,
  ): Promise<T> {
    this.#rateLimiter.assertAllowed(kind);
    const key = cacheKey(kind, request);
    const cached = this.#cache.get(key);
    if (cached) return withCached(cached as T, true);
    const loaded = withCached(await loader(), false);
    this.#cache.set(key, loaded);
    return loaded;
  }

  private runtime() {
    return Object.freeze({ now: this.#clock });
  }

  private recordHistory(kind: WebToolKind, title: string, query: string): void {
    this.#repository.addHistory({
      id: this.#idFactory(),
      kind,
      title: normalize(title).slice(0, 200) || kind,
      query: normalize(query).slice(0, 500),
      createdAt: this.#clock().toISOString(),
    });
  }

  private async decide(prompt: string): Promise<ToolDecision> {
    const provider = this.#aiProvider?.();
    if (!provider) return fallbackDecision(prompt);
    try {
      const text = await collectProviderText(
        provider,
        `Choose exactly one tool for this request and return only JSON with keys intent, query, location, category, country, amount, from, to, timeZone, topic.
Allowed intent values: search, weather, news, currency, time, maps, knowledge.
Request: ${prompt}`,
      );
      return decisionFromAi(prompt, text) ?? fallbackDecision(prompt);
    } catch {
      return fallbackDecision(prompt);
    }
  }

  private async runDecision(decision: ToolDecision): Promise<CacheableResponse> {
    if (decision.intent === 'weather') {
      return this.weather({ location: decision.location ?? decision.query, days: 3 });
    }
    if (decision.intent === 'news') {
      return this.news({
        category: decision.category,
        country: decision.country,
        query: decision.query,
        limit: 8,
      });
    }
    if (decision.intent === 'currency') {
      return this.convertCurrency({
        amount: decision.amount ?? 1,
        from: decision.from ?? 'USD',
        to: decision.to ?? 'INR',
      });
    }
    if (decision.intent === 'time') {
      return this.time({ timeZone: decision.timeZone ?? 'UTC' });
    }
    if (decision.intent === 'maps') {
      return this.maps({ query: decision.query });
    }
    if (decision.intent === 'knowledge') {
      return this.knowledge({ topic: decision.topic ?? decision.query });
    }
    return this.search({ query: decision.query, limit: 8 });
  }

  private async answerWithAi(decision: ToolDecision, response: CacheableResponse): Promise<string> {
    const fallback = fallbackAnswer(decision, response);
    const provider = this.#aiProvider?.();
    if (!provider) return fallback;
    try {
      return (
        (await collectProviderText(
          provider,
          `Answer the request using only this web tool result. Include concise citations by title when useful.
Request: ${decision.query}
Tool: ${decision.intent}
Result JSON:
${JSON.stringify(response, null, 2)}`,
        )) || fallback
      );
    } catch {
      return fallback;
    }
  }
}
