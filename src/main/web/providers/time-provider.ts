import { ERROR_CODES } from '../../../shared/platform/errors';
import type {
  TimeConversionRequest,
  TimeConversionResponse,
  TimeRequest,
  TimeResponse,
} from '../../../shared/web/contracts';
import { PlatformError } from '../../platform/errors/platform-error';
import type { ProviderRuntime, TimeProvider } from './contracts';

function partsFor(timeZone: string, date: Date): Readonly<Record<string, string>> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return Object.freeze(
    Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    ),
  );
}

function offsetMinutes(timeZone: string, date: Date): number {
  try {
    const parts = partsFor(timeZone, date);
    const utc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return Math.round((utc - date.getTime()) / 60_000);
  } catch (error) {
    throw new PlatformError(ERROR_CODES.validationFailed, 'Timezone is invalid.', {
      cause: error,
      metadata: { timeZone },
    });
  }
}

function display(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

export class IntlTimeProvider implements TimeProvider {
  public readonly id = 'intl';

  public time(request: TimeRequest, runtime: ProviderRuntime): Promise<TimeResponse> {
    const date = runtime.now();
    const offset = offsetMinutes(request.timeZone, date);
    return Promise.resolve(
      Object.freeze({
        timeZone: request.timeZone,
        isoDateTime: date.toISOString(),
        displayTime: display(request.timeZone, date),
        offsetMinutes: offset,
        generatedAt: date.toISOString(),
        cached: false,
      }),
    );
  }

  public convert(
    request: TimeConversionRequest,
    runtime: ProviderRuntime,
  ): Promise<TimeConversionResponse> {
    const source = request.isoDateTime ? new Date(request.isoDateTime) : runtime.now();
    if (Number.isNaN(source.getTime())) {
      throw new PlatformError(ERROR_CODES.validationFailed, 'Date/time is invalid.');
    }
    offsetMinutes(request.fromTimeZone, source);
    offsetMinutes(request.toTimeZone, source);
    return Promise.resolve(
      Object.freeze({
        fromTimeZone: request.fromTimeZone,
        toTimeZone: request.toTimeZone,
        sourceIsoDateTime: source.toISOString(),
        convertedIsoDateTime: source.toISOString(),
        displayTime: display(request.toTimeZone, source),
      }),
    );
  }
}
