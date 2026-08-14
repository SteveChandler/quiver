import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getActiveNDBCStations,
  fetchRecentNDBCObservations,
} from "@/lib/services/ndbc-service";
import {
  IOOS_STATION_FILTERS,
  NDBC_WAVE_CAPABLE_TYPES,
} from "@/lib/constants/ioos-config";
import { haversineDistance } from "@/lib/utils/geo-utils";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SyncPhase = "stations" | "observations";

// 4 minutes — 20s safety margin before Vercel's 300s kill
const MAX_RUNTIME_MS = 4 * 60 * 1000;

interface StationSyncResult {
  phase: "stations";
  stationsDiscovered: number;
  stationsWithWaveType: number;
  stationsLinkedToBeaches: number;
  stationsUpserted: number;
  stationsAlreadyInIOOS: number;
  errors: string[];
  duration_ms: number;
}

interface ObservationSyncResult {
  phase: "observations";
  stationsQueried: number;
  stationsSynced: number;
  stationsSkippedIOOS: number;
  stationsFailed: number;
  stationsSkippedTimeout: number;
  observationsUpserted: number;
  errors: string[];
  duration_ms: number;
}

/**
 * GET /api/cron/ndbc-direct-sync
 *
 * Two-phase cron: syncs NDBC-exclusive stations and observations into
 * ndbc_direct_stations / ndbc_direct_observations for ML training.
 *
 * Query params:
 * - phase: "stations" (weekly) | "observations" (every 2h)
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    const url = new URL(request.url);
    const phase = url.searchParams.get("phase") as SyncPhase | null;

    if (!phase || !["stations", "observations"].includes(phase)) {
      return createErrorResponse(
        "Invalid phase",
        'Query param "phase" must be "stations" or "observations"',
        400
      );
    }

    console.log(`[NDBC-Direct] Starting sync (phase=${phase})...`);

    if (phase === "stations") {
      const result = await withCronOutcome(
        {
          job: "/api/cron/ndbc-direct-sync?phase=stations",
          unit: "stations_synced",
          expectedMin: 1,
          getProduced: (value) => value.stationsUpserted,
        },
        syncStations,
      );
      console.log("[NDBC-Direct] Station discovery complete:", result);
      return createSuccessResponse(result);
    } else {
      const result = await withCronOutcome(
        {
          job: "/api/cron/ndbc-direct-sync?phase=observations",
          unit: "observations_upserted",
          expectedMin: 1,
          getProduced: (value) => value.observationsUpserted,
        },
        syncObservations,
      );
      console.log("[NDBC-Direct] Observation sync complete:", result);
      return createSuccessResponse(result);
    }
  } catch (error) {
    console.error("[NDBC-Direct] Cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/ndbc-direct-sync", _GET);

// ---------------------------------------------------------------------------
// Phase: stations (weekly)
// ---------------------------------------------------------------------------

async function syncStations(): Promise<StationSyncResult> {
  const startTime = Date.now();
  const result: StationSyncResult = {
    phase: "stations",
    stationsDiscovered: 0,
    stationsWithWaveType: 0,
    stationsLinkedToBeaches: 0,
    stationsUpserted: 0,
    stationsAlreadyInIOOS: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    const supabase = createSupabaseServiceRoleClient();

    // 1. Get all active NDBC stations from metadata feed
    const allStations = await getActiveNDBCStations();
    result.stationsDiscovered = allStations.length;

    // 2. Filter to wave-capable station types
    // Filter to known wave-capable types. Stations with no type metadata
    // (null/undefined) are included — many NDBC buoys lack type in the feed.
    // Stations with explicit non-wave types (e.g. "cman") are excluded.
    const waveStations = allStations.filter((s) => {
      if (!s.type) return true; // missing type — include (likely a buoy)
      return NDBC_WAVE_CAPABLE_TYPES.has(s.type.toLowerCase());
    });
    result.stationsWithWaveType = waveStations.length;

    // 3. Fetch beaches for proximity matching
    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, name, lat, lon")
      .not("lat", "is", null)
      .not("lon", "is", null);

    if (beachError) {
      result.errors.push(`Failed to fetch beaches: ${beachError.message}`);
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // 4. Fetch existing IOOS stations for cross-reference dedup
    const { data: ioosStations, error: ioosError } = await supabase
      .from("ioos_stations")
      .select("station_id");

    if (ioosError) {
      result.errors.push(
        `Failed to fetch IOOS stations: ${ioosError.message}`
      );
    }

    const ioosStationIds = new Set(
      (ioosStations || []).map((s) => s.station_id)
    );

    const maxDistKm = IOOS_STATION_FILTERS.maxDistanceFromBeachKm;
    const stationsToUpsert: Array<{
      station_id: string;
      name: string;
      latitude: number;
      longitude: number;
      station_type: string | null;
      has_wave_data: boolean;
      nearest_beach_id: string;
      distance_to_beach_km: number;
      ioos_station_id: string | null;
      active: boolean;
    }> = [];

    for (const station of waveStations) {
      // Find nearest beach within 150km
      let nearestBeach: { id: string; distance: number } | null = null;

      for (const beach of beaches || []) {
        if (beach.lat == null || beach.lon == null) continue;
        const distance = haversineDistance(
          station.lat,
          station.lon,
          beach.lat,
          beach.lon
        );
        if (
          distance <= maxDistKm &&
          (!nearestBeach || distance < nearestBeach.distance)
        ) {
          nearestBeach = { id: beach.id, distance };
        }
      }

      if (!nearestBeach) continue;
      result.stationsLinkedToBeaches++;

      // Cross-reference: check if `wmo_{stationId}` exists in ioos_stations
      const ioosId = `wmo_${station.id}`;
      const existsInIOOS = ioosStationIds.has(ioosId);
      if (existsInIOOS) result.stationsAlreadyInIOOS++;

      stationsToUpsert.push({
        station_id: station.id,
        name: station.name,
        latitude: station.lat,
        longitude: station.lon,
        station_type: station.type || null,
        has_wave_data: true,
        nearest_beach_id: nearestBeach.id,
        distance_to_beach_km:
          Math.round(nearestBeach.distance * 10) / 10,
        ioos_station_id: existsInIOOS ? ioosId : null,
        active: true,
      });
    }

    // 5. Upsert in batches (Supabase has row limits on upsert)
    const UPSERT_BATCH = 200;
    for (let i = 0; i < stationsToUpsert.length; i += UPSERT_BATCH) {
      const batch = stationsToUpsert.slice(i, i + UPSERT_BATCH);
      // TODO: Remove `as any` once db:types is regenerated with ndbc_direct_* tables
      const { error: upsertError } = await (supabase as any)
        .from("ndbc_direct_stations")
        .upsert(batch, {
          onConflict: "station_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        result.errors.push(
          `Upsert batch error (offset ${i}): ${upsertError.message}`
        );
      } else {
        result.stationsUpserted += batch.length;
      }
    }

    console.log(
      `[NDBC-Direct] Discovered ${result.stationsDiscovered} stations, ` +
        `${result.stationsWithWaveType} wave-capable, ` +
        `${result.stationsLinkedToBeaches} near beaches, ` +
        `${result.stationsAlreadyInIOOS} already in IOOS`
    );
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? error.message
        : "Unknown error during station sync"
    );
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// ---------------------------------------------------------------------------
// Phase: observations (every 2h)
// ---------------------------------------------------------------------------

async function syncObservations(): Promise<ObservationSyncResult> {
  const startTime = Date.now();
  const result: ObservationSyncResult = {
    phase: "observations",
    stationsQueried: 0,
    stationsSynced: 0,
    stationsSkippedIOOS: 0,
    stationsFailed: 0,
    stationsSkippedTimeout: 0,
    observationsUpserted: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    const supabase = createSupabaseServiceRoleClient();

    // 1. Get active NDBC-direct stations with wave data
    // TODO: Remove `as any` once db:types is regenerated with ndbc_direct_* tables
    const { data: stations, error: stationsError } = (await (supabase as any)
      .from("ndbc_direct_stations")
      .select("station_id, ioos_station_id")
      .eq("active", true)
      .eq("has_wave_data", true)) as {
      data: Array<{ station_id: string; ioos_station_id: string | null }> | null;
      error: { message: string } | null;
    };

    if (stationsError) {
      result.errors.push(
        `Failed to fetch stations: ${stationsError.message}`
      );
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    if (!stations || stations.length === 0) {
      console.log("[NDBC-Direct] No active stations to sync");
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // 2. Dedup: skip stations that are active in IOOS
    const ioosLinkedIds = stations
      .filter((s) => s.ioos_station_id)
      .map((s) => s.ioos_station_id!);

    let activeIOOSIds = new Set<string>();
    if (ioosLinkedIds.length > 0) {
      const { data: activeIOOS } = await supabase
        .from("ioos_stations")
        .select("station_id")
        .in("station_id", ioosLinkedIds)
        .eq("active", true);

      activeIOOSIds = new Set(
        (activeIOOS || []).map((s) => s.station_id)
      );
    }

    const exclusiveStations = stations.filter((s) => {
      if (s.ioos_station_id && activeIOOSIds.has(s.ioos_station_id)) {
        result.stationsSkippedIOOS++;
        return false;
      }
      return true;
    });

    result.stationsQueried = exclusiveStations.length;
    console.log(
      `[NDBC-Direct] Syncing ${exclusiveStations.length} exclusive stations ` +
        `(skipped ${result.stationsSkippedIOOS} active in IOOS)`
    );

    // 3. Process in batches with politeness delay
    const BATCH_SIZE = 20;
    for (let i = 0; i < exclusiveStations.length; i += BATCH_SIZE) {
      // Time budget check
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        result.stationsSkippedTimeout = exclusiveStations.length - i;
        console.log(
          `[NDBC-Direct] Time budget exceeded, skipping ${result.stationsSkippedTimeout} stations`
        );
        break;
      }

      const batch = exclusiveStations.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (station) => {
          try {
            const observations = await fetchRecentNDBCObservations(
              station.station_id,
              24
            );
            return { stationId: station.station_id, observations };
          } catch (err) {
            console.error(
              `[NDBC-Direct] Error fetching ${station.station_id}:`,
              err
            );
            return { stationId: station.station_id, observations: [] };
          }
        })
      );

      // Process results from this batch
      const observationsToInsert: Array<{
        station_id: string;
        observed_at: string;
        wave_height_m: number | null;
        wave_period_s: number | null;
        wave_direction_deg: number | null;
        water_temp_c: number | null;
        wind_speed_ms: number | null;
        wind_direction_deg: number | null;
      }> = [];

      const successfulStationIds: string[] = [];

      for (const settled of batchResults) {
        if (settled.status === "rejected") {
          result.stationsFailed++;
          continue;
        }

        const { stationId, observations } = settled.value;

        if (observations.length === 0) {
          result.stationsFailed++;
          continue;
        }

        result.stationsSynced++;
        successfulStationIds.push(stationId);

        for (const obs of observations) {
          observationsToInsert.push({
            station_id: stationId,
            observed_at: obs.ts,
            wave_height_m: obs.wave_height_m,
            wave_period_s: obs.wave_period_s,
            wave_direction_deg: obs.wave_direction_deg,
            water_temp_c: obs.water_temp_c,
            wind_speed_ms: obs.wind_speed_ms,
            wind_direction_deg: obs.wind_direction_deg,
          });
        }
      }

      // Upsert observations (ignore duplicates via unique index)
      if (observationsToInsert.length > 0) {
        // TODO: Remove `as any` once db:types is regenerated with ndbc_direct_* tables
        const { error: insertError } = await (supabase as any)
          .from("ndbc_direct_observations")
          .upsert(observationsToInsert, {
            onConflict: "station_id,observed_at",
            ignoreDuplicates: true,
          });

        if (insertError) {
          result.errors.push(`Batch insert error: ${insertError.message}`);
        } else {
          result.observationsUpserted += observationsToInsert.length;
        }
      }

      // Update last_seen_at and has_wave_data for successful stations
      if (successfulStationIds.length > 0) {
        // TODO: Remove `as any` once db:types is regenerated with ndbc_direct_* tables
        await (supabase as any)
          .from("ndbc_direct_stations")
          .update({
            last_seen_at: new Date().toISOString(),
            has_wave_data: true,
          })
          .in("station_id", successfulStationIds);
      }

      // Politeness delay between batches
      if (i + BATCH_SIZE < exclusiveStations.length) {
        await delay(500);
      }
    }
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? error.message
        : "Unknown error during observation sync"
    );
  }

  // Refresh observable_beaches materialized view (same as ioos-sync)
  try {
    const refreshClient = createSupabaseServiceRoleClient();
    const { error: refreshError } = await (refreshClient as any).rpc(
      "refresh_observable_beaches"
    );
    if (refreshError) {
      result.errors.push(
        `Failed to refresh observable_beaches: ${refreshError.message}`
      );
    }
  } catch {
    result.errors.push("Failed to refresh observable_beaches: unknown error");
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
