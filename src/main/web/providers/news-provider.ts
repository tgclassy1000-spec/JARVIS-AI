import type {
  Citation,
  NewsArticle,
  NewsCategory,
  NewsRequest,
  NewsResponse,
} from '../../../shared/web/contracts';
import type { NewsProvider, ProviderRuntime } from './contracts';
import type { WebHttpClient } from './http-client';
import { asArray, asOptionalString, asRecord, hostname } from './json';

const CATEGORY_QUERY: Readonly<Record<NewsCategory, string>> = Object.freeze({
  top: '',
  technology: 'technology OR ai OR software',
  business: 'business OR markets OR startup',
  sports: 'sports',
  entertainment: 'entertainment OR film OR music',
  science: 'science OR space OR research',
});

export class HackerNewsNewsProvider implements NewsProvider {
  public readonly id = 'hacker-news-algolia';

  public constructor(private readonly http: WebHttpClient) {}

  public async news(request: NewsRequest, runtime: ProviderRuntime): Promise<NewsResponse> {
    const category = request.category ?? 'top';
    const query = request.query ?? CATEGORY_QUERY[category];
    const limit = request.limit ?? 8;
    const url = new URL('https://hn.algolia.com/api/v1/search_by_date');
    url.searchParams.set('tags', 'story');
    if (query) url.searchParams.set('query', query);
    url.searchParams.set('hitsPerPage', String(limit));
    const payload = asRecord(await this.http.getJson(url));
    const generatedAt = runtime.now().toISOString();
    const articles: NewsArticle[] = asArray(payload.hits)
      .map(asRecord)
      .map((hit, index) => {
        const urlValue =
          asOptionalString(hit.url) ??
          `https://news.ycombinator.com/item?id=${asOptionalString(hit.objectID) ?? String(index)}`;
        const title =
          asOptionalString(hit.title) ?? asOptionalString(hit.story_title) ?? 'Untitled';
        return Object.freeze({
          id: asOptionalString(hit.objectID) ?? `news:${index}`,
          title,
          url: urlValue,
          source: hostname(urlValue),
          summary: title,
          category,
          country: request.country?.toUpperCase(),
          publishedAt: asOptionalString(hit.created_at) ?? generatedAt,
        });
      })
      .slice(0, limit);
    const citations: Citation[] = articles.map((article) =>
      Object.freeze({
        title: article.title,
        url: article.url,
        source: article.source,
        accessedAt: generatedAt,
      }),
    );
    return Object.freeze({
      category,
      country: request.country?.toUpperCase(),
      articles: Object.freeze(articles),
      citations: Object.freeze(citations),
      generatedAt,
      cached: false,
    });
  }
}
