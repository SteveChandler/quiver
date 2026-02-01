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
import type { SpotProfile } from '../spot-profile/types';
import type { ConditionsSnapshot, ConditionsWindow } from '../conditions/types';
import type { UserPreferences } from '../user-preferences/types';
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
 * Convert EnhancedForecastEntity to ConditionsSnapshot.
 */
export function forecastToSnapshot(forecast: EnhancedForecastEntity): ConditionsSnapshot {
  // Parse wave data
  const waveHeight = parseFloat(forecast.wave_height || '0');
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  // Use getDirectionDegrees to handle both numeric ("280") and cardinal ("WNW") strings
  const waveDirection = getDirectionDegrees(
    forecast.swell_1_direction,
    forecast.swell_1_direction
  );

  // Parse wind data
  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const windDirection = getDirectionDegrees(
    forecast.wind_direction_deg,
    forecast.wind_direction
  );

  // Parse tide data
  const tideHeight = parseFloat(forecast.tide_height || '0');
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
    timestamp: new Date(forecast.forecast_time || Date.now()),
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
    confidence: forecast.confidence_score ?? 50,
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
  // Map subscores to legacy format
  const subscores = {
    waveHeightFit: Math.round((composite.subscores.get('baseConditions') ?? 50) * 0.25),
    periodEnergyScore: Math.round((composite.subscores.get('baseConditions') ?? 50) * 0.20),
    windAlignment: Math.round((composite.subscores.get('windQuality') ?? 50) * 0.20),
    tideFit: Math.round((composite.subscores.get('tideFit') ?? 50) * 0.15),
    affinityBonus,
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
  userSkillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
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

  // Apply preferred wave size adjustment WITH skill level
  // Now applies if there's a preference OR a skill level (for skill ceiling checks)
  let adjustedComposite = composite;
  if (options?.preferredWaveSize !== 'any' || options?.userSkillLevel) {
    adjustedComposite = applyPreferredWaveSizeAdjustment(
      composite,
      snapshot.waveHeight,
      options?.preferredWaveSize || 'any',
      options?.userSkillLevel
    );
  }

  return compositeToDetailedScore(
    adjustedComposite,
    options?.affinityBonus ?? 0,
    options?.distancePenalty ?? 0
  );
}

/**
 * Skill-based wave height ranges.
 * Defines ideal and acceptable wave ranges for each skill level.
 */
interface SkillWaveRanges {
  ideal: { min: number; max: number };
  acceptable: { min: number; max: number };
}

const SKILL_WAVE_RANGES: Record<string, SkillWaveRanges> = {
  beginner: {
    ideal: { min: 1, max: 3 },
    acceptable: { min: 0.5, max: 4 },
  },
  intermediate: {
    ideal: { min: 2, max: 5 },
    acceptable: { min: 1, max: 6 },
  },
  advanced: {
    ideal: { min: 3, max: 8 },
    acceptable: { min: 2, max: 12 },
  },
  expert: {
    ideal: { min: 4, max: 12 },
    acceptable: { min: 2, max: 20 },
  },
};

/**
 * Preference-based wave height ranges.
 */
const PREF_WAVE_RANGES = {
  small: { ideal: { min: 1, max: 3 }, acceptable: { min: 0.5, max: 4 } },
  medium: { ideal: { min: 3, max: 6 }, acceptable: { min: 2, max: 8 } },
  large: { ideal: { min: 5, max: 12 }, acceptable: { min: 4, max: 15 } },
};

/**
 * Apply preferred wave size adjustment to composite score.
 * Now skill-level-aware with softer penalties.
 *
 * Priority:
 * 1. Check skill ceiling first - waves too big for skill level get penalized
 * 2. Apply preference-based bonus/penalty if preference is set
 * 3. If no preference, check skill-based ideal range for small bonus
 */
function applyPreferredWaveSizeAdjustment(
  composite: CompositeScore,
  waveHeight: number,
  preferredSize: 'small' | 'medium' | 'large' | 'any',
  userSkillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null
): CompositeScore {
  // SAFETY: Default to 'beginner' if no skill level set - conservative approach
  // ensures unset users don't see dangerously high scores for big waves
  const skillRanges = SKILL_WAVE_RANGES[userSkillLevel || 'beginner'];
  const newReasons = [...composite.reasons];
  const newWarnings = [...composite.warnings];

  // Check skill ceiling first - waves too big for skill level
  if (waveHeight > skillRanges.acceptable.max) {
    const overSkill = waveHeight - skillRanges.acceptable.max;
    // SAFETY: No cap on penalty - dangerous conditions (e.g., 20ft for beginner)
    // should receive appropriately severe scores. -8 pts per foot over limit.
    // Example: Beginner (max 4ft) vs 20ft = 16ft over = -128 pts (score near 0)
    const penalty = Math.round(overSkill * 8);

    // Determine warning severity based on how far over skill level
    const warningMessage = overSkill >= 8
      ? 'Dangerous: Waves far exceed your skill level'
      : overSkill >= 4
        ? 'Waves significantly exceed your skill level'
        : 'Waves may exceed your skill level';

    return {
      ...composite,
      total: Math.max(0, composite.total - penalty),
      reasons: newReasons,
      warnings: [...newWarnings, warningMessage],
    };
  }

  // If no preference or 'any', just check skill-based bonus
  if (!preferredSize || preferredSize === 'any') {
    // Within ideal skill range = small bonus
    if (waveHeight >= skillRanges.ideal.min && waveHeight <= skillRanges.ideal.max) {
      return {
        ...composite,
        total: Math.min(100, composite.total + 3),
        reasons: [...newReasons, 'Great wave size for your level'],
        warnings: newWarnings,
      };
    }
    return composite;
  }

  // Apply preference-based adjustment
  const prefRange = PREF_WAVE_RANGES[preferredSize];

  // Perfect match - bonus
  if (waveHeight >= prefRange.ideal.min && waveHeight <= prefRange.ideal.max) {
    return {
      ...composite,
      total: Math.min(100, composite.total + 5),
      reasons: [...newReasons, 'Waves match your preferred size'],
      warnings: newWarnings,
    };
  }

  // Within acceptable range - no adjustment
  if (waveHeight >= prefRange.acceptable.min && waveHeight <= prefRange.acceptable.max) {
    return composite;
  }

  // Outside acceptable - soft penalty (MUCH softer than before)
  // OLD: -12 pts per 0.5ft, max -36
  // NEW: -5 pts per 1ft, max -15
  const distanceOutside = waveHeight < prefRange.acceptable.min
    ? prefRange.acceptable.min - waveHeight
    : waveHeight - prefRange.acceptable.max;

  const penalty = Math.min(15, Math.round(distanceOutside * 5));

  const warningMessage = waveHeight < prefRange.acceptable.min
    ? 'Waves may be smaller than preferred'
    : 'Waves may be larger than preferred';

  return {
    ...composite,
    total: Math.max(0, composite.total - penalty),
    reasons: newReasons,
    warnings: [...newWarnings, warningMessage],
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get direction in degrees from either numeric or string direction.
 */
function getDirectionDegrees(
  deg: number | string | null | undefined,
  cardinal: string | null | undefined
): number | null {
  // If we have numeric degrees
  if (deg !== null && deg !== undefined) {
    const numDeg = typeof deg === 'string' ? parseFloat(deg) : deg;
    if (!isNaN(numDeg)) {
      return numDeg;
    }
  }

  // Fall back to cardinal direction
  if (!cardinal) return null;

  const cardinalMap: Record<string, number> = {
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

  return cardinalMap[cardinal.toUpperCase()] ?? null;
}

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
