import type { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
  withAuth,
  withNoStore,
  withRateLimit,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";
import {
  loadCustomSpotForecastAdjusters,
  type CustomSpotDiscoveryRow,
} from "@/lib/services/discovery/surf-discovery-orchestrator";
import { applyV51DisplayOverrideToForecasts } from "@/lib/services/forecast/v5-display-gate";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WINDOW_MS = 16 * 24 * 60 * 60 * 1000;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function parseInstant(value: string | null): number {
  return value && ISO_INSTANT.test(value) ? Date.parse(value) : NaN;
}

const SPOT_SELECT =
  "id, user_id, name, lat, lon, visibility, nearest_beach_id, nearest_beach_distance_mi, break_type, facing_direction_deg, swell_window_min_deg, swell_window_max_deg, offshore_direction_deg, exposure_level, swell_access_factors, wind_exposure_factors, terrain_method, terrain_params, terrain_params_hash, terrain_analyzed_at, terrain_status, fingerprint_model_version, deleted_at";

const ROW_SELECT =
  "beach_id, forecast_at, wave_height, wave_period, wave_direction, wave_height_om, wave_direction_om, swell_height_om, swell_period_om, swell_direction_om, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, wind_wave_height, wind_wave_period, wind_wave_direction, data_source";

type HeightsByHour = Record<string, string>;

function changedHeights(
  rows: EnhancedForecastEntity[],
  adjust: (row: EnhancedForecastEntity) => EnhancedForecastEntity,
): HeightsByHour {
  const heights: HeightsByHour = {};
  for (const row of rows) {
    const adjusted = adjust(row).wave_height;
    if (adjusted && adjusted !== row.wave_height) heights[row.forecast_at] = adjusted;
  }
  return heights;
}

/**
 * A custom spot's anchor-forecast heights adjusted to the spot's own terrain,
 * keyed by forecast_at, for clients that read the anchor's rows directly.
 * `heights` scales the stored rows; `displayHeights` scales the display rows
 * that /api/forecasts/current serves. Hours left unchanged are omitted.
 */
export async function customSpotForecastHeightsHandler(
  request: NextRequest,
  { supabase, params }: OptionalAuthContext,
): Promise<NextResponse> {
  const id = params.id ?? "";
  if (!UUID.test(id)) return createValidationError("id must be a UUID");
  const start = parseInstant(request.nextUrl.searchParams.get("start"));
  const end = parseInstant(request.nextUrl.searchParams.get("end"));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_WINDOW_MS) {
    return createValidationError("start and end must be ISO times at most 16 days apart");
  }
  const empty = { heights: {}, displayHeights: {} };

  try {
    // The caller's client, so RLS decides whether they may see the spot.
    const { data: spotData, error: spotError } = await supabase
      .from("custom_spots")
      .select(SPOT_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (spotError) throw new Error(spotError.message);
    const spot = spotData as unknown as CustomSpotDiscoveryRow | null;
    if (!spot?.nearest_beach_id || spot.terrain_status !== "ok") return createSuccessResponse(empty);

    const [beachResult, rowResult] = await Promise.all([
      supabase.from("beaches").select("*").eq("id", spot.nearest_beach_id).maybeSingle(),
      supabase
        .from("enhanced_forecasts")
        .select(ROW_SELECT)
        .eq("beach_id", spot.nearest_beach_id)
        .gte("forecast_at", new Date(start).toISOString())
        .lt("forecast_at", new Date(end).toISOString())
        .order("forecast_at", { ascending: true }),
    ]);
    if (beachResult.error) throw new Error(beachResult.error.message);
    if (rowResult.error) throw new Error(rowResult.error.message);
    const nearestBeach = beachResult.data as Beach | null;
    if (!nearestBeach) return createSuccessResponse(empty);

    const adjust = (await loadCustomSpotForecastAdjusters([{ spot, nearestBeach }])).get(spot.id);
    if (!adjust) return createSuccessResponse(empty);

    const rows = (rowResult.data ?? []) as unknown as EnhancedForecastEntity[];
    const displayRows = await applyV51DisplayOverrideToForecasts(rows);
    const heights = changedHeights(rows, adjust);
    // The override returns the same rows when it is off; no need to scale them twice.
    return createSuccessResponse({
      heights,
      displayHeights: displayRows === rows ? heights : changedHeights(displayRows, adjust),
    });
  } catch (error) {
    return handleApiError(
      error instanceof Error ? error : new Error(String(error)),
      "Failed to load custom spot forecast heights",
    );
  }
}

const handleGet = withNoStore(
  withRateLimit(
    withAuth(customSpotForecastHeightsHandler, {
      optional: true,
      errorMessage: "Unexpected error loading custom spot forecast heights",
    }),
    "public-default",
  ),
);

export const GET = withErrorNoStore(handleGet);
