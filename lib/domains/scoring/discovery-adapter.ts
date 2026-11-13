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
import { getDirectionDegrees, parseWindSpeedOrNull } from '@/lib/utils/number-parsing';
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
import { memoizedSpotProfile } from './scoring-memo';
import { createSwellComponent, pickDominantSwell } from '../conditions';
import type { SwellPartition, SwellPartitions } from '../conditions';
import { ScoringEngine } from './scoring-engine';
import { baseConditionsScorer } from './scorers/base-conditions-scorer';
import { swellAlignmentScorer } from './scorers/swell-alignment-scorer';
import { swellInterferenceScorer } from './scorers/swell-interference-scorer';
import { isWindQualityUnknown, windQualityScorer } from './scorers/wind-quality-scorer';
import { tideFitScorer } from './scorers/tide-fit-scorer';
import { tideDirectionScorer } from './scorers/tide-direction-scorer';
import { setupRiskScorer } from './scorers/setup-risk-scorer';
import { windowStabilityScorer } from './scorers/window-stability-scorer';
import { trendPreferenceScorer } from './scorers/trend-preference-scorer';
import {
  formatBigSurfCaution,
  formatBoardFit,
  formatMellowBreak,
  formatSmallSide,
  formatSmallSurf,
  oneSizeStory,
  prependReasons,
  reasonList,
  takeReasons,
  type ReasonCode,
} from './reason-sentences';

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

let discoveryScoringEngine: ScoringEngine | undefined;

export function getDiscoveryScoringEngine(): ScoringEngine {
  return discoveryScoringEngine ??= createDiscoveryScoringEngine();
}

/**
 * Convert Beach database row to SpotProfile.
 */
export function beachToSpotProfile(beach: Beach): SpotProfile {
  return memoizedSpotProfile(beach, () => createSpotProfile(beach));
}

/**
 * A forecast the caller assembled from request conditions has no stored
 * confidence_score by construction, so the neutral 50 is expected, not data loss.
 */
const REQUEST_DERIVED_CONFIDENCE_TRACKING = {
  severity: 'low',
  reason: 'request_derived_forecast',
} as const;

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
export function forecastToSnapshot(
  forecast: EnhancedForecastEntity,
  options: { requestDerived?: boolean } = {},
): ConditionsSnapshot {
  const waveHeight = parseFloat(forecast.wave_height || '0');
  const storedWavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');

  const windSpeed = parseWindSpeedOrNull(forecast.wind_speed);
  const windDirection = getDirectionDegrees(
    forecast.wind_direction_deg,
    forecast.wind_direction
  );

  const parsedTideHeight = parseFloat(forecast.tide_height || '');
  const tideHeight = Number.isFinite(parsedTideHeight) ? parsedTideHeight : 0;
  const tideStatus = parseTideStatus(forecast.tide_status);
  const tideDirection = parseTideDirection(forecast.tide_status);
  const tideRate = resolveTideRate(forecast, Number.isFinite(parsedTideHeight) ? parsedTideHeight : null);

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
    waveHeightKnown: Number.isFinite(parseFloat(forecast.wave_height ?? '')),
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
      heightKnown: Number.isFinite(parsedTideHeight),
      rateFtPerHour: tideRate.rateFtPerHour,
      rateSource: tideRate.rateSource,
    },
    confidence: resolveConfidence(
      forecast.confidence_score,
      'discovery',
      undefined,
      options.requestDerived ? REQUEST_DERIVED_CONFIDENCE_TRACKING : undefined,
    ),
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
  distancePenalty: number = 0,
  // A skip exits before windQuality runs, so its absence only proves unknown wind on a full run.
  windUnknown: boolean = !composite.skipReason && !composite.subscores.has('windQuality')
): DetailedScore {
  // Only track missing subscores for non-skip results.
  // Skip results are disqualified beaches where subscores are intentionally
  // absent for scorers that did not run (early exit by design).
  if (!composite.skipReason) {
    // windQuality is absent by design when the wind can't be judged (weight 0).
    for (const key of ['baseConditions', 'tideFit'] as const) {
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
    ...(windUnknown ? { windUnknown: true } : {}),
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
    // One card, one size story: no "Good size" beside a small-surf line, and no line twice.
    ...takeReasons(oneSizeStory(reasonList(composite.reasons, composite.reasonCodes), composite.warningCodes), 5),
    warnings: [...composite.warnings],
    warningCodes: reasonList(composite.warnings, composite.warningCodes).reasonCodes,
    effects: [...(composite.effects ?? [])],
    conditionBadges: [], // Will be generated separately if needed
  };
}

/**
 * Options for discovery scoring.
 */
interface DiscoveryScoringOptions {
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
    options?.distancePenalty ?? 0,
    isWindQualityUnknown(snapshot, profile)
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
export const SKILL_WAVE_RANGES = SKILL_WAVE_RANGES_SOURCE;

// =============================================================================
// Skill Level Scoring Helper Functions
// =============================================================================

/**
 * Result of checking wave height against skill ceiling.
 */
interface SkillCeilingResult {
  /** Penalty points (0 if within skill limit) */
  penalty: number;
  /** Warning message if over skill limit */
  warning: string | null;
  /** A big-surf warning is a caution: it leads the warnings and is never cut. */
  warningCode?: ReasonCode;
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
  const kind =
    overSkill >= WAVE_SIZE_SCORING_CONFIG.warnings.dangerousThreshold
      ? 'far_over'
      : overSkill >= WAVE_SIZE_SCORING_CONFIG.warnings.significantThreshold
        ? 'well_over'
        : 'over';

  const warning = formatBigSurfCaution({ kind, heightFt: waveHeight });
  return { penalty, warning, warningCode: warning ? 'caution_size_over' : undefined };
}

/**
 * Result of checking wave height against the user's lower-end preference.
 */
interface SkillFloorResult {
  /** Penalty points (0 if wave height is within/above the user's ideal floor) */
  penalty: number;
  /** The small-surf line with its band ("Small surf at 1–2 ft." / "On the small side at 2–3 ft."), or null */
  warning: string | null;
  warningCode?: ReasonCode;
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

  // A missing or zero height (an empty forecast row parses to 0) keeps the penalty
  // but gets no line: "Small surf" would be a claim the row cannot back.
  if (!Number.isFinite(waveHeight) || waveHeight <= 0) {
    return { penalty, warning: null };
  }
  const below = waveHeight < skillRanges.acceptable.min;
  return {
    penalty,
    warning: below ? formatSmallSurf(waveHeight) : formatSmallSide(waveHeight),
    warningCode: below ? 'small_surf' : 'small_side',
  };
}

/**
 * Result of checking wave height against a board-aware rideability band.
 */
interface BoardFitResult {
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
      note: formatBoardFit('big', board, waveHeight),
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
      note: formatBoardFit('small', board, waveHeight),
    };
  }

  if (waveHeight >= band.ideal.min && waveHeight <= band.ideal.max) {
    return {
      penalty: 0,
      bonus: WAVE_SIZE_SCORING_CONFIG.boardFitIdealBonus,
      note: formatBoardFit('good', board, waveHeight),
    };
  }

  return { penalty: 0, bonus: 0, note: null };
}

/**
 * Result of condition-aware beach skill match scoring.
 */
interface BeachSkillMatchResult {
  /** Score adjustment (positive = bonus, negative = penalty) */
  adjustment: number;
  /** Reason string for the adjustment */
  reason: string | null;
  /** Warning string if conditions are challenging */
  warning: string | null;
  reasonCode?: ReasonCode;
  warningCode?: ReasonCode;
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
  // The score treats an unknown level as intermediate; the copy does not name a level it does not know.
  const knownBeachSkill = parseSkillLevel(beachSkillLevel);
  const beachSkill: SkillLevel = knownBeachSkill ?? 'intermediate';
  const userRanges = SKILL_WAVE_RANGES[userSkillLevel];
  const skillGap = SKILL_ORDER[beachSkill] - SKILL_ORDER[userSkillLevel];
  const wavesInIdealRange = waveHeight >= userRanges.ideal.min && waveHeight <= userRanges.ideal.max;
  const wavesManageable = waveHeight <= userRanges.ideal.max;

  // Beach at or below user level with ideal wave conditions — best match
  if (skillGap <= 0 && wavesInIdealRange) {
    // The bonus stays; the line is gone (Steven: it named the surfer's level).
    return {
      adjustment: WAVE_SIZE_SCORING_CONFIG.skillIdealBonus,
      reason: null,
      warning: null,
    };
  }

  // Beach harder than user but conditions are mild enough
  if (skillGap > 0 && wavesManageable) {
    return {
      adjustment: skillGap === 1 ? 1 : 0,
      reason: knownBeachSkill ? formatMellowBreak(knownBeachSkill) : null,
      reasonCode: knownBeachSkill ? 'break_mellow' : undefined,
      warning: null,
    };
  }

  // Beach harder than user and conditions aren't easy
  // Note: checkSkillCeiling handles the heavy wave-height penalties separately
  if (skillGap > 0) {
    const penalty = Math.min(skillGap * 2, 6);
    const warning = skillGap >= 2 && knownBeachSkill
      ? formatBigSurfCaution({ kind: 'advanced_break', level: knownBeachSkill, heightFt: waveHeight })
      : null;
    return {
      adjustment: -penalty,
      reason: null,
      warning,
      warningCode: warning ? 'caution_advanced_break' : undefined,
    };
  }

  // Beach at or below user level, waves outside ideal range — neutral
  return { adjustment: 0, reason: null, warning: null };
}

/**
 * Adds one warning with its code. A caution (big surf, harder break) goes in
 * front, so the message reads it first ("Watch: …") and no later cut drops it;
 * other warnings keep their place at the end. Order is display only.
 */
function withWarning(
  composite: CompositeScore,
  warning: string | null,
  code: ReasonCode | undefined,
): Pick<CompositeScore, 'warnings' | 'warningCodes'> {
  const current = reasonList(composite.warnings, composite.warningCodes);
  // The cap line and the floor line can read the same ("Small surf at 1–2 ft."); show it once.
  if (!warning || current.reasons.includes(warning)) {
    return { warnings: current.reasons, warningCodes: current.reasonCodes };
  }
  const next = code?.startsWith('caution_')
    ? prependReasons(current, [warning], [code])
    : { reasons: [...current.reasons, warning], reasonCodes: [...current.reasonCodes, code ?? null] };
  return { warnings: next.reasons, warningCodes: next.reasonCodes };
}

/**
 * Apply a score adjustment consistently to a composite score.
 * Handles clamping and array updates.
 */
function applyScoreAdjustment(
  composite: CompositeScore,
  adjustment: number,
  reason: string | null,
  warning: string | null,
  codes: { reasonCode?: ReasonCode; warningCode?: ReasonCode } = {},
): CompositeScore {
  if (adjustment === 0 && !reason && !warning) {
    return composite;
  }

  return {
    ...composite,
    total: Math.max(0, Math.min(100, composite.total + adjustment)),
    reasons: reason ? [...composite.reasons, reason] : composite.reasons,
    reasonCodes: reason
      ? [...reasonList(composite.reasons, composite.reasonCodes).reasonCodes, codes.reasonCode ?? null]
      : composite.reasonCodes,
    ...withWarning(composite, warning, codes.warningCode),
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
  const ceilingCheck = checkSkillCeiling(waveHeight, skillLevel);
  if (ceilingCheck.penalty > 0) {
    return {
      ...composite,
      total: Math.max(0, composite.total - ceilingCheck.penalty),
      ...withWarning(composite, ceilingCheck.warning, ceilingCheck.warningCode),
    };
  }

  // 2. Preference floor - small practice waves should not score the same for
  // experienced surfers as they do for beginners.
  const floorCheck = checkSkillFloor(waveHeight, skillLevel);
  const floorAdjusted =
    floorCheck.penalty > 0
      ? {
          ...composite,
          total: Math.max(0, composite.total - floorCheck.penalty),
          ...withWarning(composite, floorCheck.warning, floorCheck.warningCode),
        }
      : composite;

  // 3. Condition-aware skill-based scoring
  const match = calculateBeachSkillMatchBonus(
    waveHeight, beachSkillLevel ?? null, skillLevel
  );
  return applyScoreAdjustment(floorAdjusted, match.adjustment, match.reason, match.warning, {
    reasonCode: match.reasonCode,
    warningCode: match.warningCode,
  });
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

/** A mean rate over more than half a tidal cycle isn't this row's rate. */
const MAX_NEXT_EXTREMUM_HOURS = 13;
/** Near the turn the tide is slack, but the mean to it reads as a real swing. */
const MIN_NEXT_EXTREMUM_HOURS = 1.5;

/**
 * Signed tide rate (ft/h, + rising): the hourly series' own rate when the row
 * carries one, else the mean rate to the next high/low. The mean overstates
 * the rate near the turn and understates it mid-swing.
 */
function resolveTideRate(
  forecast: EnhancedForecastEntity,
  tideHeightFt: number | null,
): { rateFtPerHour: number | null; rateSource: 'series' | 'next_extremum' | null } {
  const seriesRate = forecast.tide_rate_ft_per_hour;
  if (typeof seriesRate === 'number' && Number.isFinite(seriesRate)) {
    return { rateFtPerHour: seriesRate, rateSource: 'series' };
  }
  const none = { rateFtPerHour: null, rateSource: null };
  if (tideHeightFt === null || !forecast.next_tide_at) return none;
  const nextHeightFt = parseFloat(forecast.next_tide_height || '');
  const hours = (Date.parse(forecast.next_tide_at) - Date.parse(forecast.forecast_at)) / 3_600_000;
  if (!Number.isFinite(nextHeightFt) || !Number.isFinite(hours)) return none;
  if (hours < MIN_NEXT_EXTREMUM_HOURS || hours > MAX_NEXT_EXTREMUM_HOURS) return none;
  return {
    rateFtPerHour: Math.round(((nextHeightFt - tideHeightFt) / hours) * 100) / 100,
    rateSource: 'next_extremum',
  };
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
