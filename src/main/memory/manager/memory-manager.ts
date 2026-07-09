import type {
  MemoryArchive,
  MemoryExport,
  MemoryKind,
  MemoryRecord,
  MemorySearchRequest,
  MemorySearchResult,
  MemorySettings,
  SaveMemoryRequest,
  UpdateMemoryRequest,
} from '../../../shared/memory/contracts';
import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError } from '../../platform/errors/platform-error';
import type { MemoryRepository } from '../persistence/memory-repository';
import { cosineSimilarity, semanticVector } from '../semantic/semantic-index';

function normalizeTags(tags: readonly string[] = []): readonly string[] {
  return Object.freeze(
    [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
  );
}

function keywordScore(memory: MemoryRecord, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const haystack = `${memory.content} ${memory.summary} ${memory.tags.join(' ')}`.toLowerCase();
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

export class MemoryManager {
  public constructor(private readonly repository: MemoryRepository) {}

  public saveMemory(request: SaveMemoryRequest): MemoryRecord {
    this.assertEnabled();
    return this.repository.save({
      ...request,
      content: request.content.trim(),
      summary: request.summary?.trim() || request.content.trim(),
      tags: normalizeTags(request.tags),
    });
  }

  public recallMemory(query: string, limit = 6): readonly MemoryRecord[] {
    if (!this.settings().enabled) return Object.freeze([]);
    return this.searchMemory({ query, mode: 'hybrid', limit }).map((result) => result.memory);
  }

  public updateMemory(request: UpdateMemoryRequest): MemoryRecord {
    const updated = this.repository.update({
      ...request,
      content: request.content?.trim(),
      summary: request.summary?.trim(),
      tags: request.tags ? normalizeTags(request.tags) : undefined,
    });
    if (!updated) throw this.notFound(request.id);
    return updated;
  }

  public forgetMemory(id: string): void {
    if (!this.repository.delete(id)) throw this.notFound(id);
  }

  public searchMemory(request: MemorySearchRequest): readonly MemorySearchResult[] {
    if (!this.settings().enabled) return Object.freeze([]);
    const queryVector = semanticVector(request.query);
    const requiredTags = normalizeTags(request.tags);
    const mode = request.mode ?? 'hybrid';
    return Object.freeze(
      this.repository
        .list(request.kind)
        .filter((memory) => requiredTags.every((tag) => memory.tags.includes(tag)))
        .map((memory) => {
          const keyword = keywordScore(memory, request.query);
          const semantic = cosineSimilarity(
            queryVector,
            semanticVector(`${memory.content} ${memory.summary} ${memory.tags.join(' ')}`),
          );
          const score =
            mode === 'keyword'
              ? keyword
              : mode === 'semantic'
                ? semantic
                : Math.max(keyword, semantic);
          return { memory, score };
        })
        .filter((result) => !request.query.trim() || result.score > 0)
        .sort(
          (left, right) =>
            Number(right.memory.pinned) - Number(left.memory.pinned) || right.score - left.score,
        )
        .slice(0, request.limit ?? 50),
    );
  }

  public summarizeMemory(kind?: MemoryKind): string {
    const memories = this.repository.list(kind);
    if (memories.length === 0) return 'No saved memories.';
    return memories.map((memory) => `- [${memory.kind}] ${memory.summary}`).join('\n');
  }

  public mergeDuplicateMemories(): number {
    const memories = this.repository.list();
    const removed = new Set<string>();
    let merged = 0;
    for (let index = 0; index < memories.length; index += 1) {
      let target = memories[index];
      if (!target || removed.has(target.id)) continue;
      for (let candidateIndex = index + 1; candidateIndex < memories.length; candidateIndex += 1) {
        const candidate = memories[candidateIndex];
        if (!candidate || removed.has(candidate.id) || candidate.kind !== target.kind) continue;
        const similarity = cosineSimilarity(
          semanticVector(target.content),
          semanticVector(candidate.content),
        );
        if (similarity < 0.9) continue;
        target =
          this.repository.update({
            id: target.id,
            tags: normalizeTags([...target.tags, ...candidate.tags]),
            pinned: target.pinned || candidate.pinned,
          }) ?? target;
        this.repository.delete(candidate.id);
        removed.add(candidate.id);
        merged += 1;
      }
    }
    return merged;
  }

  public list(kind?: MemoryKind): readonly MemoryRecord[] {
    return this.repository.list(kind);
  }

  public settings(): MemorySettings {
    return this.repository.settings();
  }

  public setEnabled(enabled: boolean): MemorySettings {
    return this.repository.setEnabled(enabled);
  }

  public deleteEverything(): number {
    return this.repository.deleteAll();
  }

  public backup(): MemoryArchive {
    return this.repository.archive();
  }

  public restore(archive: MemoryArchive, replace: boolean): number {
    return this.repository.restore(archive, replace);
  }

  public exportMemory(): MemoryExport {
    return Object.freeze({
      filename: `jarvis-memory-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
      content: JSON.stringify(this.backup(), null, 2),
    });
  }

  public close(): void {
    this.repository.close();
  }

  private assertEnabled(): void {
    if (!this.settings().enabled) {
      throw new PlatformError(ERROR_CODES.memoryDisabled, 'Memory is disabled.');
    }
  }

  private notFound(id: string): PlatformError {
    return new PlatformError(ERROR_CODES.memoryNotFound, 'Memory was not found.', {
      metadata: { id },
    });
  }
}
