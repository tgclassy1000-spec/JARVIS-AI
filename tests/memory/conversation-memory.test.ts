// @vitest-environment node

import { ManagedConversationMemory } from '../../src/main/memory/conversation-memory';
import { MemoryManager } from '../../src/main/memory/manager/memory-manager';
import { SqliteMemoryRepository } from '../../src/main/memory/persistence/sqlite-memory-repository';
import type { MemoryExtractor } from '../../src/main/memory/extraction/memory-extractor';
import type { Logger } from '../../src/main/platform/logging/logger';

const warn = vi.fn();
const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn,
  error: vi.fn(),
  child() {
    return this;
  },
};

describe('ManagedConversationMemory', () => {
  it('formats recall and saves unique extracted memories', async () => {
    const manager = new MemoryManager(new SqliteMemoryRepository(':memory:'));
    manager.saveMemory({ kind: 'preference', content: 'Prefers concise answers' });
    const extractor: MemoryExtractor = {
      extract: () =>
        Promise.resolve([{ kind: 'fact', content: 'Uses TypeScript', tags: ['software'] }]),
    };
    const integration = new ManagedConversationMemory(manager, extractor, logger);
    expect(integration.recall('concise response')).toContain('Prefers concise answers');
    await integration.extract('I use TypeScript', 'chat');
    await integration.extract('I use TypeScript', 'chat');
    expect(manager.list('fact')).toHaveLength(1);
    manager.setEnabled(false);
    expect(integration.recall('anything')).toBeUndefined();
    await integration.extract('I use Rust', 'chat');
    manager.close();
  });

  it('contains extraction failures without hiding application errors', async () => {
    const manager = new MemoryManager(new SqliteMemoryRepository(':memory:'));
    const integration = new ManagedConversationMemory(
      manager,
      { extract: () => Promise.reject(new Error('offline')) },
      logger,
    );
    await expect(integration.extract('I prefer blue', 'chat')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    manager.close();
  });
});
