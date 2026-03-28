/**
 * Unified Surf Conditions Scorer
 *
 * Scores surf conditions based on forecast data and beach characteristics.
 * Shared between Morning Intel and Home Screen Best Bet.
 */

import type {
  BeachWithThresholds,
  ForecastForScoring,
  ConditionScore,
  ConditionSubscores,
  ConditionCharacter,
  MatchQuality,
  RecommendationLabel,
  UserScoringPreferences,
} from './types';
import { trackFallback } from '@/lib/monitoring/fallback-tracker';
import {
  SKILL_WAVE_RANGES,
  parseSkillLevel,
} from '@/lib/domains/user-preferences/skill-level';

// Default thresholds
const DEFAULT_MAX_WIND_ONSHORE_MPH = 10;
const DEFAULT_MAX_WIND_ANY_MPH = 25;
const DEFAULT_WIND_OFFSHORE_TOL_DEG = 45;

// Max raw points per subscore
const MAX_WAVE_HEIGHT_FIT = 25;
const MAX_PERIOD_ENERGY = 20;
const MAX_WIND_ALIGNMENT = 20;
const MAX_TIDE_FIT = 15;
const MAX_RAW_POINTS = MAX_WAVE_HEIGHT_FIT + MAX_PERIOD_ENERGY + MAX_WIND_ALIGNMENT + MAX_TIDE_FIT;

// Quality thresholds (after normalization to 0-100)
const THRESHOLD_PERFECT = 85;
const THRESHOLD_EXCELLENT = 70;
const THRESHOLD_GOOD = 55;
const THRESHOLD_FAIR = 40;
const THRESHOLD_MINIMAL = 30; // New: between fair and skip — marginal but not hopeless

/**
 * Calculate angular difference between two directions (in degrees)
 * Returns value between 0 and 180
 */
export function angleDifference(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2) % 360;
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * Calculate how well the swell direction fits the beach's preferred swell window.
 * Uses swell_window_center_deg + swell_window_halfwidth_deg from beach config.
 *
 * @param swellDirection - Swell direction in degrees, or null if unknown
 * @param beach - Beach configuration with optional swell window fields
 * @returns Fit score from 0.0 (worst) to 1.0 (ideal)
 */
export function calculateSwellDirectionFit(
  swellDirection: number | null | undefined,
  beach: BeachWithThresholds
): number {
  // No swell direction data — use neutral fallback
  if (swellDirection == null) return 0.5;

  const center = beach.swell_window_center_deg;
  const halfwidth = beach.swell_window_halfwidth_deg;

  // No beach swell window configured — use neutral fallback
  if (center == null || halfwidth == null) {
    trackFallback({
      domain: 'scoring',
      field: 'swell_window_center_deg',
      fallbackValue: 0.5,
      context: { beachId: beach.id },
    });
    return 0.5;
  }

  const diff = angleDifference(swellDirection, center);

  // Perfect fit: within halfwidth → 1.0
  // Beyond halfwidth: linearly decay to 0 at 75° past halfwidth
  if (diff <= halfwidth) {
    return 1.0;
  }

  const decayRange = 75; // degrees of decay past halfwidth (steeper than 90°)
  const excess = diff - halfwidth;
  const fit = Math.max(0, 1.0 - excess / decayRange);
  return parseFloat(fit.toFixed(4));
}

/**
 * Calculate the swell quality boost for small waves.
 *
 * Only applies when waveHeight < 2ft. Long-period groundswell with ideal
 * swell direction earns up to 12 additional points, rewarding quality
 * over raw wave height.
 *
 * @param forecast - Forecast data including wave height, period, and swell direction
 * @param beach - Beach configuration with swell window preferences
 * @returns Boost points (0–12)
 */
export function calculateSwellQualityBoost(
  forecast: ForecastForScoring,
  beach: BeachWithThresholds
): number {
  // Only boost small waves (< 2ft)
  if (forecast.waveHeight >= 2) return 0;

  // Period factor: long period = more energy even at small heights
  // ≥14s = excellent groundswell, 10-14s = moderate, 8-10s = marginal, <8s = wind chop (no boost)
  let periodFactor: number;
  if (forecast.wavePeriod >= 14) {
    periodFactor = 1.0;
  } else if (forecast.wavePeriod >= 10) {
    periodFactor = 0.6;
  } else if (forecast.wavePeriod >= 8) {
    periodFactor = 0.2;
  } else {
    periodFactor = 0.05; // Near-zero for short-period wind chop
  }

  // Direction factor: how well the swell aligns with beach's ideal window
  const directionFactor = calculateSwellDirectionFit(forecast.swellDirection, beach);

  // Small wave multiplier: scales from 0 (at 0.5ft or below) to 1.0 (approaching 2ft)
  // This ensures very flat days don't get a big boost
  const clampedHeight = Math.max(0, Math.min(2, forecast.waveHeight));
  const smallWaveMultiplier = Math.max(0, (clampedHeight - 0.5) / 1.5);

  const boost = periodFactor * directionFactor * smallWaveMultiplier * 12;
  return parseFloat(boost.toFixed(4));
}

/**
 * Check if wind is onshore relative to the beach's offshore direction
 */
function isWindOnshore(
  windDirection: number,
  offshoreDirection: number,
  tolerance: number
): boolean {
  // Onshore is 180 degrees from offshore
  const onshoreDirection = (offshoreDirection + 180) % 360;
  return angleDifference(windDirection, onshoreDirection) <= tolerance;
}

/**
 * Check skip conditions - these override normal scoring
 */
function checkSkipConditions(
  forecast: ForecastForScoring,
  beach: BeachWithThresholds
): { skip: boolean; reason: string | null } {
  const maxWindAny = beach.max_wind_any_mph ?? DEFAULT_MAX_WIND_ANY_MPH;
  const maxWindOnshore = beach.max_wind_onshore_mph ?? DEFAULT_MAX_WIND_ONSHORE_MPH;
  const offshoreDir = beach.wind_offshore_deg ?? 90;
  if (beach.wind_offshore_deg == null) {
    trackFallback({ domain: 'scoring', field: 'wind_offshore_deg', fallbackValue: 90, context: { beachId: beach.id } });
  }
  const tolerance = beach.wind_offshore_tol_deg ?? DEFAULT_WIND_OFFSHORE_TOL_DEG;

  // Check if wind exceeds absolute maximum
  if (forecast.windSpeed > maxWindAny) {
    return { skip: true, reason: `Too windy (${Math.round(forecast.windSpeed)} mph)` };
  }

  // Check if onshore wind exceeds threshold
  if (forecast.windDirection !== null) {
    const isOnshore = isWindOnshore(forecast.windDirection, offshoreDir, tolerance);
    if (isOnshore && forecast.windSpeed > maxWindOnshore) {
      return { skip: true, reason: `Strong onshore wind (${Math.round(forecast.windSpeed)} mph)` };
    }
  }

  return { skip: false, reason: null };
}

/**
 * Score wave height fit (0-25 points)
 * Ideal range: 2-6ft for most conditions
 */
function scoreWaveHeightFit(waveHeight: number): { score: number; reason: string | null } {
  if (waveHeight <= 0) {
    return { score: 0, reason: null };
  }

  // Ideal range: 2-5ft gets max score
  // 1-2ft and 5-7ft get partial score
  // Outside that range drops off
  let score: number;
  let reason: string | null = null;

  if (waveHeight >= 2 && waveHeight <= 5) {
    score = MAX_WAVE_HEIGHT_FIT;
    reason = `Good wave size (${waveHeight.toFixed(1)}ft)`;
  } else if (waveHeight >= 1 && waveHeight < 2) {
    score = Math.round(MAX_WAVE_HEIGHT_FIT * (waveHeight / 2));
    reason = `Small but rideable waves`;
  } else if (waveHeight > 5 && waveHeight <= 8) {
    score = Math.round(MAX_WAVE_HEIGHT_FIT * (1 - (waveHeight - 5) / 6));
    reason = `Larger swell (${waveHeight.toFixed(1)}ft)`;
  } else if (waveHeight > 8) {
    score = Math.round(MAX_WAVE_HEIGHT_FIT * 0.3);
    reason = `Big swell - expert only`;
  } else {
    score = Math.round(MAX_WAVE_HEIGHT_FIT * waveHeight);
  }

  return { score: Math.min(MAX_WAVE_HEIGHT_FIT, Math.max(0, score)), reason };
}

/**
 * Score wave height fit personalized to user preference (0-25 points)
 */
function scoreWaveHeightFitPersonalized(
  waveHeight: number,
  preferredSize: 'small' | 'medium' | 'large'
): { score: number; reason: string | null } {
  if (waveHeight <= 0) {
    return { score: 0, reason: null };
  }

  const ranges = {
    small: { idealMin: 1, idealMax: 3, partialLowMin: 0.5, partialHighMax: 5 },
    medium: { idealMin: 2, idealMax: 5, partialLowMin: 1, partialHighMax: 8 },
    large: { idealMin: 5, idealMax: 10, partialLowMin: 3, partialHighMax: 14 },
  };

  const range = ranges[preferredSize];
  let score: number;
  let reason: string | null = null;

  if (waveHeight >= range.idealMin && waveHeight <= range.idealMax) {
    score = MAX_WAVE_HEIGHT_FIT;
    reason = `Your kind of waves (${waveHeight.toFixed(1)}ft)`;
  } else if (waveHeight < range.idealMin && waveHeight >= range.partialLowMin) {
    score = Math.round(MAX_WAVE_HEIGHT_FIT * (waveHeight / range.idealMin));
    reason = `Below your preferred size (${waveHeight.toFixed(1)}ft)`;
  } else if (waveHeight > range.idealMax && waveHeight <= range.partialHighMax) {
    const fraction = 1 - (waveHeight - range.idealMax) / (range.partialHighMax - range.idealMax);
    score = Math.round(MAX_WAVE_HEIGHT_FIT * fraction);
    reason = `Above your comfort zone (${waveHeight.toFixed(1)}ft)`;
  } else if (waveHeight < range.partialLowMin) {
    score = Math.round(MAX_WAVE_HEIGHT_FIT * 0.1);
    reason = `Below your preferred size (${waveHeight.toFixed(1)}ft)`;
  } else {
    score = Math.round(MAX_WAVE_HEIGHT_FIT * 0.2);
    reason = `Above your comfort zone (${waveHeight.toFixed(1)}ft)`;
  }

  return { score: Math.min(MAX_WAVE_HEIGHT_FIT, Math.max(0, score)), reason };
}

/**
 * Score period energy (0-20 points)
 * Longer periods = more energy = better waves
 */
function scorePeriodEnergy(period: number): { score: number; reason: string | null } {
  if (period <= 0) {
    return { score: 0, reason: null };
  }

  // 14+ seconds is excellent
  // 10-14 is good
  // 6-10 is fair
  // Under 6 is poor
  let score: number;
  let reason: string | null = null;

  if (period >= 14) {
    score = MAX_PERIOD_ENERGY;
    reason = `Strong swell energy (${period}s period)`;
  } else if (period >= 10) {
    score = Math.round(MAX_PERIOD_ENERGY * (0.6 + 0.4 * ((period - 10) / 4)));
    reason = `Good swell energy`;
  } else if (period >= 6) {
    score = Math.round(MAX_PERIOD_ENERGY * (0.3 + 0.3 * ((period - 6) / 4)));
  } else {
    score = Math.round(MAX_PERIOD_ENERGY * (period / 6) * 0.3);
  }

  return { score: Math.min(MAX_PERIOD_ENERGY, Math.max(0, score)), reason };
}

/**
 * Score wind alignment (0-20 points)
 * Offshore > Cross-shore > Onshore
 */
function scoreWindAlignment(
  windSpeed: number,
  windDirection: number | null,
  beach: BeachWithThresholds
): { score: number; reason: string | null; warning: string | null } {
  // Light wind is always good
  if (windSpeed <= 3) {
    return { score: MAX_WIND_ALIGNMENT, reason: 'Glassy conditions', warning: null };
  }

  // No wind direction data - assume moderate score
  if (windDirection === null) {
    return { score: Math.round(MAX_WIND_ALIGNMENT * 0.5), reason: null, warning: 'Wind direction unknown' };
  }

  const offshoreDir = beach.wind_offshore_deg ?? 90;
  const tolerance = beach.wind_offshore_tol_deg ?? DEFAULT_WIND_OFFSHORE_TOL_DEG;

  const angleFromOffshore = angleDifference(windDirection, offshoreDir);
  const isOffshore = angleFromOffshore <= tolerance;
  const isCrossShore = angleFromOffshore > tolerance && angleFromOffshore <= tolerance + 60;
  const isOnshore = !isOffshore && !isCrossShore;

  let score: number;
  let reason: string | null = null;
  let warning: string | null = null;

  if (isOffshore) {
    // Offshore - excellent, but degrade slightly with higher speeds
    const speedFactor = Math.max(0.6, 1 - (windSpeed - 3) / 30);
    score = Math.round(MAX_WIND_ALIGNMENT * speedFactor);
    reason = 'Offshore wind';
  } else if (isCrossShore) {
    // Cross-shore - ok for most conditions
    const speedFactor = Math.max(0.4, 1 - (windSpeed - 3) / 20);
    score = Math.round(MAX_WIND_ALIGNMENT * 0.7 * speedFactor);
    if (windSpeed > 10) {
      warning = 'Cross-shore wind picking up';
    }
  } else {
    // Onshore - poor
    const speedFactor = Math.max(0.2, 1 - (windSpeed - 3) / 15);
    score = Math.round(MAX_WIND_ALIGNMENT * 0.3 * speedFactor);
    warning = 'Onshore wind';
  }

  return { score: Math.min(MAX_WIND_ALIGNMENT, Math.max(0, score)), reason, warning };
}

/**
 * Score tide fit (0-15 points)
 * Based on beach's preferred tide range
 */
function scoreTideFit(
  tideHeight: number,
  beach: BeachWithThresholds
): { score: number; reason: string | null; warning: string | null } {
  const minTide = beach.preferred_tide_ft_min ?? 0;
  const maxTide = beach.preferred_tide_ft_max ?? 6;

  // If no tide preferences, give moderate score
  if (beach.preferred_tide_ft_min === null && beach.preferred_tide_ft_max === null) {
    return { score: Math.round(MAX_TIDE_FIT * 0.7), reason: null, warning: null };
  }

  let score: number;
  let reason: string | null = null;
  let warning: string | null = null;

  if (tideHeight >= minTide && tideHeight <= maxTide) {
    score = MAX_TIDE_FIT;
    reason = 'Good tide';
  } else if (tideHeight < minTide) {
    const diff = minTide - tideHeight;
    score = Math.round(MAX_TIDE_FIT * Math.max(0.2, 1 - diff / 2));
    warning = 'Tide is low';
  } else {
    // tideHeight > maxTide
    const diff = tideHeight - maxTide;
    score = Math.round(MAX_TIDE_FIT * Math.max(0.2, 1 - diff / 2));
    warning = 'Tide is high';
  }

  return { score: Math.min(MAX_TIDE_FIT, Math.max(0, score)), reason, warning };
}

/**
 * Determine match quality from normalized score
 */
function getMatchQuality(score: number): MatchQuality {
  if (score >= THRESHOLD_PERFECT) return 'perfect';
  if (score >= THRESHOLD_EXCELLENT) return 'excellent';
  if (score >= THRESHOLD_GOOD) return 'good';
  if (score >= THRESHOLD_FAIR) return 'fair';
  if (score >= THRESHOLD_MINIMAL) return 'minimal';
  return 'skip';
}

/**
 * Get recommendation label from match quality
 */
function getRecommendationLabel(quality: MatchQuality): RecommendationLabel {
  switch (quality) {
    case 'perfect':
    case 'excellent':
      return 'Worth it';
    case 'good':
    case 'fair':
      return 'Maybe';
    case 'minimal':
      return 'Maybe'; // Minimal: worth considering for quality chasers
    case 'skip':
      return 'Skip';
  }
}

/**
 * Check if wind is onshore for condition character classification.
 * Reuses beach offshore direction and tolerance.
 */
function isWindOnshoreForCharacter(
  windSpeed: number,
  windDirection: number | null,
  beach: BeachWithThresholds
): boolean {
  if (windDirection === null) return false;
  const offshoreDir = beach.wind_offshore_deg ?? 90;
  const onshoreDir = (offshoreDir + 180) % 360;
  const tolerance = beach.wind_offshore_tol_deg ?? DEFAULT_WIND_OFFSHORE_TOL_DEG;
  return windSpeed > 0 && angleDifference(windDirection, onshoreDir) <= tolerance;
}

/**
 * Determine the qualitative condition character.
 *
 * Priority-ordered decision tree: first matching rule wins.
 * Categories: skip → flat → small-quality/clean/weak → medium-clean/mixed → large-clean/rough
 *
 * @param forecast - The forecast data
 * @param beach - Beach configuration
 * @param subscores - Already-computed subscores for context
 * @param totalScore - Final capped score (0-100)
 * @returns ConditionCharacter with label and category
 */
export function getConditionCharacter(
  forecast: ForecastForScoring,
  beach: BeachWithThresholds,
  subscores: ConditionSubscores,
  totalScore: number
): ConditionCharacter {
  const { waveHeight, wavePeriod, windSpeed, windDirection } = forecast;
  const maxWindAny = beach.max_wind_any_mph ?? DEFAULT_MAX_WIND_ANY_MPH;
  const maxWindOnshore = beach.max_wind_onshore_mph ?? DEFAULT_MAX_WIND_ONSHORE_MPH;
  const isOnshore = isWindOnshoreForCharacter(windSpeed, windDirection, beach);

  // 1. Skip conditions — blown out or dominated by onshore wind
  if (windSpeed > maxWindAny) {
    return { category: 'skip', label: 'Blown out — too much wind' };
  }
  if (isOnshore && windSpeed > maxWindOnshore) {
    return { category: 'skip', label: 'Onshore wind — conditions blown out' };
  }

  // 2. Flat — barely anything to surf
  if (waveHeight < 0.5) {
    return { category: 'flat', label: 'Flat — rest day' };
  }

  // 3. Small waves (0.5–2ft)
  if (waveHeight < 2) {
    // Small-weak: onshore or very short period wind chop (checked early)
    if (wavePeriod < 8) {
      // Short period always = weak, regardless of wind
      if (isOnshore && windSpeed > 5) {
        return { category: 'small-weak', label: 'Small & choppy — onshore wind' };
      }
      return { category: 'small-weak', label: 'Weak swell — minimal energy' };
    }

    // Small-quality: long period + good direction alignment
    if (wavePeriod >= 12) {
      const directionFit = calculateSwellDirectionFit(forecast.swellDirection, beach);
      if (directionFit >= 0.85) {
        return { category: 'small-quality', label: 'Small but powerful — long-period energy' };
      }
      // Moderate direction alignment with good period — still has push
      if (directionFit >= 0.4) {
        return { category: 'small-quality', label: 'Small with some push — angled swell' };
      }
    }

    // Small-clean: light wind, not onshore (8s+ period)
    if (windSpeed <= 5 && !isOnshore) {
      return { category: 'small-clean', label: 'Small & clean — glassy conditions' };
    }

    // Small-weak: onshore wind (8-11s period)
    if (isOnshore && windSpeed > 5) {
      return { category: 'small-weak', label: 'Small & choppy — onshore wind' };
    }

    // Catch-all small fallback
    return { category: 'small-weak', label: 'Small — marginal conditions' };
  }

  // 4. Medium waves (2–5ft)
  if (waveHeight < 5) {
    const windIsGood = subscores.windAlignment >= Math.round(MAX_WIND_ALIGNMENT * 0.7);
    const tideIsGood = subscores.tideFit >= Math.round(MAX_TIDE_FIT * 0.7);
    if (windIsGood && tideIsGood && wavePeriod >= 10) {
      return { category: 'medium-clean', label: 'Dialed — everything\'s lining up' };
    }
    return { category: 'medium-mixed', label: 'Decent — some quality in the mix' };
  }

  // 5. Large waves (5ft+)
  const windIsClean = subscores.windAlignment >= Math.round(MAX_WIND_ALIGNMENT * 0.6);
  if (windIsClean && wavePeriod >= 10) {
    return { category: 'large-clean', label: 'Firing — overhead and clean' };
  }
  return { category: 'large-rough', label: 'Big and rough — experts only' };
}

/**
 * Build natural language message from reasons and warnings
 */
function buildMessage(
  quality: MatchQuality,
  label: RecommendationLabel,
  reasons: string[],
  warnings: string[],
  skipReason: string | null
): string {
  if (quality === 'skip') {
    return `Skip — ${skipReason || 'Conditions not favorable'}`;
  }

  const topReasons = reasons.slice(0, 2).join(', ');
  let message = `${label} — ${topReasons || 'Conditions look decent'}`;

  if (warnings.length > 0) {
    message += `. Watch: ${warnings[0]}`;
  }

  return message;
}

/**
 * Compute a wave-height-based score ceiling (0-100).
 *
 * Maps wave height to a ceiling that caps the overall condition score,
 * preventing inflated scores when waves are too small or too large for
 * the beach's skill level.
 *
 * Segments:
 *   0 ft            -> 0
 *   0 < h < 1       -> 0-20  (linear ramp)
 *   1 <= h < idealMin -> 30-55 (ramp toward ideal)
 *   idealMin <= h <= idealMax -> 55-100 (full ideal range)
 *   h > idealMax    -> 100 declining toward 65
 *
 * @param waveHeight - Forecast wave height in feet
 * @param idealMin   - Lower bound of ideal range for skill level
 * @param idealMax   - Upper bound of ideal range for skill level
 * @returns Ceiling value 0-100
 */
export function getWaveHeightCeiling(
  waveHeight: number,
  idealMin: number,
  idealMax: number
): number {
  if (waveHeight <= 0) return 0;
  if (waveHeight < 1) return Math.round(20 * waveHeight); // 0-20
  if (waveHeight < idealMin) {
    return Math.round(
      30 + ((waveHeight - 1) / Math.max(idealMin - 1, 0.5)) * 25
    ); // 30-55
  }
  if (waveHeight <= idealMax) {
    return Math.round(
      55 +
        ((waveHeight - idealMin) / Math.max(idealMax - idealMin, 1)) * 45
    ); // 55-100
  }
  // Above ideal: decline from 100 toward 65
  const overRatio = Math.min((waveHeight - idealMax) / idealMax, 1);
  return Math.round(100 - overRatio * 35);
}

/**
 * Options for scoreConditions()
 */
export interface ScoreConditionsOptions {
  /** Water quality status for the beach */
  waterQuality?: { status: 'good' | 'advisory' | 'closure' | 'unknown' };
  userPreferences?: UserScoringPreferences;
}

/**
 * Main scoring function
 *
 * Scores surf conditions based on forecast data and beach characteristics.
 *
 * @param forecast - The forecast data to score
 * @param beach - The beach with its configuration thresholds
 * @param options - Optional overrides (e.g. water quality status)
 * @returns ConditionScore with total, subscores, quality, and message
 */
export function scoreConditions(
  forecast: ForecastForScoring,
  beach: BeachWithThresholds,
  options?: ScoreConditionsOptions
): ConditionScore {
  // Water quality closure overrides all scoring — site is unsafe
  if (options?.waterQuality?.status === 'closure') {
    const closureSubscores: ConditionSubscores = { waveHeightFit: 0, periodEnergy: 0, windAlignment: 0, tideFit: 0 };
    return {
      total: 0,
      subscores: closureSubscores,
      matchQuality: 'skip',
      recommendationLabel: 'Skip',
      reasons: [],
      warnings: ['Water quality closure — health advisory active'],
      message: 'Skip — Water quality closure, health advisory active',
      waterQualityWarning: 'Water quality closure — health advisory active',
      character: getConditionCharacter(forecast, beach, closureSubscores, 0),
      swellQualityBoost: 0,
    };
  }

  // Check skip conditions first
  const skipCheck = checkSkipConditions(forecast, beach);

  if (skipCheck.skip) {
    const skipSubscores: ConditionSubscores = { waveHeightFit: 0, periodEnergy: 0, windAlignment: 0, tideFit: 0 };
    return {
      total: 0,
      subscores: skipSubscores,
      matchQuality: 'skip',
      recommendationLabel: 'Skip',
      reasons: [],
      warnings: [skipCheck.reason!],
      message: buildMessage('skip', 'Skip', [], [skipCheck.reason!], skipCheck.reason),
      character: getConditionCharacter(forecast, beach, skipSubscores, 0),
      swellQualityBoost: 0,
    };
  }

  // Calculate subscores
  const waveResult = options?.userPreferences?.preferredWaveSize
    ? scoreWaveHeightFitPersonalized(forecast.waveHeight, options.userPreferences.preferredWaveSize)
    : scoreWaveHeightFit(forecast.waveHeight);
  const periodResult = scorePeriodEnergy(forecast.wavePeriod);
  const windResult = scoreWindAlignment(forecast.windSpeed, forecast.windDirection, beach);
  const tideResult = scoreTideFit(forecast.tideHeight, beach);

  // Calculate base subscores (kept pure for transparency and existing test compatibility)
  const subscores: ConditionSubscores = {
    waveHeightFit: waveResult.score,
    periodEnergy: periodResult.score,
    windAlignment: windResult.score,
    tideFit: tideResult.score,
  };

  // Apply swell quality boost separately (adds to raw total but not subscores)
  // Only applies when waveHeight < 2ft — rewards groundswell quality at small sizes
  const swellBoostRaw = calculateSwellQualityBoost(forecast, beach);
  const swellQualityBoost = Math.round(swellBoostRaw);

  // Calculate normalized total (0-100), applying boost capped at MAX_WAVE_HEIGHT_FIT headroom
  const baseRawTotal = subscores.waveHeightFit + subscores.periodEnergy + subscores.windAlignment + subscores.tideFit;
  // Boost is applied before normalization, capped so total waveHeightFit contribution ≤ MAX_WAVE_HEIGHT_FIT
  const cappedBoost = Math.min(swellQualityBoost, MAX_WAVE_HEIGHT_FIT - subscores.waveHeightFit);
  const rawTotal = baseRawTotal + cappedBoost;
  const normalizedTotal = Math.round((rawTotal / MAX_RAW_POINTS) * 100);

  // Apply wave-height ceiling based on beach skill level
  const parsedSkill = parseSkillLevel(beach.skill_level);
  const skillRanges = SKILL_WAVE_RANGES[parsedSkill ?? 'intermediate'];
  const baseCeiling = getWaveHeightCeiling(
    forecast.waveHeight,
    skillRanges.ideal.min,
    skillRanges.ideal.max
  );
  // Swell quality boost can raise the ceiling for small-but-quality days
  // (a 14s groundswell at 1.5ft is more surfable than flat wind chop at 1.5ft)
  const qualityCeilingBonus = cappedBoost > 0 ? Math.round((cappedBoost / MAX_WAVE_HEIGHT_FIT) * 20) : 0;
  const ceiling = Math.min(100, baseCeiling + qualityCeilingBonus);
  const cappedTotal = Math.min(normalizedTotal, ceiling);

  // Determine quality and label
  const matchQuality = getMatchQuality(cappedTotal);
  const recommendationLabel = getRecommendationLabel(matchQuality);

  // Collect reasons and warnings
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (waveResult.reason) reasons.push(waveResult.reason);
  if (periodResult.reason) reasons.push(periodResult.reason);
  if (windResult.reason) reasons.push(windResult.reason);
  if (tideResult.reason) reasons.push(tideResult.reason);

  if (windResult.warning) warnings.push(windResult.warning);
  if (tideResult.warning) warnings.push(tideResult.warning);

  // Build message
  const message = buildMessage(matchQuality, recommendationLabel, reasons, warnings, null);

  // Classify condition character (qualitative label for UI)
  const character = getConditionCharacter(forecast, beach, subscores, cappedTotal);

  const result: ConditionScore = {
    total: cappedTotal,
    subscores,
    matchQuality,
    recommendationLabel,
    reasons,
    warnings,
    message,
    character,
    swellQualityBoost,
  };

  // Inject advisory warning without overriding the score
  if (options?.waterQuality?.status === 'advisory') {
    const advisoryMsg = 'Water quality advisory — elevated bacteria levels';
    result.warnings.push(advisoryMsg);
    result.waterQualityWarning = advisoryMsg;
  }

  return result;
}
