// @vitest-environment node

import { ERROR_CODES } from '../../src/shared/platform/errors';
import type { StreamChunk } from '../../src/main/conversation/provider/contracts';
import type {
  GeminiClient,
  GeminiGenerateRequest,
  GeminiStreamChunk,
} from '../../src/main/conversation/provider/gemini/gemini-client';
import { GeminiProvider } from '../../src/main/conversation/provider/gemini/gemini-provider';

async function* chunks(...values: string[]): AsyncGenerator<GeminiStreamChunk> {
  await Promise.resolve();
  for (const text of values) yield { text };
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<string> {
  let result = '';
  for await (const chunk of stream) result += chunk.text;
  return result;
}

function mockClient(overrides: Partial<GeminiClient> = {}): GeminiClient {
  return {
    generateContentStream: () => Promise.resolve(chunks('Hello', ' world')),
    countTokens: () => Promise.resolve(12),
    ...overrides,
  };
}

function provider(client?: GeminiClient) {
  return new GeminiProvider({
    apiKey: client ? undefined : 'test-key',
    client,
    model: 'gemini-2.5-flash',
    timeoutMs: 10_000,
    maxAttempts: 3,
    retryBaseDelayMs: 1,
    sleep: () => Promise.resolve(),
  });
}

describe('GeminiProvider', () => {
  it('streams text and exposes provider metadata', async () => {
    const client = mockClient();
    const gemini = provider(client);
    const stream = gemini.createSession().stream({
      messages: [{ role: 'user', content: 'Hello' }],
      systemInstruction: 'Be concise',
    });

    await expect(collect(stream)).resolves.toBe('Hello world');
    expect(gemini.id).toBe('gemini');
    expect(gemini.model).toBe('gemini-2.5-flash');
  });

  it('fails closed when the API key is absent', () => {
    const gemini = new GeminiProvider({
      model: 'gemini-2.5-flash',
      timeoutMs: 1_000,
      maxAttempts: 1,
    });
    expect(() => gemini.createSession()).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.providerNotConfigured }),
    );
  });

  it('uses exact token counts with heuristic fallback', async () => {
    const exact = provider(mockClient({ countTokens: () => Promise.resolve(42) }));
    await expect(exact.tokenEstimator.estimate([{ role: 'user', content: 'hello' }])).resolves.toBe(
      42,
    );

    const zero = provider(mockClient({ countTokens: () => Promise.resolve(0) }));
    await expect(
      zero.tokenEstimator.estimate([{ role: 'user', content: '12345678' }]),
    ).resolves.toBe(4);

    const failed = provider(
      mockClient({ countTokens: () => Promise.reject(new Error('offline')) }),
    );
    await expect(
      failed.tokenEstimator.estimate([{ role: 'user', content: '12345678' }]),
    ).resolves.toBe(4);

    const unconfigured = new GeminiProvider({
      model: 'gemini-2.5-flash',
      timeoutMs: 1_000,
      maxAttempts: 1,
    });
    await expect(
      unconfigured.tokenEstimator.estimate([{ role: 'user', content: '12345678' }]),
    ).resolves.toBe(4);
  });

  it('bounds token estimation with the provider timeout', async () => {
    vi.useFakeTimers();
    const gemini = new GeminiProvider({
      client: mockClient({
        countTokens: (request) =>
          new Promise((_resolve, reject) => {
            request.signal?.addEventListener(
              'abort',
              () =>
                reject(
                  request.signal?.reason instanceof Error
                    ? request.signal.reason
                    : new Error('Token estimation aborted'),
                ),
              { once: true },
            );
          }),
      }),
      model: 'gemini-2.5-flash',
      timeoutMs: 1_000,
      maxAttempts: 1,
    });
    const estimation = gemini.tokenEstimator.estimate([{ role: 'user', content: '12345678' }]);
    const fallback = expect(estimation).resolves.toBe(4);
    await vi.advanceTimersByTimeAsync(1_000);
    await fallback;
    vi.useRealTimers();
  });

  it('retries transient failures with exponential delays', async () => {
    const generate = vi
      .fn<(request: GeminiGenerateRequest) => Promise<AsyncIterable<GeminiStreamChunk>>>()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce({ status: 429, message: 'busy' })
      .mockResolvedValueOnce(chunks('Recovered'));
    const delays: number[] = [];
    const gemini = new GeminiProvider({
      client: mockClient({ generateContentStream: generate }),
      model: 'gemini-2.5-flash',
      timeoutMs: 10_000,
      maxAttempts: 3,
      retryBaseDelayMs: 10,
      sleep: (milliseconds) => {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    });

    await expect(
      collect(gemini.createSession().stream({ messages: [{ role: 'user', content: 'retry' }] })),
    ).resolves.toBe('Recovered');
    expect(generate).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([10, 20]);
  });

  it('uses abortable default retry delays and can cancel while waiting', async () => {
    const succeedsAfterRetry = vi
      .fn<(request: GeminiGenerateRequest) => Promise<AsyncIterable<GeminiStreamChunk>>>()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(chunks('ok'));
    const quickRetry = new GeminiProvider({
      client: mockClient({ generateContentStream: succeedsAfterRetry }),
      model: 'gemini-2.5-flash',
      timeoutMs: 10_000,
      maxAttempts: 2,
      retryBaseDelayMs: 1,
    });
    await expect(
      collect(
        quickRetry.createSession().stream({ messages: [{ role: 'user', content: 'retry' }] }),
      ),
    ).resolves.toBe('ok');

    const alwaysOffline = vi.fn(() => Promise.reject(new TypeError('network')));
    const cancellable = new GeminiProvider({
      client: mockClient({ generateContentStream: alwaysOffline }),
      model: 'gemini-2.5-flash',
      timeoutMs: 20_000,
      maxAttempts: 3,
      retryBaseDelayMs: 10_000,
    })
      .createSession()
      .stream({ messages: [{ role: 'user', content: 'cancel retry' }] });
    const pending = cancellable[Symbol.asyncIterator]().next();
    const cancelled = expect(pending).rejects.toMatchObject({
      code: ERROR_CODES.generationCancelled,
    });
    await vi.waitFor(() => expect(alwaysOffline).toHaveBeenCalledOnce());
    await Promise.resolve();
    cancellable.cancel();
    await cancelled;
  });

  it('does not retry after response text has been emitted', async () => {
    async function* partial(): AsyncGenerator<GeminiStreamChunk> {
      await Promise.resolve();
      yield { text: 'partial' };
      throw new TypeError('network');
    }
    const generate = vi.fn(() => Promise.resolve(partial()));
    const stream = provider(mockClient({ generateContentStream: generate }))
      .createSession()
      .stream({ messages: [{ role: 'user', content: 'partial' }] });
    const iterator = stream[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toEqual({ value: { text: 'partial' }, done: false });
    await expect(iterator.next()).rejects.toMatchObject({ code: ERROR_CODES.networkFailure });
    expect(generate).toHaveBeenCalledOnce();
  });

  it('supports explicit cancellation and external abort signals', async () => {
    const generate = (request: GeminiGenerateRequest) =>
      Promise.resolve(
        (async function* () {
          if (request.signal.aborted) throw request.signal.reason;
          await new Promise<void>((_resolve, reject) => {
            request.signal.addEventListener(
              'abort',
              () =>
                reject(
                  request.signal.reason instanceof Error
                    ? request.signal.reason
                    : new Error('Aborted'),
                ),
              { once: true },
            );
          });
          yield { text: 'never' };
        })(),
      );
    const gemini = provider(mockClient({ generateContentStream: generate }));
    const response = gemini
      .createSession()
      .stream({ messages: [{ role: 'user', content: 'cancel' }] });
    const pending = response[Symbol.asyncIterator]().next();
    const cancelled = expect(pending).rejects.toMatchObject({
      code: ERROR_CODES.generationCancelled,
    });
    response.cancel();
    await cancelled;

    const external = new AbortController();
    const externalResponse = gemini.createSession().stream({
      messages: [{ role: 'user', content: 'cancel externally' }],
      signal: external.signal,
    });
    const externalPending = externalResponse[Symbol.asyncIterator]().next();
    const externallyCancelled = expect(externalPending).rejects.toMatchObject({
      code: ERROR_CODES.generationCancelled,
    });
    external.abort('external cancellation');
    await externallyCancelled;

    const preAborted = new AbortController();
    preAborted.abort();
    const preAbortedResponse = gemini.createSession().stream({
      messages: [{ role: 'user', content: 'already cancelled' }],
      signal: preAborted.signal,
    });
    await expect(preAbortedResponse[Symbol.asyncIterator]().next()).rejects.toMatchObject({
      code: ERROR_CODES.generationCancelled,
    });
  });

  it('enforces timeout and single-consumer streams', async () => {
    vi.useFakeTimers();
    const generate = (request: GeminiGenerateRequest) =>
      Promise.resolve(
        (async function* () {
          if (request.signal.aborted) throw request.signal.reason;
          await new Promise<void>((_resolve, reject) => {
            request.signal.addEventListener(
              'abort',
              () =>
                reject(
                  request.signal.reason instanceof Error
                    ? request.signal.reason
                    : new Error('Aborted'),
                ),
              { once: true },
            );
          });
          yield { text: 'never' };
        })(),
      );
    const gemini = new GeminiProvider({
      client: mockClient({ generateContentStream: generate }),
      model: 'gemini-2.5-flash',
      timeoutMs: 1_000,
      maxAttempts: 1,
    });
    const response = gemini
      .createSession()
      .stream({ messages: [{ role: 'user', content: 'wait' }] });
    const iterator = response[Symbol.asyncIterator]();
    const pending = iterator.next();
    const timedOut = expect(pending).rejects.toMatchObject({ code: ERROR_CODES.timeout });
    await vi.advanceTimersByTimeAsync(1_000);
    await timedOut;
    await expect(response[Symbol.asyncIterator]().next()).rejects.toBeDefined();
    vi.useRealTimers();
  });
});
