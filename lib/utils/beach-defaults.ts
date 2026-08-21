/**
 * Beach Type Defaults Utility
 *
 * Single source of truth for Beach object field defaults.
 * Eliminates duplication across test mocks, transformers, and server actions.
 *
 * IMPORTANT: When new columns are added to the beaches table:
 * 1. Run: yarn db:types (to regenerate types/database.generated.ts)
 * 2. Update this file ONLY - add the new field with its default value
 * 3. All test mocks, transformers, and factories automatically inherit the change
 *
 * This prevents the cascading TypeScript errors that previously affected
 * 5+ files whenever the Beach schema changed.
 */

import type { Beach } from "@/types/database";
import { DEFAULT_TIMEZONE } from "./timezone-constants";

/**
 * Partial Beach object containing ONLY the fields that can be provided.
 * All other fields will be filled with defaults from getBeachDefaults().
 */
export type BeachInput = Partial<Beach> & Pick<Beach, "id" | "name">;

/**
 * Get default values for all nullable/optional Beach fields.
 *
 * These defaults represent the "zero state" or "empty state" for each field.
 * Required fields (id, name, created_at, is_private, cdip_eligible, terrain_enabled)
 * are NOT included here - callers must provide them.
 *
 * @returns Object containing default values for all nullable Beach fields
 */
function getBeachDefaults(): Omit<
  Beach,
  "id" | "name" | "created_at" | "is_private" | "cdip_eligible" | "terrain_enabled"
> {
  return {
    // Location fields (lat/lon are NOT NULL in DB but default to 0 here for test mocks)
    lat: 0,
    lon: 0,
    city: null,
    state: null,
    country: null,
    region: null,
    region_id: null,
    slug: null,
    geog: null,
    timezone: DEFAULT_TIMEZONE,
    nws_forecast_zone: null,
    nws_office: null,

    // Descriptive fields
    description: null,
    editorial_reviewed_at: null,
    editorial_sources: [],
    seo_indexable: false,
    skill_level: "", // non-nullable in DB schema; "" is the zero/empty state
    break_type: null,
    crowd_level: null,

    // Conditions and preferences
    best_conditions_prose: null,
    best_months: null,
    wave_tips: null,
    hazards: null,
    features: null,
    warnings: null,
    real_takeaways: null,

    // Access and local knowledge
    parking_tips: null,
    access_tips: null,
    local_etiquette: null,
    crowd_tips: null,

    // Ratings and reviews
    average_rating: null,
    review_count: null,

    // Ownership
    owner_id: null,
    deleted_at: null,

    // Preference model (JSON)
    preference_model: null,

    // Tide preferences
    preferred_tide_ft_min: null,
    preferred_tide_ft_max: null,
    preferred_tide_direction: null,
    tide_direction_sensitivity: null,

    // Swell analysis
    aspect_deg: null,
    swell_window_min_deg: null,
    swell_window_max_deg: null,
    swell_window_center_deg: null,
    swell_window_halfwidth_deg: null,
    swell_window_center_deg_v2: null,
    swell_window_halfwidth_deg_v2: null,
    swell_window_max_deg_v2: null,
    swell_window_min_deg_v2: null,
    swell_window_v2_analyzed_at: null,
    swell_window_v2_method: null,
    swell_access_factors: null,
    swell_analyzed_at: null,

    // Wind analysis
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
    wind_cross_shore_ok_kt: null,
    wind_onshore_bad_kt: null,
    wind_exposure_factors: null,
    wind_analyzed_at: null,
    max_wind_any_mph: null,
    max_wind_onshore_mph: null,

    // Height offset (per-beach calibration; non-nullable in schema)
    height_offset_enabled: false,
    height_offset_max_age_days: 30,
    height_offset_min_sample_count: 5,

    // CDIP buoy integration
    cdip_station: null,

    // Empirically calibrated per-beach shoaling factor lookup (period-keyed).
    // See migration 20260407134519. Null for uncalibrated beaches.
    shoaling_factors: null,

    // Beach persona and deepwater decay
    persona: null,
    deepwater_decay_factor: null,

    // Terrain analysis
    terrain_analysis_debug: null,
    terrain_analyzed_at: null,
    terrain_method: null,
    terrain_params: null,
    terrain_params_hash: null,
    terrain_status: null,
    wave_punchiness_ai: null,
    wave_punchiness_ai_confidence: null,
    wave_punchiness_ai_meta: null,
  };
}

/**
 * Create a complete Beach object with all required fields filled.
 *
 * This is the primary factory function used across the codebase.
 * It ensures type safety while allowing flexible overrides.
 *
 * @param input - Partial Beach with at minimum { id, name }
 * @returns Complete Beach object with all fields defined
 *
 * @example
 * // Minimal usage (test mock)
 * const beach = createBeachWithDefaults({
 *   id: "test-beach-1",
 *   name: "Test Beach",
 * });
 *
 * @example
 * // With overrides (production transformation)
 * const beach = createBeachWithDefaults({
 *   id: spot.id,
 *   name: spot.name,
 *   lat: spot.coordinates.lat,
 *   lon: spot.coordinates.lon,
 *   city: "San Diego",
 * });
 */
export function createBeachWithDefaults(input: BeachInput): Beach {
  const defaults = getBeachDefaults();

  return {
    // Required fields with defaults
    created_at: new Date().toISOString(),
    is_private: false,
    cdip_eligible: false,
    terrain_enabled: false,

    // Merge defaults with input
    ...defaults,
    ...input,
  };
}

/**
 * Create a Beach object from a partial database row (e.g., from SELECT with limited fields).
 *
 * This is useful for server actions that query only specific columns
 * but need to return a full Beach object for components.
 *
 * @param row - Partial Beach from database query
 * @returns Complete Beach object with unqueried fields set to null
 *
 * @example
 * // Server action querying only a few fields
 * const { data } = await supabase
 *   .from('beaches')
 *   .select('id, name, lat, lon, city, state')
 *   .eq('id', beachId)
 *   .single();
 *
 * return expandPartialBeach(data);
 */
export function expandPartialBeach<T extends Partial<Beach> & Pick<Beach, "id" | "name">>(
  row: T
): Beach {
  return createBeachWithDefaults(row);
}
