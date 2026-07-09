// @vitest-environment node

import { ERROR_CODES } from '../../src/shared/platform/errors';
import { MemoryManager } from '../../src/main/memory/manager/memory-manager';
import { SqliteMemoryRepository } from '../../src/main/memory/persistence/sqlite-memory-repository';
import { cosineSimilarity, semanticVector } from '../../src/main/memory/semantic/semantic-index';
import { ShortTermMemory } from '../../src/main/memory/short-term-memory';

function manager() {
  let id = 0;
  return new MemoryManager(new SqliteMemoryRepository(':memory:', undefined, () => `m-${++id}`));
}

describe('MemoryManager', () => {
  it('saves, recalls, searches, updates, summarizes, exports, restores, and forgets memories', () => {
    const memory = manager();
    const saved = memory.saveMemory({
      kind: 'preference',
      content: 'I prefer Visual Studio Code for coding',
      summary: 'Preferred editor',
      tags: [' IDE ', 'typescript', 'IDE'],
    });
    expect(
      memory.searchMemory({ query: 'programming editor', mode: 'semantic' })[0]?.memory.id,
    ).toBe(saved.id);
    expect(
      memory.searchMemory({ query: 'typescript', mode: 'keyword', tags: ['ide'] }),
    ).toHaveLength(1);
    expect(memory.searchMemory({ query: '', kind: 'preference', limit: 1 })).toHaveLength(1);
    expect(memory.searchMemory({ query: 'missing', tags: ['absent'] })).toEqual([]);
    expect(memory.recallMemory('code editor')).toHaveLength(1);
    expect(
      memory.updateMemory({
        id: saved.id,
        content: ' Prefers compact TypeScript ',
        summary: ' Compact ',
        tags: ['code'],
        pinned: true,
      }).pinned,
    ).toBe(true);
    expect(memory.summarizeMemory()).toContain('[preference]');
    expect(memory.exportMemory().content).toContain(saved.id);
    const archive = memory.backup();
    memory.forgetMemory(saved.id);
    expect(memory.restore(archive, false)).toBe(1);
    expect(() => memory.forgetMemory('missing')).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.memoryNotFound }),
    );
    expect(() => memory.updateMemory({ id: 'missing', content: 'none' })).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.memoryNotFound }),
    );
    memory.close();
  });

  it('merges similar memories and enforces disabled privacy mode', () => {
    const memory = manager();
    memory.saveMemory({ kind: 'fact', content: 'Uses TypeScript for programming', tags: ['work'] });
    memory.saveMemory({
      kind: 'fact',
      content: 'Uses TypeScript for coding',
      tags: ['software'],
      pinned: true,
    });
    memory.saveMemory({ kind: 'preference', content: 'Uses TypeScript for coding' });
    memory.saveMemory({ kind: 'fact', content: 'Drinks green tea' });
    expect(memory.mergeDuplicateMemories()).toBe(1);
    expect(memory.list()).toHaveLength(3);
    memory.setEnabled(false);
    expect(memory.recallMemory('typescript')).toEqual([]);
    expect(memory.searchMemory({ query: 'typescript' })).toEqual([]);
    expect(() => memory.saveMemory({ kind: 'fact', content: 'Blocked' })).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.memoryDisabled }),
    );
    expect(memory.deleteEverything()).toBe(3);
    expect(memory.summarizeMemory()).toBe('No saved memories.');
    memory.close();
  });

  it('keeps short-term memory separate and expiring', () => {
    let now = 10;
    const shortTerm = new ShortTermMemory(() => now);
    shortTerm.set('draft', 'temporary', 5);
    expect(shortTerm.get('draft')).toBe('temporary');
    now = 15;
    expect(shortTerm.get('draft')).toBeUndefined();
    shortTerm.set('x', 'y', 10);
    expect(shortTerm.delete('x')).toBe(true);
    shortTerm.clear();
  });

  it('computes safe semantic similarity for empty and related vectors', () => {
    expect(cosineSimilarity({}, semanticVector('typescript'))).toBe(0);
    expect(
      cosineSimilarity(
        semanticVector('coding in vscode'),
        semanticVector('programming in an editor'),
      ),
    ).toBeGreaterThan(0);
  });
});
