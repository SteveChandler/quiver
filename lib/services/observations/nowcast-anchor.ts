import type { SupabaseClient } from "@supabase/supabase-js";
import type { NowcastAnchor } from "./nowcast-anchor.types";

const DEFAULT_MAX_AGE_HOURS = 6;
const LOG_PREFIX = "[nowcast-anchor]";

type FetchOptions = {
  maxAgeHours?: number;
};

type RpcRow = {
  beach_id: string;
  station_id: string;
  observed_at: string;
  wave_height_m: number | string;
  wave_period_s: number | string | null;
  wave_direction_deg: number | string | null;
};

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Fetch the latest buoy observation per observable beach via the
 * `get_nowcast_anchors` RPC (see migration 20260419150000).
 *
 * Returns a Map keyed by beach_id so callers can do O(1) lookup while
 * iterating ~300 beaches in the forecast builder. Beaches without a
 * recent observation are absent from the map (caller treats missing
 * as "no anchor, forecast-only path").
 *
 * Failures are logged and swallowed — a broken observation pipeline
 * must never halt the forecast build cron. Downstream callers check
 * `map.get(beachId)` truthiness and fall through on miss.
 */
export async function fetchNowcastAnchors(
  supabase: SupabaseClient,
  options: FetchOptions = {},
): Promise<Map<string, NowcastAnchor>> {
  const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;

  try {
    const { data, error } = await supabase.rpc("get_nowcast_anchors", {
      max_age_hours: maxAgeHours,
    });

    if (error) {
      console.warn(`${LOG_PREFIX} RPC error, falling through to forecast-only`, error);
      return new Map();
    }

    const rows: RpcRow[] = (data as RpcRow[] | null) ?? [];
    const map = new Map<string, NowcastAnchor>();
    for (const r of rows) {
      const waveHeightM = toNumberOrNull(r.wave_height_m);
      if (waveHeightM === null) continue; // RPC already filters nulls but defend anyway
      map.set(r.beach_id, {
        beachId: r.beach_id,
        stationId: r.station_id,
        observedAt: r.observed_at,
        waveHeightM,
        wavePeriodS: toNumberOrNull(r.wave_period_s),
        waveDirectionDeg: toNumberOrNull(r.wave_direction_deg),
      });
    }
    return map;
  } catch (err) {
    console.warn(`${LOG_PREFIX} unexpected failure, falling through to forecast-only`, err);
    return new Map();
  }
}
