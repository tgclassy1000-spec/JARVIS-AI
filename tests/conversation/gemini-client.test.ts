// @vitest-environment node

const sdk = vi.hoisted(() => ({
  constructor: vi.fn(),
  generateContentStream: vi.fn(),
  countTokens: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    public readonly models = {
      generateContentStream: sdk.generateContentStream,
      countTokens: sdk.countTokens,
    };
    public constructor(options: unknown) {
      sdk.constructor(options);
    }
  },
}));

import { GoogleGeminiClient } from '../../src/main/conversation/provider/gemini/gemini-client';

describe('GoogleGeminiClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the API key inside the SDK and maps chat roles for streaming', async () => {
    const stream = (async function* () {
      await Promise.resolve();
      yield { text: 'chunk' };
    })();
    sdk.generateContentStream.mockResolvedValue(stream);
    const client = new GoogleGeminiClient('main-process-secret');
    const controller = new AbortController();
    await client.generateContentStream({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
      ],
      systemInstruction: 'System',
      signal: controller.signal,
    });

    expect(sdk.constructor).toHaveBeenCalledWith({ apiKey: 'main-process-secret' });
    expect(sdk.generateContentStream).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: 'Question' }] },
        { role: 'model', parts: [{ text: 'Answer' }] },
      ],
      config: { abortSignal: controller.signal, systemInstruction: 'System' },
    });
  });

  it('counts tokens and handles optional SDK values', async () => {
    sdk.countTokens.mockResolvedValueOnce({ totalTokens: 17 }).mockResolvedValueOnce({});
    const client = new GoogleGeminiClient('secret');
    await expect(
      client.countTokens({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Count' }],
      }),
    ).resolves.toBe(17);
    await expect(
      client.countTokens({
        model: 'gemini-2.5-flash',
        messages: [],
        signal: new AbortController().signal,
      }),
    ).resolves.toBe(0);
  });
});
