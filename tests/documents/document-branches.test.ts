// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { strToU8, zipSync } from 'fflate';

import { ChunkBuilder } from '../../src/main/documents/chunking/chunk-builder';
import { DocumentIndexer } from '../../src/main/documents/indexing/document-indexer';
import { DocumentParserRegistry } from '../../src/main/documents/parser/document-parser-registry';
import { formatFromPath, isImageFormat } from '../../src/main/documents/parser/format';
import { stripXml, textNodes } from '../../src/main/documents/parser/xml';
import { SqliteDocumentRepository } from '../../src/main/documents/persistence/sqlite-document-repository';
import { DocumentSession } from '../../src/main/documents/session/document-session';
import type { DocumentChunk, DocumentDetail } from '../../src/shared/documents/contracts';

function zip(entries: Readonly<Record<string, string>>): Uint8Array {
  const encoded: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(entries)) encoded[name] = strToU8(content);
  return zipSync(encoded);
}

function documentDetail(id: string, overrides: Partial<DocumentDetail> = {}): DocumentDetail {
  const timestamp = `2026-01-0${id.length}T00:00:00.000Z`;
  return {
    id,
    title: `${id}.md`,
    format: 'markdown',
    sourcePath: `${id}.md`,
    byteSize: 10,
    mimeType: 'text/markdown',
    checksum: id,
    wordCount: 4,
    characterCount: 40,
    tableCount: 0,
    ocrStatus: 'not-required',
    pinned: false,
    importedAt: timestamp,
    updatedAt: timestamp,
    preview: `${id} preview`,
    chunks: [],
    tables: [],
    ...overrides,
  };
}

function chunk(documentId: string, content: string): DocumentChunk {
  return {
    id: `${documentId}:chunk`,
    documentId,
    index: 0,
    content,
    tokenEstimate: Math.max(1, Math.ceil(content.length / 4)),
  };
}

describe('document branch behavior', () => {
  it('searches empty, keyword, semantic and hybrid paths with filters and preview fallback', () => {
    const indexer = new DocumentIndexer();
    const pinned = documentDetail('pinned', {
      pinned: true,
      preview: 'Arc reactor operations manual',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
    const invoice = documentDetail('invoice', {
      format: 'pdf',
      preview: 'Invoice preview',
      chunks: [chunk('invoice', 'Pepper invoice payable next Friday')],
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const ignored = documentDetail('ignored', {
      format: 'docx',
      preview: 'Completely unrelated content',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(indexer.search([pinned], '   ', 'hybrid', {}, 10)).toHaveLength(0);
    expect(
      indexer.search([pinned, invoice], 'pepper', 'keyword', { pinnedOnly: true }, 10),
    ).toHaveLength(0);
    expect(
      indexer.search([pinned, invoice, ignored], 'pepper', 'hybrid', { formats: ['pdf'] }, 10)[0]
        ?.document.id,
    ).toBe('invoice');
    expect(indexer.search([pinned, invoice], 'arc', 'semantic', {}, 10)[0]?.document.id).toBe(
      'pinned',
    );
    expect(indexer.search([pinned, ignored], 'md', 'keyword', {}, 10)[0]?.document.id).toBe(
      'pinned',
    );
    expect(indexer.search([pinned, invoice], 'missing', 'keyword', {}, 10)).toHaveLength(0);
  });

  it('builds chunks at natural boundaries and builds prompts with optional fields', () => {
    let index = 0;
    const builder = new ChunkBuilder({
      targetCharacters: 36,
      overlapCharacters: 5,
      idFactory: () => `chunk-${++index}`,
    });
    expect(builder.build('doc', '')).toHaveLength(0);
    const chunks = builder.build(
      'doc',
      'First sentence is long enough. Second sentence is also long enough. Third sentence.',
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.content.endsWith('.')).toBe(true);

    const prompt = new DocumentSession(
      documentDetail('prompt', {
        preview: 'Preview-only content',
        tables: [{ title: 'Owners', rows: [['Owner', 'Task']] }],
      }),
    ).prompt({
      documentId: 'prompt',
      action: 'translate',
      question: 'What matters?',
      targetLanguage: 'Hindi',
    });
    expect(prompt).toContain('Question: What matters?');
    expect(prompt).toContain('Target language: Hindi');
    expect(prompt).toContain('Tables:');
    expect(prompt).toContain('Preview-only content');
  });

  it('parses helper edge cases for formats, XML, PDF and sparse OOXML packages', () => {
    const registry = new DocumentParserRegistry();

    expect(formatFromPath('REPORT.JPEG')).toBe('jpeg');
    expect(formatFromPath('archive.bin')).toBeUndefined();
    expect(isImageFormat('png')).toBe(true);
    expect(isImageFormat('pdf')).toBe(false);
    expect(stripXml('<p>Tony &amp; Pepper</p>')).toBe('Tony & Pepper');
    expect(textNodes('<w:t>One</w:t><w:t> </w:t><w:tc>Ignored</w:tc>')).toEqual(['One']);

    const pdf = registry.parse({
      fileName: 'array.pdf',
      format: 'pdf',
      buffer: strToU8('%PDF /Type /Page BT [(Hello\\n)(PDF\\) text)] TJ ET'),
    });
    expect(pdf.text).toContain('Hello');
    expect(pdf.text).toContain('PDF) text');

    const inlineXlsx = registry.parse({
      fileName: 'inline.xlsx',
      format: 'xlsx',
      buffer: zip({
        'xl/worksheets/sheet1.xml':
          '<worksheet><sheetData><row><c><v>42</v></c><c><is><t>Inline</t></is></c></row></sheetData></worksheet>',
        'xl/worksheets/sheet2.xml':
          '<worksheet><sheetData><row><c t="s"><v>9</v></c></row></sheetData></worksheet>',
      }),
    });
    expect(inlineXlsx.text).toContain('42 | Inline');

    const emptyDocx = registry.parse({
      fileName: 'empty.docx',
      format: 'docx',
      buffer: zip({}),
    });
    expect(emptyDocx.text).toBe('');
    expect(emptyDocx.tables).toHaveLength(0);

    const emptyPptx = registry.parse({
      fileName: 'empty.pptx',
      format: 'pptx',
      buffer: zip({}),
    });
    expect(emptyPptx.pageCount).toBeUndefined();
    expect(emptyPptx.text).toBe('');

    const mixedPptx = registry.parse({
      fileName: 'mixed.pptx',
      format: 'pptx',
      buffer: zip({
        'ppt/slides/slide2.xml': '<p:sld><a:t>Second</a:t></p:sld>',
        'ppt/slides/slide1.xml': '<p:sld></p:sld>',
      }),
    });
    expect(mixedPptx.text).toBe('Slide 2: Second');
  });

  it('covers repository missing rows, history variants, rollback and schema protection', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-doc-branches-'));
    const repository = new SqliteDocumentRepository(join(directory, 'documents.sqlite'));
    try {
      expect(repository.get('missing')).toBeUndefined();
      expect(repository.getByChecksum('missing')).toBeUndefined();
      expect(repository.pin('missing', true)).toBeUndefined();
      expect(repository.touch('missing', '2026-01-01T00:00:00.000Z')).toBeUndefined();
      expect(repository.delete('missing')).toBe(false);

      repository.save({
        id: 'history',
        title: 'History',
        format: 'pdf',
        sourcePath: 'history.pdf',
        byteSize: 200,
        mimeType: 'application/pdf',
        checksum: 'history-checksum',
        pageCount: 2,
        wordCount: 2,
        characterCount: 20,
        tableCount: 0,
        ocrStatus: 'not-required',
        pinned: true,
        importedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastOpenedAt: '2026-01-02T00:00:00.000Z',
        preview: 'History preview',
        chunks: [chunk('history', 'History preview')],
        tables: [],
      });
      repository.saveAnalysis({
        documentId: 'history',
        action: 'summarize',
        content: 'Summary',
        generatedAt: '2026-01-03T00:00:00.000Z',
      });
      expect(repository.history('history')).toHaveLength(1);

      expect(() =>
        repository.save({
          id: 'rollback',
          title: 'Rollback',
          format: 'markdown',
          sourcePath: 'rollback.md',
          byteSize: 50,
          mimeType: 'text/markdown',
          checksum: 'rollback-checksum',
          wordCount: 2,
          characterCount: 20,
          tableCount: 0,
          ocrStatus: 'not-required',
          pinned: false,
          importedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          preview: 'Rollback preview',
          chunks: [
            { ...chunk('rollback', 'First'), id: 'duplicate-chunk' },
            { ...chunk('rollback', 'Second'), id: 'duplicate-chunk' },
          ],
          tables: [],
        }),
      ).toThrow();
      expect(repository.get('rollback')).toBeUndefined();
    } finally {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }

    const futureDirectory = mkdtempSync(join(tmpdir(), 'jarvis-doc-future-'));
    const futurePath = join(futureDirectory, 'documents.sqlite');
    const futureDatabase = new DatabaseSync(futurePath);
    futureDatabase.exec('PRAGMA user_version = 99;');
    futureDatabase.close();
    expect(() => new SqliteDocumentRepository(futurePath)).toThrow(
      'Unsupported document schema version 99.',
    );
    rmSync(futureDirectory, { recursive: true, force: true });
  });

  it('reopens existing repositories without rerunning migrations', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-doc-existing-'));
    const databasePath = join(directory, 'documents.sqlite');
    const first = new SqliteDocumentRepository(databasePath);
    first.close();
    const second = new SqliteDocumentRepository(databasePath);
    expect(second.schemaVersion()).toBe(1);
    second.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
