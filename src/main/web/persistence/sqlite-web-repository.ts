import { DatabaseSync } from 'node:sqlite';

import type { WebBookmark, WebHistoryEntry, WebToolKind } from '../../../shared/web/contracts';
import type { WebBookmarkInput, WebHistoryInput, WebRepository } from './web-repository';

const SCHEMA_VERSION = 1;

interface WebHistoryRow {
  readonly id: string;
  readonly kind: WebToolKind;
  readonly title: string;
  readonly query: string;
  readonly created_at: string;
}

interface WebBookmarkRow {
  readonly id: string;
  readonly kind: WebToolKind;
  readonly title: string;
  readonly query: string | null;
  readonly url: string | null;
  readonly created_at: string;
}

function historyFromRow(row: WebHistoryRow): WebHistoryEntry {
  return Object.freeze({
    id: row.id,
    kind: row.kind,
    title: row.title,
    query: row.query,
    createdAt: row.created_at,
  });
}

function bookmarkFromRow(row: WebBookmarkRow): WebBookmark {
  return Object.freeze({
    id: row.id,
    kind: row.kind,
    title: row.title,
    query: row.query ?? undefined,
    url: row.url ?? undefined,
    createdAt: row.created_at,
  });
}

export class SqliteWebRepository implements WebRepository {
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

  public addHistory(input: WebHistoryInput): WebHistoryEntry {
    this.#database
      .prepare(
        `INSERT INTO web_history (id, kind, title, query, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.id, input.kind, input.title, input.query, input.createdAt);
    this.#database.exec(`
      DELETE FROM web_history
      WHERE id NOT IN (
        SELECT id FROM web_history ORDER BY created_at DESC LIMIT 100
      )
    `);
    return historyFromRow(
      this.#database
        .prepare('SELECT * FROM web_history WHERE id = ?')
        .get(input.id) as unknown as WebHistoryRow,
    );
  }

  public history(limit = 25): readonly WebHistoryEntry[] {
    const rows = this.#database
      .prepare('SELECT * FROM web_history ORDER BY created_at DESC LIMIT ?')
      .all(limit) as unknown as WebHistoryRow[];
    return Object.freeze(rows.map(historyFromRow));
  }

  public saveBookmark(input: WebBookmarkInput): WebBookmark {
    this.#database
      .prepare(
        `INSERT OR REPLACE INTO web_bookmarks (id, kind, title, query, url, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.kind,
        input.title,
        input.query ?? null,
        input.url ?? null,
        input.createdAt,
      );
    return bookmarkFromRow(
      this.#database
        .prepare('SELECT * FROM web_bookmarks WHERE id = ?')
        .get(input.id) as unknown as WebBookmarkRow,
    );
  }

  public bookmarks(): readonly WebBookmark[] {
    const rows = this.#database
      .prepare('SELECT * FROM web_bookmarks ORDER BY created_at DESC')
      .all() as unknown as WebBookmarkRow[];
    return Object.freeze(rows.map(bookmarkFromRow));
  }

  public deleteBookmark(id: string): boolean {
    return this.#database.prepare('DELETE FROM web_bookmarks WHERE id = ?').run(id).changes > 0;
  }

  public close(): void {
    this.#database.close();
  }

  private migrate(): void {
    const version = this.schemaVersion();
    if (version > SCHEMA_VERSION) {
      throw new Error(`Unsupported web schema version ${version}.`);
    }
    if (version < 1) {
      this.#database.exec(`
        BEGIN;
        CREATE TABLE web_history (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          query TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE web_bookmarks (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          query TEXT,
          url TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_web_history_recent ON web_history(created_at DESC);
        CREATE INDEX idx_web_bookmarks_recent ON web_bookmarks(created_at DESC);
        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }
}
