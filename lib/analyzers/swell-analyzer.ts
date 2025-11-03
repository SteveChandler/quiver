/**
 * Swell Analyzer Module
 * Analyzes swell components and their match with beach preferences
 *
 * Extracted from morning-intel-utils.ts as part of Phase 7.2.2 refactoring
 */

import type {
  SwellComponent,
  ForecastSlice,
  BeachPreferences,
  ConditionEvaluation,
} from "@/types/morning-intel";

/**
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Convert degrees to cardinal direction
 */
function degreesToCardinal(degrees: number): string {
  const normalized = normalizeAngle(degrees);
  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

/**
 * Check if angle is within window (handles 0/360 wraparound)
 */
export function isAngleInWindow(
  angle: number,
  minDeg: number,
  maxDeg: number
): boolean {
  // Normalize all angles to 0-360
  const norm = (deg: number) => ((deg % 360) + 360) % 360;
  const a = norm(angle);
  const min = norm(minDeg);
  const max = norm(maxDeg);

  if (min <= max) {
    // Normal case: window doesn't cross 0°
    return a >= min && a <= max;
  } else {
    // Window crosses 0° (e.g., 350° to 10°)
    return a >= min || a <= max;
  }
}

/**
 * Extract primary and secondary swell components
 */
export function primarySecondarySwell(
  forecasts: ForecastSlice["forecasts"]
): { primary: SwellComponent | null; secondary: SwellComponent | null } {
  if (forecasts.length === 0) {
    return { primary: null, secondary: null };
  }

  // Get most recent forecast with swell data
  const forecastWithSwell = forecasts.find(
    (f) =>
      f.swell_height !== null &&
      f.swell_period !== null &&
      f.swell_direction !== null
  );

  if (!forecastWithSwell) {
    return { primary: null, secondary: null };
  }

  const primary: SwellComponent | null = forecastWithSwell.swell_height
    ? {
        height: Number(forecastWithSwell.swell_height.toFixed(1)),
        period: Math.round(forecastWithSwell.swell_period || 0),
        direction: Math.round(forecastWithSwell.swell_direction || 0),
        cardinal: degreesToCardinal(forecastWithSwell.swell_direction || 0),
      }
    : null;

  const secondary: SwellComponent | null =
    forecastWithSwell.secondary_swell_height
      ? {
          height: Number(forecastWithSwell.secondary_swell_height.toFixed(1)),
          period: Math.round(forecastWithSwell.secondary_swell_period || 0),
          direction: Math.round(
            forecastWithSwell.secondary_swell_direction || 0
          ),
          cardinal: degreesToCardinal(
            forecastWithSwell.secondary_swell_direction || 0
          ),
        }
      : null;

  return { primary, secondary };
}

/**
 * Analyze swell direction match with beach preferences
 */
export function analyzeSwellMatch(
  swellDirection: number | null | undefined,
  beach: BeachPreferences
): ConditionEvaluation {
  // If no swell window defined, consider acceptable
  if (!beach.swellWindowMin || !beach.swellWindowMax) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: "Swell direction not configured for this beach",
    };
  }

  // If no swell data, mark as poor
  if (swellDirection == null) {
    return {
      status: "poor",
      emoji: "❌",
      message: "No swell direction data available",
    };
  }

  // Check if swell is within window
  const isInWindow = isAngleInWindow(
    swellDirection,
    beach.swellWindowMin,
    beach.swellWindowMax
  );

  if (isInWindow) {
    return {
      status: "optimal",
      emoji: "✅",
      message: `${degreesToCardinal(swellDirection)} (${Math.round(swellDirection)}°) - within optimal window`,
    };
  }

  // Calculate how far outside the window
  // Handle windows that cross 0° boundary
  let centerWindow: number;
  if (beach.swellWindowMin > beach.swellWindowMax) {
    // Window crosses 0° (e.g., 350° to 10°)
    centerWindow = ((beach.swellWindowMin + beach.swellWindowMax + 360) / 2) % 360;
  } else {
    centerWindow = (beach.swellWindowMin + beach.swellWindowMax) / 2;
  }

  const rawDiff = Math.abs(normalizeAngle(swellDirection - centerWindow));
  // Find shortest angular distance (clockwise or counter-clockwise)
  const angleDiff = Math.min(rawDiff, 360 - rawDiff);

  if (angleDiff < 45) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: `${degreesToCardinal(swellDirection)} (${Math.round(swellDirection)}°) - slightly off optimal`,
    };
  }

  return {
    status: "poor",
    emoji: "❌",
    message: `${degreesToCardinal(swellDirection)} (${Math.round(swellDirection)}°) - outside optimal window`,
  };
}
