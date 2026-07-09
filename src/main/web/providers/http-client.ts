import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError } from '../../platform/errors/platform-error';

export interface WebHttpClient {
  getJson(url: URL, init?: RequestInit): Promise<unknown>;
  getText(url: URL, init?: RequestInit): Promise<string>;
}

export interface FetchWebHttpClientOptions {
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly fetcher?: typeof fetch;
  readonly backoffMs?: number;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class FetchWebHttpClient implements WebHttpClient {
  readonly #timeoutMs: number;
  readonly #maxAttempts: number;
  readonly #fetcher: typeof fetch;
  readonly #backoffMs: number;

  public constructor(options: FetchWebHttpClientOptions) {
    this.#timeoutMs = options.timeoutMs;
    this.#maxAttempts = options.maxAttempts;
    this.#fetcher = options.fetcher ?? fetch;
    this.#backoffMs = options.backoffMs ?? 150;
  }

  public async getJson(url: URL, init: RequestInit = {}): Promise<unknown> {
    const text = await this.getText(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    });
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new PlatformError(ERROR_CODES.providerUnknown, 'Web provider returned invalid JSON.', {
        cause: error,
        metadata: { url: this.redactUrl(url) },
      });
    }
  }

  public async getText(url: URL, init: RequestInit = {}): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
      try {
        const response = await this.#fetcher(url, {
          ...init,
          signal: controller.signal,
          headers: {
            'User-Agent': 'JARVIS-Web-Intelligence/0.8',
            ...(init.headers ?? {}),
          },
        });
        if (!response.ok) {
          if (response.status === 429) {
            throw new PlatformError(ERROR_CODES.rateLimited, 'Web provider rate limit exceeded.', {
              metadata: { status: response.status, url: this.redactUrl(url) },
            });
          }
          throw new PlatformError(ERROR_CODES.networkFailure, 'Web provider request failed.', {
            metadata: { status: response.status, url: this.redactUrl(url) },
          });
        }
        return await response.text();
      } catch (error) {
        lastError = isAbort(error)
          ? new PlatformError(ERROR_CODES.timeout, 'Web provider request timed out.', {
              cause: error,
              metadata: { url: this.redactUrl(url) },
            })
          : error;
        if (attempt < this.#maxAttempts) await delay(this.#backoffMs * attempt);
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastError instanceof PlatformError) throw lastError;
    throw new PlatformError(ERROR_CODES.networkFailure, 'Web provider request failed.', {
      cause: lastError,
      metadata: { url: this.redactUrl(url) },
    });
  }

  private redactUrl(url: URL): string {
    const redacted = new URL(url);
    redacted.searchParams.forEach((_value, key) => {
      if (/key|token|secret|password/i.test(key)) redacted.searchParams.set(key, '[redacted]');
    });
    return redacted.toString();
  }
}
