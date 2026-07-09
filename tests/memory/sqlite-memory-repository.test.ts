// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { SqliteMemoryRepository } from '../../src/main/memory/persistence/sqlite-memory-repository';
import type { MemoryKind } from '../../src/shared/memory/contracts';

describe('SqliteMemoryRepository', () => {
  it('migrates a fresh database and supports CRUD, settings, archive, restore, and deletion', () => {
    let id = 0;
    const repository = new SqliteMemoryRepository(
      ':memory:',
      () => new Date('2026-07-07T00:00:00.000Z'),
      () => `memory-${++id}`,
    );
    expect(repository.schemaVersion()).toBe(1);
    const saved = repository.save({
      kind: 'preference',
      content: 'Prefers concise TypeScript examples',
      tags: ['typescript'],
      pinned: true,
    });
    expect(repository.get(saved.id)?.summary).toBe(saved.content);
    expect(repository.list('preference')).toHaveLength(1);
    expect(
      repository.update({ id: saved.id, content: 'Prefers compact examples' })?.content,
    ).toContain('compact');
    expect(repository.update({ id: 'missing', content: 'x' })).toBeUndefined();
    expect(repository.setEnabled(false)).toEqual({ enabled: false });
    const archive = repository.archive();
    expect(archive.memories).toHaveLength(1);
    expect(repository.delete(saved.id)).toBe(true);
    expect(repository.delete(saved.id)).toBe(false);
    expect(repository.restore(archive, true)).toBe(1);
    expect(repository.settings().enabled).toBe(false);
    expect(repository.deleteAll()).toBe(1);
    repository.close();
  });

  it('rolls back an invalid restore archive', () => {
    const repository = new SqliteMemoryRepository(':memory:');
    const valid = repository.save({ kind: 'fact', content: 'Valid memory' });
    const archive = repository.archive();
    const invalid = {
      ...archive,
      memories: [{ ...valid, id: 'invalid', kind: 'invalid' as MemoryKind }],
    };
    expect(() => repository.restore(invalid, false)).toThrow();
    expect(repository.list()).toHaveLength(1);
    repository.close();
  });

  it('persists and reopens a migrated database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-memory-'));
    const path = join(directory, 'memory.sqlite');
    const first = new SqliteMemoryRepository(path);
    first.save({ kind: 'fact', content: 'Uses Windows' });
    first.close();
    const second = new SqliteMemoryRepository(path);
    expect(second.schemaVersion()).toBe(1);
    expect(second.list()).toHaveLength(1);
    second.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('rejects databases from a future schema', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-future-memory-'));
    const path = join(directory, 'memory.sqlite');
    const database = new DatabaseSync(path);
    database.exec('PRAGMA user_version = 99');
    database.close();
    expect(() => new SqliteMemoryRepository(path)).toThrow('Unsupported memory schema version');
    rmSync(directory, { recursive: true, force: true });
  });
});
