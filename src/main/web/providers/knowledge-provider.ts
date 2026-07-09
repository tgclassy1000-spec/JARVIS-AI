import { ERROR_CODES } from '../../../shared/platform/errors';
import type { Citation, KnowledgeRequest, KnowledgeResponse } from '../../../shared/web/contracts';
import { PlatformError } from '../../platform/errors/platform-error';
import type { KnowledgeProvider, ProviderRuntime } from './contracts';
import type { WebHttpClient } from './http-client';
import { asOptionalString, asRecord } from './json';

export class WikipediaKnowledgeProvider implements KnowledgeProvider {
  public readonly id = 'wikipedia-summary';

  public constructor(private readonly http: WebHttpClient) {}

  public async lookup(
    request: KnowledgeRequest,
    runtime: ProviderRuntime,
  ): Promise<KnowledgeResponse> {
    const url = new URL(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(request.topic)}`,
    );
    const payload = asRecord(await this.http.getJson(url));
    const desktopUrl = asRecord(asRecord(payload.content_urls).desktop);
    const pageUrl = asOptionalString(desktopUrl.page) ?? url.toString();
    const title = asOptionalString(payload.title) ?? request.topic;
    const summary = asOptionalString(payload.extract) ?? '';
    if (!summary) {
      throw new PlatformError(ERROR_CODES.webProviderUnavailable, 'Knowledge topic was not found.');
    }
    const generatedAt = runtime.now().toISOString();
    const citation: Citation = Object.freeze({
      title,
      url: pageUrl,
      source: 'wikipedia.org',
      accessedAt: generatedAt,
    });
    return Object.freeze({
      topic: request.topic,
      title,
      summary,
      url: pageUrl,
      citation,
      generatedAt,
      cached: false,
    });
  }
}
