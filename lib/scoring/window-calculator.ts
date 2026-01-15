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
} from './types';
import { scoreConditions } from './surf-conditions-scorer';
import { generateWindowMessage } from './message-generator';

// Default configuration
const DEFAULT_MIN_SCORE_THRESHOLD = 40;
const DEFAULT_MIN_SESSION_HOURS = 1;
const MAX_WINDOW_HOURS = 4;

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

  // Score all forecasts
  const scoredForecasts = scoreForecasts(forecasts, beach, minScoreThreshold);

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

  // Generate message
  const message = generateWindowMessage(startInfo.reason, endInfo.reason);

  return {
    start: startInfo.time,
    end: endInfo.time,
    startReason: startInfo.reason,
    endReason: endInfo.reason,
    message,
    peakTime,
  };
}

/**
 * Scores all forecasts and marks viability
 */
function scoreForecasts(
  forecasts: ForecastForScoring[],
  beach: BeachWithThresholds,
  minScoreThreshold: number
): ScoredForecast[] {
  return forecasts.map(forecast => {
    const result = scoreConditions(forecast, beach);
    return {
      forecast,
      score: result.total,
      isViable: result.total >= minScoreThreshold,
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
function findPeakTime(
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

  return scoredForecasts[peakIndex].forecast.forecastTime;
}
