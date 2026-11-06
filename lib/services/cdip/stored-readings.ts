/**
 * Stored buoy readings for a calibrated beach's own station, used when the live
 * ERDDAP fetch fails or lags. ioos_observations is filled from ERDDAP every 2 h;
 * ndbc_direct_observations is the same buoy via NDBC every ~30 min, so it keeps
 * working when ERDDAP itself is down.
 */
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createContextLogger } from "@/lib/logger";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import { getStationConfig } from "@/lib/constants/cdip-stations";
import type { CDIPBuoyData, CDIPDataResponse } from "@/types/forecast";
import { normalizeStationIdForErddap, transformToCDIPBuoyData } from "./data-parser";
import { normalizeCdipStationId } from "./calibration-station";

const log = createContextLogger("CDIPStoredReadings");

const MAX_ROWS_PER_SOURCE = 24;

interface StoredRow {
  observed_at: string;
  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
}

export function ioosStationIdForCdip(stationId: string): string | null {
  const bare = normalizeCdipStationId(stationId);
  return bare ? `edu_ucsd_cdip_${normalizeStationIdForErddap(bare)}` : null;
}

/** Newest reading time in a buoy series, or null. */
export function latestReadingMs(data: CDIPBuoyData | null | undefined): number | null {
  let latest: number | null = null;
  for (const point of data?.data ?? []) {
    const ms = Date.parse(point.timestamp);
    if (Number.isFinite(ms) && (latest === null || ms > latest)) latest = ms;
  }
  return latest;
}

/**
 * Stored readings for `stationId` newer than `maxAgeHours`, parsed by the same
 * validator as live ERDDAP rows. Null when the station is not in the station
 * table, has no stored readings in the window, or the query fails.
 */
export async function fetchStoredCDIPBuoyData(
  stationId: string,
  maxAgeHours: number,
  nowMs: number = Date.now(),
): Promise<CDIPBuoyData | null> {
  const config = getStationConfig(stationId);
  const ioosId = ioosStationIdForCdip(stationId);
  if (!config || !ioosId) return null;

  const cutoff = new Date(nowMs - maxAgeHours * 3_600_000).toISOString();
  const columns = "observed_at, wave_height_m, wave_period_s, wave_direction_deg";

  try {
    const supabase = await createSupabaseServiceRoleClient();
    const queries = [
      supabase
        .from("ioos_observations")
        .select(columns)
        .eq("station_id", ioosId)
        .gte("observed_at", cutoff)
        .not("wave_height_m", "is", null)
        .order("observed_at", { ascending: false })
        .limit(MAX_ROWS_PER_SOURCE),
      ...(config.ndbcTwinId
        ? [
            supabase
              .from("ndbc_direct_observations")
              .select(columns)
              .eq("station_id", config.ndbcTwinId)
              .gte("observed_at", cutoff)
              .not("wave_height_m", "is", null)
              .order("observed_at", { ascending: false })
              .limit(MAX_ROWS_PER_SOURCE),
          ]
        : []),
    ];
    const results = await Promise.all(queries);

    const byTime = new Map<string, StoredRow>();
    for (const { data, error } of results) {
      if (error) {
        log.warn(`Stored buoy readings query failed for ${stationId}: ${error.message}`);
        continue;
      }
      for (const row of (data ?? []) as StoredRow[]) {
        const key = new Date(row.observed_at).toISOString();
        if (!byTime.has(key)) byTime.set(key, row);
      }
    }
    if (byTime.size === 0) return null;

    const raw: CDIPDataResponse = {
      parameter: "wave_height",
      sensorId: stationId,
      units: "feet",
      dataGaps: [],
      data: [...byTime.entries()]
        .sort(([a], [b]) => Date.parse(b) - Date.parse(a))
        .map(([timestamp, row]) => [
          timestamp,
          (row.wave_height_m ?? 0) * METERS_TO_FEET,
          row.wave_period_s ?? 0,
          row.wave_direction_deg ?? 0,
        ] as [string, number, number, number]),
      metadata: {
        station_name: config.name,
        location: { latitude: config.latitude, longitude: config.longitude },
      },
    };

    const parsed = transformToCDIPBuoyData(stationId, raw);
    return parsed ? { ...parsed, readingSource: "stored" } : null;
  } catch (error) {
    log.warn(`Stored buoy readings unavailable for ${stationId}`, error);
    return null;
  }
}
