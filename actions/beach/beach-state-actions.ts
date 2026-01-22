"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import type { Beach } from "@/types/database";
import { expandPartialBeach } from "@/lib/utils/beach-defaults";

const STATE_MAP_BEACH_FIELDS =
  "id, name, slug, city, lat, lon, state, country, created_at, is_private, geog";

type StateMapBeachRow = Pick<
  Beach,
  "id" | "name" | "slug" | "city" | "lat" | "lon" | "state" | "country" | "created_at" | "is_private" | "geog"
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
    slug: row.slug ?? null,
    state: row.state ?? null,
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

  return withDatabaseOperation<Beach[]>(async (supabase) => {
    if (!Array.isArray(stateValues) || stateValues.length === 0) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from("beaches")
      .select(STATE_MAP_BEACH_FIELDS)
      .in("state", stateValues)
      .or("country.is.null,country.eq.USA,country.eq.US,country.eq.usa,country.eq.us")
      .not("lat", "is", null)
      .not("lon", "is", null)
      .order("name")
      .limit(limit);

    if (error) throw error;
    const rows = (data ?? []) as StateMapBeachRow[];
    return { data: rows.map(toFullBeach), error: null };
  });
}


