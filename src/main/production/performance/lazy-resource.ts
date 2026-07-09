export class LazyResource<T> {
  readonly #factory: () => T;
  #value: T | undefined;
  #loaded = false;

  public constructor(factory: () => T) {
    this.#factory = factory;
  }

  public get loaded(): boolean {
    return this.#loaded;
  }

  public get value(): T {
    if (!this.#loaded) {
      this.#value = this.#factory();
      this.#loaded = true;
    }
    return this.#value as T;
  }

  public clear(): void {
    this.#value = undefined;
    this.#loaded = false;
  }
}
