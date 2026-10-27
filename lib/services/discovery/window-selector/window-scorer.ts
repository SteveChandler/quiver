/**
 * Window Scorer
 *
 * Functions for scoring forecast windows based on conditions and user preferences.
 *
 * @module lib/services/discovery/window-selector/window-scorer
 */

import type { Beach } from "@/types/database";
import type { BeachWithThresholds } from "@/lib/scoring/types";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { CompositeScore } from "@/lib/domains/scoring";
import type { BoardClass, RideabilityBand } from "@/lib/domains/rideability";
import type { SkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { beachToSpotProfile, forecastToSnapshot } from "@/lib/domains/scoring";
import {
  resolveNativeSkillLevel,
  scoreNativeConditionBreakdown,
  scoreNativeConditionInputs,
  nativeScoreInputsFromForecast,
  type NativeConditionScoreBreakdown,
} from "@/lib/scoring/native-condition-score";
import { resolveTideBand, type TideBand } from "@/lib/domains/scoring/tide-swing";
import { isTideSwingEnabled } from "@/lib/flags/tide-swing";
import { getRideabilityBand } from "@/lib/domains/rideability";
import { getDirectionDegrees } from "./direction-utils";
import { resolveWindOrientation } from "@/lib/domains/shared/wind-orientation";
import { getDiscoveryScoringEngine } from "@/lib/domains/scoring";
import { isDirectionScoringEnabledForBeach } from "@/lib/flags/direction-scoring";
import { windChopCeiling } from "@/lib/domains/scoring/wind-chop-ceiling";
import type { NativeDirectionScoreInput } from "@/lib/scoring/native-condition-score";

const SELECTOR_IDEAL_RIDEABILITY_BONUS = 4;
const SELECTOR_ACCEPTABLE_RIDEABILITY_BONUS = 1;
const SELECTOR_OUT_OF_BAND_PENALTY_PER_FOOT = 5;
const SELECTOR_OUT_OF_BAND_PENALTY_CAP = 12;

/**
 * Score a forecast window using the native-compatible condition score.
 *
 * Uses the same scoring system as display, ensuring consistency between
 * window selection and UI.
 *
 * @param forecast - Forecast entity to score
 * @param beach - Beach metadata
 * @returns Score from 0-100
 */
interface WindowConditionScoreDetails {
  score: number;
  boardClass: BoardClass | null;
  rideabilityBand: RideabilityBand | null;
  decisionCeiling: number;
  components: NativeConditionScoreBreakdown["components"];
  appliedEffects: string[];
}

/** Resolve the same domain decision ceiling for every native-compatible score path. */
function decisionEffectDetails(
  forecast: EnhancedForecastEntity,
  beach: Beach,
): { ceiling: number; effects: string[] } {
  const composite = scoreWindowWithComposite(forecast, beach);
  const effects = composite.effects ?? [];
  const ceiling = effects.reduce(
    (current, effect) => Math.min(current, effect.verdictCeiling ?? 100),
    100,
  );
  if (isDirectionScoringEnabledForBeach(beach)) {
    const chop = windChopCeiling(
      {
        profile: beachToSpotProfile(beach),
        snapshot: forecastToSnapshot(forecast),
        window: null,
        preferences: null,
      },
      composite.subscores,
      { ignoreWindQuality: true },
    );
    if (chop && chop.ceiling < ceiling) {
      return { ceiling: chop.ceiling, effects: [...effects.map((effect) => effect.code), 'wind_chop'] };
    }
  }

  return { ceiling, effects: effects.map((effect) => effect.code) };
}

export function directionInput(
  forecast: EnhancedForecastEntity,
  beach: BeachWithThresholds,
  directionScoringEnabledOverride?: boolean,
): NativeDirectionScoreInput | undefined {
  if (!(directionScoringEnabledOverride ?? isDirectionScoringEnabledForBeach(beach))) return undefined;
  const orientation = resolveWindOrientation(beach);
  return {
    windDirectionDeg: getDirectionDegrees(
      forecast.wind_direction_deg,
      forecast.wind_direction,
    ),
    swellDirectionDeg: getDirectionDegrees(
      forecast.swell_1_direction ?? forecast.wave_direction,
      null,
    ),
    offshoreDeg: orientation.offshoreDeg,
    offshoreToleranceDeg: orientation.toleranceDeg,
    windowCenterDeg: beach.swell_window_center_deg ?? null,
    windowHalfwidthDeg: beach.swell_window_halfwidth_deg ?? null,
  };
}

function isFullBeach(beach: BeachWithThresholds): beach is Beach {
  return (
    Object.prototype.hasOwnProperty.call(beach, "break_type") &&
    Object.prototype.hasOwnProperty.call(beach, "aspect_deg")
  );
}

/** The beach's curated tide band for the displayed tide term; same rule as the engine's explicitRange. */
function displayTideBand(beach: BeachWithThresholds): TideBand | null {
  if (!isTideSwingEnabled()) return null;
  const { preferred_tide_ft_min: minHeightFt, preferred_tide_ft_max: maxHeightFt } = beach;
  if (minHeightFt == null || maxHeightFt == null) return null;
  return resolveTideBand({ minHeightFt, maxHeightFt, explicitRange: true });
}

/**
 * Scores the best saved board, but never below the no-board baseline. A null
 * boardClass means no saved board improved the displayed score.
 */
export function scoreWindowConditionDetails(
  forecast: EnhancedForecastEntity,
  beach: BeachWithThresholds,
  skillLevel?: SkillLevel | string | null,
  rideabilityBand?: RideabilityBand | null,
  boardClasses?: readonly BoardClass[] | null,
): WindowConditionScoreDetails {
  const resolvedSkillLevel = resolveNativeSkillLevel(
    skillLevel,
    "intermediate",
  );
  const uniqueBoardClasses = Array.from(new Set(boardClasses ?? []));
  const effectDetails = isFullBeach(beach)
    ? decisionEffectDetails(forecast, beach)
    : { ceiling: 100, effects: [] };
  const { ceiling } = effectDetails;
  const applyCeiling = (score: number): number => Math.min(score, ceiling);
  const appliedEffects = (score: number): string[] =>
    score > ceiling ? effectDetails.effects : [];
  const direction = directionInput(forecast, beach);
  const inputs = nativeScoreInputsFromForecast(forecast, displayTideBand(beach));
  const baselineScore = scoreNativeConditionInputs(inputs, resolvedSkillLevel, null, direction);

  if (uniqueBoardClasses.length === 0) {
    const score = rideabilityBand
      ? Math.max(
          baselineScore,
          scoreNativeConditionInputs(
            inputs,
            resolvedSkillLevel,
            rideabilityBand,
            direction,
          ),
        )
      : baselineScore;
    return {
      score: applyCeiling(score),
      boardClass: null,
      rideabilityBand: rideabilityBand ?? null,
      decisionCeiling: ceiling,
      components: scoreNativeConditionBreakdown(inputs, resolvedSkillLevel, null, direction).components,
      appliedEffects: appliedEffects(score),
    };
  }

  let best: WindowConditionScoreDetails = {
    score: applyCeiling(baselineScore),
    boardClass: null,
    rideabilityBand: null,
    decisionCeiling: ceiling,
    components: scoreNativeConditionBreakdown(inputs, resolvedSkillLevel, null, direction).components,
    appliedEffects: appliedEffects(baselineScore),
  };
  for (const boardClass of uniqueBoardClasses) {
    const boardBand = getRideabilityBand(resolvedSkillLevel, boardClass);
    const rawScore = scoreNativeConditionInputs(inputs, resolvedSkillLevel, boardBand, direction);
    const score = applyCeiling(rawScore);
    if (score > best.score) {
      best = {
        score,
        boardClass,
        rideabilityBand: boardBand,
        decisionCeiling: ceiling,
        components: scoreNativeConditionBreakdown(
          inputs,
          resolvedSkillLevel,
          boardClass,
          direction,
        ).components,
        appliedEffects: appliedEffects(rawScore),
      };
    }
  }

  return best;
}

export function scoreWindowConditionScore(
  forecast: EnhancedForecastEntity,
  beach: BeachWithThresholds,
  skillLevel?: SkillLevel | string | null,
  rideabilityBand?: RideabilityBand | null,
  boardClasses?: readonly BoardClass[] | null,
): number {
  return scoreWindowConditionDetails(
    forecast,
    beach,
    skillLevel,
    rideabilityBand,
    boardClasses,
  ).score;
}

/**
 * Score a forecast window for selector ranking, with a small board-aware
 * rideability nudge.
 */
export function scoreWindowForSelection(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  rideabilityBand: RideabilityBand | null = null,
  skillLevel?: SkillLevel | string | null,
  boardClasses?: readonly BoardClass[] | null,
): number {
  const details = scoreWindowConditionDetails(
    forecast,
    beach,
    skillLevel,
    rideabilityBand,
    boardClasses,
  );
  const baseScore = details.score;
  const adjustmentBand = details.rideabilityBand;
  if (!adjustmentBand) {
    return baseScore;
  }

  return clampSelectionScore(
    Math.min(
      baseScore + getRideabilitySelectionAdjustment(forecast, adjustmentBand),
      details.decisionCeiling,
    ),
  );
}

/**
 * Score a forecast window with the domain engine and return the composite
 * result for downstream explanation/confidence builders.
 */
export function scoreWindowWithComposite(
  forecast: EnhancedForecastEntity,
  beach: Beach,
): CompositeScore {
  const engine = getDiscoveryScoringEngine();
  const profile = beachToSpotProfile(beach);
  const snapshot = forecastToSnapshot(forecast);

  return engine.score({
    profile,
    snapshot,
    window: null,
    preferences: null,
  });
}

function getRideabilitySelectionAdjustment(
  forecast: EnhancedForecastEntity,
  rideabilityBand: RideabilityBand,
): number {
  const waveHeight = parseFloat(forecast.wave_height || "0");
  if (!Number.isFinite(waveHeight) || waveHeight <= 0) {
    return 0;
  }

  if (
    waveHeight >= rideabilityBand.ideal.min &&
    waveHeight <= rideabilityBand.ideal.max
  ) {
    return SELECTOR_IDEAL_RIDEABILITY_BONUS;
  }

  if (waveHeight < rideabilityBand.acceptable.min) {
    const under = rideabilityBand.acceptable.min - waveHeight;
    return -Math.min(
      SELECTOR_OUT_OF_BAND_PENALTY_CAP,
      Math.round(under * SELECTOR_OUT_OF_BAND_PENALTY_PER_FOOT),
    );
  }

  if (waveHeight > rideabilityBand.acceptable.max) {
    const over = waveHeight - rideabilityBand.acceptable.max;
    return -Math.min(
      SELECTOR_OUT_OF_BAND_PENALTY_CAP,
      Math.round(over * SELECTOR_OUT_OF_BAND_PENALTY_PER_FOOT),
    );
  }

  return SELECTOR_ACCEPTABLE_RIDEABILITY_BONUS;
}

function clampSelectionScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
