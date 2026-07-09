import { basename } from 'node:path';

import { unzipSync } from 'fflate';

import type { DocumentFormat, ExtractedTable } from '../../../shared/documents/contracts';
import type { DocumentParser, ParsedDocument } from './contracts';
import { textNodes } from './xml';

type ZipEntries = Readonly<Record<string, Uint8Array>>;

function unzip(buffer: Uint8Array): ZipEntries {
  return unzipSync(buffer);
}

function decode(entry: Uint8Array | undefined): string {
  if (!entry) return '';
  return new TextDecoder('utf-8', { fatal: false }).decode(entry);
}

function entryText(entries: ZipEntries, path: string): string {
  return decode(entries[path]);
}

function sortedEntryNames(entries: ZipEntries, prefix: string, suffix: string): readonly string[] {
  return Object.keys(entries)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function wordTables(documentXml: string): readonly ExtractedTable[] {
  const tables = [...documentXml.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g)].map((tableMatch) => {
    const rows = [...tableMatch[0].matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)].map((rowMatch) =>
      Object.freeze(
        [...rowMatch[0].matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)]
          .map((cellMatch) => textNodes(cellMatch[0]).join(' ').trim())
          .filter(Boolean),
      ),
    );
    return Object.freeze({
      title: 'DOCX table',
      rows: Object.freeze(rows.filter((row) => row.length > 0)),
    });
  });
  return Object.freeze(tables.filter((table) => table.rows.length > 0));
}

function sharedStrings(entries: ZipEntries): readonly string[] {
  const xml = entryText(entries, 'xl/sharedStrings.xml');
  return Object.freeze(
    [...xml.matchAll(/<si[\s\S]*?<\/si>/g)].map((match) => textNodes(match[0]).join(' ')),
  );
}

function worksheetRows(
  sheetXml: string,
  shared: readonly string[],
): readonly (readonly string[])[] {
  const rows = [...sheetXml.matchAll(/<row[\s\S]*?<\/row>/g)].map((rowMatch) => {
    const cells = [...rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((cellMatch) => {
      const attrs = cellMatch[1]!;
      const body = cellMatch[2]!;
      const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
      const value = valueMatch ? valueMatch[1]!.trim() : '';
      const inline = textNodes(body).join(' ');
      if (attrs.includes('t="s"')) return shared[Number.parseInt(value, 10)] ?? '';
      return inline || value;
    });
    return Object.freeze(cells.map((cell) => cell.trim()).filter(Boolean));
  });
  return Object.freeze(rows.filter((row) => row.length > 0));
}

export class OoxmlDocumentParser implements DocumentParser {
  public readonly formats: readonly DocumentFormat[] = ['docx', 'xlsx', 'pptx'];

  public parse(input: {
    readonly buffer: Uint8Array;
    readonly fileName: string;
    readonly format: DocumentFormat;
  }): ParsedDocument {
    const entries = unzip(input.buffer);
    if (input.format === 'docx') return this.parseDocx(entries, input.fileName);
    if (input.format === 'xlsx') return this.parseXlsx(entries, input.fileName);
    return this.parsePptx(entries, input.fileName);
  }

  private parseDocx(entries: ZipEntries, fileName: string): ParsedDocument {
    const documentXml = entryText(entries, 'word/document.xml');
    const paragraphs = [...documentXml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)]
      .map((match) => textNodes(match[0]).join(' ').trim())
      .filter(Boolean);
    return Object.freeze({
      title: basename(fileName),
      format: 'docx' as const,
      text: paragraphs.join('\n'),
      tables: wordTables(documentXml),
      needsOcr: false,
    });
  }

  private parseXlsx(entries: ZipEntries, fileName: string): ParsedDocument {
    const shared = sharedStrings(entries);
    const sheets = sortedEntryNames(entries, 'xl/worksheets/sheet', '.xml');
    const tables = sheets.map((name, index) =>
      Object.freeze({
        title: `Sheet ${index + 1}`,
        rows: worksheetRows(entryText(entries, name), shared),
      }),
    );
    const text = tables
      .flatMap((table) => table.rows.map((row) => row.join(' | ')))
      .join('\n')
      .trim();
    return Object.freeze({
      title: basename(fileName),
      format: 'xlsx' as const,
      text,
      tables: Object.freeze(tables.filter((table) => table.rows.length > 0)),
      needsOcr: false,
    });
  }

  private parsePptx(entries: ZipEntries, fileName: string): ParsedDocument {
    const slides = sortedEntryNames(entries, 'ppt/slides/slide', '.xml');
    const slideTexts = slides
      .map((name, index) => {
        const content = textNodes(entryText(entries, name)).join(' ').trim();
        return content ? `Slide ${index + 1}: ${content}` : '';
      })
      .filter(Boolean);
    return Object.freeze({
      title: basename(fileName),
      format: 'pptx' as const,
      text: slideTexts.join('\n'),
      pageCount: slides.length || undefined,
      tables: Object.freeze([]),
      needsOcr: false,
    });
  }
}
