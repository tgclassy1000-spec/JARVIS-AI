import { basename } from 'node:path';

import type { DocumentFormat, ExtractedTable } from '../../../shared/documents/contracts';
import type { DocumentParser, ParsedDocument } from './contracts';

function decode(buffer: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer).split('\u0000').join('');
}

function csvRows(text: string): readonly (readonly string[])[] {
  return Object.freeze(
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) =>
        Object.freeze(
          line
            .split(',')
            .map((cell) => cell.trim().replace(/^"|"$/g, ''))
            .filter((cell) => cell.length > 0),
        ),
      )
      .filter((row) => row.length > 1),
  );
}

function markdownTables(text: string): readonly ExtractedTable[] {
  const lines = text.split(/\r?\n/);
  const tables: ExtractedTable[] = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index];
    const separator = lines[index + 1];
    if (!header?.includes('|') || !separator || !/^\s*\|?\s*:?-{3,}/.test(separator)) continue;
    const rows: string[][] = [];
    let cursor = index;
    while (cursor < lines.length && lines[cursor]?.includes('|')) {
      const line = lines[cursor];
      if (line && !/^\s*\|?\s*:?-{3,}/.test(line)) {
        rows.push(
          line
            .split('|')
            .map((cell) => cell.trim())
            .filter(Boolean),
        );
      }
      cursor += 1;
    }
    tables.push({ rows });
    index = cursor;
  }
  return Object.freeze(tables.map((table) => Object.freeze(table)));
}

export class TextDocumentParser implements DocumentParser {
  public readonly formats: readonly DocumentFormat[] = ['txt', 'markdown', 'csv', 'json'];

  public parse(input: {
    readonly buffer: Uint8Array;
    readonly fileName: string;
    readonly format: DocumentFormat;
  }): ParsedDocument {
    const raw = decode(input.buffer);
    const text =
      input.format === 'json'
        ? JSON.stringify(JSON.parse(raw) as unknown, null, 2)
        : raw.replace(/\r\n/g, '\n').trim();
    const csvTable =
      input.format === 'csv'
        ? [{ title: 'CSV data', rows: csvRows(text) }]
        : ([] as readonly ExtractedTable[]);
    return Object.freeze({
      title: basename(input.fileName),
      format: input.format,
      text,
      tables: input.format === 'markdown' ? markdownTables(text) : csvTable,
      needsOcr: false,
    });
  }
}
