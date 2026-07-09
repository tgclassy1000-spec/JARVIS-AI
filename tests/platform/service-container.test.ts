import { ERROR_CODES } from '../../src/shared/platform/errors';
import { PlatformError } from '../../src/main/platform/errors/platform-error';
import { ServiceContainer, createServiceToken } from '../../src/main/platform/di/service-container';

describe('ServiceContainer', () => {
  it('resolves singleton values and factories', () => {
    const container = new ServiceContainer();
    const valueToken = createServiceToken<number>('value');
    const derivedToken = createServiceToken<string>('derived');
    let factoryCalls = 0;
    container.registerValue(valueToken, 7);
    container.registerFactory(derivedToken, (services) => {
      factoryCalls += 1;
      return `value:${services.resolve(valueToken)}`;
    });

    expect(container.has(valueToken)).toBe(true);
    expect(container.resolve(derivedToken)).toBe('value:7');
    expect(container.resolve(derivedToken)).toBe('value:7');
    expect(factoryCalls).toBe(1);
  });

  it('rejects duplicate, missing, and circular services with stable codes', () => {
    const container = new ServiceContainer();
    const duplicate = createServiceToken<number>('duplicate');
    container.registerValue(duplicate, 1);
    expect(() => container.registerValue(duplicate, 2)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.serviceDuplicate }),
    );

    const missing = createServiceToken<string>('missing');
    expect(() => container.resolve(missing)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.serviceNotFound }),
    );

    const first = createServiceToken<string>('first');
    const second = createServiceToken<string>('second');
    container.registerFactory(first, (services) => services.resolve(second));
    container.registerFactory(second, (services) => services.resolve(first));
    expect(() => container.resolve(first)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.serviceCycle }),
    );
    expect(() => container.resolve(first)).toThrowError(PlatformError);
  });
});
// @vitest-environment node
