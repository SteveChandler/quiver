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

  // Apply preferred wave size adjustment
  let adjustedComposite = composite;
  if (options?.preferredWaveSize && options.preferredWaveSize !== 'any') {
    adjustedComposite = applyPreferredWaveSizeAdjustment(
      composite,
      snapshot.waveHeight,
      options.preferredWaveSize
    );
  }

  return compositeToDetailedScore(
    adjustedComposite,
    options?.affinityBonus ?? 0,
    options?.distancePenalty ?? 0
  );
}

/**
 * Apply preferred wave size adjustment to composite score.
 * Penalizes scores when waves don't match user's preferred size category.
 */
function applyPreferredWaveSizeAdjustment(
  composite: CompositeScore,
  waveHeight: number,
  preferredSize: 'small' | 'medium' | 'large'
): CompositeScore {
  const ranges = {
    small: { min: 1, max: 3 },
    medium: { min: 3, max: 6 },
    large: { min: 6, max: Infinity },
  };

  const range = ranges[preferredSize];
  const { min, max } = range;

  // Check if wave height matches preferred range
  if (waveHeight >= min && waveHeight <= max) {
    // Perfect match - no adjustment needed
    return composite;
  }

  // Calculate how far outside the range
  const outsideRange = waveHeight < min
    ? min - waveHeight
    : waveHeight > max
      ? waveHeight - max
      : 0;

  if (outsideRange === 0) {
    return composite;
  }

  // Apply graduated penalty (max 36 points, 12 per 0.5ft outside range)
  const penalty = Math.min(36, Math.floor(outsideRange / 0.5) * 12);
  const adjustedTotal = Math.max(0, Math.min(75, composite.total - penalty));

  // Add warning about wave size mismatch
  const sizeLabel = preferredSize === 'small' ? '1-3 ft'
    : preferredSize === 'medium' ? '3-6 ft'
      : '6+ ft';

  const newWarnings = [...composite.warnings];
  if (waveHeight < min) {
    newWarnings.push(`Waves may be smaller than your preferred size (${sizeLabel})`);
  } else {
    newWarnings.push(`Waves may be larger than your preferred size (${sizeLabel})`);
  }

  return {
    ...composite,
    total: adjustedTotal,
    warnings: newWarnings,
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
