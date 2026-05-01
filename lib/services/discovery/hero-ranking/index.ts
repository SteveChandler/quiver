/**
 * Hero re-rank — pure post-process layered on top of the 8-scorer engine.
 *
 * The discovery scoring engine produces a 0-100 `score` per beach by
 * combining wave/period/wind/tide/affinity. That score answers "how good
 * are conditions here?" — but not "is this beach the right venue for THIS
 * setup?" `rerankHero` adds the venue-vs-setup question:
 *
 *   1. compute `setupSuitability` (reuses wraparound-safe alignment + an
 *      exposure-vs-period dimension)
 *   2. compute window evidence (`persistence` from per-slot variance,
 *      `duration` from window length)
 *   3. compose a 0-100 `heroWindowScore` weighted across setup, engine
 *      score, tideFit, windQuality, persistence, duration
 *   4. lift the highest-scoring candidate to position 0 — preserve the
 *      original engine-score order for everything else (no nearby reorder)
 *
 * Pure: no logging, no side effects. The orchestrator owns logging via
 * `diagnostics.logHeroRankingDiagnostic`.
 */

import type { SurfDiscoveryRecommendation } from "@/types/personalization";

import type { HeroRankingDiagnostic } from "./diagnostics";
import { computeHeroWindowScore } from "./hero-window-score";
import { computeSetupSuitability } from "./setup-suitability";
import {
  deriveSharedSetupSignal,
  type SharedSetupSignal,
} from "./shared-setup-signal";
import { computeWindowPersistence } from "./window-evidence";

const NEUTRAL_SETUP_SUITABILITY = 50;
const TIDE_FIT_MAX = 15;
const WIND_ALIGNMENT_MAX = 20;

export interface RerankResult {
  /**
   * Hero-lifted candidates: `[0]` is the highest `heroWindowScore`; the
   * remaining slots preserve the input's engine-score order verbatim.
   */
  reranked: SurfDiscoveryRecommendation[];
  /** Diagnostic rows ordered identically to `reranked`. */
  diagnostics: HeroRankingDiagnostic[];
}

interface ComputedRec {
  rec: SurfDiscoveryRecommendation;
  setupSuitability: number;
  persistence: number;
  durationHours: number;
  heroScore: number;
}

/** Scales an engine subscore (0-`max`) into the 0-100 space the composer expects. */
function subscoreTo100(score: number, max: number): number {
  if (max <= 0 || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, (score / max) * 100));
}

/**
 * Computes window duration in hours from `rec.window.start`/`rec.window.end`.
 * Accepts both `Date` objects and ISO strings (JSON-roundtripped payloads).
 * Returns 0 when either bound is missing or unparseable.
 */
function windowDurationHours(rec: SurfDiscoveryRecommendation): number {
  const start = rec.window?.start;
  const end = rec.window?.end;
  if (start == null || end == null) return 0;
  const startMs = start instanceof Date ? start.getTime() : Date.parse(String(start));
  const endMs = end instanceof Date ? end.getTime() : Date.parse(String(end));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const hours = (endMs - startMs) / 3_600_000;
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

function computeOne(
  rec: SurfDiscoveryRecommendation,
  sharedSignal: SharedSetupSignal,
): ComputedRec {
  const setupSuitability = rec.spotProfile
    ? computeSetupSuitability(rec.spotProfile, sharedSignal)
    : NEUTRAL_SETUP_SUITABILITY;

  const slotScores =
    rec.windowSlotScores && rec.windowSlotScores.length > 0
      ? rec.windowSlotScores
      : [rec.score];
  const persistence = computeWindowPersistence(slotScores);

  const durationHours = windowDurationHours(rec);

  // tideFit subscore is 0-15; windAlignment is 0-20. Scale to 0-100 so the
  // weighted composer's terms are commensurable.
  const tideFitAcrossWindow = subscoreTo100(rec.subscores.tideFit, TIDE_FIT_MAX);
  const windQualityScore = subscoreTo100(
    rec.subscores.windAlignment,
    WIND_ALIGNMENT_MAX,
  );

  const heroScore = computeHeroWindowScore({
    representativeSlotScore: rec.score,
    setupSuitability,
    windowSlotScores: slotScores,
    windowDurationHours: durationHours,
    tideFitAcrossWindow,
    windQualityScore,
  });

  return { rec, setupSuitability, persistence, durationHours, heroScore };
}

function toDiagnostic(
  c: ComputedRec,
  finalRank: number,
  sharedSignal: SharedSetupSignal,
): HeroRankingDiagnostic {
  return {
    beachSlug: c.rec.beach.slug ?? "",
    representativeSlotScore: c.rec.score,
    setupSuitability: c.setupSuitability,
    windAlignment: c.rec.subscores.windAlignment,
    tideFit: c.rec.subscores.tideFit,
    waveHeightFit: c.rec.subscores.waveHeightFit,
    periodEnergyScore: c.rec.subscores.periodEnergyScore,
    affinityBonus: c.rec.subscores.affinityBonus,
    windowDurationHours: c.durationHours,
    windowPersistence: c.persistence,
    heroWindowScore: c.heroScore,
    finalRank,
    isHero: finalRank === 0,
    sharedSetupSignal: {
      directionDeg: sharedSignal.directionDeg,
      periodS: sharedSignal.periodS,
      source: sharedSignal.source,
    },
  };
}

/**
 * Hero-lift only: pick the highest `heroWindowScore` as the new hero,
 * lift to `[0]`, and preserve the input's order for the remainder.
 *
 * If the engine-sort hero already wins, returns the input array reference
 * (no copy) and emits diagnostics ordered identically.
 */
export function rerankHero(
  recs: SurfDiscoveryRecommendation[],
): RerankResult {
  if (recs.length === 0) return { reranked: [], diagnostics: [] };

  const sharedSignal = deriveSharedSetupSignal(recs);
  const computed = recs.map((rec) => computeOne(rec, sharedSignal));

  let heroIdx = 0;
  for (let i = 1; i < computed.length; i++) {
    if (computed[i].heroScore > computed[heroIdx].heroScore) {
      heroIdx = i;
    }
  }

  if (heroIdx === 0) {
    return {
      reranked: recs,
      diagnostics: computed.map((c, idx) => toDiagnostic(c, idx, sharedSignal)),
    };
  }

  const liftedComputed: ComputedRec[] = [
    computed[heroIdx],
    ...computed.slice(0, heroIdx),
    ...computed.slice(heroIdx + 1),
  ];

  return {
    reranked: liftedComputed.map((c) => c.rec),
    diagnostics: liftedComputed.map((c, idx) => toDiagnostic(c, idx, sharedSignal)),
  };
}

// Re-export so consumers can import everything from one entry point.
export type { HeroRankingDiagnostic } from "./diagnostics";
export { computeHeroWindowScore } from "./hero-window-score";
export type { HeroWindowScoreInput } from "./hero-window-score";
export {
  cardinalToDeg,
  deriveSharedSetupSignal,
} from "./shared-setup-signal";
export type { SharedSetupSignal } from "./shared-setup-signal";
export { computeWindowDurationScore, computeWindowPersistence } from "./window-evidence";
