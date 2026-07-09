import type {
  DocumentDetail,
  DocumentFormat,
  DocumentSearchMode,
  DocumentSearchResult,
} from '../../../shared/documents/contracts';
import { cosineSimilarity, semanticVector } from '../../memory/semantic/semantic-index';

export interface DocumentFilter {
  readonly formats?: readonly DocumentFormat[];
  readonly pinnedOnly?: boolean;
}

function keywordScore(text: string, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

function excerpt(content: string, query: string): string {
  const normalized = query.trim().toLowerCase();
  const firstTerm = normalized.split(/\s+/)[0]!;
  const index = content.toLowerCase().indexOf(firstTerm);
  const start = Math.max(0, index < 0 ? 0 : index - 70);
  return content.slice(start, start + 220).trim();
}

export class DocumentIndexer {
  public search(
    documents: readonly DocumentDetail[],
    query: string,
    mode: DocumentSearchMode,
    filter: DocumentFilter,
    limit: number,
  ): readonly DocumentSearchResult[] {
    const normalized = query.trim();
    if (!normalized) return Object.freeze([]);
    const queryVector = semanticVector(normalized);
    const results: DocumentSearchResult[] = [];
    for (const document of documents) {
      if (filter.pinnedOnly && !document.pinned) continue;
      if (filter.formats && !filter.formats.includes(document.format)) continue;
      for (const chunk of document.chunks.length > 0 ? document.chunks : [undefined]) {
        const content = chunk?.content ?? document.preview;
        const keyword = keywordScore(`${document.title} ${content}`, normalized);
        const semantic = cosineSimilarity(
          queryVector,
          semanticVector(`${document.title} ${content}`),
        );
        const score =
          mode === 'keyword'
            ? keyword
            : mode === 'semantic'
              ? semantic
              : Math.max(keyword, semantic);
        if (score <= 0) continue;
        results.push(
          Object.freeze({
            document,
            chunk,
            score,
            match: excerpt(content, normalized),
          }),
        );
      }
    }
    return Object.freeze(
      results
        .sort(
          (left, right) =>
            right.score - left.score ||
            Number(right.document.pinned) - Number(left.document.pinned) ||
            right.document.updatedAt.localeCompare(left.document.updatedAt),
        )
        .slice(0, limit),
    );
  }
}
