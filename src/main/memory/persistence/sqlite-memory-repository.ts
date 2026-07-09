import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type {
  MemoryArchive,
  MemoryKind,
  MemoryRecord,
  MemorySettings,
  SaveMemoryRequest,
  UpdateMemoryRequest,
} from '../../../shared/memory/contracts';
import type { MemoryRepository } from './memory-repository';

const SCHEMA_VERSION = 1;
type Clock = () => Date;
type IdFactory = () => string;

interface MemoryRow {
  readonly id: string;
  readonly kind: MemoryKind;
  readonly content: string;
  readonly summary: string;
  readonly tags: string;
  readonly pinned: number;
  readonly source_conversation_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

function fromRow(row: MemoryRow): MemoryRecord {
  return Object.freeze({
    id: row.id,
    kind: row.kind,
    content: row.content,
    summary: row.summary,
    tags: Object.freeze(JSON.parse(row.tags) as string[]),
    pinned: Boolean(row.pinned),
    sourceConversationId: row.source_conversation_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SqliteMemoryRepository implements MemoryRepository {
  readonly #database: DatabaseSync;

  public constructor(
    databasePath: string,
    private readonly clock: Clock = () => new Date(),
    private readonly idFactory: IdFactory = randomUUID,
  ) {
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

  public list(kind?: MemoryKind): readonly MemoryRecord[] {
    const statement = kind
      ? this.#database.prepare(
          'SELECT * FROM memories WHERE kind = ? ORDER BY pinned DESC, updated_at DESC',
        )
      : this.#database.prepare('SELECT * FROM memories ORDER BY pinned DESC, updated_at DESC');
    const rows = (kind ? statement.all(kind) : statement.all()) as unknown as MemoryRow[];
    return Object.freeze(rows.map(fromRow));
  }

  public get(id: string): MemoryRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM memories WHERE id = ?').get(id) as
      MemoryRow | undefined;
    return row ? fromRow(row) : undefined;
  }

  public save(memory: SaveMemoryRequest): MemoryRecord {
    const id = this.idFactory();
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        `INSERT INTO memories
        (id, kind, content, summary, tags, pinned, source_conversation_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        memory.kind,
        memory.content,
        memory.summary ?? memory.content,
        JSON.stringify(memory.tags ?? []),
        memory.pinned ? 1 : 0,
        memory.sourceConversationId ?? null,
        timestamp,
        timestamp,
      );
    return this.get(id)!;
  }

  public update(changes: UpdateMemoryRequest): MemoryRecord | undefined {
    const current = this.get(changes.id);
    if (!current) return undefined;
    this.#database
      .prepare(
        'UPDATE memories SET content = ?, summary = ?, tags = ?, pinned = ?, updated_at = ? WHERE id = ?',
      )
      .run(
        changes.content ?? current.content,
        changes.summary ?? current.summary,
        JSON.stringify(changes.tags ?? current.tags),
        (changes.pinned ?? current.pinned) ? 1 : 0,
        this.clock().toISOString(),
        changes.id,
      );
    return this.get(changes.id);
  }

  public delete(id: string): boolean {
    return this.#database.prepare('DELETE FROM memories WHERE id = ?').run(id).changes > 0;
  }

  public deleteAll(): number {
    return Number(this.#database.prepare('DELETE FROM memories').run().changes);
  }

  public settings(): MemorySettings {
    const row = this.#database
      .prepare("SELECT value FROM memory_settings WHERE key = 'enabled'")
      .get() as { value: string } | undefined;
    return Object.freeze({ enabled: row?.value !== 'false' });
  }

  public setEnabled(enabled: boolean): MemorySettings {
    this.#database
      .prepare("INSERT OR REPLACE INTO memory_settings (key, value) VALUES ('enabled', ?)")
      .run(String(enabled));
    return Object.freeze({ enabled });
  }

  public archive(): MemoryArchive {
    return Object.freeze({
      schemaVersion: 1,
      exportedAt: this.clock().toISOString(),
      settings: this.settings(),
      memories: this.list(),
    });
  }

  public restore(archive: MemoryArchive, replace: boolean): number {
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      if (replace) this.#database.exec('DELETE FROM memories');
      const insert = this.#database.prepare(`INSERT OR REPLACE INTO memories
        (id, kind, content, summary, tags, pinned, source_conversation_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const memory of archive.memories) {
        insert.run(
          memory.id,
          memory.kind,
          memory.content,
          memory.summary,
          JSON.stringify(memory.tags),
          memory.pinned ? 1 : 0,
          memory.sourceConversationId ?? null,
          memory.createdAt,
          memory.updatedAt,
        );
      }
      this.setEnabled(archive.settings.enabled);
      this.#database.exec('COMMIT');
      return archive.memories.length;
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
  }

  public close(): void {
    this.#database.close();
  }

  private migrate(): void {
    const version = this.schemaVersion();
    if (version > SCHEMA_VERSION) throw new Error(`Unsupported memory schema version ${version}.`);
    if (version < 1) {
      this.#database.exec(`
        BEGIN;
        CREATE TABLE memories (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('user-profile','preference','fact','conversation','semantic')),
          content TEXT NOT NULL,
          summary TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '[]',
          pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
          source_conversation_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_memories_kind ON memories(kind, pinned DESC, updated_at DESC);
        CREATE TABLE memory_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        INSERT INTO memory_settings (key, value) VALUES ('enabled', 'true');
        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }
}
