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
import {
  currentMapForecastRow,
  fetchBulkForecastRowsWithV51Display,
  resolveForecastFetchWindow,
} from "@/lib/services/forecast/map-current-forecast";
import { resolveSelectedHourDisplay, type ForecastDisplay } from "@/lib/services/forecast/today-headline";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const dynamic = "force-dynamic";

const MAX_SPOTS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SPOT_SELECT =
  "id, user_id, name, lat, lon, visibility, nearest_beach_id, nearest_beach_distance_mi, break_type, facing_direction_deg, swell_window_min_deg, swell_window_max_deg, offshore_direction_deg, exposure_level, swell_access_factors, wind_exposure_factors, terrain_method, terrain_params, terrain_params_hash, terrain_analyzed_at, terrain_status, fingerprint_model_version, deleted_at";

/**
 * Current wave label for custom spots whose forecast is adjusted to their own
 * terrain, from the same row the map shows for the anchor beach. Spots that
 * are not adjusted are left out; the map keeps the anchor's label for them.
 */
export async function customSpotCurrentDisplayHandler(
  request: NextRequest,
  { supabase }: OptionalAuthContext,
): Promise<NextResponse> {
  const ids = [...new Set(
    (request.nextUrl.searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean),
  )];
  if (ids.some((id) => !UUID.test(id))) return createValidationError("ids must be UUIDs");
  if (ids.length === 0) return createSuccessResponse({ displays: {} });

  try {
    // The caller's client, so RLS decides which spots they may see.
    const { data: spotData, error: spotError } = await supabase
      .from("custom_spots")
      .select(SPOT_SELECT)
      .in("id", ids.slice(0, MAX_SPOTS))
      .is("deleted_at", null);
    if (spotError) throw new Error(spotError.message);
    const spots = ((spotData ?? []) as unknown as CustomSpotDiscoveryRow[])
      .filter((spot) => spot.nearest_beach_id && spot.terrain_status === "ok");
    if (spots.length === 0) return createSuccessResponse({ displays: {} });

    const beachIds = [...new Set(spots.map((spot) => spot.nearest_beach_id as string))];
    const window = resolveForecastFetchWindow(null);
    const [beachResult, forecastResult] = await Promise.all([
      supabase.from("beaches").select("*").in("id", beachIds),
      fetchBulkForecastRowsWithV51Display(supabase, beachIds, window.start, window.end, request.signal),
    ]);
    if (beachResult.error) throw new Error(beachResult.error.message);
    if (forecastResult.error) throw new Error(forecastResult.error.message);

    const beaches = new Map(((beachResult.data ?? []) as Beach[]).map((beach) => [beach.id, beach]));
    const pairs = spots.flatMap((spot) => {
      const nearestBeach = beaches.get(spot.nearest_beach_id as string);
      return nearestBeach ? [{ spot, nearestBeach }] : [];
    });
    const adjusters = await loadCustomSpotForecastAdjusters(pairs);
    const rowsByBeach = Map.groupBy(forecastResult.data ?? [], (row: EnhancedForecastEntity) => row.beach_id);
    const now = new Date();

    const displays: Record<string, ForecastDisplay> = {};
    for (const { spot, nearestBeach } of pairs) {
      const adjust = adjusters.get(spot.id);
      if (!adjust) continue;
      const row = currentMapForecastRow(rowsByBeach.get(nearestBeach.id) ?? [], now);
      const display = row ? resolveSelectedHourDisplay(adjust(row)) : null;
      if (display) displays[spot.id] = display;
    }
    return createSuccessResponse({ displays });
  } catch (error) {
    return handleApiError(
      error instanceof Error ? error : new Error(String(error)),
      "Failed to load custom spot forecasts",
    );
  }
}

const handleGet = withNoStore(
  withRateLimit(
    withAuth(customSpotCurrentDisplayHandler, {
      optional: true,
      errorMessage: "Unexpected error loading custom spot forecasts",
    }),
    "public-default",
  ),
);

export const GET = withErrorNoStore(handleGet);
