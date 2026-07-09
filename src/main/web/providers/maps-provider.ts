import type { MapLookupRequest, MapLookupResponse, MapPlace } from '../../../shared/web/contracts';
import type { MapsProvider, ProviderRuntime } from './contracts';
import type { WebHttpClient } from './http-client';
import { asArray, asNumber, asOptionalString, asRecord } from './json';

export class OpenStreetMapProvider implements MapsProvider {
  public readonly id = 'openstreetmap-nominatim';

  public constructor(private readonly http: WebHttpClient) {}

  public async lookup(
    request: MapLookupRequest,
    runtime: ProviderRuntime,
  ): Promise<MapLookupResponse> {
    const limit = request.limit ?? 5;
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', request.query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', String(limit));
    const places: MapPlace[] = asArray(await this.http.getJson(url))
      .map(asRecord)
      .map((place, index) =>
        Object.freeze({
          id: asOptionalString(place.place_id) ?? `place:${index}`,
          name:
            asOptionalString(place.name) ?? asOptionalString(place.display_name) ?? request.query,
          address: asOptionalString(place.display_name) ?? request.query,
          latitude: Number(asOptionalString(place.lat) ?? asNumber(place.lat)),
          longitude: Number(asOptionalString(place.lon) ?? asNumber(place.lon)),
        }),
      )
      .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
      .slice(0, limit);
    return Object.freeze({
      query: request.query,
      places: Object.freeze(places),
      generatedAt: runtime.now().toISOString(),
      cached: false,
    });
  }
}
