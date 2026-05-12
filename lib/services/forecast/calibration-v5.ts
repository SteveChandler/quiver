/**
 * v5 shadow calibration reader and inference helper.
 *
 * Phase 2 of the v5 shadow program: load the active ml_calibration_versions
 * row at log time and compute v5_shadow_height_m alongside the production
 * display height. v5 is NOT served — only logged into ml_predictions_log
 * so the comparator (current displayed vs raw OM vs v5) becomes available
 * once enough paired-with-observation rows accumulate.
 *
 * v5.1 shadow spec (locked 2026-05-11 by post-refit gate):
 *   v5.1 = f(wave_height_om) + g(direction_bucket), except NW uses f(om)
 *          only because the NW directional adjustment regressed post-refit.
 *   Guardrail: when (direction_bucket=W, om_bucket=0.5-1.0m), pass through
 *              raw OM (skip g entirely for that cell only).
 *
 * Audit references:
 *   seaside/reports/v5_shadow_walk_forward_2026-05-02.md
 *   seaside/reports/om_per_direction_calibration_2026-05-02.md
 *
 * Critical invariants:
 * 1. NEVER throws to the caller. computeV5Shadow returns null on any error
 *    or missing input; logDisplayPredictions writes null in that case.
 * 2. Active calibration is cached in-process for 1 hour. Refit cron runs
 *    weekly; 1h cache adds at most 1h delay before a new fit takes effect.
 * 3. Bucket strings are exact and stable: see DIRECTION_BUCKETS / OM_BUCKETS.
 *    Storage column comments in the migration must match.
 */

import { createServiceRoleClient } from "@/lib/supabase";
import { createContextLogger } from "@/lib/logger";

const log = createContextLogger("CalibrationV5");

export type DirectionBucket = "S/SW" | "W" | "NW" | "OTHER";
export type OmBucket = "<0.5m" | "0.5-1.0m" | "1.0-1.5m" | "1.5m+";

type Knot = { om_anchor: number; obs: number; n: number };
type Knots = Record<OmBucket, Knot>;
type GDir = Record<DirectionBucket, { g: number; n: number }>;
type Guardrails = {
  passthrough_cells?: Array<{
    direction_bucket: DirectionBucket;
    om_bucket: OmBucket;
  }>;
};

export type CalibrationVersion = {
  version: string;
  knots: Knots;
  g_dir: GDir;
  guardrails: Guardrails | null;
};

const OM_BUCKET_ORDER: OmBucket[] = [
  "<0.5m",
  "0.5-1.0m",
  "1.0-1.5m",
  "1.5m+",
];

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const V51_FORMULA_ID = "v5_1_no_nw_g";

let cachedVersion: CalibrationVersion | null = null;
let cachedAt = 0;
let cacheLoadInFlight: Promise<CalibrationVersion | null> | null = null;
let warnedNoActiveVersion = false;
let warnedMissingServiceRoleKey = false;
let warnedMalformedRow = false;

/**
 * Bucket OM predicted height in meters into the v5 OM bucket strings.
 * Boundaries are exclusive on the upper edge: <0.5 / [0.5,1.0) / [1.0,1.5) / 1.5+.
 */
export function bucketOm(omM: number | null | undefined): OmBucket | null {
  if (omM == null || !Number.isFinite(omM)) return null;
  if (omM < 0.5) return "<0.5m";
  if (omM < 1.0) return "0.5-1.0m";
  if (omM < 1.5) return "1.0-1.5m";
  return "1.5m+";
}

/**
 * Bucket primary swell direction in degrees (0–360) into the v5 direction
 * bucket strings. Matches the boundaries used in the calibration audits:
 *   S/SW: 170–240, W: 250–280, NW: 280–340, OTHER: everything else (incl null).
 * Note: 240–250 falls into OTHER (matches audit code, not a typo).
 */
export function bucketDirection(
  dirDeg: number | null | undefined
): DirectionBucket {
  if (dirDeg == null || !Number.isFinite(dirDeg)) return "OTHER";
  const d = ((dirDeg % 360) + 360) % 360;
  if (d >= 170 && d < 240) return "S/SW";
  if (d >= 250 && d < 280) return "W";
  if (d >= 280 && d < 340) return "NW";
  return "OTHER";
}

/**
 * Saturating piecewise-linear interpolation across 4 (om_anchor, obs) anchors.
 * Below the smallest anchor: return the smallest obs. Above the largest:
 * return obs + (om - max_anchor) (slope = 1, since the walk-forward audit's
 * 1.5m+ residual fits a unit-slope tail).
 */
function interpolateF(omM: number, knots: Knots | undefined | null): number {
  if (!knots || typeof knots !== "object") return omM;
  const points = OM_BUCKET_ORDER.map((b) => knots[b])
    .filter(
      (k): k is Knot =>
        k != null &&
        typeof k === "object" &&
        typeof (k as Knot).om_anchor === "number" &&
        typeof (k as Knot).obs === "number"
    )
    .sort((a, b) => a.om_anchor - b.om_anchor);

  if (points.length === 0) return omM;
  if (omM <= points[0].om_anchor) return points[0].obs;

  const last = points[points.length - 1];
  if (omM >= last.om_anchor) {
    return last.obs + (omM - last.om_anchor);
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (omM >= a.om_anchor && omM <= b.om_anchor) {
      const t = (omM - a.om_anchor) / (b.om_anchor - a.om_anchor);
      return a.obs + t * (b.obs - a.obs);
    }
  }
  return last.obs;
}

function isPassthroughCell(
  guardrails: Guardrails | null,
  dirBucket: DirectionBucket,
  omBucket: OmBucket
): boolean {
  const cells = guardrails?.passthrough_cells;
  if (!cells || cells.length === 0) return false;
  return cells.some(
    (c) => c.direction_bucket === dirBucket && c.om_bucket === omBucket
  );
}

function shadowModelVersion(calibrationVersion: string): string {
  const suffix = calibrationVersion.startsWith("v5_c.")
    ? calibrationVersion.slice("v5_c.".length)
    : calibrationVersion;
  return `${V51_FORMULA_ID}.${suffix}`;
}

export type V5ShadowResult = {
  v5_shadow_height_m: number;
  v5_model_version: string;
  direction_bucket: DirectionBucket;
  om_bucket: OmBucket;
};

/**
 * Validate that a calibration row has the minimum shape needed for inference.
 * A row that came back malformed (truncated select, mocked fetch in tests,
 * partial JSONB) is treated as no-calibration rather than letting the bad
 * shape reach the inference math.
 */
function isValidCalibration(row: unknown): row is CalibrationVersion {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  if (typeof r.version !== "string") return false;
  if (!r.knots || typeof r.knots !== "object") return false;
  if (!r.g_dir || typeof r.g_dir !== "object") return false;
  // At least one usable knot — otherwise interpolateF would just echo OM and
  // the row would silently produce a degenerate v5 = OM + g.
  const k = r.knots as Record<string, unknown>;
  const anyUsableKnot = OM_BUCKET_ORDER.some((b) => {
    const knot = k[b] as Knot | undefined;
    return (
      knot != null &&
      typeof knot === "object" &&
      typeof knot.om_anchor === "number" &&
      typeof knot.obs === "number"
    );
  });
  return anyUsableKnot;
}

/**
 * Compute the v5 shadow height for one prediction. Returns null when the
 * inputs are insufficient (no OM height) or no active calibration is loaded.
 *
 * INVARIANT: this function NEVER throws to the caller. Any unexpected error
 * is swallowed and returned as null, with a one-time warn. This is the v5
 * shadow logging path; failures must never destabilize the production
 * display-snapshot batch insert.
 */
export function computeV5Shadow(params: {
  wave_height_om_m: number | null | undefined;
  primary_swell_direction_deg: number | null | undefined;
  calibration: CalibrationVersion | null;
}): V5ShadowResult | null {
  try {
    return computeV5ShadowImpl(params);
  } catch (err) {
    if (!warnedV5ComputeError) {
      warnedV5ComputeError = true;
      log.warn("computeV5Shadow: unexpected error (v5 shadow disabled)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }
}

let warnedV5ComputeError = false;

function computeV5ShadowImpl(params: {
  wave_height_om_m: number | null | undefined;
  primary_swell_direction_deg: number | null | undefined;
  calibration: CalibrationVersion | null;
}): V5ShadowResult | null {
  const { wave_height_om_m, primary_swell_direction_deg, calibration } = params;

  if (
    wave_height_om_m == null ||
    !Number.isFinite(wave_height_om_m) ||
    !calibration ||
    !isValidCalibration(calibration)
  ) {
    return null;
  }

  const omBucket = bucketOm(wave_height_om_m);
  if (!omBucket) return null;

  const dirBucket = bucketDirection(primary_swell_direction_deg);
  const v5ModelVersion = shadowModelVersion(calibration.version);

  // NUMERIC(5,3) on ml_predictions_log.v5_shadow_height_m caps at 99.999m;
  // clamp defensively. The unit-slope tail of f at unrealistic OM (e.g. 100m)
  // could otherwise overflow on insert and roll back the snapshot batch.
  const clamp = (v: number): number => Math.min(Math.max(v, 0), 99.999);

  // Guardrail: pass through raw OM in the W × 0.5-1.0m cell (failed
  // walk-forward promotion at +0.0545m MAE; isolated to that cell).
  if (isPassthroughCell(calibration.guardrails, dirBucket, omBucket)) {
    return {
      v5_shadow_height_m: Number(clamp(wave_height_om_m).toFixed(3)),
      v5_model_version: v5ModelVersion,
      direction_bucket: dirBucket,
      om_bucket: omBucket,
    };
  }

  const fOm = interpolateF(wave_height_om_m, calibration.knots);
  const gEntry =
    calibration.g_dir && typeof calibration.g_dir === "object"
      ? calibration.g_dir[dirBucket]
      : undefined;
  const gDir =
    dirBucket !== "NW" &&
    gEntry &&
    typeof gEntry === "object" &&
    typeof gEntry.g === "number"
      ? gEntry.g
      : 0;
  const v5 = clamp(fOm + gDir);

  return {
    v5_shadow_height_m: Number(v5.toFixed(3)),
    v5_model_version: v5ModelVersion,
    direction_bucket: dirBucket,
    om_bucket: omBucket,
  };
}

/**
 * Load the currently active calibration version, with in-process caching.
 * Returns null on any error or when no active row exists. Cache is shared
 * across concurrent callers (single-flight load).
 */
export async function getActiveCalibration(): Promise<CalibrationVersion | null> {
  const now = Date.now();
  if (cachedVersion && now - cachedAt < CACHE_TTL_MS) {
    return cachedVersion;
  }

  if (cacheLoadInFlight) {
    return cacheLoadInFlight;
  }

  // Env-gate: missing service-role key → short-circuit with one warn.
  // createServiceRoleClient() throws when SUPABASE_SERVICE_ROLE_KEY is unset;
  // catching here would still produce a per-cache-miss warn forever in any
  // env without the key (Vercel preview without secrets, local dev).
  const hasServiceRoleKey =
    !!(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() &&
    !!(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!hasServiceRoleKey) {
    if (!warnedMissingServiceRoleKey) {
      warnedMissingServiceRoleKey = true;
      log.warn(
        "getActiveCalibration: SUPABASE_SERVICE_ROLE_KEY not configured; v5 shadow disabled"
      );
    }
    return null;
  }

  cacheLoadInFlight = (async () => {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("ml_calibration_versions" as never)
        .select("version, knots, g_dir, guardrails")
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        log.warn("getActiveCalibration: query failed", {
          error: error.message,
          code: error.code,
        });
        return cachedVersion; // serve stale on error
      }

      if (!data) {
        if (!warnedNoActiveVersion) {
          warnedNoActiveVersion = true;
          log.warn(
            "getActiveCalibration: no active calibration version (v5 shadow will be NULL)"
          );
        }
        return null;
      }

      if (!isValidCalibration(data)) {
        if (!warnedMalformedRow) {
          warnedMalformedRow = true;
          log.warn(
            "getActiveCalibration: active row is malformed (missing version/knots/g_dir); v5 shadow disabled"
          );
        }
        return cachedVersion; // serve stale on shape mismatch
      }

      cachedVersion = data;
      cachedAt = Date.now();
      warnedNoActiveVersion = false;
      warnedMalformedRow = false;
      return data;
    } catch (err) {
      log.warn("getActiveCalibration: unexpected error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return cachedVersion;
    } finally {
      cacheLoadInFlight = null;
    }
  })();

  return cacheLoadInFlight;
}

/**
 * Test-only: clear the in-process cache. Not exported from a barrel; tests
 * import directly.
 */
export function __resetCalibrationCacheForTests(): void {
  cachedVersion = null;
  cachedAt = 0;
  cacheLoadInFlight = null;
  warnedNoActiveVersion = false;
  warnedMissingServiceRoleKey = false;
  warnedMalformedRow = false;
  warnedV5ComputeError = false;
}
