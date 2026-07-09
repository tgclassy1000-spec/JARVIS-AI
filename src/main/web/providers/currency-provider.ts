import { ERROR_CODES } from '../../../shared/platform/errors';
import type {
  CurrencyConversionRequest,
  CurrencyConversionResponse,
} from '../../../shared/web/contracts';
import { PlatformError } from '../../platform/errors/platform-error';
import type { CurrencyProvider, ProviderRuntime } from './contracts';
import type { WebHttpClient } from './http-client';
import { asNumber, asOptionalString, asRecord } from './json';

export class FrankfurterCurrencyProvider implements CurrencyProvider {
  public readonly id = 'frankfurter';

  public constructor(private readonly http: WebHttpClient) {}

  public async convert(
    request: CurrencyConversionRequest,
    runtime: ProviderRuntime,
  ): Promise<CurrencyConversionResponse> {
    void runtime;
    const from = request.from.toUpperCase();
    const to = request.to.toUpperCase();
    const url = new URL('https://api.frankfurter.app/latest');
    url.searchParams.set('amount', String(request.amount));
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    const payload = asRecord(await this.http.getJson(url));
    const rates = asRecord(payload.rates);
    const converted = asNumber(rates[to], Number.NaN);
    if (!Number.isFinite(converted)) {
      throw new PlatformError(ERROR_CODES.webProviderUnavailable, 'Currency pair was not found.');
    }
    const rate = converted / request.amount;
    return Object.freeze({
      amount: request.amount,
      from,
      to,
      rate,
      converted,
      asOf: asOptionalString(payload.date) ?? new Date().toISOString().slice(0, 10),
      provider: this.id,
      cached: false,
    });
  }
}
