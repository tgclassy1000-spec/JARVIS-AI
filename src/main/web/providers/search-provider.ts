import type {
  Citation,
  WebSearchRequest,
  WebSearchResponse,
  WebSearchResult,
} from '../../../shared/web/contracts';
import type { ProviderRuntime, WebSearchProvider } from './contracts';
import type { WebHttpClient } from './http-client';
import { asArray, asOptionalString, asRecord, asString, hostname } from './json';

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function citation(result: WebSearchResult, accessedAt: string): Citation {
  return Object.freeze({
    title: result.title,
    url: result.url,
    source: result.source,
    accessedAt,
  });
}

function flattenTopics(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  const topics = asArray(value).flatMap((topic) => {
    const record = asRecord(topic);
    const nested = asArray(record.Topics);
    return nested.length > 0 ? nested.map(asRecord) : [record];
  });
  return Object.freeze(topics);
}

export class DuckDuckGoSearchProvider implements WebSearchProvider {
  public readonly id = 'duckduckgo-instant-answer';

  public constructor(private readonly http: WebHttpClient) {}

  public async search(
    request: WebSearchRequest,
    runtime: ProviderRuntime,
  ): Promise<WebSearchResponse> {
    const limit = request.limit ?? 8;
    const url = new URL('https://api.duckduckgo.com/');
    url.searchParams.set('q', request.query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_html', '1');
    url.searchParams.set('no_redirect', '1');
    const payload = asRecord(await this.http.getJson(url));
    const generatedAt = runtime.now().toISOString();
    const results: WebSearchResult[] = [];
    const abstractUrl = asOptionalString(payload.AbstractURL);
    const abstractText = asOptionalString(payload.AbstractText);
    const heading = asOptionalString(payload.Heading);
    if (abstractUrl && abstractText && heading) {
      results.push(
        Object.freeze({
          id: `search:${results.length}`,
          title: heading,
          url: abstractUrl,
          snippet: abstractText,
          source: hostname(abstractUrl),
          rank: results.length + 1,
          score: 1,
          metadata: {
            url: abstractUrl,
            title: heading,
            description: abstractText,
            siteName: hostname(abstractUrl),
            fetchedAt: generatedAt,
          },
        }),
      );
    }

    for (const topic of flattenTopics(payload.RelatedTopics)) {
      const urlValue = asOptionalString(topic.FirstURL);
      const title = asOptionalString(topic.Text)?.split(' - ')[0] ?? asOptionalString(topic.Result);
      const snippet = asOptionalString(topic.Text) ?? stripHtml(asString(topic.Result));
      if (!urlValue || !title || !snippet) continue;
      results.push(
        Object.freeze({
          id: `search:${results.length}`,
          title: stripHtml(title),
          url: urlValue,
          snippet: stripHtml(snippet),
          source: hostname(urlValue),
          rank: results.length + 1,
          score: Math.max(0.1, 1 - results.length * 0.08),
          metadata: {
            url: urlValue,
            title: stripHtml(title),
            description: stripHtml(snippet),
            siteName: hostname(urlValue),
            fetchedAt: generatedAt,
          },
        }),
      );
      if (results.length >= limit) break;
    }

    const ranked = results.slice(0, limit).map((result, index) =>
      Object.freeze({
        ...result,
        rank: index + 1,
        score: Math.max(result.score, 1 / (index + 1)),
      }),
    );
    return Object.freeze({
      query: request.query,
      results: Object.freeze(ranked),
      citations: Object.freeze(ranked.map((result) => citation(result, generatedAt))),
      summary: ranked[0]?.snippet ?? 'No web search results were returned.',
      generatedAt,
      cached: false,
    });
  }
}
