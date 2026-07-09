import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  MessageRole,
  MessageStatus,
} from '../../../shared/conversation/contracts';
import type { ConversationRepository, NewMessage } from './conversation-repository';

type Clock = () => Date;
type IdFactory = () => string;

interface ConversationRow {
  readonly id: string;
  readonly title: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly message_count: number;
  readonly preview: string | null;
}

interface MessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly status: MessageStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

function summaryFromRow(row: ConversationRow): ConversationSummary {
  return Object.freeze({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
    preview: row.preview ?? '',
  });
}

function messageFromRow(row: MessageRow): ConversationMessage {
  return Object.freeze({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

const SUMMARY_SELECT = `
  SELECT c.id, c.title, c.created_at, c.updated_at,
    COUNT(m.id) AS message_count,
    COALESCE((SELECT content FROM messages p WHERE p.conversation_id = c.id ORDER BY p.created_at DESC, p.rowid DESC LIMIT 1), '') AS preview
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
`;

export class SqliteConversationRepository implements ConversationRepository {
  readonly #database: DatabaseSync;

  public constructor(
    databasePath: string,
    private readonly clock: Clock = () => new Date(),
    private readonly idFactory: IdFactory = randomUUID,
  ) {
    this.#database = new DatabaseSync(databasePath);
    this.#database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('complete', 'streaming', 'error', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
    `);
  }

  public create(title: string): ConversationDetail {
    const id = this.idFactory();
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, title, timestamp, timestamp);
    return Object.freeze({
      id,
      title,
      createdAt: timestamp,
      updatedAt: timestamp,
      messageCount: 0,
      preview: '',
      messages: Object.freeze([]),
    });
  }

  public list(): readonly ConversationSummary[] {
    return this.querySummaries(`${SUMMARY_SELECT} GROUP BY c.id ORDER BY c.updated_at DESC`);
  }

  public get(conversationId: string): ConversationDetail | undefined {
    const summary = this.getSummaryRow(conversationId);
    if (!summary) return undefined;
    const rows = this.#database
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid')
      .all(conversationId) as unknown as MessageRow[];
    return Object.freeze({
      ...summaryFromRow(summary),
      messages: Object.freeze(rows.map(messageFromRow)),
    });
  }

  public rename(conversationId: string, title: string): ConversationSummary | undefined {
    const timestamp = this.clock().toISOString();
    const result = this.#database
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, timestamp, conversationId);
    return result.changes > 0 ? this.getConversationSummary(conversationId) : undefined;
  }

  public delete(conversationId: string): boolean {
    return (
      this.#database.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId).changes >
      0
    );
  }

  public search(query: string): readonly ConversationSummary[] {
    const pattern = `%${query}%`;
    return this.querySummaries(
      `${SUMMARY_SELECT}
       WHERE c.title LIKE ? ESCAPE '\\' OR EXISTS (
         SELECT 1 FROM messages s WHERE s.conversation_id = c.id AND s.content LIKE ? ESCAPE '\\'
       )
       GROUP BY c.id ORDER BY c.updated_at DESC`,
      pattern,
      pattern,
    );
  }

  public addMessage(message: NewMessage): ConversationMessage {
    const id = this.idFactory();
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare(
        'INSERT INTO messages (id, conversation_id, role, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        message.conversationId,
        message.role,
        message.content,
        message.status,
        timestamp,
        timestamp,
      );
    this.touch(message.conversationId, timestamp);
    return Object.freeze({ id, ...message, createdAt: timestamp, updatedAt: timestamp });
  }

  public getMessage(messageId: string): ConversationMessage | undefined {
    const row = this.#database.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as
      MessageRow | undefined;
    return row ? messageFromRow(row) : undefined;
  }

  public updateMessage(
    messageId: string,
    changes: { readonly content?: string; readonly status?: MessageStatus },
  ): ConversationMessage | undefined {
    const current = this.getMessage(messageId);
    if (!current) return undefined;
    const timestamp = this.clock().toISOString();
    this.#database
      .prepare('UPDATE messages SET content = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(
        changes.content ?? current.content,
        changes.status ?? current.status,
        timestamp,
        messageId,
      );
    this.touch(current.conversationId, timestamp);
    return this.getMessage(messageId);
  }

  public deleteFromMessage(conversationId: string, messageId: string, inclusive: boolean): void {
    const target = this.#database
      .prepare('SELECT created_at, rowid FROM messages WHERE id = ? AND conversation_id = ?')
      .get(messageId, conversationId) as
      { readonly created_at: string; readonly rowid: number } | undefined;
    if (!target) return;
    const operator = inclusive ? '>=' : '>';
    this.#database
      .prepare(
        `DELETE FROM messages WHERE conversation_id = ? AND (created_at > ? OR (created_at = ? AND rowid ${operator} ?))`,
      )
      .run(conversationId, target.created_at, target.created_at, target.rowid);
    this.touch(conversationId, this.clock().toISOString());
  }

  public setSummary(conversationId: string, summary: string | undefined): void {
    this.#database
      .prepare('UPDATE conversations SET summary = ? WHERE id = ?')
      .run(summary ?? null, conversationId);
  }

  public getSummary(conversationId: string): string | undefined {
    const row = this.#database
      .prepare('SELECT summary FROM conversations WHERE id = ?')
      .get(conversationId) as { readonly summary: string | null } | undefined;
    return row?.summary ?? undefined;
  }

  public close(): void {
    this.#database.close();
  }

  private getSummaryRow(conversationId: string): ConversationRow | undefined {
    return this.#database
      .prepare(`${SUMMARY_SELECT} WHERE c.id = ? GROUP BY c.id`)
      .get(conversationId) as ConversationRow | undefined;
  }

  private getConversationSummary(conversationId: string): ConversationSummary | undefined {
    const row = this.getSummaryRow(conversationId);
    return row ? summaryFromRow(row) : undefined;
  }

  private querySummaries(sql: string, ...parameters: string[]): readonly ConversationSummary[] {
    const rows = this.#database.prepare(sql).all(...parameters) as unknown as ConversationRow[];
    return Object.freeze(rows.map(summaryFromRow));
  }

  private touch(conversationId: string, timestamp: string): void {
    this.#database
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(timestamp, conversationId);
  }
}
