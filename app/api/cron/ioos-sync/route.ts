import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { IOOSService } from "@/lib/services/ioos-service";
import {
  IOOS_STATION_FILTERS,
  IOOS_SYNC_CONFIG,
  IOOS_QUALITY_THRESHOLDS,
} from "@/lib/constants/ioos-config";
import { IOOSStation, IOOSObservation, PRIORITY_NETWORKS } from "@/types/ioos";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow up to 5 minutes for full sync

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
  stationsSynced: number;
  observationsInserted: number;
  stationsFailed: number;
  stationsSkipped: number;
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
 *    - Updates station last_seen_at timestamp
 *
 * Query params:
 * - phase: "stations" | "observations" (required)
 * - maxStations: Max stations to process (default: 500)
 * - batchSize: Stations per batch (default: 10)
 *
 * Auth:
 * - Vercel Cron header (`x-vercel-cron`)
 * - OR Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
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
      const result = await syncStations(maxStations);
      console.log("✅ IOOS station discovery complete:", result);
      return createSuccessResponse(result);
    } else {
      const result = await syncObservations(maxStations, batchSize);
      console.log("✅ IOOS observation sync complete:", result);
      return createSuccessResponse(result);
    }
  } catch (error) {
    console.error("❌ IOOS sync cron error:", error);
    return handleApiError(error);
  }
}

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
          last_seen_at: new Date().toISOString(),
        });
        result.stationsLinkedToBeaches++;
      }
    }

    // Upsert stations to database
    if (stationsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("ioos_stations")
        .upsert(stationsToUpsert, {
          onConflict: "station_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        result.errors.push(`Failed to upsert stations: ${upsertError.message}`);
      } else {
        result.stationsUpserted = stationsToUpsert.length;
      }
    }

    // Mark stations not seen in this discovery as inactive
    const seenIds = stationsToUpsert.map((s) => s.station_id);
    if (seenIds.length > 0) {
      // Note: Supabase not.in filter expects unquoted comma-separated values
      const { error: deactivateError } = await supabase
        .from("ioos_stations")
        .update({ active: false })
        .not("station_id", "in", `(${seenIds.join(",")})`);

      if (deactivateError) {
        result.errors.push(`Failed to deactivate old stations: ${deactivateError.message}`);
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
 * Observation Sync Phase
 * Fetches latest observations for active stations
 */
async function syncObservations(
  maxStations: number,
  batchSize: number
): Promise<ObservationSyncResult> {
  const startTime = Date.now();
  const maxRuntime = IOOS_SYNC_CONFIG.observationSyncMaxRuntimeMs;

  const result: ObservationSyncResult = {
    phase: "observations",
    stationsSynced: 0,
    observationsInserted: 0,
    stationsFailed: 0,
    stationsSkipped: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    const ioosService = new IOOSService();
    const supabase = createSupabaseServiceRoleClient();

    // Get active stations with wave data
    const { data: stations, error: stationsError } = await supabase
      .from("ioos_stations")
      .select("station_id, source_network, name")
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
      const stationIds = batch.map((s) => s.station_id);

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stations.length / batchSize)}...`);

      // Fetch observations for batch
      const observations = await ioosService.fetchBatch(stationIds, batchSize);

      // Prepare observations for insert
      const observationsToInsert: Partial<IOOSObservation>[] = [];

      for (const [stationId, obs] of observations.entries()) {
        // Validate observation has meaningful data
        if (obs.wave_height_m !== null || obs.wave_period_s !== null) {
          observationsToInsert.push({
            station_id: stationId,
            observed_at: obs.observed_at,
            wave_height_m: obs.wave_height_m,
            wave_period_s: obs.wave_period_s,
            wave_direction_deg: obs.wave_direction_deg,
            water_temp_c: obs.water_temp_c,
            wind_speed_ms: obs.wind_speed_ms,
            wind_direction_deg: obs.wind_direction_deg,
            raw_data: obs.raw_data,
          });
          result.stationsSynced++;
        }
      }

      // Track failures
      result.stationsFailed += stationIds.length - observations.size;

      // Insert observations (ignore duplicates)
      if (observationsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("ioos_observations")
          .upsert(observationsToInsert, {
            onConflict: "station_id,observed_at",
            ignoreDuplicates: true,
          });

        if (insertError) {
          result.errors.push(`Batch insert error: ${insertError.message}`);
        } else {
          result.observationsInserted += observationsToInsert.length;
        }
      }

      // Update last_seen_at for successful stations
      const successfulIds = Array.from(observations.keys());
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

    // Mark stations as inactive if no data for 7+ days
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - IOOS_QUALITY_THRESHOLDS.stationInactiveDays);

    const { error: staleError } = await supabase
      .from("ioos_stations")
      .update({ active: false })
      .lt("last_seen_at", staleThreshold.toISOString())
      .eq("active", true);

    if (staleError) {
      result.errors.push(`Failed to mark stale stations: ${staleError.message}`);
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
  const R = 6371; // Earth's radius in km
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
