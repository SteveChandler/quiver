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
  MatchQuality,
  RecommendationLabel,
} from './types';
import { trackFallback } from '@/lib/monitoring/fallback-tracker';

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

/**
 * Calculate angular difference between two directions (in degrees)
 * Returns value between 0 and 180
 */
function angleDifference(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2) % 360;
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
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
    case 'skip':
      return 'Skip';
  }
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
 * Options for scoreConditions()
 */
export interface ScoreConditionsOptions {
  /** Water quality status for the beach */
  waterQuality?: { status: 'good' | 'advisory' | 'closure' | 'unknown' };
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
    return {
      total: 0,
      subscores: { waveHeightFit: 0, periodEnergy: 0, windAlignment: 0, tideFit: 0 },
      matchQuality: 'skip',
      recommendationLabel: 'Skip',
      reasons: [],
      warnings: ['Water quality closure — health advisory active'],
      message: 'Skip — Water quality closure, health advisory active',
      waterQualityWarning: 'Water quality closure — health advisory active',
    };
  }

  // Check skip conditions first
  const skipCheck = checkSkipConditions(forecast, beach);

  if (skipCheck.skip) {
    return {
      total: 0,
      subscores: {
        waveHeightFit: 0,
        periodEnergy: 0,
        windAlignment: 0,
        tideFit: 0,
      },
      matchQuality: 'skip',
      recommendationLabel: 'Skip',
      reasons: [],
      warnings: [skipCheck.reason!],
      message: buildMessage('skip', 'Skip', [], [skipCheck.reason!], skipCheck.reason),
    };
  }

  // Calculate subscores
  const waveResult = scoreWaveHeightFit(forecast.waveHeight);
  const periodResult = scorePeriodEnergy(forecast.wavePeriod);
  const windResult = scoreWindAlignment(forecast.windSpeed, forecast.windDirection, beach);
  const tideResult = scoreTideFit(forecast.tideHeight, beach);

  const subscores: ConditionSubscores = {
    waveHeightFit: waveResult.score,
    periodEnergy: periodResult.score,
    windAlignment: windResult.score,
    tideFit: tideResult.score,
  };

  // Calculate normalized total (0-100)
  const rawTotal = subscores.waveHeightFit + subscores.periodEnergy + subscores.windAlignment + subscores.tideFit;
  const normalizedTotal = Math.round((rawTotal / MAX_RAW_POINTS) * 100);

  // Determine quality and label
  const matchQuality = getMatchQuality(normalizedTotal);
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

  const result: ConditionScore = {
    total: normalizedTotal,
    subscores,
    matchQuality,
    recommendationLabel,
    reasons,
    warnings,
    message,
  };

  // Inject advisory warning without overriding the score
  if (options?.waterQuality?.status === 'advisory') {
    const advisoryMsg = 'Water quality advisory — elevated bacteria levels';
    result.warnings.push(advisoryMsg);
    result.waterQualityWarning = advisoryMsg;
  }

  return result;
}
