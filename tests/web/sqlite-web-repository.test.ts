// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { SqliteWebRepository } from '../../src/main/web/persistence/sqlite-web-repository';

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'jarvis-web-repo-'));
  const repository = new SqliteWebRepository(join(directory, 'web.sqlite'));
  return {
    directory,
    repository,
    cleanup: () => {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

describe('SqliteWebRepository', () => {
  it('stores history and bookmarks with schema migrations', () => {
    const { repository, cleanup } = createRepository();
    try {
      expect(repository.schemaVersion()).toBe(1);
      repository.addHistory({
        id: 'history',
        kind: 'search',
        title: 'Search',
        query: 'jarvis',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(repository.history()[0]?.query).toBe('jarvis');
      const bookmark = repository.saveBookmark({
        id: 'bookmark',
        kind: 'search',
        title: 'JARVIS',
        query: 'jarvis',
        url: 'https://example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(bookmark.url).toBe('https://example.com');
      expect(repository.bookmarks()).toHaveLength(1);
      expect(repository.deleteBookmark('bookmark')).toBe(true);
      expect(repository.deleteBookmark('bookmark')).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('reopens migrated databases and preserves nullable bookmark fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-web-reopen-'));
    const databasePath = join(directory, 'web.sqlite');
    const first = new SqliteWebRepository(databasePath);
    first.saveBookmark({
      id: 'bookmark',
      kind: 'news',
      title: 'Headlines',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    first.close();

    const second = new SqliteWebRepository(databasePath);
    try {
      expect(second.schemaVersion()).toBe(1);
      expect(second.bookmarks()[0]).toMatchObject({
        id: 'bookmark',
        query: undefined,
        url: undefined,
      });
    } finally {
      second.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects unsupported future schemas', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-web-future-'));
    const databasePath = join(directory, 'web.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('PRAGMA user_version = 99;');
    database.close();
    expect(() => new SqliteWebRepository(databasePath)).toThrow(
      'Unsupported web schema version 99.',
    );
    rmSync(directory, { recursive: true, force: true });
  });
});
