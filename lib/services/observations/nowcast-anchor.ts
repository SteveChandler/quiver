import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LatestObservation, NowcastAnchor } from "./nowcast-anchor.types";
import { STALENESS_THRESHOLDS } from "@/lib/config/forecast-staleness";

const DEFAULT_MAX_AGE_HOURS = STALENESS_THRESHOLDS.NOWCAST_ANCHOR;
const LOG_PREFIX = "[nowcast-anchor]";

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

type ReportScope = "run" | "request";

type FetchOptions = {
  maxAgeHours?: number;
  beachId?: string;
  /**
   * "run" (a cron that reads anchors once per run) reports every failure.
   * "request" (the default; request paths) reports at most once per process
   * per REQUEST_REPORT_WINDOW_MS, so an RPC outage is not one event per request.
   */
  reportScope?: ReportScope;
};

export const REQUEST_REPORT_WINDOW_MS = 5 * 60 * 1000;

let lastRequestReportAt: number | null = null;
let suppressedRequestReports = 0;

/** Test hook: forget the request-scope report window. */
export function resetNowcastAnchorReportWindow(): void {
  lastRequestReportAt = null;
  suppressedRequestReports = 0;
}

function reportAnchorFailure(error: unknown, failure: "rpc_error" | "throw", scope: ReportScope): void {
  let suppressed = 0;
  if (scope === "request") {
    const now = Date.now();
    if (lastRequestReportAt !== null && now - lastRequestReportAt < REQUEST_REPORT_WINDOW_MS) {
      suppressedRequestReports += 1;
      return;
    }
    lastRequestReportAt = now;
    suppressed = suppressedRequestReports;
    suppressedRequestReports = 0;
  }
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
      nowcast_anchor_scope: scope,
    },
    ...(scope === "request" ? { extra: { suppressed_since_last_report: suppressed } } : {}),
  });
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
 * Failures are logged and reported to Sentry (see `reportScope`), then fall
 * through to an empty map — a broken observation pipeline must never halt the
 * forecast build cron. Downstream callers check
 * `map.get(beachId)` truthiness and fall through on miss.
 */
export async function fetchNowcastAnchors(
  supabase: SupabaseClient,
  options: FetchOptions = {},
): Promise<Map<string, NowcastAnchor>> {
  const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;
  const scope = options.reportScope ?? "request";

  try {
    const query = supabase.rpc("get_nowcast_anchors", {
      max_age_hours: maxAgeHours,
    });
    const { data, error } = await (options.beachId !== undefined
      ? query.eq("beach_id", options.beachId)
      : query);

    if (error) {
      console.warn(`${LOG_PREFIX} RPC error, falling through to forecast-only`, error);
      reportAnchorFailure(error, "rpc_error", scope);
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
    reportAnchorFailure(err, "throw", scope);
    return new Map();
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
