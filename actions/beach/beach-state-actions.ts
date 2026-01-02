"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import type { Beach } from "@/types/database";

const STATE_MAP_BEACH_FIELDS =
  "id, name, slug, city, lat, lon, state, country, created_at, is_private, geog";

type StateMapBeachRow = Pick<
  Beach,
  "id" | "name" | "slug" | "city" | "lat" | "lon" | "state" | "country" | "created_at" | "is_private" | "geog"
>;

function toFullBeach(row: StateMapBeachRow): Beach {
  // Ensure we return a full `Beach` row type (no `undefined` fields) so components
  // like `InteractiveMap` can consume it safely.
  return {
    access_tips: null,
    aspect_deg: null,
    average_rating: null,
    best_conditions_prose: null,
    best_months: null,
    break_type: null,
    city: row.city ?? null,
    country: row.country ?? null,
    created_at: row.created_at,
    crowd_level: null,
    crowd_tips: null,
    deleted_at: null,
    description: null,
    features: null,
    geog: row.geog,
    hazards: null,
    id: row.id,
    is_private: row.is_private,
    lat: row.lat ?? null,
    local_etiquette: null,
    lon: row.lon ?? null,
    name: row.name,
    owner_id: null,
    parking_tips: null,
    preference_model: null,
    preferred_tide_ft_max: null,
    preferred_tide_ft_min: null,
    real_takeaways: null,
    region: null,
    region_id: null,
    review_count: null,
    skill_level: null,
    slug: row.slug ?? null,
    state: row.state ?? null,
    swell_window_center_deg: null,
    swell_window_halfwidth_deg: null,
    swell_window_max_deg: null,
    swell_window_min_deg: null,
    warnings: null,
    wave_tips: null,
    wind_cross_shore_ok_kt: null,
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
    wind_onshore_bad_kt: null,
  };
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


