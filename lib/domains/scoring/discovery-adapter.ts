/**
 * Discovery Adapter
 *
 * Bridges the new domain-driven scoring engine with the existing
 * surf-discovery-service. Maintains backwards compatibility while
 * using the new pluggable scoring architecture.
 *
 * This adapter:
 * 1. Converts Beach + EnhancedForecastEntity to ScorerInput
 * 2. Runs the new scoring engine
 * 3. Converts CompositeScore back to DetailedScore format
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { DetailedScore } from '@/types/personalization';
import type { ScorerInput, CompositeScore } from './types';
import { getDirectionDegrees } from '@/lib/utils/number-parsing';
import { trackFallback } from '@/lib/monitoring/fallback-tracker';
import { resolveConfidence } from '@/lib/monitoring/fallback-helpers';
import type { SpotProfile } from '../spot-profile/types';
import type { ConditionsSnapshot, ConditionsWindow } from '../conditions/types';
import type { UserPreferences } from '../user-preferences/types';
import type { SkillLevel } from '../user-preferences/skill-level';
import { getSkillLevelOrDefault, parseSkillLevel, SKILL_WAVE_RANGES as SKILL_WAVE_RANGES_SOURCE } from '../user-preferences/skill-level';
import type { SkillWaveRanges } from '../user-preferences/skill-level';
import { getRideabilityBand, type BoardClass } from '../rideability';
import { createSpotProfile } from '../spot-profile';
import { createSwellComponent, pickDominantSwell } from '../conditions';
import type { SwellPartition, SwellPartitions } from '../conditions';
import {
  ScoringEngine,
  baseConditionsScorer,
  swellAlignmentScorer,
  swellInterferenceScorer,
  windQualityScorer,
  tideFitScorer,
  tideDirectionScorer,
  setupRiskScorer,
  windowStabilityScorer,
  trendPreferenceScorer,
} from './index';

/**
 * Create a pre-configured scoring engine with all standard scorers.
 */
export function createDiscoveryScoringEngine(): ScoringEngine {
  const engine = new ScoringEngine();
  return engine.registerAll([
    baseConditionsScorer,
    swellAlignmentScorer,
    swellInterferenceScorer,
    windQualityScorer,
    tideFitScorer,
    tideDirectionScorer,
    setupRiskScorer,
    windowStabilityScorer,
    trendPreferenceScorer,
  ]);
}

/**
 * Convert Beach database row to SpotProfile.
 */
export function beachToSpotProfile(beach: Beach): SpotProfile {
  return createSpotProfile(beach);
}

/**
 * Convert EnhancedForecastEntity to ConditionsSnapshot.
 *
 * Snapshot semantics: `primarySwell`, `waveDirection`, and `wavePeriod` all
 * describe the **dominant** wave train (tallest partition, longer-period
 * tiebreak when within 20% — see `pickDominantSwell`). Reading `swell_1_*`
 * directly here would let `primarySwell` and `wavePeriod` disagree on
 * mixed-swell or windswell-dominant days, since `forecast.wave_period` and
 * `forecast.wave_direction` are written by `forecast-builder.ts` using the
 * same dominant picker.
 *
 * Direction-only scorers (`swellAlignment`, `swellInterference`) consume
 * `primarySwell.periodS`/`directionDeg`; those fields must reflect the
 * dominant component or the period-relevance gates fire on the wrong train.
 */
export function forecastToSnapshot(forecast: EnhancedForecastEntity): ConditionsSnapshot {
  const waveHeight = parseFloat(forecast.wave_height || '0');
  const storedWavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');

  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const windDirection = getDirectionDegrees(
    forecast.wind_direction_deg,
    forecast.wind_direction
  );

  const tideHeight = parseFloat(forecast.tide_height || '0') || 0;
  const tideStatus = parseTideStatus(forecast.tide_status);
  const tideDirection = parseTideDirection(forecast.tide_status);

  const partitions: SwellPartitions = {
    swell_1: parsePartition(forecast.swell_1_height, forecast.swell_1_period, forecast.swell_1_direction),
    swell_2: parsePartition(forecast.swell_2_height, forecast.swell_2_period, forecast.swell_2_direction),
    wind_wave: parsePartition(forecast.wind_wave_height, forecast.wind_wave_period, forecast.wind_wave_direction),
  };

  const dominant = pickDominantSwell(partitions);
  const primarySwell = dominant ? toSwellComponent(dominant) : null;
  const wavePeriod = dominant ? dominant.period : storedWavePeriod;
  const waveDirection = dominant ? dominant.direction : null;

  // `secondarySwell` carries the next-most-energetic non-dominant *swell*
  // train (swell_1 or swell_2 only) so the interference scorer keeps its
  // swell-vs-swell focus. Wind sea is exposed separately via `windWave` so
  // future scorers can reason about it without being forced through the
  // existing two-swell interference path.
  const swellOnlyCandidates: SwellPartition[] = [];
  if (dominant?.source !== 'swell_1' && partitions.swell_1) swellOnlyCandidates.push(partitions.swell_1);
  if (dominant?.source !== 'swell_2' && partitions.swell_2) swellOnlyCandidates.push(partitions.swell_2);
  const secondarySwellPart = swellOnlyCandidates
    .sort((a, b) => energy(b) - energy(a))[0];
  const secondarySwell = secondarySwellPart ? toSwellComponent(secondarySwellPart) : null;

  // `windWave` is populated only when wind_wave is a distinct partition that
  // isn't already represented as the dominant. When wind_wave IS dominant,
  // primarySwell already carries it and re-exposing it here would
  // double-count.
  const windWavePartition = partitions.wind_wave;
  const windWave = windWavePartition && dominant?.source !== 'wind_wave'
    ? toSwellComponent(windWavePartition)
    : null;

  return {
    timestamp: new Date(forecast.forecast_at),
    waveHeight,
    wavePeriod,
    waveDirection,
    primarySwell,
    secondarySwell,
    windWave,
    wind: {
      speedMph: windSpeed,
      directionDeg: windDirection,
    },
    tide: {
      heightFt: tideHeight,
      status: tideStatus,
      direction: tideDirection,
    },
    confidence: resolveConfidence(forecast.confidence_score, 'discovery'),
    dataSource: forecast.data_source || 'unknown',
  };
}

/**
 * Parse a single NOAA partition row into the numeric shape `pickDominantSwell`
 * expects. Returns `null` when height, period, OR direction is missing.
 *
 * Direction is required (not defaulted to W) because a partition without a
 * known direction can't be scored geometrically; fabricating one would feed
 * the alignment / interference scorers a phantom W swell rather than letting
 * them fall through to their neutral path. NOAA always pairs height/period
 * with direction in real data, so the only rows this rejects are malformed.
 */
function parsePartition(
  height: string | null | undefined,
  period: string | null | undefined,
  direction: string | number | null | undefined
): SwellPartition | null {
  if (!height || !period) return null;
  const h = parseFloat(height);
  const p = parseFloat(typeof period === 'string' ? period.replace('s', '') : String(period));
  if (!Number.isFinite(h) || !Number.isFinite(p) || h <= 0 || p <= 0) return null;
  // `getDirectionDegrees` handles both numeric ("280") and cardinal ("WNW")
  // strings; null result means the field was unparseable.
  const cardinal = typeof direction === 'string' ? direction : null;
  const d = getDirectionDegrees(direction ?? null, cardinal);
  if (d == null) return null;
  return { height: h, period: p, direction: d };
}

function toSwellComponent(p: SwellPartition) {
  return createSwellComponent(p.height, p.period, p.direction);
}

function energy(p: SwellPartition): number {
  return p.height * p.height * p.period;
}

/**
 * Convert CompositeScore to DetailedScore format for backwards compatibility.
 */
export function compositeToDetailedScore(
  composite: CompositeScore,
  affinityBonus: number = 0,
  distancePenalty: number = 0
): DetailedScore {
  // Only track missing subscores for non-skip results.
  // Skip results are disqualified beaches where subscores are intentionally
  // absent for scorers that did not run (early exit by design).
  if (!composite.skipReason) {
    for (const key of ['baseConditions', 'windQuality', 'tideFit'] as const) {
      if (!composite.subscores.has(key)) trackFallback({ domain: 'discovery', field: `subscore_${key}`, fallbackValue: 50 });
    }
  }

  // Map subscores to legacy format
  const subscores = {
    waveHeightFit: Math.round((composite.subscores.get('baseConditions') ?? 50) * 0.25),
    periodEnergyScore: Math.round((composite.subscores.get('baseConditions') ?? 50) * 0.20),
    windAlignment: Math.round((composite.subscores.get('windQuality') ?? 50) * 0.20),
    tideFit: Math.round((composite.subscores.get('tideFit') ?? 50) * 0.15),
    affinityBonus,
    personalizationBonus: 0,
    distancePenalty,
  };

  // Adjust total with affinity and distance
  const adjustedTotal = Math.max(
    0,
    Math.min(100, composite.total + affinityBonus + distancePenalty)
  );

  // Map match quality
  const matchQuality = composite.matchQuality === 'skip' ? 'fair' : composite.matchQuality;

  return {
    total: adjustedTotal,
    subscores,
    matchQuality,
    reasons: [...composite.reasons].slice(0, 5),
    warnings: [...composite.warnings],
    effects: [...(composite.effects ?? [])],
    conditionBadges: [], // Will be generated separately if needed
  };
}

/**
 * Options for discovery scoring.
 */
export interface DiscoveryScoringOptions {
  window?: ConditionsWindow | null;
  preferences?: UserPreferences | null;
  affinityBonus?: number;
  distancePenalty?: number;
  /** User's experience/skill level */
  userSkillLevel?: SkillLevel | null;
  /** Beach's static skill level from database */
  beachSkillLevel?: string | null;
}

/**
 * Score a beach for discovery using the new scoring engine.
 *
 * This function provides the same interface as the old scoreBeachForDiscovery
 * but uses the new domain-driven scoring architecture.
 */
export function scoreBeachWithEngine(
  engine: ScoringEngine,
  beach: Beach,
  forecast: EnhancedForecastEntity,
  options?: DiscoveryScoringOptions
): DetailedScore {
  const profile = beachToSpotProfile(beach);
  const snapshot = forecastToSnapshot(forecast);

  const input: ScorerInput = {
    profile,
    snapshot,
    window: options?.window ?? null,
    preferences: options?.preferences ?? null,
  };

  const composite = engine.score(input);

  // Apply skill-level adjustments (ceiling check + condition-aware bonus)
  let adjustedComposite = composite;
  if (options?.userSkillLevel || options?.beachSkillLevel) {
    adjustedComposite = applySkillBasedAdjustment(
      composite,
      snapshot.waveHeight,
      options?.userSkillLevel,
      options?.beachSkillLevel
    );
  }

  return compositeToDetailedScore(
    adjustedComposite,
    options?.affinityBonus ?? 0,
    options?.distancePenalty ?? 0
  );
}

// =============================================================================
// Wave Size Scoring Configuration
// =============================================================================

/**
 * Configuration constants for wave size scoring adjustments.
 * Centralized for easy tuning and testing.
 */
export const WAVE_SIZE_SCORING_CONFIG = {
  /** Points deducted per foot over skill ceiling */
  skillCeilingPenaltyPerFoot: 8,
  /** Points deducted per foot below a user's ideal lower bound */
  skillFloorPenaltyPerFoot: 6,
  /** Extra points deducted per foot below a user's acceptable lower bound */
  skillFloorBelowAcceptableExtraPenaltyPerFoot: 8,
  /** Cap for small-wave floor penalties so clean small days can remain possible */
  skillFloorPenaltyCap: 18,
  /** Bonus points for waves in skill ideal range */
  skillIdealBonus: 3,
  /** Points deducted per foot outside the board's acceptable band */
  boardFitPenaltyPerFoot: 8,
  /** Cap for small-wave board penalties so clean small days can remain possible */
  boardFitSmallWavePenaltyCap: 18,
  /** Bonus points for waves in the board's ideal band */
  boardFitIdealBonus: 6,
  /** Warning thresholds */
  warnings: {
    /** Feet over limit for "dangerous" warning */
    dangerousThreshold: 8,
    /** Feet over limit for "significantly exceeds" warning */
    significantThreshold: 4,
  },
} as const;

/**
 * Skill-based wave height ranges.
 * Canonical definition lives in user-preferences/skill-level.ts.
 * Re-exported here for backwards compatibility with existing imports.
 */
export type { SkillWaveRanges };
export const SKILL_WAVE_RANGES = SKILL_WAVE_RANGES_SOURCE;

// =============================================================================
// Skill Level Scoring Helper Functions
// =============================================================================

/**
 * Result of checking wave height against skill ceiling.
 */
export interface SkillCeilingResult {
  /** Penalty points (0 if within skill limit) */
  penalty: number;
  /** Warning message if over skill limit */
  warning: string | null;
}

/**
 * Check if wave height exceeds user's skill ceiling.
 * Returns penalty and warning for waves that are too big for skill level.
 *
 * @param waveHeight - Current wave height in feet
 * @param skillLevel - User's skill level
 * @returns Penalty and warning (if applicable)
 */
export function checkSkillCeiling(
  waveHeight: number,
  skillLevel: SkillLevel
): SkillCeilingResult {
  const skillRanges = SKILL_WAVE_RANGES[skillLevel];

  if (waveHeight <= skillRanges.acceptable.max) {
    return { penalty: 0, warning: null };
  }

  const overSkill = waveHeight - skillRanges.acceptable.max;
  // SAFETY: No cap on penalty - dangerous conditions should receive severe scores.
  // -8 pts per foot over limit. Example: Beginner (max 4ft) vs 20ft = -128 pts
  const penalty = Math.round(overSkill * WAVE_SIZE_SCORING_CONFIG.skillCeilingPenaltyPerFoot);

  // Determine warning severity based on how far over skill level
  const warning =
    overSkill >= WAVE_SIZE_SCORING_CONFIG.warnings.dangerousThreshold
      ? 'Dangerous: Waves far exceed your skill level'
      : overSkill >= WAVE_SIZE_SCORING_CONFIG.warnings.significantThreshold
        ? 'Waves significantly exceed your skill level'
        : 'Waves may exceed your skill level';

  return { penalty, warning };
}

/**
 * Result of checking wave height against the user's lower-end preference.
 */
export interface SkillFloorResult {
  /** Penalty points (0 if wave height is within/above the user's ideal floor) */
  penalty: number;
  /** Warning string if conditions are smaller than the user's usual range */
  warning: string | null;
}

/**
 * Penalize waves that are useful for lower-skill practice but below the
 * viewer's normal range. This is intentionally softer than the ceiling gate:
 * small waves are not unsafe, but they should not rank as equally "worth it"
 * for an advanced surfer.
 */
export function checkSkillFloor(
  waveHeight: number,
  skillLevel: SkillLevel
): SkillFloorResult {
  const skillRanges = SKILL_WAVE_RANGES[skillLevel];

  if (waveHeight >= skillRanges.ideal.min) {
    return { penalty: 0, warning: null };
  }

  const belowIdeal = Math.max(0, skillRanges.ideal.min - waveHeight);
  const belowAcceptable = Math.max(0, skillRanges.acceptable.min - waveHeight);
  const rawPenalty =
    belowIdeal * WAVE_SIZE_SCORING_CONFIG.skillFloorPenaltyPerFoot +
    belowAcceptable *
      WAVE_SIZE_SCORING_CONFIG.skillFloorBelowAcceptableExtraPenaltyPerFoot;
  const penalty = Math.min(
    WAVE_SIZE_SCORING_CONFIG.skillFloorPenaltyCap,
    Math.round(rawPenalty)
  );

  if (penalty <= 0) {
    return { penalty: 0, warning: null };
  }

  const warning =
    waveHeight < skillRanges.acceptable.min
      ? 'Waves are below your usual range'
      : 'Waves are smaller than your ideal range';

  return { penalty, warning };
}

/**
 * Result of checking wave height against a board-aware rideability band.
 */
export interface BoardFitResult {
  /** Penalty points (0 if board is appropriate for the wave height) */
  penalty: number;
  /** Bonus points (0 unless wave height is in the board's ideal band) */
  bonus: number;
  /** User-facing note for board-specific fit, if any */
  note: string | null;
}

/**
 * Check if the current wave height fits the selected board class.
 */
export function checkBoardFit(
  waveHeight: number,
  skillLevel: SkillLevel,
  board: BoardClass | null
): BoardFitResult {
  if (!board || !Number.isFinite(waveHeight)) {
    return { penalty: 0, bonus: 0, note: null };
  }

  const band = getRideabilityBand(skillLevel, board);

  if (waveHeight > band.acceptable.max) {
    const over = waveHeight - band.acceptable.max;
    return {
      penalty: Math.round(over * WAVE_SIZE_SCORING_CONFIG.boardFitPenaltyPerFoot),
      bonus: 0,
      note: `too big for your ${board}`,
    };
  }

  if (waveHeight < band.acceptable.min) {
    const under = band.acceptable.min - waveHeight;
    return {
      penalty: Math.min(
        WAVE_SIZE_SCORING_CONFIG.boardFitSmallWavePenaltyCap,
        Math.round(under * WAVE_SIZE_SCORING_CONFIG.boardFitPenaltyPerFoot)
      ),
      bonus: 0,
      note: `too small for your ${board}`,
    };
  }

  if (waveHeight >= band.ideal.min && waveHeight <= band.ideal.max) {
    return {
      penalty: 0,
      bonus: WAVE_SIZE_SCORING_CONFIG.boardFitIdealBonus,
      note: `in the sweet spot for your ${board}`,
    };
  }

  return { penalty: 0, bonus: 0, note: null };
}

/**
 * Result of condition-aware beach skill match scoring.
 */
export interface BeachSkillMatchResult {
  /** Score adjustment (positive = bonus, negative = penalty) */
  adjustment: number;
  /** Reason string for the adjustment */
  reason: string | null;
  /** Warning string if conditions are challenging */
  warning: string | null;
}

/** Numeric ordering for skill level comparisons. */
const SKILL_ORDER: Record<SkillLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

/**
 * Calculate condition-aware skill match bonus/penalty.
 *
 * Considers BOTH the beach's static skill level AND current wave height
 * to determine how well conditions match the user's experience level.
 *
 * Cases:
 * - Beach at/below user level + ideal waves → bonus (+3)
 * - Beach harder but conditions manageable → small bonus (+1) or neutral
 * - Beach harder + conditions heavy → penalty (-2 to -6)
 * - Beach at/below user level + non-ideal waves → neutral (0)
 *
 * Note: checkSkillCeiling handles dangerous wave-height penalties separately.
 *
 * @param waveHeight - Current wave height in feet
 * @param beachSkillLevel - Beach's skill level from database (may be null)
 * @param userSkillLevel - User's skill level
 * @returns Adjustment, reason, and warning (as applicable)
 */
export function calculateBeachSkillMatchBonus(
  waveHeight: number,
  beachSkillLevel: string | null,
  userSkillLevel: SkillLevel
): BeachSkillMatchResult {
  const beachSkill: SkillLevel = parseSkillLevel(beachSkillLevel) ?? 'intermediate';
  const userRanges = SKILL_WAVE_RANGES[userSkillLevel];
  const skillGap = SKILL_ORDER[beachSkill] - SKILL_ORDER[userSkillLevel];
  const wavesInIdealRange = waveHeight >= userRanges.ideal.min && waveHeight <= userRanges.ideal.max;
  const wavesManageable = waveHeight <= userRanges.ideal.max;

  // Beach at or below user level with ideal wave conditions — best match
  if (skillGap <= 0 && wavesInIdealRange) {
    return {
      adjustment: WAVE_SIZE_SCORING_CONFIG.skillIdealBonus,
      reason: 'Conditions match your experience level today',
      warning: null,
    };
  }

  // Beach harder than user but conditions are mild enough
  if (skillGap > 0 && wavesManageable) {
    const label = beachSkill.charAt(0).toUpperCase() + beachSkill.slice(1);
    return {
      adjustment: skillGap === 1 ? 1 : 0,
      reason: `${label} spot, but today's conditions are manageable`,
      warning: null,
    };
  }

  // Beach harder than user and conditions aren't easy
  // Note: checkSkillCeiling handles the heavy wave-height penalties separately
  if (skillGap > 0) {
    const label = beachSkill.charAt(0).toUpperCase() + beachSkill.slice(1);
    const penalty = Math.min(skillGap * 2, 6);
    return {
      adjustment: -penalty,
      reason: null,
      warning: skillGap >= 2
        ? `${label} spot — conditions may be challenging for your level`
        : null,
    };
  }

  // Beach at or below user level, waves outside ideal range — neutral
  return { adjustment: 0, reason: null, warning: null };
}

/**
 * Apply a score adjustment consistently to a composite score.
 * Handles clamping and array updates.
 */
function applyScoreAdjustment(
  composite: CompositeScore,
  adjustment: number,
  reason: string | null,
  warning: string | null
): CompositeScore {
  if (adjustment === 0 && !reason && !warning) {
    return composite;
  }

  return {
    ...composite,
    total: Math.max(0, Math.min(100, composite.total + adjustment)),
    reasons: reason ? [...composite.reasons, reason] : composite.reasons,
    warnings: warning ? [...composite.warnings, warning] : composite.warnings,
  };
}

/**
 * Apply skill-level-based adjustment to composite score.
 *
 * Priority:
 * 1. Check skill ceiling first - waves too big for skill level get penalized
 * 2. Apply condition-aware skill-based bonus/penalty
 *
 * @param composite - The composite score to adjust
 * @param waveHeight - Current wave height in feet
 * @param userSkillLevel - User's skill level (defaults to beginner for safety)
 * @param beachSkillLevel - Beach's static skill level from DB
 * @returns Adjusted composite score
 */
function applySkillBasedAdjustment(
  composite: CompositeScore,
  waveHeight: number,
  userSkillLevel?: SkillLevel | null,
  beachSkillLevel?: string | null
): CompositeScore {
  // SAFETY: Default to 'beginner' if no skill level set
  const skillLevel = getSkillLevelOrDefault(userSkillLevel);

  // 1. Safety first - check skill ceiling
  const { penalty, warning: skillWarning } = checkSkillCeiling(waveHeight, skillLevel);
  if (penalty > 0) {
    return {
      ...composite,
      total: Math.max(0, composite.total - penalty),
      warnings: [...composite.warnings, skillWarning!],
    };
  }

  // 2. Preference floor - small practice waves should not score the same for
  // experienced surfers as they do for beginners.
  const { penalty: floorPenalty, warning: floorWarning } = checkSkillFloor(
    waveHeight,
    skillLevel
  );
  const floorAdjusted =
    floorPenalty > 0
      ? {
          ...composite,
          total: Math.max(0, composite.total - floorPenalty),
          warnings: floorWarning ? [...composite.warnings, floorWarning] : composite.warnings,
        }
      : composite;

  // 3. Condition-aware skill-based scoring
  const { adjustment, reason, warning } = calculateBeachSkillMatchBonus(
    waveHeight, beachSkillLevel ?? null, skillLevel
  );
  return applyScoreAdjustment(floorAdjusted, adjustment, reason, warning);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse tide status from string.
 */
function parseTideStatus(
  status: string | null | undefined
): 'rising' | 'falling' | 'slack-high' | 'slack-low' | 'unknown' {
  if (!status) return 'unknown';
  const lower = status.toLowerCase();

  if (lower.includes('rising')) return 'rising';
  if (lower.includes('falling')) return 'falling';
  if (lower.includes('high')) return 'slack-high';
  if (lower.includes('low')) return 'slack-low';
  if (lower.includes('slack')) return 'slack-high';

  return 'unknown';
}

/**
 * Parse tide direction from status string.
 */
function parseTideDirection(
  status: string | null | undefined
): 'rising' | 'falling' | 'slack' {
  if (!status) return 'slack';
  const lower = status.toLowerCase();

  if (lower.includes('rising')) return 'rising';
  if (lower.includes('falling')) return 'falling';
  return 'slack';
}
