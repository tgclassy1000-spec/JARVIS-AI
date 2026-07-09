// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteDocumentRepository } from '../../src/main/documents/persistence/sqlite-document-repository';

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'jarvis-doc-repo-'));
  const repository = new SqliteDocumentRepository(join(directory, 'documents.sqlite'));
  return {
    repository,
    cleanup: () => {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

describe('SqliteDocumentRepository', () => {
  it('stores metadata, chunks, tables, analysis history and recents', () => {
    const { repository, cleanup } = createRepository();
    try {
      expect(repository.schemaVersion()).toBe(1);
      const saved = repository.save({
        id: 'doc',
        title: 'Report',
        format: 'markdown',
        sourcePath: 'report.md',
        byteSize: 100,
        mimeType: 'text/markdown',
        checksum: 'abc',
        wordCount: 4,
        characterCount: 20,
        tableCount: 1,
        ocrStatus: 'not-required',
        pinned: false,
        importedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        preview: 'Report preview',
        chunks: [
          {
            id: 'chunk',
            documentId: 'doc',
            index: 0,
            content: 'Report preview',
            tokenEstimate: 4,
          },
        ],
        tables: [{ rows: [['A', 'B']] }],
      });
      expect(saved.chunks).toHaveLength(1);
      expect(repository.getByChecksum('abc')?.id).toBe('doc');
      expect(repository.pin('doc', true)).toMatchObject({ pinned: true });
      expect(repository.touch('doc', '2026-01-02T00:00:00.000Z')).toMatchObject({
        lastOpenedAt: '2026-01-02T00:00:00.000Z',
      });
      repository.saveAnalysis({
        documentId: 'doc',
        action: 'summarize',
        content: 'Summary',
        generatedAt: '2026-01-03T00:00:00.000Z',
      });
      expect(repository.history('doc', 'summarize')[0]?.content).toBe('Summary');
      expect(repository.list()[0]?.id).toBe('doc');
      expect(repository.delete('doc')).toBe(true);
      expect(repository.get('doc')).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
