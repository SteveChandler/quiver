import type { Beach } from "@/types/database";
import type { SurfSpot } from "@/lib/data/surf-spots";

/**
 * Props passed from ISR pages to the map client components are serialized into
 * the RSC payload and rewritten on every regeneration. Project rows to the
 * fields the maps read at the server boundary.
 */

/**
 * Beach columns read by InteractiveMap's module graph from beaches it is given:
 * markers, cluster and preview popups, and beach URLs. `country` is always
 * present because buildBeachUrl branches on the key existing.
 */
export const MAP_BEACH_FIELDS = [
  "id",
  "name",
  "slug",
  "city",
  "state",
  "country",
  "region",
  "lat",
  "lon",
  "timezone",
  "is_private",
  "skill_level",
  "break_type",
  "crowd_level",
  "wave_tips",
  "best_conditions_prose",
  "crowd_tips",
] as const satisfies readonly (keyof Beach)[];

export type MapBeach = Pick<Beach, (typeof MAP_BEACH_FIELDS)[number]>;

export function toMapBeach(beach: MapBeach): MapBeach {
  const projected: Partial<Record<keyof MapBeach, unknown>> = {};
  for (const field of MAP_BEACH_FIELDS) {
    projected[field] = beach[field] ?? null;
  }
  return projected as MapBeach;
}

/** SurfSpot fields CityMapView reads for its list and the map beaches it builds. */
export const CITY_MAP_SPOT_FIELDS = [
  "id",
  "slug",
  "name",
  "city",
  "region",
  "coordinates",
  "skillLevel",
  "overview",
  "crowdFactor",
  "conditions",
  "swellAdvice",
] as const satisfies readonly (keyof SurfSpot)[];

export type CityMapSpot = Pick<SurfSpot, (typeof CITY_MAP_SPOT_FIELDS)[number]>;

export function toCityMapSpot(spot: CityMapSpot): CityMapSpot {
  const projected: Partial<Record<keyof CityMapSpot, unknown>> = {};
  for (const field of CITY_MAP_SPOT_FIELDS) {
    if (spot[field] !== undefined) projected[field] = spot[field];
  }
  return projected as CityMapSpot;
}
