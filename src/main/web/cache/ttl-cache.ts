interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export class TtlCache<T> {
  readonly #entries = new Map<string, CacheEntry<T>>();
  readonly #ttlMs: number;
  readonly #clock: () => number;

  public constructor(ttlMs: number, clock: () => number = Date.now) {
    this.#ttlMs = ttlMs;
    this.#clock = clock;
  }

  public get(key: string): T | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.#clock()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  public set(key: string, value: T): void {
    this.#entries.set(key, { value, expiresAt: this.#clock() + this.#ttlMs });
  }

  public clear(): void {
    this.#entries.clear();
  }
}
