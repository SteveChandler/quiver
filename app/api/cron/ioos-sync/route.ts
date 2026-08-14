import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { IOOSService } from "@/lib/services/ioos";
import {
  IOOS_STATION_FILTERS,
  IOOS_SYNC_CONFIG,
  IOOS_QUALITY_THRESHOLDS,
  IOOS_OBSERVATION_CONFIG,
  CanonicalVar,
} from "@/lib/constants/ioos-config";
import { EARTH_RADIUS_KM } from "@/lib/utils/geo-utils";
import { IOOSStation, IOOSObservation, PRIORITY_NETWORKS } from "@/types/ioos";
import { ParsedObservation } from "@/lib/services/ioos";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel hard limit (5min); internal limit is 4min with 20s safety margin

type SyncPhase = "stations" | "observations";

interface StationSyncResult {
  phase: "stations";
  stationsDiscovered: number;
  stationsUpserted: number;
  stationsLinkedToBeaches: number;
  errors: string[];
  duration_ms: number;
}

interface ObservationSyncResult {
  phase: "observations";
  stationsReactivated: number;
  stationsSynced: number;
  observationsInserted: number;
  stationsFailed: number;
  stationsSkipped: number;
  stationsDeactivated404: number;
  observableBeachesRefreshed: boolean;
  errors: string[];
  duration_ms: number;
}

/**
 * GET /api/cron/ioos-sync
 *
 * Cron job: syncs IOOS wave buoy data in two phases:
 *
 * 1. Station Discovery (weekly, Sundays at 5 AM UTC):
 *    - Fetches all IOOS datasets from ERDDAP API
 *    - Filters for wave-capable stations
 *    - Links stations to nearest beaches using PostGIS
 *    - Upserts into ioos_stations table
 *
 * 2. Observation Sync (every 2 hours):
 *    - Fetches latest observations for active stations
 *    - Validates data quality
 *    - Inserts into ioos_observations table
 *    - Updates station last_seen_at timestamp on successful data fetch
 *
 * Query params:
 * - phase: "stations" | "observations" (required)
 * - maxStations: Max stations to process (default: 500)
 * - batchSize: Stations per batch (default: 10)
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */
async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    // Parse query params
    const url = new URL(request.url);
    const phase = url.searchParams.get("phase") as SyncPhase | null;
    const maxStations = parseInt(url.searchParams.get("maxStations") || "500");
    const batchSize = parseInt(
      url.searchParams.get("batchSize") ||
        String(IOOS_STATION_FILTERS.observationBatchSize)
    );

    if (!phase || !["stations", "observations"].includes(phase)) {
      return createErrorResponse(
        "Invalid phase",
        'Query param "phase" must be "stations" or "observations"',
        400
      );
    }

    console.log(`🌊 Starting IOOS sync (phase=${phase})...`);

    if (phase === "stations") {
      const result = await withCronOutcome(
        {
          job: "/api/cron/ioos-sync?phase=stations",
          unit: "stations_synced",
          expectedMin: 1,
          getProduced: (value) => value.stationsUpserted,
        },
        () => syncStations(maxStations),
      );
      console.log("✅ IOOS station discovery complete:", result);
      return createSuccessResponse(result);
    } else {
      const result = await withCronOutcome(
        {
          job: "/api/cron/ioos-sync?phase=observations",
          unit: "observations_stored",
          expectedMin: 1,
          getProduced: (value) => value.observationsInserted,
        },
        () => syncObservations(maxStations, batchSize),
      );
      console.log("✅ IOOS observation sync complete:", result);
      return createSuccessResponse(result);
    }
  } catch (error) {
    console.error("❌ IOOS sync cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/ioos-sync", _GET);

/**
 * Station Discovery Phase
 * Discovers IOOS stations and links them to beaches
 */
async function syncStations(maxStations: number): Promise<StationSyncResult> {
  const startTime = Date.now();
  const result: StationSyncResult = {
    phase: "stations",
    stationsDiscovered: 0,
    stationsUpserted: 0,
    stationsLinkedToBeaches: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    const ioosService = new IOOSService();
    const supabase = createSupabaseServiceRoleClient();

    // Discover stations from IOOS ERDDAP
    console.log("📡 Discovering IOOS stations...");
    const discovery = await ioosService.discoverStations();

    if (discovery.errors.length > 0) {
      result.errors.push(...discovery.errors);
    }

    result.stationsDiscovered = discovery.totalFound;
    console.log(`Found ${discovery.totalFound} total stations, ${discovery.waveStationsFound} with wave data`);

    // Debug: Log network distribution
    const networkCounts = new Map<string, number>();
    const waveStations = discovery.stations.filter((s) => s.has_wave_data);
    for (const station of discovery.stations) {
      const count = networkCounts.get(station.source_network) || 0;
      networkCounts.set(station.source_network, count + 1);
    }
    console.log(`Network distribution:`, Object.fromEntries(networkCounts));
    console.log(`Wave-capable stations by network:`,
      Object.fromEntries(
        [...new Set(waveStations.map(s => s.source_network))].map(n =>
          [n, waveStations.filter(s => s.source_network === n).length]
        )
      )
    );

    // Filter to priority networks and wave-capable stations
    const priorityStations = discovery.stations
      .filter((s) => s.has_wave_data)
      .filter((s) => PRIORITY_NETWORKS.includes(s.source_network as any))
      .slice(0, maxStations);

    console.log(`Processing ${priorityStations.length} priority wave stations...`);

    // Get all beaches for proximity linking
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

    // Process stations in batches
    const stationsToUpsert: Partial<IOOSStation>[] = [];

    for (const station of priorityStations) {
      // Find nearest beach
      let nearestBeach: { id: string; distance: number } | null = null;

      for (const beach of beaches || []) {
        if (beach.lat == null || beach.lon == null) continue;
        const distance = calculateDistance(
          station.latitude,
          station.longitude,
          beach.lat,
          beach.lon
        );

        if (
          distance <= IOOS_STATION_FILTERS.maxDistanceFromBeachKm &&
          (!nearestBeach || distance < nearestBeach.distance)
        ) {
          nearestBeach = { id: beach.id, distance };
        }
      }

      if (nearestBeach) {
        stationsToUpsert.push({
          station_id: station.station_id,
          source_network: station.source_network,
          name: station.name,
          latitude: station.latitude,
          longitude: station.longitude,
          sensors: station.sensors,
          has_wave_data: station.has_wave_data,
          nearest_beach_id: nearestBeach.id,
          distance_to_beach_km: Math.round(nearestBeach.distance * 10) / 10,
          active: true,
          // Note: last_seen_at intentionally omitted — only updated by the
          // observation sync phase when valid data is returned. Including it here
          // would reset the freshness clock for dead stations every discovery cycle.
        });
        result.stationsLinkedToBeaches++;
      }
    }

    // Upsert stations to database
    if (stationsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("ioos_stations")
        .upsert(stationsToUpsert as any, {
          onConflict: "station_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        result.errors.push(`Failed to upsert stations: ${upsertError.message}`);
      } else {
        result.stationsUpserted = stationsToUpsert.length;
      }
    }

    // Safe deactivation with consecutive miss tracking
    const seenIds = stationsToUpsert
      .map((s) => s.station_id)
      .filter((id): id is string => typeof id === "string");

    if (seenIds.length > 0) {
      // Reset miss counter for stations we found
      const { error: resetError } = await supabase
        .from("ioos_stations")
        .update({ consecutive_discovery_misses: 0 })
        .in("station_id", seenIds);

      if (resetError) {
        result.errors.push(`Failed to reset miss counters: ${resetError.message}`);
      }

      // Safety cap: if discovery found <50% of active stations, skip deactivation
      // (ERDDAP catalog may be partially down; activeCount includes just-upserted stations by design)
      const { count: activeCount } = await supabase
        .from("ioos_stations")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      if (seenIds.length < (activeCount ?? 0) * 0.5) {
        console.warn(
          `[IOOS] Discovery found only ${seenIds.length}/${activeCount} active stations. Skipping deactivation to prevent mass-deactivation from incomplete ERDDAP results.`
        );
      } else {
        // Increment miss counter for stations NOT found
        // TODO: RPC function missing from DB types
        const { error: incrementError } = await (supabase as any).rpc(
          "increment_station_discovery_misses",
          { seen_ids: seenIds }
        );

        if (incrementError) {
          result.errors.push(`Failed to increment miss counters: ${incrementError.message}`);
          // Skip deactivation if increment failed — stale counters could cause incorrect deactivations
        } else {
          // Only deactivate stations with 3+ consecutive misses (reset counter on deactivation)
          const { error: deactivateError } = await supabase
            .from("ioos_stations")
            .update({ active: false, consecutive_discovery_misses: 0 })
            .gte("consecutive_discovery_misses", 3)
            .eq("active", true);

          if (deactivateError) {
            result.errors.push(`Failed to deactivate old stations: ${deactivateError.message}`);
          }
        }
      }
    }
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error during station sync"
    );
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

/**
 * Helper to refresh station capabilities from ERDDAP /info endpoint
 */
async function refreshStationCapabilities(
  ioosService: IOOSService,
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  stationIds: string[]
): Promise<number> {
  let refreshed = 0;

  for (const stationId of stationIds) {
    const caps = await ioosService.fetchStationVariables(stationId);
    if (caps) {
      const { error } = await supabase
        .from("ioos_stations")
        .update({
          available_variables: caps.availableVariables,
          variable_map: caps.variableMap,
          variables_last_synced_at: new Date().toISOString(),
        })
        .eq("station_id", stationId);

      if (!error) refreshed++;
    }
    // Small delay to avoid rate limiting
    await delay(100);
  }

  return refreshed;
}

/**
 * Observation Sync Phase
 * Fetches latest observations for active stations using dynamic URL building
 */
async function syncObservations(
  maxStations: number,
  batchSize: number
): Promise<ObservationSyncResult> {
  const startTime = Date.now();
  const maxRuntime = IOOS_SYNC_CONFIG.observationSyncMaxRuntimeMs;

  const result: ObservationSyncResult = {
    phase: "observations",
    stationsReactivated: 0,
    stationsSynced: 0,
    observationsInserted: 0,
    stationsFailed: 0,
    stationsSkipped: 0,
    stationsDeactivated404: 0,
    observableBeachesRefreshed: false,
    errors: [],
    duration_ms: 0,
  };

  try {
    const ioosService = new IOOSService();
    const supabase = createSupabaseServiceRoleClient();

    // Reactivate inactive stations that have recent observations.
    // This fixes the lifecycle bug where intermittent reporters (e.g., CDIP buoys
    // reporting every 2-6h) get deactivated by the stale check, but can never
    // accumulate fresh last_seen_at because the observation sync only processes
    // active stations.
    const MAX_REACTIVATIONS_PER_RUN = 25;
    let reactivatedIds: string[] = [];

    const reactivationThreshold = new Date();
    reactivationThreshold.setDate(
      reactivationThreshold.getDate() - IOOS_QUALITY_THRESHOLDS.stationInactiveDays
    );

    const { data: inactiveWithRecentData, error: reactivateCheckError } = await supabase
      .from("ioos_stations")
      .select("station_id")
      .eq("active", false)
      .eq("has_wave_data", true)
      .gt("last_seen_at", reactivationThreshold.toISOString());

    if (!reactivateCheckError && inactiveWithRecentData && inactiveWithRecentData.length > 0) {
      reactivatedIds = inactiveWithRecentData
        .map((s) => s.station_id)
        .slice(0, MAX_REACTIVATIONS_PER_RUN);

      if (inactiveWithRecentData.length > MAX_REACTIVATIONS_PER_RUN) {
        console.warn(
          `⚠️ ${inactiveWithRecentData.length} stations eligible for reactivation, capping at ${MAX_REACTIVATIONS_PER_RUN}`
        );
      }

      const { error: reactivateError } = await supabase
        .from("ioos_stations")
        .update({ active: true })
        .in("station_id", reactivatedIds);

      if (!reactivateError) {
        result.stationsReactivated = reactivatedIds.length;
        console.log(
          `♻️ Reactivated ${reactivatedIds.length} stations with recent data: ${reactivatedIds.join(", ")}`
        );
      } else {
        reactivatedIds = [];
        result.errors.push(
          `Failed to reactivate stations: ${reactivateError.message}`
        );
      }
    }

    // Get active stations with wave data, including variable_map
    const { data: stations, error: stationsError } = await supabase
      .from("ioos_stations")
      .select("station_id, source_network, name, variable_map, variables_last_synced_at")
      .eq("active", true)
      .eq("has_wave_data", true)
      .limit(maxStations);

    if (stationsError) {
      result.errors.push(`Failed to fetch stations: ${stationsError.message}`);
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    if (!stations || stations.length === 0) {
      console.log("No active IOOS stations to sync");
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Find stations needing variable refresh (missing or stale variable_map)
    const refreshThreshold = new Date(
      Date.now() - IOOS_OBSERVATION_CONFIG.variableRefreshDays * 24 * 3600_000
    ).toISOString();

    const stationsNeedingRefresh = stations
      .filter(s => !s.variables_last_synced_at || s.variables_last_synced_at < refreshThreshold)
      .map(s => s.station_id)
      .slice(0, 20); // Limit per run to avoid timeout

    if (stationsNeedingRefresh.length > 0) {
      console.log(`📡 Refreshing capabilities for ${stationsNeedingRefresh.length} stations...`);
      const refreshed = await refreshStationCapabilities(ioosService, supabase, stationsNeedingRefresh);
      console.log(`✅ Refreshed ${refreshed} station capabilities`);

      // Re-fetch stations to get updated variable_map
      const { data: updatedStations } = await supabase
        .from("ioos_stations")
        .select("station_id, source_network, name, variable_map, variables_last_synced_at")
        .eq("active", true)
        .eq("has_wave_data", true)
        .limit(maxStations);

      if (updatedStations) {
        stations.length = 0;
        stations.push(...updatedStations);
      }
    }

    console.log(`📊 Syncing observations for ${stations.length} active stations...`);

    // Process in batches
    for (let i = 0; i < stations.length; i += batchSize) {
      // Check runtime limit
      if (Date.now() - startTime > maxRuntime) {
        console.log(`⏱️ Reached max runtime (${maxRuntime}ms), stopping early`);
        result.stationsSkipped = stations.length - i;
        break;
      }

      const batch = stations.slice(i, i + batchSize);

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stations.length / batchSize)}...`);

      // Fetch observations for batch using dynamic URLs
      const batchResults: Array<{ stationId: string; obs: ParsedObservation | null }> = [];

      // Fetch observations in parallel within each batch
      const promises = batch.map(async (station) => {
        const variableMap = (station.variable_map || {}) as Partial<Record<CanonicalVar, string>>;

        // Skip stations without variable_map (will be refreshed next run)
        if (!variableMap.wave_height) {
          return { stationId: station.station_id, obs: null, skipped: true };
        }

        const obs = await ioosService.fetchObservationDynamic(station.station_id, variableMap);
        return { stationId: station.station_id, obs, skipped: false };
      });

      const settled = await Promise.allSettled(promises);
      for (const r of settled) {
        if (r.status === "fulfilled") {
          if (r.value.skipped) {
            result.stationsSkipped++;
          }
          batchResults.push(r.value);
        } else {
          result.stationsFailed++;
        }
      }

      // Prepare observations for insert
      const observationsToInsert: Partial<IOOSObservation>[] = [];

      for (const { stationId, obs } of batchResults) {
        if (obs && obs.waveHeightM !== null) {
          observationsToInsert.push({
            station_id: stationId,
            observed_at: obs.observedAt,
            wave_height_m: obs.waveHeightM,
            wave_period_s: obs.wavePeriodS,
            wave_direction_deg: obs.waveDirectionDeg,
            water_temp_c: obs.waterTempC,
            wind_speed_ms: obs.windSpeedMS,
            wind_direction_deg: obs.windDirectionDeg,
            raw_data: obs.raw,
          });
          result.stationsSynced++;
        } else {
          result.stationsFailed++;
        }
      }

      // Insert observations (ignore duplicates)
      if (observationsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("ioos_observations")
          .upsert(observationsToInsert as any, {
            onConflict: "station_id,observed_at",
            ignoreDuplicates: true,
          });

        if (insertError) {
          result.errors.push(`Batch insert error: ${insertError.message}`);
        } else {
          result.observationsInserted += observationsToInsert.length;
        }
      }

      // Update last_seen_at only for stations with valid wave data
      const successfulIds = batchResults
        .filter(r => r.obs !== null && r.obs.waveHeightM !== null)
        .map(r => r.stationId);

      if (successfulIds.length > 0) {
        await supabase
          .from("ioos_stations")
          .update({ last_seen_at: new Date().toISOString() })
          .in("station_id", successfulIds);
      }

      // Small delay between batches
      if (i + batchSize < stations.length) {
        await delay(200);
      }
    }

    // Mark stations that returned "Unrecognized variable" as not having wave data
    // This cleans up stations that were incorrectly identified during discovery
    const stationsWithoutWaveData = ioosService.getStationsWithoutWaveData();
    if (stationsWithoutWaveData.length > 0) {
      console.log(`📝 Marking ${stationsWithoutWaveData.length} stations as has_wave_data=false`);

      const { error: noWaveError } = await supabase
        .from("ioos_stations")
        .update({ has_wave_data: false })
        .in("station_id", stationsWithoutWaveData);

      if (noWaveError) {
        result.errors.push(`Failed to update no-wave stations: ${noWaveError.message}`);
      }
    }

    // Deactivate stations that returned 404 (no longer exist on ERDDAP)
    const stationsReturning404 = ioosService.getStationsReturning404();
    if (stationsReturning404.length > 0) {
      const totalAttempted = result.stationsSynced + result.stationsFailed;
      const ratio404 = totalAttempted > 0 ? stationsReturning404.length / totalAttempted : 0;

      if (ratio404 > 0.5) {
        // >50% returning 404 likely indicates ERDDAP outage, not actual station removal
        console.warn(
          `[IOOS] ${stationsReturning404.length}/${totalAttempted} stations returned 404 (${(ratio404 * 100).toFixed(0)}%). ` +
          `Skipping deactivation — likely ERDDAP outage.`
        );
      } else {
        console.log(`📝 Deactivating ${stationsReturning404.length} stations that returned 404`);

        const { error: deactivate404Error } = await supabase
          .from("ioos_stations")
          .update({ active: false })
          .in("station_id", stationsReturning404);

        if (deactivate404Error) {
          result.errors.push(`Failed to deactivate 404 stations: ${deactivate404Error.message}`);
        } else {
          result.stationsDeactivated404 = stationsReturning404.length;
        }
      }
    }

    // Mark stations as inactive if no data for stationInactiveDays (14 days).
    // Exclude just-reactivated stations so they get a fair chance to report data
    // before being re-deactivated (their first ERDDAP fetch may fail transiently).
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - IOOS_QUALITY_THRESHOLDS.stationInactiveDays);

    let staleQuery = supabase
      .from("ioos_stations")
      .update({ active: false })
      .lt("last_seen_at", staleThreshold.toISOString())
      .eq("active", true);

    if (reactivatedIds.length > 0) {
      staleQuery = staleQuery.not(
        "station_id",
        "in",
        `(${reactivatedIds.join(",")})`
      );
    }

    const { error: staleError } = await staleQuery;

    if (staleError) {
      result.errors.push(`Failed to mark stale stations: ${staleError.message}`);
    }

    // Refresh observable_beaches materialized view so ML health metrics stay current
    // TODO: RPC function missing from DB types
    const { error: refreshError } = await (supabase as any).rpc("refresh_observable_beaches");
    if (refreshError) {
      result.errors.push(`Failed to refresh observable_beaches: ${refreshError.message}`);
    } else {
      result.observableBeachesRefreshed = true;
      console.log("✅ Refreshed observable_beaches materialized view");
    }
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error during observation sync"
    );
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = EARTH_RADIUS_KM;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
