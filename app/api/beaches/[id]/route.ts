import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyBeachCoordinateCorrection } from "@/lib/beach-coordinate-corrections";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";

const BEACH_DETAIL_SELECT = `
  access_tips,
  aspect_deg,
  average_rating,
  best_conditions_prose,
  best_months,
  break_type,
  cdip_eligible,
  cdip_station,
  city,
  country,
  created_at,
  crowd_level,
  crowd_tips,
  deepwater_decay_factor,
  description,
  features,
  hazards,
  height_offset_enabled,
  height_offset_max_age_days,
  height_offset_min_sample_count,
  id,
  lat,
  local_etiquette,
  lon,
  max_wind_any_mph,
  max_wind_onshore_mph,
  name,
  nws_forecast_zone,
  nws_office,
  parking_tips,
  persona,
  preference_model,
  preferred_tide_direction,
  preferred_tide_ft_max,
  preferred_tide_ft_min,
  real_takeaways,
  region,
  region_id,
  review_count,
  shoaling_factors,
  skill_level,
  slug,
  state,
  swell_access_factors,
  swell_analyzed_at,
  swell_window_center_deg,
  swell_window_halfwidth_deg,
  swell_window_max_deg,
  swell_window_min_deg,
  terrain_analyzed_at,
  terrain_enabled,
  terrain_method,
  terrain_params,
  terrain_params_hash,
  terrain_status,
  tide_direction_sensitivity,
  timezone,
  warnings,
  wave_tips,
  wind_analyzed_at,
  wind_cross_shore_ok_kt,
  wind_exposure_factors,
  wind_offshore_deg,
  wind_offshore_tol_deg,
  wind_onshore_bad_kt
`;

// Core handler logic for fetching a single beach
async function fetchBeachById(beachId: string): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beaches")
      .select(BEACH_DETAIL_SELECT)
      .eq("id", beachId)
      .or("is_private.is.null,is_private.eq.false")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return handleApiError(error, "Failed to fetch beach");
    }

    if (!data) {
      return createErrorResponse("Beach not found", undefined, 404);
    }

    // Ensure review_count is always populated. The denormalized
    // beaches.review_count column is sometimes null/stale, which breaks the
    // beach_reviews_empty instrumentation. Recompute live when missing.
    let reviewCount = (data as { review_count?: number | null }).review_count;
    if (typeof reviewCount !== "number") {
      const { count } = await supabase
        .from("beach_reviews")
        .select("id", { count: "exact", head: true })
        .eq("beach_id", beachId)
        .is("deleted_at", null);
      reviewCount = count ?? 0;
    }
    const beachWithCount = applyBeachCoordinateCorrection({
      ...data,
      review_count: reviewCount,
    });

    // PERFORMANCE OPTIMIZATION: Cache beach data for 1 hour (3600s)
    // Beach metadata rarely changes
    const response = createSuccessResponse({ beach: beachWithCount });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );

    return response;
  } catch (err) {
    return handleApiError(err, "Failed to fetch beach");
  }
}

// GET /api/beaches/[id] - fetch a single beach by ID
// Bot blocking and rate limiting applied to prevent abuse
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Wrap the handler with bot blocking and rate limiting
  const wrappedHandler = withBotBlockingAndRateLimit(
    async () => fetchBeachById(id),
    "public-default"
  );

  return wrappedHandler(request);
}
