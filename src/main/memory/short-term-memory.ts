export interface ShortTermEntry {
  readonly key: string;
  readonly value: string;
  readonly expiresAt: number;
}

export class ShortTermMemory {
  readonly #entries = new Map<string, ShortTermEntry>();

  public constructor(private readonly clock: () => number = Date.now) {}

  public set(key: string, value: string, ttlMs: number): void {
    this.#entries.set(key, Object.freeze({ key, value, expiresAt: this.clock() + ttlMs }));
  }

  public get(key: string): string | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.clock()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  public delete(key: string): boolean {
    return this.#entries.delete(key);
  }

  public clear(): void {
    this.#entries.clear();
  }
}
