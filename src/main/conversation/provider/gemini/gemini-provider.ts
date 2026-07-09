import { ERROR_CODES } from '../../../../shared/platform/errors';
import { PlatformError } from '../../../platform/errors/platform-error';
import type {
  AIMessage,
  AIProvider,
  ChatRequest,
  ChatSession,
  StreamChunk,
  StreamResponse,
  TokenEstimator,
} from '../contracts';
import { HeuristicTokenEstimator } from '../token-estimator';
import type { GeminiClient } from './gemini-client';
import { GoogleGeminiClient } from './gemini-client';
import { isRetryableGeminiError, mapGeminiError } from './gemini-errors';

export interface GeminiProviderOptions {
  readonly apiKey?: string;
  readonly model: 'gemini-2.5-flash';
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly retryBaseDelayMs?: number;
  readonly client?: GeminiClient;
  readonly sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

function abortableSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  const abortError = () =>
    signal.reason instanceof Error
      ? signal.reason
      : new DOMException('Operation aborted', 'AbortError');
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

class GeminiTokenEstimator implements TokenEstimator {
  readonly #fallback = new HeuristicTokenEstimator();

  public constructor(
    private readonly client: GeminiClient | undefined,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  public async estimate(
    messages: readonly AIMessage[],
    systemInstruction?: string,
  ): Promise<number> {
    if (!this.client) return this.#fallback.estimate(messages, systemInstruction);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Token estimation timed out', 'TimeoutError')),
      this.timeoutMs,
    );
    try {
      const count = await this.client.countTokens({
        model: this.model,
        messages,
        systemInstruction,
        signal: controller.signal,
      });
      return count > 0 ? count : this.#fallback.estimate(messages, systemInstruction);
    } catch {
      return this.#fallback.estimate(messages, systemInstruction);
    } finally {
      clearTimeout(timeout);
    }
  }
}

class GeminiStreamResponse implements StreamResponse {
  readonly #controller = new AbortController();
  #cancelled = false;
  #consumed = false;

  public constructor(
    private readonly client: GeminiClient,
    private readonly model: string,
    private readonly request: ChatRequest,
    private readonly timeoutMs: number,
    private readonly maxAttempts: number,
    private readonly retryBaseDelayMs: number,
    private readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>,
  ) {}

  public cancel(): void {
    this.#cancelled = true;
    this.#controller.abort(new DOMException('Generation cancelled', 'AbortError'));
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<StreamChunk> {
    if (this.#consumed) {
      throw new PlatformError(
        ERROR_CODES.providerUnknown,
        'A response stream can only be consumed once.',
      );
    }
    this.#consumed = true;
    let timedOut = false;
    const externalSignal = this.request.signal;
    const forwardAbort = () => {
      this.#cancelled = true;
      this.#controller.abort(externalSignal?.reason);
    };
    externalSignal?.addEventListener('abort', forwardAbort, { once: true });
    if (externalSignal?.aborted) forwardAbort();
    const timeout = setTimeout(() => {
      timedOut = true;
      this.#controller.abort(new DOMException('Generation timed out', 'TimeoutError'));
    }, this.timeoutMs);

    try {
      for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
        let emitted = false;
        try {
          const stream = await this.client.generateContentStream({
            model: this.model,
            messages: this.request.messages,
            systemInstruction: this.request.systemInstruction,
            signal: this.#controller.signal,
          });
          for await (const chunk of stream) {
            if (this.#controller.signal.aborted) throw this.#controller.signal.reason;
            if (chunk.text) {
              emitted = true;
              yield { text: chunk.text };
            }
          }
          return;
        } catch (error) {
          const mapped = mapGeminiError(error, { cancelled: this.#cancelled, timedOut });
          if (emitted || attempt === this.maxAttempts || !isRetryableGeminiError(mapped))
            throw mapped;
          try {
            await this.sleep(this.retryBaseDelayMs * 2 ** (attempt - 1), this.#controller.signal);
          } catch (sleepError) {
            throw mapGeminiError(sleepError, { cancelled: this.#cancelled, timedOut });
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', forwardAbort);
    }
  }
}

class GeminiChatSession implements ChatSession {
  public constructor(
    private readonly client: GeminiClient,
    private readonly options: GeminiProviderOptions,
  ) {}

  public stream(request: ChatRequest): StreamResponse {
    return new GeminiStreamResponse(
      this.client,
      this.options.model,
      request,
      this.options.timeoutMs,
      this.options.maxAttempts,
      this.options.retryBaseDelayMs ?? 250,
      this.options.sleep ?? abortableSleep,
    );
  }
}

export class GeminiProvider implements AIProvider {
  public readonly id = 'gemini';
  public readonly model: string;
  public readonly tokenEstimator: TokenEstimator;
  readonly #client: GeminiClient | undefined;

  public constructor(private readonly options: GeminiProviderOptions) {
    this.model = options.model;
    this.#client =
      options.client ?? (options.apiKey ? new GoogleGeminiClient(options.apiKey) : undefined);
    this.tokenEstimator = new GeminiTokenEstimator(this.#client, options.model, options.timeoutMs);
  }

  public createSession(): ChatSession {
    if (!this.#client) {
      throw new PlatformError(
        ERROR_CODES.providerNotConfigured,
        'Gemini is not configured. Add GEMINI_API_KEY to the local .env file.',
      );
    }
    return new GeminiChatSession(this.#client, this.options);
  }
}
