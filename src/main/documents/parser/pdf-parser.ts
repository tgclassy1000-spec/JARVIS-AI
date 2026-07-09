import { basename } from 'node:path';

import type { DocumentFormat } from '../../../shared/documents/contracts';
import type { DocumentParser, ParsedDocument } from './contracts';

function decodePdfBytes(buffer: Uint8Array): string {
  return new TextDecoder('latin1', { fatal: false }).decode(buffer);
}

function unescapePdfText(value: string): string {
  return value
    .replace(/\\\)/g, ')')
    .replace(/\\\(/g, '(')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

function extractLiteralText(raw: string): string {
  const literal = [...raw.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g)].map((match) =>
    unescapePdfText(match[1]!),
  );
  const arrays = [...raw.matchAll(/\[((?:\s*\([^()\\]*(?:\\.[^()\\]*)*\)\s*)+)\]\s*TJ/g)]
    .flatMap((match) => [...match[1]!.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)])
    .map((match) => unescapePdfText(match[1]!));
  return [...literal, ...arrays].join(' ').replace(/\s+/g, ' ').trim();
}

export class PdfDocumentParser implements DocumentParser {
  public readonly formats: readonly DocumentFormat[] = ['pdf'];

  public parse(input: {
    readonly buffer: Uint8Array;
    readonly fileName: string;
    readonly format: DocumentFormat;
  }): ParsedDocument {
    const raw = decodePdfBytes(input.buffer);
    const pageCount = Math.max(1, [...raw.matchAll(/\/Type\s*\/Page\b/g)].length);
    const text = extractLiteralText(raw);
    return Object.freeze({
      title: basename(input.fileName),
      format: 'pdf' as const,
      text,
      pageCount,
      tables: Object.freeze([]),
      needsOcr: text.length < 20,
    });
  }
}
