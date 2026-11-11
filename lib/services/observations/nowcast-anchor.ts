import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LatestObservation, NowcastAnchor } from "./nowcast-anchor.types";
import { STALENESS_THRESHOLDS } from "@/lib/config/forecast-staleness";

const DEFAULT_MAX_AGE_HOURS = STALENESS_THRESHOLDS.NOWCAST_ANCHOR;
const LOG_PREFIX = "[nowcast-anchor]";

type FetchOptions = {
  maxAgeHours?: number;
  beachId?: string;
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
 * Failures are logged and reported to Sentry, then fall through to an
 * empty map — a broken observation pipeline must never halt the forecast
 * build cron. Downstream callers check
 * `map.get(beachId)` truthiness and fall through on miss.
 */
export async function fetchNowcastAnchors(
  supabase: SupabaseClient,
  options: FetchOptions = {},
): Promise<Map<string, NowcastAnchor>> {
  return (await fetchNowcastAnchorsWithStatus(supabase, options)).anchors;
}

interface NowcastAnchorsFetch {
  anchors: Map<string, NowcastAnchor>;
  /** True when the RPC failed, so the empty map means "unknown", not "no fresh observations". */
  unavailable: boolean;
}

function reportAnchorFailure(error: unknown, failure: "rpc_error" | "throw", options: FetchOptions): void {
  try {
    const message =
      error instanceof Error
        ? error.message
        : typeof (error as { message?: unknown })?.message === "string"
          ? (error as { message: string }).message
          : String(error);
    Sentry.captureException(error instanceof Error ? error : new Error(message), {
      level: "warning",
      tags: {
        component: "nowcast-anchor",
        nowcast_anchor_failure: failure,
        nowcast_anchor_scope: options.beachId === undefined ? "batch" : "single_beach",
      },
    });
  } catch {
    // Error capture is best effort and must never change the forecast-only fallback.
  }
}

/**
 * Same lookup as fetchNowcastAnchors, plus whether the RPC failed. The forecast
 * cron uses the flag to report a degraded (forecast-only) build.
 */
export async function fetchNowcastAnchorsWithStatus(
  supabase: SupabaseClient,
  options: FetchOptions = {},
): Promise<NowcastAnchorsFetch> {
  const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;

  try {
    const query = supabase.rpc("get_nowcast_anchors", {
      max_age_hours: maxAgeHours,
    });
    const { data, error } = await (options.beachId !== undefined
      ? query.eq("beach_id", options.beachId)
      : query);

    if (error) {
      console.warn(`${LOG_PREFIX} RPC error, falling through to forecast-only`, error);
      reportAnchorFailure(error, "rpc_error", options);
      return { anchors: new Map(), unavailable: true };
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
    return { anchors: map, unavailable: false };
  } catch (err) {
    console.warn(`${LOG_PREFIX} unexpected failure, falling through to forecast-only`, err);
    reportAnchorFailure(err, "throw", options);
    return { anchors: new Map(), unavailable: true };
  }
}

/**
 * Fetch the latest buoy observation for a single beach, for the display-side
 * "live channel" UI on the beach detail page. Returns null when no station
 * resolves, no fresh observation exists, or the RPC fails.
 *
 * Reuses `get_nowcast_anchors` to keep one source of truth for what counts
 * as a fresh observation. The map-style fetcher is overkill for single-beach
 * reads on the request path, hence this thin wrapper.
 */
export async function fetchLatestObservation(
  supabase: SupabaseClient,
  beachId: string,
  options: FetchOptions = {},
): Promise<LatestObservation | null> {
  const map = await fetchNowcastAnchors(supabase, { ...options, beachId });
  const anchor = map.get(beachId);
  if (!anchor) return null;
  return {
    stationId: anchor.stationId,
    observedAt: anchor.observedAt,
    waveHeightM: anchor.waveHeightM,
    wavePeriodS: anchor.wavePeriodS,
    waveDirectionDeg: anchor.waveDirectionDeg,
  };
}
