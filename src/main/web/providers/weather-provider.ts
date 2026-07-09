import { ERROR_CODES } from '../../../shared/platform/errors';
import type {
  WeatherForecastDay,
  WeatherRequest,
  WeatherResponse,
} from '../../../shared/web/contracts';
import { PlatformError } from '../../platform/errors/platform-error';
import type { ProviderRuntime, WeatherProvider } from './contracts';
import type { WebHttpClient } from './http-client';
import { asArray, asNumber, asRecord, asString } from './json';

function weatherCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Variable conditions';
}

function numberAt(values: readonly unknown[], index: number): number {
  return asNumber(values[index]);
}

function stringAt(values: readonly unknown[], index: number): string | undefined {
  const value = values[index];
  return typeof value === 'string' ? value : undefined;
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  public readonly id = 'open-meteo';

  public constructor(private readonly http: WebHttpClient) {}

  public async weather(
    request: WeatherRequest,
    runtime: ProviderRuntime,
  ): Promise<WeatherResponse> {
    const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geocodeUrl.searchParams.set('name', request.location);
    geocodeUrl.searchParams.set('count', '1');
    geocodeUrl.searchParams.set('language', 'en');
    geocodeUrl.searchParams.set('format', 'json');
    const geocode = asRecord(await this.http.getJson(geocodeUrl));
    const location = asRecord(asArray(geocode.results)[0]);
    const latitude = asNumber(location.latitude, Number.NaN);
    const longitude = asNumber(location.longitude, Number.NaN);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new PlatformError(
        ERROR_CODES.webProviderUnavailable,
        'Weather location was not found.',
      );
    }

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.searchParams.set('latitude', String(latitude));
    forecastUrl.searchParams.set('longitude', String(longitude));
    forecastUrl.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    );
    forecastUrl.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    );
    forecastUrl.searchParams.set('timezone', 'auto');
    forecastUrl.searchParams.set('forecast_days', String(request.days ?? 3));
    const forecast = asRecord(await this.http.getJson(forecastUrl));
    const current = asRecord(forecast.current);
    const daily = asRecord(forecast.daily);
    const dates = asArray(daily.time);
    const forecastDays: WeatherForecastDay[] = dates.map((_date, index) =>
      Object.freeze({
        date: asString(dates[index]),
        minCelsius: numberAt(asArray(daily.temperature_2m_min), index),
        maxCelsius: numberAt(asArray(daily.temperature_2m_max), index),
        precipitationProbabilityPercent: numberAt(
          asArray(daily.precipitation_probability_max),
          index,
        ),
        sunrise: stringAt(asArray(daily.sunrise), index),
        sunset: stringAt(asArray(daily.sunset), index),
      }),
    );
    return Object.freeze({
      location: asString(location.name, request.location),
      latitude,
      longitude,
      current: {
        temperatureCelsius: asNumber(current.temperature_2m),
        condition: weatherCode(asNumber(current.weather_code)),
        humidityPercent: asNumber(current.relative_humidity_2m),
        windKph: asNumber(current.wind_speed_10m),
        observedAt: asString(current.time, runtime.now().toISOString()),
      },
      forecast: Object.freeze(forecastDays),
      provider: this.id,
      generatedAt: runtime.now().toISOString(),
      cached: false,
    });
  }
}
