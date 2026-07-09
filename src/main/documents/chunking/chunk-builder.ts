import { randomUUID } from 'node:crypto';

import type { DocumentChunk } from '../../../shared/documents/contracts';

export interface ChunkBuilderOptions {
  readonly targetCharacters?: number;
  readonly overlapCharacters?: number;
  readonly idFactory?: () => string;
}

export class ChunkBuilder {
  readonly #targetCharacters: number;
  readonly #overlapCharacters: number;
  readonly #idFactory: () => string;

  public constructor(options: ChunkBuilderOptions = {}) {
    this.#targetCharacters = options.targetCharacters ?? 1_600;
    this.#overlapCharacters = options.overlapCharacters ?? 180;
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  public build(documentId: string, text: string): readonly DocumentChunk[] {
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (!normalized) return Object.freeze([]);
    const chunks: DocumentChunk[] = [];
    let cursor = 0;
    while (cursor < normalized.length) {
      const hardEnd = Math.min(cursor + this.#targetCharacters, normalized.length);
      const newline = normalized.lastIndexOf('\n', hardEnd);
      const sentence = normalized.lastIndexOf('. ', hardEnd);
      const boundary = Math.max(newline, sentence);
      const end = boundary > cursor + this.#targetCharacters * 0.55 ? boundary + 1 : hardEnd;
      const content = normalized.slice(cursor, end).trim();
      if (content) {
        chunks.push(
          Object.freeze({
            id: this.#idFactory(),
            documentId,
            index: chunks.length,
            content,
            tokenEstimate: Math.max(1, Math.ceil(content.length / 4)),
          }),
        );
      }
      if (end >= normalized.length) break;
      cursor = Math.max(end - this.#overlapCharacters, cursor + 1);
    }
    return Object.freeze(chunks);
  }
}
