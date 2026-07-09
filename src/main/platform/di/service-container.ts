import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError } from '../errors/platform-error';

export interface ServiceToken<T> {
  readonly key: symbol;
  readonly description: string;
  readonly __type?: T;
}

export type ServiceFactory<T> = (container: ServiceContainer) => T;

interface ServiceRegistration<T> {
  readonly factory: ServiceFactory<T>;
  instance?: T;
}

export function createServiceToken<T>(description: string): ServiceToken<T> {
  return Object.freeze({ key: Symbol(description), description });
}

export class ServiceContainer {
  readonly #registrations = new Map<symbol, ServiceRegistration<unknown>>();
  readonly #resolving = new Set<symbol>();

  public registerValue<T>(token: ServiceToken<T>, value: T): void {
    this.registerFactory(token, () => value);
  }

  public registerFactory<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    if (this.#registrations.has(token.key)) {
      throw new PlatformError(
        ERROR_CODES.serviceDuplicate,
        `Service already registered: ${token.description}`,
      );
    }
    this.#registrations.set(token.key, { factory });
  }

  public resolve<T>(token: ServiceToken<T>): T {
    const registration = this.#registrations.get(token.key);
    if (!registration) {
      throw new PlatformError(
        ERROR_CODES.serviceNotFound,
        `Service not registered: ${token.description}`,
      );
    }
    if (this.#resolving.has(token.key)) {
      throw new PlatformError(
        ERROR_CODES.serviceCycle,
        `Circular service dependency: ${token.description}`,
      );
    }
    if ('instance' in registration) return registration.instance as T;

    this.#resolving.add(token.key);
    try {
      const instance = registration.factory(this);
      registration.instance = instance;
      return instance as T;
    } finally {
      this.#resolving.delete(token.key);
    }
  }

  public has<T>(token: ServiceToken<T>): boolean {
    return this.#registrations.has(token.key);
  }
}
