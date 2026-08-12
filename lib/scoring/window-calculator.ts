/**
 * Window Calculator - Finds optimal surf windows using linear interpolation
 *
 * Scores forecasts and identifies contiguous time windows where conditions
 * are favorable for surfing, using interpolation for precise transition times.
 */

import type {
  BeachWithThresholds,
  ForecastForScoring,
  OptimalWindow,
  WindowCalculatorOptions,
  WindowBoundaryReason,
  MultiWindowResult,
} from './types';
import type { Beach } from '@/types/database';
import type { ConditionsSnapshot } from '@/lib/domains/conditions/types';
import type { BoardClass } from '@/lib/domains/rideability';
import { createSwellComponent } from '@/lib/domains/conditions';
import {
  beachToSpotProfile,
  createDiscoveryScoringEngine,
  getConditionCharacter,
  type ScoringEngine,
} from '@/lib/domains/scoring';
import {
  resolveNativeSkillLevel,
  scoreNativeConditionInputs,
} from '@/lib/scoring/native-condition-score';
import { getRideabilityBand } from '@/lib/domains/rideability';
import {
  DAYLIGHT_END_HOUR,
  DAYLIGHT_START_HOUR,
} from '@/lib/services/magic-hour/constants';
import { getLocalHour } from '@/lib/utils/timezone-utils';
import { generateWindowMessage } from './message-generator';

// Singleton engine for performance — created lazily on first call.
let _engine: ScoringEngine | null = null;
function getEngine(): ScoringEngine {
  if (!_engine) {
    _engine = createDiscoveryScoringEngine();
  }
  return _engine;
}

/**
 * Convert ForecastForScoring (legacy scoring shape) to a ConditionsSnapshot
 * the domain engine can consume. Mirrors the field mapping in
 * `discovery-adapter.forecastToSnapshot` but works from the already-parsed
 * `ForecastForScoring` rather than a raw `EnhancedForecastEntity`.
 */
function forecastForScoringToSnapshot(forecast: ForecastForScoring): ConditionsSnapshot {
  const swellDirection = forecast.swellDirection ?? null;
  const primarySwell =
    forecast.waveHeight > 0 && forecast.wavePeriod > 0
      ? createSwellComponent(
          forecast.waveHeight,
          forecast.wavePeriod,
          swellDirection ?? 270,
        )
      : null;

  const tideStatus = forecast.tideStatus?.toLowerCase() ?? null;
  let parsedTideStatus: ConditionsSnapshot['tide']['status'] = 'unknown';
  let parsedTideDirection: ConditionsSnapshot['tide']['direction'] = 'slack';
  if (tideStatus) {
    if (tideStatus.includes('rising')) {
      parsedTideStatus = 'rising';
      parsedTideDirection = 'rising';
    } else if (tideStatus.includes('falling')) {
      parsedTideStatus = 'falling';
      parsedTideDirection = 'falling';
    } else if (tideStatus.includes('high')) {
      parsedTideStatus = 'slack-high';
    } else if (tideStatus.includes('low')) {
      parsedTideStatus = 'slack-low';
    } else if (tideStatus.includes('slack')) {
      parsedTideStatus = 'slack-high';
    }
  }

  return {
    timestamp: forecast.forecastTime,
    waveHeight: forecast.waveHeight,
    wavePeriod: forecast.wavePeriod,
    waveDirection: swellDirection,
    primarySwell,
    secondarySwell: null,
    windWave: null,
    wind: {
      speedMph: forecast.windSpeed,
      directionDeg: forecast.windDirection,
    },
    tide: {
      heightFt: forecast.tideHeight,
      status: parsedTideStatus,
      direction: parsedTideDirection,
    },
    confidence: 80,
    dataSource: 'unknown',
  };
}

/**
 * Score a forecast against the native-compatible conditions model.
 * Returns the same `total` shape as the legacy scorer for downstream use.
 */
function scoreForecastTotal(
  forecast: ForecastForScoring,
  _beach: BeachWithThresholds,
  skillLevel?: WindowCalculatorOptions['skillLevel'],
  boardClasses: readonly BoardClass[] = [],
): number {
  const inputs = {
    waveHeightFt: forecast.waveHeight,
    windSpeedMph: forecast.windSpeed,
    periodSec: forecast.wavePeriod,
    tideHeightFt: Number.isFinite(forecast.tideHeight) ? forecast.tideHeight : null,
    tideStatus: forecast.tideStatus,
  };
  const baselineScore = scoreNativeConditionInputs(inputs, skillLevel);
  if (boardClasses.length === 0) return baselineScore;

  const resolvedSkill = resolveNativeSkillLevel(skillLevel, 'intermediate');
  return boardClasses.reduce((bestScore, boardClass) => {
    const boardScore = scoreNativeConditionInputs(
      inputs,
      resolvedSkill,
      getRideabilityBand(resolvedSkill, boardClass),
    );
    return Math.max(bestScore, boardScore);
  }, baselineScore);
}

// Default configuration
const DEFAULT_MIN_SCORE_THRESHOLD = 40;
const DEFAULT_MIN_SESSION_HOURS = 1;
const MAX_WINDOW_HOURS = 4;

function filterForecastsToDaylight(
  forecasts: ForecastForScoring[],
  beachTimezone?: string
): ForecastForScoring[] {
  if (!beachTimezone) return forecasts;

  return forecasts.filter((forecast) => {
    const localHour = getLocalHour(forecast.forecastTime, beachTimezone);
    return (
      localHour >= DAYLIGHT_START_HOUR &&
      localHour < DAYLIGHT_END_HOUR
    );
  });
}

/**
 * Scored forecast point with the original forecast and computed score
 */
interface ScoredForecast {
  forecast: ForecastForScoring;
  score: number;
  isViable: boolean;
}

/**
 * Calculates the optimal surf window from forecast data
 *
 * @param forecasts - Array of forecast data points
 * @param beach - Beach configuration with wind/tide thresholds
 * @param options - Optional configuration for window calculation
 * @returns OptimalWindow if viable window found, null otherwise
 *
 * @example
 * const window = calculateOptimalWindow(forecasts, beach, { sunsetTime: sunset });
 * if (window) {
 *   console.log(`Best window: ${window.start} to ${window.end}`);
 *   console.log(window.message);
 * }
 */
export function calculateOptimalWindow(
  forecasts: ForecastForScoring[],
  beach: BeachWithThresholds,
  options: WindowCalculatorOptions = {}
): OptimalWindow | null {
  if (forecasts.length === 0) {
    return null;
  }

  const {
    sunsetTime,
    minScoreThreshold = DEFAULT_MIN_SCORE_THRESHOLD,
    minSessionHours = DEFAULT_MIN_SESSION_HOURS,
  } = options;
  const daylightForecasts = filterForecastsToDaylight(
    forecasts,
    options.beachTimezone
  );

  if (daylightForecasts.length === 0) {
    return null;
  }

  // Score all forecasts
  const scoredForecasts = scoreForecasts(
    daylightForecasts,
    beach,
    minScoreThreshold,
    options.skillLevel,
    options.boardClasses,
  );

  // Find best contiguous window
  const windowIndices = findBestWindow(scoredForecasts);

  if (!windowIndices) {
    return null;
  }

  const { startIndex, endIndex } = windowIndices;

  // Calculate precise start time (interpolate if needed)
  const startInfo = calculateWindowStart(
    scoredForecasts,
    startIndex,
    minScoreThreshold
  );

  // Calculate precise end time (interpolate if needed)
  let endInfo = calculateWindowEnd(
    scoredForecasts,
    endIndex,
    minScoreThreshold
  );

  // Apply maximum window length
  const maxEndTime = new Date(startInfo.time.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
  if (endInfo.time.getTime() > maxEndTime.getTime()) {
    endInfo = {
      time: maxEndTime,
      reason: {
        time: maxEndTime,
        factor: 'score',
        description: 'maximum window length reached',
      },
    };
  }

  // Cap at sunset if provided
  if (sunsetTime && endInfo.time.getTime() > sunsetTime.getTime()) {
    endInfo = {
      time: sunsetTime,
      reason: {
        time: sunsetTime,
        factor: 'sunset',
        description: 'sunset',
      },
    };
  }

  // Verify minimum session length
  const durationMs = endInfo.time.getTime() - startInfo.time.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  if (durationHours < minSessionHours) {
    return null;
  }

  // Find peak time within window
  const peakTime = findPeakTime(scoredForecasts, startIndex, endIndex);
  const peakScore = peakTime
    ? scoredForecasts.find(
        (scored) => scored.forecast.forecastTime.getTime() === peakTime.getTime(),
      )?.score
    : undefined;

  // Generate message
  const message = generateWindowMessage(startInfo.reason, endInfo.reason);

  return {
    start: startInfo.time,
    end: endInfo.time,
    startReason: startInfo.reason,
    endReason: endInfo.reason,
    message,
    peakTime,
    peakScore,
  };
}

/**
 * Scores all forecasts and marks viability
 */
function scoreForecasts(
  forecasts: ForecastForScoring[],
  beach: BeachWithThresholds,
  minScoreThreshold: number,
  skillLevel?: WindowCalculatorOptions['skillLevel'],
  boardClasses: readonly BoardClass[] = [],
): ScoredForecast[] {
  return forecasts.map(forecast => {
    const total = scoreForecastTotal(forecast, beach, skillLevel, boardClasses);
    return {
      forecast,
      score: total,
      isViable: total >= minScoreThreshold,
    };
  });
}

/**
 * Finds the best contiguous window of viable forecasts
 * Returns null if no viable window exists
 */
function findBestWindow(
  scoredForecasts: ScoredForecast[]
): { startIndex: number; endIndex: number } | null {
  if (scoredForecasts.length === 0) {
    return null;
  }

  let bestStart = -1;
  let bestEnd = -1;
  let bestAvgScore = -1;
  let bestWindowLength = 0;

  let currentStart = -1;

  for (let i = 0; i < scoredForecasts.length; i++) {
    const sf = scoredForecasts[i];

    if (sf.isViable) {
      if (currentStart === -1) {
        currentStart = i;
      }

      // Check if this is the best window so far
      const windowForecasts = scoredForecasts.slice(currentStart, i + 1);
      const avgScore = windowForecasts.reduce((sum, f) => sum + f.score, 0) / windowForecasts.length;
      const windowLength = i - currentStart + 1;

      // Prefer higher scores, and longer windows when scores are equal
      const isBetter = avgScore > bestAvgScore ||
        (avgScore === bestAvgScore && windowLength > bestWindowLength);

      if (isBetter) {
        bestAvgScore = avgScore;
        bestWindowLength = windowLength;
        bestStart = currentStart;
        bestEnd = i;
      }
    } else {
      currentStart = -1;
    }
  }

  if (bestStart === -1 || bestEnd === -1) {
    return null;
  }

  // Need at least 2 data points to form a meaningful window
  if (bestStart === bestEnd) {
    return null;
  }

  return { startIndex: bestStart, endIndex: bestEnd };
}

/**
 * Calculates the precise window start time using interpolation
 */
function calculateWindowStart(
  scoredForecasts: ScoredForecast[],
  startIndex: number,
  minScoreThreshold: number
): { time: Date; reason: WindowBoundaryReason } {
  const startForecast = scoredForecasts[startIndex];

  // If this is the first forecast or the previous one is also viable,
  // use the forecast time directly
  if (startIndex === 0 || scoredForecasts[startIndex - 1].isViable) {
    const reason = determineStartReason(startForecast.forecast);
    return {
      time: startForecast.forecast.forecastTime,
      reason,
    };
  }

  // Interpolate between previous (non-viable) and current (viable) forecast
  const prevForecast = scoredForecasts[startIndex - 1];

  const interpolatedTime = interpolateTransition(
    prevForecast.forecast.forecastTime,
    prevForecast.score,
    startForecast.forecast.forecastTime,
    startForecast.score,
    minScoreThreshold
  );

  const reason = determineStartReason(startForecast.forecast, prevForecast.forecast);

  return {
    time: interpolatedTime,
    reason,
  };
}

/**
 * Calculates the precise window end time using interpolation
 */
function calculateWindowEnd(
  scoredForecasts: ScoredForecast[],
  endIndex: number,
  minScoreThreshold: number
): { time: Date; reason: WindowBoundaryReason } {
  const endForecast = scoredForecasts[endIndex];

  // If this is the last forecast or the next one is also viable,
  // use the forecast time directly
  if (
    endIndex === scoredForecasts.length - 1 ||
    scoredForecasts[endIndex + 1].isViable
  ) {
    const reason = determineEndReason(endForecast.forecast);
    return {
      time: endForecast.forecast.forecastTime,
      reason,
    };
  }

  // Interpolate between current (viable) and next (non-viable) forecast
  const nextForecast = scoredForecasts[endIndex + 1];

  const interpolatedTime = interpolateTransition(
    endForecast.forecast.forecastTime,
    endForecast.score,
    nextForecast.forecast.forecastTime,
    nextForecast.score,
    minScoreThreshold
  );

  const reason = determineEndReason(nextForecast.forecast, endForecast.forecast);

  return {
    time: interpolatedTime,
    reason,
  };
}

/**
 * Linear interpolation to find when score crosses threshold
 *
 * Given two time points with scores, finds the time when the score
 * crosses the threshold.
 */
function interpolateTransition(
  time1: Date,
  score1: number,
  time2: Date,
  score2: number,
  threshold: number
): Date {
  // If scores are the same, return midpoint
  if (score1 === score2) {
    const midMs = (time1.getTime() + time2.getTime()) / 2;
    return new Date(midMs);
  }

  // Calculate interpolation factor
  // t = (threshold - score1) / (score2 - score1)
  const t = (threshold - score1) / (score2 - score1);

  // Clamp to [0, 1] range
  const clampedT = Math.max(0, Math.min(1, t));

  // Interpolate time
  const ms1 = time1.getTime();
  const ms2 = time2.getTime();
  const interpolatedMs = ms1 + clampedT * (ms2 - ms1);

  return new Date(interpolatedMs);
}

/**
 * Determines the reason for the window starting
 */
function determineStartReason(
  current: ForecastForScoring,
  previous?: ForecastForScoring
): WindowBoundaryReason {
  if (!previous) {
    return {
      time: current.forecastTime,
      factor: 'score',
      description: 'conditions become favorable',
    };
  }

  // Check what improved
  const windImproved = current.windSpeed < previous.windSpeed;
  const tideImproved = didTideEnterRange(previous.tideHeight, current.tideHeight);

  if (tideImproved) {
    const isRising = current.tideHeight > previous.tideHeight;
    return {
      time: current.forecastTime,
      factor: 'tide',
      description: isRising ? 'rising tide enters range' : 'falling tide enters range',
    };
  }

  if (windImproved) {
    return {
      time: current.forecastTime,
      factor: 'wind',
      description: 'wind calms down',
    };
  }

  return {
    time: current.forecastTime,
    factor: 'score',
    description: 'conditions become favorable',
  };
}

/**
 * Determines the reason for the window ending
 */
function determineEndReason(
  next: ForecastForScoring,
  current?: ForecastForScoring
): WindowBoundaryReason {
  if (!current) {
    return {
      time: next.forecastTime,
      factor: 'score',
      description: 'conditions degrade',
    };
  }

  // Check what degraded
  const windWorsened = next.windSpeed > current.windSpeed && next.windSpeed > 15;
  const tideTooHigh = next.tideHeight > 5;
  const tideTooLow = next.tideHeight < 2;

  if (windWorsened) {
    return {
      time: next.forecastTime,
      factor: 'wind',
      description: 'wind picks up',
    };
  }

  if (tideTooHigh) {
    return {
      time: next.forecastTime,
      factor: 'tide',
      description: 'tide too high',
    };
  }

  if (tideTooLow) {
    return {
      time: next.forecastTime,
      factor: 'tide',
      description: 'tide too low',
    };
  }

  return {
    time: next.forecastTime,
    factor: 'score',
    description: 'conditions degrade',
  };
}

/**
 * Check if tide moved into preferred range
 * Assumes typical preferred range of 2-5ft
 */
function didTideEnterRange(prevTide: number, currentTide: number): boolean {
  const minTide = 2.0;
  const maxTide = 5.0;

  const wasOutOfRange = prevTide < minTide || prevTide > maxTide;
  const isInRange = currentTide >= minTide && currentTide <= maxTide;

  return wasOutOfRange && isInRange;
}

/**
 * Finds the time of peak score within the window
 */
export function findPeakTime(
  scoredForecasts: ScoredForecast[],
  startIndex: number,
  endIndex: number
): Date | undefined {
  if (startIndex > endIndex) {
    return undefined;
  }

  let peakIndex = startIndex;
  let peakScore = scoredForecasts[startIndex].score;

  for (let i = startIndex + 1; i <= endIndex; i++) {
    if (scoredForecasts[i].score > peakScore) {
      peakScore = scoredForecasts[i].score;
      peakIndex = i;
    }
  }

  const peak = scoredForecasts[peakIndex];
  const peakTideStatus = peak.forecast.tideStatus;
  const isSlack =
    peakTideStatus === 'slack-high' || peakTideStatus === 'slack-low';
  if (isSlack) {
    let bestNonSlackIndex = -1;
    for (let i = startIndex; i <= endIndex; i++) {
      const s = scoredForecasts[i];
      const ts = s.forecast.tideStatus;
      if (ts !== 'slack-high' && ts !== 'slack-low' && peak.score - s.score <= 5) {
        if (bestNonSlackIndex === -1 || s.score > scoredForecasts[bestNonSlackIndex].score) {
          bestNonSlackIndex = i;
        }
      }
    }
    if (bestNonSlackIndex !== -1) {
      return scoredForecasts[bestNonSlackIndex].forecast.forecastTime;
    }
  }

  return peak.forecast.forecastTime;
}

// Threshold for multi-window viability (lower than single-window to surface more options)
const MULTI_WINDOW_MIN_SCORE = 30;
// Minimum window duration in hours
const MULTI_WINDOW_MIN_DURATION_HOURS = 1.5;
// Minimum gap between windows in hours (closer windows get merged)
const MULTI_WINDOW_MIN_GAP_HOURS = 2;
// Default maximum windows to return
const MULTI_WINDOW_DEFAULT_MAX = 3;

/**
 * Contiguous block of viable forecast indices
 */
interface ViableBlock {
  startIndex: number;
  endIndex: number;
  avgScore: number;
}

/**
 * Finds all contiguous blocks where avg score >= threshold.
 * Does not enforce minimum duration — that is filtered separately.
 */
function findAllViableBlocks(
  scoredForecasts: ScoredForecast[],
  minScore: number
): ViableBlock[] {
  const blocks: ViableBlock[] = [];
  let blockStart = -1;
  let runningSum = 0;

  for (let i = 0; i < scoredForecasts.length; i++) {
    const sf = scoredForecasts[i];

    if (sf.score >= minScore) {
      if (blockStart === -1) {
        blockStart = i;
        runningSum = 0;
      }
      runningSum += sf.score;
    } else {
      if (blockStart !== -1) {
        const count = i - blockStart;
        blocks.push({
          startIndex: blockStart,
          endIndex: i - 1,
          avgScore: runningSum / count,
        });
        blockStart = -1;
        runningSum = 0;
      }
    }
  }

  // Close any open block at end of array
  if (blockStart !== -1) {
    const count = scoredForecasts.length - blockStart;
    blocks.push({
      startIndex: blockStart,
      endIndex: scoredForecasts.length - 1,
      avgScore: runningSum / count,
    });
  }

  return blocks;
}

/**
 * Returns the number of hours between two forecast indices.
 * Uses actual forecast timestamps for accuracy.
 */
function hoursBetweenBlocks(
  scoredForecasts: ScoredForecast[],
  endIndex: number,
  startIndex: number
): number {
  const endTime = scoredForecasts[endIndex].forecast.forecastTime;
  const startTime = scoredForecasts[startIndex].forecast.forecastTime;
  return (startTime.getTime() - endTime.getTime()) / (1000 * 60 * 60);
}

/**
 * Returns the duration of a block in hours using actual timestamps.
 */
function blockDurationHours(
  scoredForecasts: ScoredForecast[],
  block: ViableBlock
): number {
  const startTime = scoredForecasts[block.startIndex].forecast.forecastTime;
  const endTime = scoredForecasts[block.endIndex].forecast.forecastTime;
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
}

/**
 * Merges blocks that are less than minGapHours apart.
 * The merged block spans both original blocks (including the gap).
 * avgScore is recalculated across all forecasts in the merged span.
 */
function mergeCloseBlocks(
  blocks: ViableBlock[],
  scoredForecasts: ScoredForecast[],
  minGapHours: number
): ViableBlock[] {
  if (blocks.length <= 1) return blocks;

  const merged: ViableBlock[] = [{ ...blocks[0] }];

  for (let i = 1; i < blocks.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = blocks[i];

    const gap = hoursBetweenBlocks(scoredForecasts, prev.endIndex, curr.startIndex);

    if (gap <= minGapHours) {
      // Merge: extend previous block to include current
      const newEnd = curr.endIndex;
      const count = newEnd - prev.startIndex + 1;
      const sum = scoredForecasts
        .slice(prev.startIndex, newEnd + 1)
        .reduce((acc, sf) => acc + sf.score, 0);
      prev.endIndex = newEnd;
      prev.avgScore = sum / count;
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

/**
 * Converts a ViableBlock into an OptimalWindow, filling in all required fields.
 */
function buildWindowFromBlock(
  block: ViableBlock,
  scoredForecasts: ScoredForecast[],
  beach: BeachWithThresholds,
  minScore: number
): OptimalWindow {
  const startInfo = calculateWindowStart(scoredForecasts, block.startIndex, minScore);
  const endInfo = calculateWindowEnd(scoredForecasts, block.endIndex, minScore);

  const peakTime = findPeakTime(scoredForecasts, block.startIndex, block.endIndex);
  const message = generateWindowMessage(startInfo.reason, endInfo.reason);

  // Use the same representative forecast for the score, character, and board
  // pick at the beach-detail render boundary.
  const peakIndex = scoredForecasts
    .slice(block.startIndex, block.endIndex + 1)
    .reduce<number>(
      (bestI, sf, i) =>
        sf.score > scoredForecasts[block.startIndex + bestI].score ? i : bestI,
      0
    );
  const peakScored = peakTime
    ? scoredForecasts.find(
        (scored) => scored.forecast.forecastTime.getTime() === peakTime.getTime(),
      )
    : undefined;
  const peakScoredFallback = scoredForecasts[block.startIndex + peakIndex];
  const representativePeak = peakScored ?? peakScoredFallback;
  const peakForecast = representativePeak.forecast;

  // Compute condition character via the domain engine (re-scores the peak
  // forecast to obtain a CompositeScore — plugins are pure and the engine
  // is a singleton, so this is microseconds).
  const peakProfile = beachToSpotProfile(beach as unknown as Beach);
  const peakSnapshot = forecastForScoringToSnapshot(peakForecast);
  const peakComposite = getEngine().score({
    profile: peakProfile,
    snapshot: peakSnapshot,
    window: null,
    preferences: null,
  });
  const character = getConditionCharacter(peakSnapshot, peakProfile, peakComposite);

  return {
    start: startInfo.time,
    end: endInfo.time,
    startReason: startInfo.reason,
    endReason: endInfo.reason,
    message,
    peakTime,
    peakScore: representativePeak.score,
    avgScore: parseFloat(block.avgScore.toFixed(1)),
    character,
  };
}

/**
 * Calculates multiple viable surf windows from a day's forecast data.
 *
 * Unlike `calculateOptimalWindow()` which finds the single best window,
 * this function:
 * - Uses a lower viability threshold (30 vs 40) to surface more options
 * - Returns up to 3 (or maxWindows) windows, each ≥1.5 hours long
 * - Merges windows that are <2 hours apart
 * - Ranks windows by average score (best first)
 * - Attaches condition character to each window
 *
 * The existing `calculateOptimalWindow()` is unchanged for backwards compatibility.
 *
 * @param forecasts - Array of forecast data points for the day
 * @param beach - Beach configuration with wind/tide thresholds
 * @param options - Optional configuration (inherits WindowCalculatorOptions + maxWindows)
 * @returns MultiWindowResult with ranked windows and bestWindow reference
 */
export function calculateMultipleWindows(
  forecasts: ForecastForScoring[],
  beach: BeachWithThresholds,
  options: WindowCalculatorOptions & { maxWindows?: number } = {}
): MultiWindowResult {
  const empty: MultiWindowResult = { windows: [], bestWindow: null };

  if (forecasts.length === 0) return empty;

  const minScore = options.minScoreThreshold ?? MULTI_WINDOW_MIN_SCORE;
  const maxWindows = options.maxWindows ?? MULTI_WINDOW_DEFAULT_MAX;
  const daylightForecasts = filterForecastsToDaylight(
    forecasts,
    options.beachTimezone
  );

  if (daylightForecasts.length === 0) return empty;

  // Score all forecasts
  const scoredForecasts: ScoredForecast[] = daylightForecasts.map(forecast => {
    const total = scoreForecastTotal(
      forecast,
      beach,
      options.skillLevel,
      options.boardClasses,
    );
    return {
      forecast,
      score: total,
      isViable: total >= minScore,
    };
  });

  // Find all contiguous blocks above threshold
  let blocks = findAllViableBlocks(scoredForecasts, minScore);

  if (blocks.length === 0) return empty;

  // Merge blocks that are too close together
  blocks = mergeCloseBlocks(blocks, scoredForecasts, MULTI_WINDOW_MIN_GAP_HOURS);

  // Filter blocks that are too short
  blocks = blocks.filter(
    block => blockDurationHours(scoredForecasts, block) >= MULTI_WINDOW_MIN_DURATION_HOURS
  );

  if (blocks.length === 0) return empty;

  // Sort by avg score descending
  blocks.sort((a, b) => b.avgScore - a.avgScore);

  // Take top N windows
  const topBlocks = blocks.slice(0, maxWindows);

  // Build OptimalWindow objects
  const windows: OptimalWindow[] = topBlocks.map(block =>
    buildWindowFromBlock(block, scoredForecasts, beach, minScore)
  );

  const bestWindow = windows.length > 0 ? windows[0] : null;

  return { windows, bestWindow };
}
