export type LocationPlaceBeachItem = {
  name: string;
  url: string;
};

/**
 * Optional geo coordinates for a beach, used to populate GeoCoordinates in
 * the containsPlace array. Uses `lat`/`lon` naming consistent with the
 * database column convention (`center_lat`, `center_lng` legacy columns are
 * read and mapped to `lat`/`lon` before being passed here).
 */
export type LocationPlaceBeachGeo = {
  name: string;
  url: string;
  /** Latitude from database `center_lat` column */
  lat?: number | null;
  /** Longitude from database `center_lng` column — stored as `lon` per CLAUDE.md convention */
  lon?: number | null;
};

export type BuildLocationPlaceStructuredDataInput = {
  city: string;
  state: string;
  topBeaches: LocationPlaceBeachItem[];
  /** City center latitude (from CityMetadata.centerLat) */
  centerLat?: number | null;
  /** City center longitude (from CityMetadata.centerLon) */
  centerLon?: number | null;
  /** Per-beach geo coordinates; when provided, adds GeoCoordinates to each containsPlace entry */
  beachGeoData?: LocationPlaceBeachGeo[];
};

/**
 * Build Location (city) JSON-LD structured data.
 *
 * Emits a Place schema with optional GeoCoordinates for the city center and
 * each contained beach. This exposes map pin data to Google's structured data
 * parser, which cannot read Mapbox GL canvas renders.
 *
 * NOTE: We intentionally do NOT emit AggregateRating/Review markup here because
 * Google review snippets do not support ratings on Place/Beach types, and
 * emitting it can trigger Search Console "Review snippets" errors.
 */
export function buildLocationPlaceStructuredData({
  city,
  state,
  topBeaches,
  centerLat,
  centerLon,
  beachGeoData,
}: BuildLocationPlaceStructuredDataInput) {
  // Build a lookup map from beach name to geo data when available
  const geoByName = new Map<string, { lat: number; lon: number }>();
  if (beachGeoData) {
    for (const item of beachGeoData) {
      if (item.lat != null && item.lon != null) {
        geoByName.set(item.name, { lat: item.lat, lon: item.lon });
      }
    }
  }

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${city}, ${state}`,
    description: `Surf beaches in ${city}, ${state}`,
  };

  // Add city-level GeoCoordinates when available
  if (centerLat != null && centerLon != null && centerLat !== 0 && centerLon !== 0) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: centerLat,
      longitude: centerLon,
    };
  }

  schema.containsPlace = topBeaches.map((beach) => {
    const geo = geoByName.get(beach.name);
    const entry: Record<string, unknown> = {
      "@type": "Beach",
      name: beach.name,
      url: beach.url,
    };
    if (geo) {
      entry.geo = {
        "@type": "GeoCoordinates",
        latitude: geo.lat,
        longitude: geo.lon,
      };
    }
    return entry;
  });

  return schema;
}

