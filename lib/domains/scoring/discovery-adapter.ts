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
import {
  transformToFaceHeightDecomposed,
  type ShoalingFactors,
  type SwellComponentInput,
  type WaveHeightSourceTag,
} from '@/lib/utils/wave-height-transformer';
import type { SpotProfile } from '../spot-profile/types';
import type { ConditionsSnapshot, ConditionsWindow } from '../conditions/types';
import type { UserPreferences } from '../user-preferences/types';
import type { SkillLevel } from '../user-preferences/skill-level';
import { getSkillLevelOrDefault, parseSkillLevel, SKILL_WAVE_RANGES as SKILL_WAVE_RANGES_SOURCE } from '../user-preferences/skill-level';
import type { SkillWaveRanges } from '../user-preferences/skill-level';
import { createSpotProfile } from '../spot-profile';
import { createSwellComponent } from '../conditions';
import {
  ScoringEngine,
  baseConditionsScorer,
  swellAlignmentScorer,
  swellInterferenceScorer,
  windQualityScorer,
  tideFitScorer,
  tideDirectionScorer,
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
 * Infer the upstream wave-height source tag from an already-persisted
 * `EnhancedForecastEntity` row.
 *
 * `transformToFaceHeight` gates its per-beach `shoaling_factors` short-circuit
 * on `source === 'cdip_sig'` because the bucket multipliers were calibrated as
 * `surfline_face_ft / cdip_hs_ft`. The upstream live path
 * (`selectWaveHeightSource` in `wave-formatters.ts`) has access to the raw
 * CDIP/WW3/NDBC feeds and picks the tag dynamically. At read time through the
 * discovery adapter we only have `forecast.data_source`, which `forecast-builder`
 * writes as one of `"CDIP" | "NOAA_BUOY" | "FALLBACK"` or a per-entry wave
 * model label (e.g. `"NOAA_NWS"`, `"OPEN_METEO"`, `"MODEL_WAVE_WATCH"`).
 *
 * Strategy:
 * - `"CDIP"` (or anything starting with `CDIP`) maps to `'cdip_sig'` so calibrated
 *   beaches get the empirical bucket factor when the writer chose CDIP.
 * - Everything else returns `undefined`, which makes `transformToFaceHeight`
 *   run the legacy `base × period × direction` pipeline — the safe default,
 *   because applying the CDIP-denominated bucket factor to a model-derived
 *   height would produce the wrong answer.
 */
function inferWaveHeightSource(
  forecast: EnhancedForecastEntity,
): WaveHeightSourceTag | undefined {
  const ds = forecast.data_source?.toUpperCase() ?? '';
  if (ds === 'CDIP' || ds.startsWith('CDIP')) return 'cdip_sig';
  return undefined;
}

/**
 * Compute the decomposed face height for a forecast at a given beach.
 *
 * Extracts swell_1/swell_2/wind_wave components from the forecast, runs
 * `transformToFaceHeightDecomposed`, and returns the face height in feet
 * along with the beach-level calibration flag. Shared by `forecastToSnapshot`
 * (scoring path) and the update-enhanced API route (display path) so both
 * always agree on the number.
 */
export function computeFaceHeight(
  forecast: EnhancedForecastEntity,
  beach: Beach,
): { faceHeightFt: number; isCalibrated: boolean } {
  const rawHeight = parseFloat(forecast.wave_height || '0');
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const waveDirection = getDirectionDegrees(
    forecast.swell_1_direction,
    forecast.swell_1_direction
  );

  const parseComponent = (
    heightStr: string | null | undefined,
    periodStr: string | null | undefined,
    directionStr: string | null | undefined,
  ): SwellComponentInput | null => {
    if (heightStr == null || periodStr == null) return null;
    const heightFt = parseFloat(heightStr);
    const periodS = parseFloat(periodStr.replace('s', ''));
    if (!Number.isFinite(heightFt) || heightFt <= 0) return null;
    if (!Number.isFinite(periodS) || periodS <= 0) return null;
    return {
      heightFt,
      periodS,
      directionDeg: getDirectionDegrees(directionStr, directionStr) ?? null,
    };
  };

  const components: Array<SwellComponentInput | null> = [
    parseComponent(
      forecast.swell_1_height,
      forecast.swell_1_period,
      forecast.swell_1_direction,
    ),
    parseComponent(
      forecast.swell_2_height,
      forecast.swell_2_period,
      forecast.swell_2_direction,
    ),
    parseComponent(
      forecast.wind_wave_height,
      forecast.wind_wave_period,
      forecast.wind_wave_direction,
    ),
  ];

  const { faceHeightFt } = transformToFaceHeightDecomposed({
    components,
    beach: {
      swell_access_factors: beach.swell_access_factors ?? null,
      terrain_enabled: beach.terrain_enabled ?? false,
      shoaling_factors: (beach.shoaling_factors ?? null) as ShoalingFactors | null,
      swell_window_center_deg: beach.swell_window_center_deg ?? null,
      swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
    },
    source: inferWaveHeightSource(forecast),
    rawHeightFt: rawHeight,
    periodS: Number.isFinite(wavePeriod) && wavePeriod > 0 ? wavePeriod : null,
    swellDirectionDeg: waveDirection ?? null,
  });

  const isCalibrated = (beach.shoaling_factors ?? null) !== null;

  return { faceHeightFt, isCalibrated };
}

/**
 * Convert EnhancedForecastEntity to ConditionsSnapshot.
 *
 * Applies the same `transformToFaceHeightDecomposed` the display path uses so
 * the score engine ingests the same face-height number the UI renders. The
 * display-path equivalent lives in `forecast-builder.getWaveHeight`. Without
 * the decomposition, calibrated beaches like Tourmaline on a mixed-period day
 * (1 ft 14s SSW + 2.5 ft 7s W wind-swell) would have the short-period wind
 * component smuggled through the 12–16s bucket factor because the scalar path
 * only sees CDIP combined Hs + peak period. Per-component alignment +
 * short-period cutoff zeroes the W wind-swell contribution and fixes the
 * Tourmaline 3-5 ft / 9.3 bug on 2026-04-09.
 *
 * Unit note: `enhanced_forecasts.swell_1_height`, `swell_2_height`, and
 * `wind_wave_height` are stored as formatted feet strings (e.g. `"3.5 ft"`)
 * by `forecast-builder.metersToFeet`, so `parseFloat` on the raw string
 * yields feet directly — no meters→feet conversion needed here.
 */
export function forecastToSnapshot(
  forecast: EnhancedForecastEntity,
  beach: Beach,
): ConditionsSnapshot {
  // Parse wave data
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  // Use getDirectionDegrees to handle both numeric ("280") and cardinal ("WNW") strings
  const waveDirection = getDirectionDegrees(
    forecast.swell_1_direction,
    forecast.swell_1_direction
  );

  const { faceHeightFt: waveHeight } = computeFaceHeight(forecast, beach);

  // Parse wind data
  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const windDirection = getDirectionDegrees(
    forecast.wind_direction_deg,
    forecast.wind_direction
  );

  // Parse tide data
  const tideHeight = parseFloat(forecast.tide_height || '0') || 0;
  const tideStatus = parseTideStatus(forecast.tide_status);
  const tideDirection = parseTideDirection(forecast.tide_status);

  // Parse primary swell
  const primarySwell = forecast.swell_1_height && forecast.swell_1_period
    ? createSwellComponent(
        parseFloat(forecast.swell_1_height),
        parseFloat(forecast.swell_1_period.replace('s', '')),
        waveDirection ?? 270
      )
    : null;

  // Parse secondary swell if available
  // Use getDirectionDegrees to handle both numeric ("315") and cardinal ("NW") strings
  const secondarySwell = forecast.swell_2_height && forecast.swell_2_period
    ? createSwellComponent(
        parseFloat(forecast.swell_2_height),
        parseFloat(forecast.swell_2_period.replace('s', '')),
        getDirectionDegrees(forecast.swell_2_direction, forecast.swell_2_direction) ?? 270
      )
    : null;

  return {
    timestamp: new Date(forecast.forecast_at),
    waveHeight,
    wavePeriod,
    waveDirection,
    primarySwell,
    secondarySwell,
    windWave: null,
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
  /** User's preferred wave size category */
  preferredWaveSize?: 'small' | 'medium' | 'large' | 'any' | null;
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
  const snapshot = forecastToSnapshot(forecast, beach);

  const input: ScorerInput = {
    profile,
    snapshot,
    window: options?.window ?? null,
    preferences: options?.preferences ?? null,
  };

  const composite = engine.score(input);

  // Apply preferred wave size adjustment WITH skill level
  // Now applies if there's a preference OR a skill level (for skill ceiling checks)
  let adjustedComposite = composite;
  if (options?.preferredWaveSize !== 'any' || options?.userSkillLevel || options?.beachSkillLevel) {
    adjustedComposite = applyPreferredWaveSizeAdjustment(
      composite,
      snapshot.waveHeight,
      options?.preferredWaveSize || 'any',
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
  /** Bonus points for waves in skill ideal range */
  skillIdealBonus: 3,
  /** Bonus points for waves matching preference */
  preferenceMatchBonus: 5,
  /** Penalty points per foot outside preference range */
  preferenceOutsidePenaltyPerFoot: 5,
  /** Maximum penalty for preference mismatch */
  preferenceOutsideMaxPenalty: 15,
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

/**
 * Preference-based wave height ranges.
 */
export const PREF_WAVE_RANGES = {
  small: { ideal: { min: 1, max: 3 }, acceptable: { min: 0.5, max: 4 } },
  medium: { ideal: { min: 3, max: 6 }, acceptable: { min: 2, max: 8 } },
  large: { ideal: { min: 5, max: 12 }, acceptable: { min: 4, max: 15 } },
} as const;

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
 * Result of calculating preference-based adjustment.
 */
export interface PreferenceAdjustmentResult {
  /** Score adjustment (positive = bonus, negative = penalty) */
  adjustment: number;
  /** Reason string for positive adjustments */
  reason: string | null;
  /** Warning string for negative adjustments */
  warning: string | null;
}

/**
 * Calculate score adjustment based on user's wave size preference.
 *
 * @param waveHeight - Current wave height in feet
 * @param preferredSize - User's preferred wave size
 * @returns Adjustment, reason, and warning (as applicable)
 */
export function calculatePreferenceAdjustment(
  waveHeight: number,
  preferredSize: 'small' | 'medium' | 'large'
): PreferenceAdjustmentResult {
  const prefRange = PREF_WAVE_RANGES[preferredSize];

  // Perfect match - bonus
  if (waveHeight >= prefRange.ideal.min && waveHeight <= prefRange.ideal.max) {
    return {
      adjustment: WAVE_SIZE_SCORING_CONFIG.preferenceMatchBonus,
      reason: 'Waves match your preferred size',
      warning: null,
    };
  }

  // Within acceptable range - no change
  if (waveHeight >= prefRange.acceptable.min && waveHeight <= prefRange.acceptable.max) {
    return { adjustment: 0, reason: null, warning: null };
  }

  // Outside acceptable - soft penalty
  const distanceOutside =
    waveHeight < prefRange.acceptable.min
      ? prefRange.acceptable.min - waveHeight
      : waveHeight - prefRange.acceptable.max;

  const penalty = Math.min(
    WAVE_SIZE_SCORING_CONFIG.preferenceOutsideMaxPenalty,
    Math.round(distanceOutside * WAVE_SIZE_SCORING_CONFIG.preferenceOutsidePenaltyPerFoot)
  );

  const warning =
    waveHeight < prefRange.acceptable.min
      ? 'Waves may be smaller than preferred'
      : 'Waves may be larger than preferred';

  return { adjustment: -penalty, reason: null, warning };
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
 * Apply preferred wave size adjustment to composite score.
 * Now skill-level-aware with softer penalties.
 *
 * Priority:
 * 1. Check skill ceiling first - waves too big for skill level get penalized
 * 2. Apply preference-based bonus/penalty if preference is set
 * 3. If no preference, check skill-based ideal range for small bonus
 *
 * @param composite - The composite score to adjust
 * @param waveHeight - Current wave height in feet
 * @param preferredSize - User's preferred wave size (or 'any')
 * @param userSkillLevel - User's skill level (defaults to beginner for safety)
 * @returns Adjusted composite score
 */
function applyPreferredWaveSizeAdjustment(
  composite: CompositeScore,
  waveHeight: number,
  preferredSize: 'small' | 'medium' | 'large' | 'any',
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

  // 2. Apply preference adjustment if set
  if (preferredSize && preferredSize !== 'any') {
    const { adjustment, reason, warning } = calculatePreferenceAdjustment(
      waveHeight,
      preferredSize
    );
    return applyScoreAdjustment(composite, adjustment, reason, warning);
  }

  // 3. Fall back to condition-aware skill-based scoring
  const { adjustment, reason, warning } = calculateBeachSkillMatchBonus(
    waveHeight, beachSkillLevel ?? null, skillLevel
  );
  return applyScoreAdjustment(composite, adjustment, reason, warning);
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
