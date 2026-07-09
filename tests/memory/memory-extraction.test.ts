// @vitest-environment node

import { GeminiMemoryExtractor } from '../../src/main/memory/extraction/memory-extractor';
import type {
  AIProvider,
  ChatSession,
  StreamResponse,
} from '../../src/main/conversation/provider/contracts';
import { HeuristicTokenEstimator } from '../../src/main/conversation/provider/token-estimator';

function provider(output: string): AIProvider {
  const session: ChatSession = {
    stream: (): StreamResponse => ({
      cancel: vi.fn(),
      async *[Symbol.asyncIterator]() {
        await Promise.resolve();
        yield { text: output };
      },
    }),
  };
  return {
    id: 'mock',
    model: 'mock',
    tokenEstimator: new HeuristicTokenEstimator(),
    createSession: () => session,
  };
}

describe('GeminiMemoryExtractor', () => {
  it('extracts only validated durable user information', async () => {
    const extractor = new GeminiMemoryExtractor(() =>
      provider(
        '{"memories":[{"kind":"user-profile","content":"The user is named Anuj","summary":"Name is Anuj","tags":["identity"]}]}',
      ),
    );
    await expect(extractor.extract('My name is Anuj', 'chat-1')).resolves.toEqual([
      expect.objectContaining({ kind: 'user-profile', sourceConversationId: 'chat-1' }),
    ]);
  });

  it('does not call Gemini for temporary or non-durable text', async () => {
    const create = vi.fn(() => provider('{"memories":[]}'));
    const extractor = new GeminiMemoryExtractor(create);
    await expect(extractor.extract('Explain recursion', 'chat')).resolves.toEqual([]);
    await expect(extractor.extract('For now, I prefer brief answers', 'chat')).resolves.toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects malformed and invalid model output', async () => {
    await expect(
      new GeminiMemoryExtractor(() => provider('not-json')).extract(
        'I prefer concise prose',
        'chat',
      ),
    ).resolves.toEqual([]);
    await expect(
      new GeminiMemoryExtractor(() =>
        provider('{"memories":[{"kind":"secret","content":"password"}]}'),
      ).extract('Remember that password', 'chat'),
    ).resolves.toEqual([]);
  });
});
