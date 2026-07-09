import type { Logger } from '../platform/logging/logger';
import type { MemoryExtractor } from './extraction/memory-extractor';
import type { MemoryManager } from './manager/memory-manager';

export interface ConversationMemory {
  recall(query: string): string | undefined;
  extract(userText: string, conversationId: string): Promise<void>;
}

export class ManagedConversationMemory implements ConversationMemory {
  public constructor(
    private readonly manager: MemoryManager,
    private readonly extractor: MemoryExtractor,
    private readonly logger: Logger,
  ) {}

  public recall(query: string): string | undefined {
    const memories = this.manager.recallMemory(query);
    if (memories.length === 0) return undefined;
    return `Relevant user memories (use only when helpful; never claim more than written):\n${memories
      .map((memory) => `- [${memory.kind}] ${memory.content}`)
      .join('\n')}`;
  }

  public async extract(userText: string, conversationId: string): Promise<void> {
    if (!this.manager.settings().enabled) return;
    try {
      const candidates = await this.extractor.extract(userText, conversationId);
      for (const candidate of candidates) {
        const duplicate = this.manager.searchMemory({
          query: candidate.content,
          kind: candidate.kind,
          mode: 'semantic',
          limit: 1,
        })[0];
        if (!duplicate || duplicate.score < 0.9) this.manager.saveMemory(candidate);
      }
      this.manager.mergeDuplicateMemories();
    } catch (error) {
      this.logger.warn('Automatic memory extraction skipped.', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
      });
    }
  }
}
