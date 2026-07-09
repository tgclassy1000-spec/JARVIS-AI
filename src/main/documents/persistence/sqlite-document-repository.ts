import { DatabaseSync } from 'node:sqlite';

import type {
  DocumentAnalysisAction,
  DocumentAnalysisResult,
  DocumentChunk,
  DocumentDetail,
  DocumentFormat,
  DocumentMetadata,
  DocumentOcrStatus,
  ExtractedTable,
} from '../../../shared/documents/contracts';
import type { DocumentRepository, DocumentSaveInput } from './document-repository';

const SCHEMA_VERSION = 1;

interface DocumentRow {
  readonly id: string;
  readonly title: string;
  readonly format: DocumentFormat;
  readonly source_path: string;
  readonly byte_size: number;
  readonly mime_type: string;
  readonly checksum: string;
  readonly page_count: number | null;
  readonly word_count: number;
  readonly character_count: number;
  readonly table_count: number;
  readonly ocr_status: DocumentOcrStatus;
  readonly pinned: number;
  readonly preview: string;
  readonly imported_at: string;
  readonly updated_at: string;
  readonly last_opened_at: string | null;
}

interface ChunkRow {
  readonly id: string;
  readonly document_id: string;
  readonly chunk_index: number;
  readonly content: string;
  readonly token_estimate: number;
}

interface TableRow {
  readonly content: string;
}

interface AnalysisRow {
  readonly document_id: string;
  readonly action: DocumentAnalysisAction;
  readonly content: string;
  readonly generated_at: string;
}

function metadataFromRow(row: DocumentRow): DocumentMetadata {
  return Object.freeze({
    id: row.id,
    title: row.title,
    format: row.format,
    sourcePath: row.source_path,
    byteSize: row.byte_size,
    mimeType: row.mime_type,
    checksum: row.checksum,
    pageCount: row.page_count ?? undefined,
    wordCount: row.word_count,
    characterCount: row.character_count,
    tableCount: row.table_count,
    ocrStatus: row.ocr_status,
    pinned: Boolean(row.pinned),
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at ?? undefined,
  });
}

function chunkFromRow(row: ChunkRow): DocumentChunk {
  return Object.freeze({
    id: row.id,
    documentId: row.document_id,
    index: row.chunk_index,
    content: row.content,
    tokenEstimate: row.token_estimate,
  });
}

function parseTables(rows: readonly TableRow[]): readonly ExtractedTable[] {
  return Object.freeze(rows.map((row) => Object.freeze(JSON.parse(row.content) as ExtractedTable)));
}

function analysisFromRow(row: AnalysisRow): DocumentAnalysisResult {
  return Object.freeze({
    documentId: row.document_id,
    action: row.action,
    content: row.content,
    generatedAt: row.generated_at,
  });
}

export class SqliteDocumentRepository implements DocumentRepository {
  readonly #database: DatabaseSync;

  public constructor(databasePath: string) {
    this.#database = new DatabaseSync(databasePath);
    try {
      this.#database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      this.migrate();
    } catch (error) {
      this.#database.close();
      throw error;
    }
  }

  public schemaVersion(): number {
    return (this.#database.prepare('PRAGMA user_version').get() as { user_version: number })
      .user_version;
  }

  public save(input: DocumentSaveInput): DocumentDetail {
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      this.#database
        .prepare(
          `INSERT OR REPLACE INTO documents
          (id, title, format, source_path, byte_size, mime_type, checksum, page_count, word_count,
           character_count, table_count, ocr_status, pinned, preview, imported_at, updated_at, last_opened_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.title,
          input.format,
          input.sourcePath,
          input.byteSize,
          input.mimeType,
          input.checksum,
          input.pageCount ?? null,
          input.wordCount,
          input.characterCount,
          input.tableCount,
          input.ocrStatus,
          input.pinned ? 1 : 0,
          input.preview,
          input.importedAt,
          input.updatedAt,
          input.lastOpenedAt ?? null,
        );
      this.#database.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(input.id);
      this.#database.prepare('DELETE FROM document_tables WHERE document_id = ?').run(input.id);
      const chunkInsert = this.#database.prepare(
        `INSERT INTO document_chunks (id, document_id, chunk_index, content, token_estimate)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const chunk of input.chunks) {
        chunkInsert.run(chunk.id, input.id, chunk.index, chunk.content, chunk.tokenEstimate);
      }
      const tableInsert = this.#database.prepare(
        'INSERT INTO document_tables (id, document_id, content) VALUES (?, ?, ?)',
      );
      input.tables.forEach((table, index) => {
        tableInsert.run(`${input.id}:table:${index}`, input.id, JSON.stringify(table));
      });
      this.#database.exec('COMMIT');
      return this.get(input.id)!;
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
  }

  public list(): readonly DocumentMetadata[] {
    const rows = this.#database
      .prepare(
        'SELECT * FROM documents ORDER BY pinned DESC, COALESCE(last_opened_at, updated_at) DESC',
      )
      .all() as unknown as DocumentRow[];
    return Object.freeze(rows.map(metadataFromRow));
  }

  public get(documentId: string): DocumentDetail | undefined {
    const row = this.#database.prepare('SELECT * FROM documents WHERE id = ?').get(documentId) as
      DocumentRow | undefined;
    if (!row) return undefined;
    const chunks = this.#database
      .prepare('SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC')
      .all(documentId) as unknown as ChunkRow[];
    const tables = this.#database
      .prepare('SELECT content FROM document_tables WHERE document_id = ? ORDER BY id ASC')
      .all(documentId) as unknown as TableRow[];
    return Object.freeze({
      ...metadataFromRow(row),
      preview: row.preview,
      chunks: Object.freeze(chunks.map(chunkFromRow)),
      tables: parseTables(tables),
    });
  }

  public getByChecksum(checksum: string): DocumentDetail | undefined {
    const row = this.#database
      .prepare('SELECT id FROM documents WHERE checksum = ?')
      .get(checksum) as { readonly id: string } | undefined;
    return row ? this.get(row.id) : undefined;
  }

  public pin(documentId: string, pinned: boolean): DocumentMetadata | undefined {
    const timestamp = new Date().toISOString();
    const result = this.#database
      .prepare('UPDATE documents SET pinned = ?, updated_at = ? WHERE id = ?')
      .run(pinned ? 1 : 0, timestamp, documentId);
    return result.changes > 0 ? metadataFromRow(this.documentRow(documentId)!) : undefined;
  }

  public touch(documentId: string, timestamp: string): DocumentMetadata | undefined {
    const result = this.#database
      .prepare('UPDATE documents SET last_opened_at = ?, updated_at = ? WHERE id = ?')
      .run(timestamp, timestamp, documentId);
    return result.changes > 0 ? metadataFromRow(this.documentRow(documentId)!) : undefined;
  }

  public delete(documentId: string): boolean {
    return this.#database.prepare('DELETE FROM documents WHERE id = ?').run(documentId).changes > 0;
  }

  public saveAnalysis(result: DocumentAnalysisResult): void {
    this.#database
      .prepare(
        'INSERT INTO document_analysis_history (id, document_id, action, content, generated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        `${result.documentId}:${result.action}:${result.generatedAt}`,
        result.documentId,
        result.action,
        result.content,
        result.generatedAt,
      );
  }

  public history(
    documentId: string,
    action?: DocumentAnalysisAction,
  ): readonly DocumentAnalysisResult[] {
    const statement = action
      ? this.#database.prepare(
          'SELECT * FROM document_analysis_history WHERE document_id = ? AND action = ? ORDER BY generated_at DESC',
        )
      : this.#database.prepare(
          'SELECT * FROM document_analysis_history WHERE document_id = ? ORDER BY generated_at DESC',
        );
    const rows = (action
      ? statement.all(documentId, action)
      : statement.all(documentId)) as unknown as AnalysisRow[];
    return Object.freeze(rows.map(analysisFromRow));
  }

  public close(): void {
    this.#database.close();
  }

  private documentRow(documentId: string): DocumentRow | undefined {
    return this.#database.prepare('SELECT * FROM documents WHERE id = ?').get(documentId) as
      DocumentRow | undefined;
  }

  private migrate(): void {
    const version = this.schemaVersion();
    if (version > SCHEMA_VERSION) {
      throw new Error(`Unsupported document schema version ${version}.`);
    }
    if (version < 1) {
      this.#database.exec(`
        BEGIN;
        CREATE TABLE documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          format TEXT NOT NULL,
          source_path TEXT NOT NULL,
          byte_size INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          checksum TEXT NOT NULL UNIQUE,
          page_count INTEGER,
          word_count INTEGER NOT NULL,
          character_count INTEGER NOT NULL,
          table_count INTEGER NOT NULL,
          ocr_status TEXT NOT NULL CHECK (ocr_status IN ('not-required','completed','unavailable')),
          pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
          preview TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_opened_at TEXT
        );
        CREATE TABLE document_chunks (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          token_estimate INTEGER NOT NULL
        );
        CREATE TABLE document_tables (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL
        );
        CREATE TABLE document_analysis_history (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          content TEXT NOT NULL,
          generated_at TEXT NOT NULL
        );
        CREATE INDEX idx_documents_recent ON documents(pinned DESC, updated_at DESC);
        CREATE INDEX idx_documents_format ON documents(format, pinned DESC);
        CREATE INDEX idx_document_chunks_document ON document_chunks(document_id, chunk_index);
        CREATE INDEX idx_document_analysis_document ON document_analysis_history(document_id, action, generated_at DESC);
        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }
}
