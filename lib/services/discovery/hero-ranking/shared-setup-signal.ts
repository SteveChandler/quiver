/**
 * Shared setup signal — cluster-wide swell narrative for `setupSuitability`.
 *
 * Why: real production forecasts diverge per beach (e.g., 2026-05-01: OB
 * sees 6s WNW only because Point Loma blocks south swell; PB and Crystal see
 * 13s SW + 7s WNW combo). Comparing each beach's "I'm a great venue for MY
 * local swell" inside one ranking pass is a category error — every beach
 * scores well against its own forecast. The shared signal answers ONE
 * question for the whole cluster: "what is the regional incoming setup,
 * and which beach is the best venue for IT?" Per-beach forecasts are still
 * used for realized-condition refinement (representative slot, wind, tide,
 * persistence, duration) — only the setup-suitability axis is shared.
 *
 * Selection rule (locked):
 *   1. From every candidate, extract its PRIMARY swell component:
 *      `swell_1_*`, falling back to `wave_*` only when `swell_1_*` is
 *      absent. Period is parsed via `parseFloat` ("13s" → 13). Direction
 *      prefers numeric `_om` siblings; falls back to a 16-point compass
 *      mapping. `swell_2_*` is intentionally NOT considered — including a
 *      small long-period background as a candidate would let it hijack
 *      the shared signal away from the dominant primary pulse.
 *   2. Pick the candidate with the largest primary period across the
 *      cluster. Tiebreak (within 0.5s): highest height. Tiebreak (within
 *      0.1ft): first encountered (deterministic, input-order stable).
 *   3. `source = "cluster-majority"` if 2+ recs' primaries are within
 *      ±1.0s of the chosen period; else `"fallback"`.
 *   4. Empty cluster OR no parseable primaries: returns the null/null
 *      fallback signal — `computeSetupSuitability` then yields
 *      NEUTRAL_FALLBACK 50.
 *
 * Why primary-only across the cluster (not best-of-all-components within a
 * single rec): the divergent case (today's bug) is exactly the case where
 * one beach is geometrically blocked from the long-period train, so its
 * `swell_1` is the short-period local pulse, while neighboring beaches see
 * the long-period train AS their primary. Aggregating per-rec primaries
 * picks up that divergence cleanly. Considering swell_2 within a single
 * rec would also break the unified-cluster baseline (e.g., a 1ft 12s SW
 * background behind a 3ft 7s W primary should NOT flip the shared signal).
 */

import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import type { EnhancedForecastEntity } from "@/types/forecast";

export interface SharedSetupSignal {
  directionDeg: number | null;
  periodS: number | null;
  heightFt: number | null;
  source: "cluster-majority" | "fallback";
}

const COMPASS: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

/**
 * 16-point compass cardinal → degrees. Case-insensitive, trim-tolerant.
 * Returns null for unknown strings, empty input, null, or undefined.
 */
export function cardinalToDeg(s: string | null | undefined): number | null {
  if (typeof s !== "string") return null;
  const k = s.trim().toUpperCase();
  if (k.length === 0) return null;
  return Object.prototype.hasOwnProperty.call(COMPASS, k) ? COMPASS[k] : null;
}

/**
 * Parse a numeric value from a forecast field that may be a string ("13s",
 * "2 ft", "270") or a number. Returns null when neither parse path yields
 * a finite number.
 */
function parseNumeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number.parseFloat(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

interface SwellComponent {
  periodS: number;
  directionDeg: number;
  heightFt: number;
}

/**
 * Extract a single swell-component triple from a forecast row using the
 * supplied period/direction/height/numeric-direction-fallback fields.
 * Returns null if either period or direction can't be resolved.
 */
function readComponent(
  forecast: EnhancedForecastEntity,
  periodKey: keyof EnhancedForecastEntity,
  directionKey: keyof EnhancedForecastEntity,
  heightKey: keyof EnhancedForecastEntity,
  omDirectionKey: keyof EnhancedForecastEntity | null,
): SwellComponent | null {
  const periodS = parseNumeric(forecast[periodKey]);
  if (periodS === null) return null;

  // Direction: prefer numeric _om sibling, then numeric primary, then cardinal.
  let directionDeg: number | null = null;
  if (omDirectionKey) {
    directionDeg = parseNumeric(forecast[omDirectionKey]);
  }
  if (directionDeg === null) {
    const raw = forecast[directionKey];
    directionDeg = parseNumeric(raw);
    if (directionDeg === null) {
      directionDeg = cardinalToDeg(typeof raw === "string" ? raw : null);
    }
  }
  if (directionDeg === null) return null;

  const heightFt = parseNumeric(forecast[heightKey]) ?? 0;
  return { periodS, directionDeg, heightFt };
}

/**
 * Pull the PRIMARY swell component from a single rec's forecast. We prefer
 * `swell_1_*` (the partition the upstream model recognized as dominant for
 * this beach's geometry). Falls back to `wave_*` only when `swell_1_*` is
 * absent. We deliberately do NOT consider `swell_2_*` here — including it
 * would let a small long-period background train (e.g., 1ft 12s SW behind
 * a 3ft 7s W pulse) hijack the shared signal away from the actual pulse
 * driving conditions. The cluster-aggregation step (`deriveSharedSetupSignal`)
 * picks the longest-period primary across recs, which catches the divergent
 * case where one beach is geometrically blocked from the long-period train
 * (its `swell_1` is 6s WNW) while the others see it as primary (13s SW).
 */
function extractPrimaryComponent(
  forecast: EnhancedForecastEntity,
): SwellComponent | null {
  const s1 = readComponent(
    forecast,
    "swell_1_period",
    "swell_1_direction",
    "swell_1_height",
    // No `_om` sibling specifically for swell_1; `swell_direction_om` is the
    // best available numeric proxy for primary swell direction.
    "swell_direction_om",
  );
  if (s1) return s1;

  // Fallback: overall wave_* fields when swell_1 is missing.
  return readComponent(
    forecast,
    "wave_period",
    "wave_direction",
    "wave_height",
    "wave_direction_om",
  );
}

const PERIOD_TIE_TOLERANCE_S = 0.5;
const HEIGHT_TIE_TOLERANCE_FT = 0.1;
const MAJORITY_PERIOD_TOLERANCE_S = 1.0;

/**
 * Derive the cluster-shared setup signal from a list of candidate
 * recommendations. See module docstring for the full selection rule.
 */
export function deriveSharedSetupSignal(
  recs: SurfDiscoveryRecommendation[],
): SharedSetupSignal {
  if (!recs || recs.length === 0) {
    return { directionDeg: null, periodS: null, heightFt: null, source: "fallback" };
  }

  // Per-rec PRIMARY component (swell_1 with wave_* fallback). We aggregate
  // across recs — never within a single rec — so a small swell_2 background
  // can't hijack the shared signal away from the dominant primary pulse.
  const perRec: Array<SwellComponent | null> = recs.map((r) =>
    r.forecast ? extractPrimaryComponent(r.forecast) : null,
  );

  let chosen: SwellComponent | null = null;
  for (const comp of perRec) {
    if (comp === null) continue;
    if (chosen === null) {
      chosen = comp;
      continue;
    }
    const dPeriod = comp.periodS - chosen.periodS;
    if (dPeriod > PERIOD_TIE_TOLERANCE_S) {
      chosen = comp;
    } else if (Math.abs(dPeriod) <= PERIOD_TIE_TOLERANCE_S) {
      const dHeight = comp.heightFt - chosen.heightFt;
      if (dHeight > HEIGHT_TIE_TOLERANCE_FT) {
        chosen = comp;
      }
      // else: within 0.1ft tolerance → first encountered wins
    }
  }

  if (chosen === null) {
    return { directionDeg: null, periodS: null, heightFt: null, source: "fallback" };
  }

  // Majority check: count how many DISTINCT recs see a primary within ±1.0s
  // of the chosen period.
  let supporters = 0;
  for (const comp of perRec) {
    if (comp === null) continue;
    if (Math.abs(comp.periodS - chosen.periodS) <= MAJORITY_PERIOD_TOLERANCE_S) {
      supporters++;
    }
  }

  return {
    directionDeg: chosen.directionDeg,
    periodS: chosen.periodS,
    heightFt: chosen.heightFt,
    source: supporters >= 2 ? "cluster-majority" : "fallback",
  };
}
