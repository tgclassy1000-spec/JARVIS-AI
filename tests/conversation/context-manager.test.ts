// @vitest-environment node

import type { ConversationMessage } from '../../src/shared/conversation/contracts';
import {
  ContextBuilder,
  ContextManager,
  type SummarizationHook,
} from '../../src/main/conversation/context/context-manager';
import type { AIMessage, TokenEstimator } from '../../src/main/conversation/provider/contracts';

function message(id: string, content: string): ConversationMessage {
  return {
    id,
    conversationId: 'conversation',
    role: id.startsWith('u') ? 'user' : 'assistant',
    content,
    status: 'complete',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const estimator: TokenEstimator = {
  estimate: (messages: readonly AIMessage[], system = '') =>
    Promise.resolve(messages.length * 10 + Math.ceil(system.length / 100)),
};

describe('ContextManager', () => {
  it('builds a full context inside the token budget', async () => {
    const manager = new ContextManager(estimator, 100, new ContextBuilder('System'));
    const result = await manager.build([message('u1', 'one'), message('a1', 'two')]);

    expect(result.messages).toHaveLength(2);
    expect(result.trimmedMessageIds).toEqual([]);
    expect(result.systemInstruction).toBe('System');
    expect(result.estimatedTokens).toBe(21);
  });

  it('trims the oldest messages while preserving the latest prompt', async () => {
    const manager = new ContextManager(estimator, 21, new ContextBuilder('System'));
    const result = await manager.build([
      message('u1', 'one'),
      message('a1', 'two'),
      message('u2', 'three'),
    ]);

    expect(result.messages).toEqual([
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ]);
    expect(result.trimmedMessageIds).toEqual(['u1']);
  });

  it('invokes the summarization hook and carries previous summaries', async () => {
    const summarize = vi.fn(() => Promise.resolve('Condensed context'));
    const summarizer: SummarizationHook = {
      summarize,
    };
    const manager = new ContextManager(estimator, 11, new ContextBuilder('System'), summarizer);
    const result = await manager.build(
      [message('u1', 'one'), message('a1', 'two')],
      'Previous context',
    );

    expect(summarize).toHaveBeenCalledWith([{ role: 'user', content: 'one' }], 'Previous context');
    expect(result.summary).toBe('Condensed context');
    expect(result.systemInstruction).toContain('Conversation summary:\nCondensed context');
  });

  it('supports a summarizer that intentionally drops the summary', async () => {
    const summarizer: SummarizationHook = { summarize: () => Promise.resolve(undefined) };
    const manager = new ContextManager(estimator, 11, new ContextBuilder('System'), summarizer);
    const result = await manager.build([message('u1', 'one'), message('a1', 'two')]);
    expect(result.summary).toBeUndefined();
    expect(result.systemInstruction).toBe('System');
  });
});
