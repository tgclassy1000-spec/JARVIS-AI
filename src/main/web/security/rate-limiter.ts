import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError } from '../../platform/errors/platform-error';

export class WebRateLimiter {
  readonly #limit: number;
  readonly #clock: () => number;
  readonly #requests = new Map<string, number[]>();

  public constructor(limitPerMinute: number, clock: () => number = Date.now) {
    this.#limit = limitPerMinute;
    this.#clock = clock;
  }

  public assertAllowed(key: string): void {
    const now = this.#clock();
    const windowStart = now - 60_000;
    const recent = (this.#requests.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
    if (recent.length >= this.#limit) {
      this.#requests.set(key, recent);
      throw new PlatformError(ERROR_CODES.rateLimited, 'Web intelligence rate limit exceeded.');
    }
    recent.push(now);
    this.#requests.set(key, recent);
  }
}
