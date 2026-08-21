"use server";

import { withServerAction, withPublicDatabaseOperation } from "@/lib/server-action-utils";
import type { Beach } from "@/types/database";
import { expandPartialBeach } from "@/lib/utils/beach-defaults";
import { rankBeaches } from "@/lib/recommendations/selection";
import { WATER_QUALITY_HOLD_PREFETCH_BUFFER } from "@/lib/recommendations/major-event-hold/water-quality";

const STATE_MAP_BEACH_FIELDS =
  "id, name, slug, city, lat, lon, timezone, state, country, created_at, is_private, geog, skill_level, break_type, average_rating, review_count";

type StateMapBeachRow = Pick<
  Beach,
  "id" | "name" | "slug" | "city" | "lat" | "lon" | "timezone" | "state" | "country" | "created_at" | "is_private" | "geog" | "skill_level" | "break_type" | "average_rating" | "review_count"
>;

/**
 * Convert partial beach row from database query to full Beach object.
 *
 * Uses expandPartialBeach utility to fill in missing fields with defaults.
 * This ensures components like InteractiveMap receive complete Beach objects.
 */
function toFullBeach(row: StateMapBeachRow): Beach {
  return expandPartialBeach({
    id: row.id,
    name: row.name,
    city: row.city ?? null,
    country: row.country ?? null,
    created_at: row.created_at,
    geog: row.geog,
    is_private: row.is_private,
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    // Carry the real timezone: beach-defaults fills an unset one with
    // DEFAULT_TIMEZONE, which map-view would then trust as a valid zone.
    timezone: row.timezone,
    slug: row.slug ?? null,
    state: row.state ?? null,
    skill_level: row.skill_level ?? null,
    break_type: row.break_type ?? null,
    average_rating: row.average_rating ?? null,
    review_count: row.review_count ?? null,
  });
}

/**
 * Fetch a limited set of beaches for a US state page map preview.
 *
 * - Uses state *values* as stored in DB (e.g., ["CA", "California"]) to avoid
 *   guessing state normalization rules.
 * - Filters to USA/NULL country.
 */
export async function getStateMapBeaches(params: {
  stateValues: string[];
  limit?: number;
}) {
  const { stateValues, limit = 200 } = params;

  return withServerAction(() =>
    withPublicDatabaseOperation<Beach[]>(async (supabase) => {
      if (!Array.isArray(stateValues) || stateValues.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("beaches")
        .select(STATE_MAP_BEACH_FIELDS)
        .in("state", stateValues)
        .or("country.is.null,country.eq.USA,country.eq.US,country.eq.usa,country.eq.us")
        .not("lat", "is", null)
        .not("lon", "is", null)
        .order("name")
        .limit(limit + WATER_QUALITY_HOLD_PREFETCH_BUFFER);

      if (error) throw error;
      const rows = (data ?? []) as StateMapBeachRow[];
      const beaches = rows.map(toFullBeach);
      const rankedBeaches = await rankBeaches(beaches, {
        compare: (left, right) => left.name.localeCompare(right.name),
      });
      return rankedBeaches.slice(0, limit);
    })
  );
}
