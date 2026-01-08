/**
 * Forecast Digest Service
 *
 * Implements multi-gate matching logic for the daily digest email.
 * Evaluates beaches against user skill level, swell window, and wind conditions
 * to generate personalized surf recommendations with natural language explanations.
 *
 * @module lib/services/forecast-digest-service
 */

import {
  findMagicHour,
  isSwellInWindow,
  checkWindOffshore,
  BeachMetadata,
  EnhancedForecastEntity,
  OptimalWindow,
} from '@/lib/services/magic-hour-finder';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * User surf preferences from learned session history.
 * Subset of user_surf_preferences table columns.
 */
export interface UserSurfPreferences {
  wave_min_ft: number | null;
  wave_max_ft: number | null;
  max_wind_mph: number | null;
  preferred_tide_statuses: string[] | null;
}

/**
 * Gate evaluation result.
 */
export interface GateResult {
  passed: boolean;
  reason: string;
}

/**
 * Wind gate evaluation result with quality description.
 */
export interface WindGateResult extends GateResult {
  quality: string;
}

/**
 * Match quality classification.
 */
export type MatchQuality = 'perfect' | 'excellent' | 'good' | 'fair' | 'no_match';

/**
 * Complete digest match evaluation result.
 */
export interface DigestMatchResult {
  isMatch: boolean;
  matchQuality: MatchQuality;
  skillGate: GateResult;
  swellGate: GateResult;
  windGate: WindGateResult;
  bestWindow: OptimalWindow | null;
  whyText: string[];
  crowdWarning: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Skill levels ordered from beginner to expert.
 * Used for strict skill gate validation.
 */
const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

/**
 * Default user skill level when not specified.
 */
const DEFAULT_USER_SKILL = 'intermediate';

/**
 * Default beach skill level when not specified.
 */
const DEFAULT_BEACH_SKILL = 'beginner';

// ============================================================================
// Gate 1: Skill Gate (STRICT - blocks if fails)
// ============================================================================

/**
 * Checks if user's skill level is sufficient for the beach.
 *
 * STRICT GATE: User skill index must be >= beach skill index.
 * This ensures beginners aren't matched to advanced/expert spots.
 *
 * @param userLevel - User's skill level (null defaults to 'intermediate')
 * @param beachLevel - Beach's required skill level (null defaults to 'beginner')
 * @returns Gate result with pass/fail and reason text
 *
 * @example
 * checkSkillGate('advanced', 'intermediate')
 * // { passed: true, reason: "Your advanced skill matches this intermediate spot" }
 *
 * checkSkillGate('beginner', 'expert')
 * // { passed: false, reason: "This expert spot requires advanced+ skills" }
 */
export function checkSkillGate(
  userLevel: string | null,
  beachLevel: string | null
): GateResult {
  const user = userLevel?.toLowerCase() ?? DEFAULT_USER_SKILL;
  const beach = beachLevel?.toLowerCase() ?? DEFAULT_BEACH_SKILL;

  const userIndex = SKILL_LEVELS.indexOf(user as any);
  const beachIndex = SKILL_LEVELS.indexOf(beach as any);

  // Handle invalid skill levels by defaulting to safe values
  const safeUserIndex = userIndex >= 0 ? userIndex : SKILL_LEVELS.indexOf(DEFAULT_USER_SKILL);
  const safeBeachIndex = beachIndex >= 0 ? beachIndex : SKILL_LEVELS.indexOf(DEFAULT_BEACH_SKILL);

  const passed = safeUserIndex >= safeBeachIndex;

  if (passed) {
    if (safeUserIndex === safeBeachIndex) {
      return {
        passed: true,
        reason: `Your ${SKILL_LEVELS[safeUserIndex]} skill is perfect for this ${SKILL_LEVELS[safeBeachIndex]} spot`,
      };
    } else {
      return {
        passed: true,
        reason: `Your ${SKILL_LEVELS[safeUserIndex]} skill matches this ${SKILL_LEVELS[safeBeachIndex]} spot`,
      };
    }
  } else {
    return {
      passed: false,
      reason: `This ${SKILL_LEVELS[safeBeachIndex]} spot requires ${SKILL_LEVELS[safeBeachIndex]}+ skills`,
    };
  }
}

// ============================================================================
// Gate 2: Swell Window Gate (blocks if fails)
// ============================================================================

/**
 * Checks if forecast swell direction is within beach's optimal swell window.
 *
 * Uses the first available forecast in the window to check swell direction.
 * If beach has no swell window configured, passes by default.
 *
 * @param forecasts - Array of enhanced forecast entities
 * @param beach - Beach metadata with swell window configuration
 * @returns Gate result with pass/fail and reason text
 *
 * @example
 * checkSwellGate(forecasts, beach)
 * // { passed: true, reason: "Swell direction 270° is in the optimal NW window" }
 *
 * checkSwellGate(forecasts, beach)
 * // { passed: false, reason: "Swell direction 180° is outside the optimal NW window" }
 */
export function checkSwellGate(
  forecasts: EnhancedForecastEntity[],
  beach: BeachMetadata
): GateResult {
  // No swell window configured = always pass
  if (
    beach.swell_window_center_deg === null ||
    beach.swell_window_halfwidth_deg === null
  ) {
    return {
      passed: true,
      reason: 'No specific swell direction required',
    };
  }

  // Get first forecast with swell direction
  const firstForecast = forecasts.find(
    (f) => f.wave_direction !== null && f.wave_direction !== undefined
  );

  if (!firstForecast?.wave_direction) {
    return {
      passed: false,
      reason: 'No swell direction data available',
    };
  }

  // Parse direction (could be string like "NW" or number)
  const swellDir = parseSwellDirection(firstForecast.wave_direction);

  const inWindow = isSwellInWindow(
    swellDir,
    beach.swell_window_center_deg,
    beach.swell_window_halfwidth_deg
  );

  const windowName = getDirectionName(beach.swell_window_center_deg);

  if (inWindow) {
    return {
      passed: true,
      reason: `Swell direction ${swellDir}° is in the optimal ${windowName} window`,
    };
  } else {
    return {
      passed: false,
      reason: `Swell direction ${swellDir}° is outside the optimal ${windowName} window`,
    };
  }
}

/**
 * Parses swell direction string to degrees.
 * Handles both string directions ("NW", "SW") and numeric values.
 */
function parseSwellDirection(direction: string | number): number {
  if (typeof direction === 'number') {
    return direction;
  }

  const dirMap: Record<string, number> = {
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

  return dirMap[direction.toUpperCase()] ?? 0;
}

/**
 * Converts degrees to cardinal direction name.
 */
function getDirectionName(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return dirs[index];
}

// ============================================================================
// Gate 3: Wind Gate (WARNING only - doesn't block)
// ============================================================================

/**
 * Checks wind quality and generates description.
 *
 * WARNING ONLY: This gate never blocks, but provides quality assessment
 * and warnings for cross-shore or onshore conditions.
 *
 * @param forecasts - Array of enhanced forecast entities
 * @param beach - Beach metadata with wind preferences
 * @returns Wind gate result with quality description
 *
 * @example
 * checkWindGate(forecasts, beach)
 * // { passed: true, quality: "perfect offshore winds", reason: "Wind is offshore..." }
 *
 * checkWindGate(forecasts, beach)
 * // { passed: true, quality: "light cross-shore", reason: "Cross-shore winds but light..." }
 */
export function checkWindGate(
  forecasts: EnhancedForecastEntity[],
  beach: BeachMetadata
): WindGateResult {
  // No wind preferences = acceptable by default
  if (beach.wind_offshore_deg === null || beach.wind_offshore_tol_deg === null) {
    return {
      passed: true,
      quality: 'acceptable conditions',
      reason: 'Wind conditions are acceptable',
    };
  }

  // Get first forecast with wind data
  const firstForecast = forecasts.find(
    (f) =>
      f.wind_direction_deg !== null &&
      f.wind_direction_deg !== undefined &&
      f.wind_speed !== null &&
      f.wind_speed !== undefined
  );

  if (!firstForecast?.wind_direction_deg || !firstForecast?.wind_speed) {
    return {
      passed: true,
      quality: 'unknown conditions',
      reason: 'Wind data not available',
    };
  }

  const windSpeed = parseFloat(firstForecast.wind_speed);
  const windQuality = checkWindOffshore(
    firstForecast.wind_direction_deg,
    beach.wind_offshore_deg,
    beach.wind_offshore_tol_deg
  );

  // Build quality description
  let quality: string;
  let reason: string;

  if (windQuality.quality === 'perfect') {
    quality = 'perfect offshore winds';
    reason = `Wind is offshore at ${Math.round(windSpeed)} mph, creating clean conditions`;
  } else if (windQuality.quality === 'acceptable') {
    quality = 'good offshore winds';
    reason = `Wind is offshore at ${Math.round(windSpeed)} mph, conditions are clean`;
  } else if (windQuality.quality === 'cross') {
    if (windSpeed <= 5) {
      quality = 'light cross-shore';
      reason = `Cross-shore winds at ${Math.round(windSpeed)} mph, but light enough to be rideable`;
    } else {
      quality = 'cross-shore winds';
      reason = `Cross-shore winds at ${Math.round(windSpeed)} mph may affect conditions`;
    }
  } else {
    // onshore
    if (windSpeed <= 5) {
      quality = 'light onshore';
      reason = `Onshore winds at ${Math.round(windSpeed)} mph, but light enough to manage`;
    } else {
      quality = 'onshore winds';
      reason = `Onshore winds at ${Math.round(windSpeed)} mph will create choppy conditions`;
    }
  }

  return {
    passed: true, // Wind gate never blocks
    quality,
    reason,
  };
}

// ============================================================================
// Match Quality Calculation
// ============================================================================

/**
 * Calculates overall match quality based on gate results and confidence.
 *
 * @param skillPassed - Skill gate passed
 * @param swellPassed - Swell gate passed
 * @param windQuality - Wind quality assessment
 * @param confidence - Magic hour confidence (0-1)
 * @returns Match quality classification
 */
function calculateMatchQuality(
  skillPassed: boolean,
  swellPassed: boolean,
  windQuality: 'perfect' | 'acceptable' | 'cross' | 'onshore',
  confidence: number
): MatchQuality {
  // No match if critical gates fail
  if (!skillPassed || !swellPassed) {
    return 'no_match';
  }

  // Perfect: all gates pass + high confidence + perfect wind
  if (windQuality === 'perfect' && confidence >= 0.8) {
    return 'perfect';
  }

  // Excellent: all gates pass + good wind + decent confidence
  if (
    (windQuality === 'perfect' || windQuality === 'acceptable') &&
    confidence >= 0.6
  ) {
    return 'excellent';
  }

  // Good: all gates pass + acceptable conditions
  if (windQuality === 'acceptable' || windQuality === 'perfect') {
    return 'good';
  }

  // Fair: all gates pass but wind is cross/onshore
  return 'fair';
}

// ============================================================================
// Why Text Generation
// ============================================================================

/**
 * Generates personalized "why text" bullets for email copy.
 *
 * Builds natural language explanation in priority order:
 * 1. Primary: Swell window match
 * 2. Secondary: Wind quality + skill level
 * 3. Timing: Tide sweet spot + best window
 * 4. Nuance: Early morning glass/calm periods
 *
 * @param beach - Beach metadata
 * @param bestWindow - Optimal window found
 * @param skillGate - Skill gate result
 * @param swellGate - Swell gate result
 * @param windGate - Wind gate result
 * @param userLevel - User's skill level
 * @returns Array of why text bullets for email
 */
function generateWhyText(
  beach: BeachMetadata,
  bestWindow: OptimalWindow,
  skillGate: GateResult,
  swellGate: GateResult,
  windGate: WindGateResult,
  userLevel: string | null
): string[] {
  const whyText: string[] = [];
  const skill = userLevel?.toLowerCase() ?? DEFAULT_USER_SKILL;

  // 1. Primary: Swell window match
  if (swellGate.passed && bestWindow.swellMatch) {
    const dirName = beach.swell_window_center_deg
      ? getDirectionName(beach.swell_window_center_deg)
      : 'optimal';
    whyText.push(
      `We're alerting you because ${beach.name} is hitting its optimal ${dirName} swell window.`
    );
  }

  // 2. Secondary: Wind quality + skill level
  if (windGate.quality.includes('offshore')) {
    // Perfect or good offshore
    if (skill === 'beginner' || skill === 'intermediate') {
      whyText.push(
        `Conditions are ${windGate.quality} which suits your ${skill} profile perfectly.`
      );
    } else {
      whyText.push(`Conditions are ${windGate.quality}, ideal for a session.`);
    }
  } else if (windGate.quality.includes('cross-shore')) {
    if (skill === 'beginner') {
      whyText.push(
        `${windGate.quality.charAt(0).toUpperCase() + windGate.quality.slice(1)} will challenge your ${skill} profile, but still rideable.`
      );
    } else {
      whyText.push(
        `${windGate.quality.charAt(0).toUpperCase() + windGate.quality.slice(1)}, but your ${skill} skills can handle it.`
      );
    }
  } else {
    // Onshore
    if (skill === 'advanced' || skill === 'expert') {
      whyText.push(
        `${windGate.quality.charAt(0).toUpperCase() + windGate.quality.slice(1)}, but your ${skill} experience can work with it.`
      );
    } else {
      whyText.push(
        `${windGate.quality.charAt(0).toUpperCase() + windGate.quality.slice(1)} - conditions may be challenging.`
      );
    }
  }

  // 3. Timing: Tide sweet spot + best window
  if (bestWindow.tideInRange) {
    whyText.push(
      `The tide hits the sweet spot around ${bestWindow.peakTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}. Best window: ${bestWindow.windowStart} – ${bestWindow.windowEnd}.`
    );
  } else {
    whyText.push(
      `Best window: ${bestWindow.windowStart} – ${bestWindow.windowEnd} based on swell and wind alignment.`
    );
  }

  // 4. Nuance: Early morning glass/calm periods
  if (bestWindow.peakTime.getHours() >= 6 && bestWindow.peakTime.getHours() <= 9) {
    if (windGate.quality.includes('offshore') || windGate.quality.includes('light')) {
      whyText.push(
        `Early bird gets the glass. Winds stay light until mid-morning.`
      );
    }
  }

  return whyText;
}

// ============================================================================
// Crowd Warning
// ============================================================================

/**
 * Generates crowd warning if match is too perfect on a weekend.
 *
 * @param matchQuality - Overall match quality
 * @param peakTime - Peak time of optimal window
 * @returns Crowd warning text or null
 */
function generateCrowdWarning(
  matchQuality: MatchQuality,
  peakTime: Date
): string | null {
  const dayOfWeek = peakTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (isWeekend && matchQuality === 'perfect') {
    return 'Expect crowds on a weekend with perfect conditions.';
  }

  return null;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Evaluates whether a beach matches user preferences for digest email.
 *
 * Executes multi-gate logic in order:
 * 1. Skill Gate (STRICT - blocks if fails)
 * 2. Swell Window Gate (blocks if fails)
 * 3. Wind Gate (WARNING only - doesn't block)
 * 4. Find optimal window via Magic Hour finder
 * 5. Calculate match quality
 * 6. Generate personalized why text
 *
 * @param forecasts - Array of enhanced forecast entities
 * @param beach - Beach metadata with preferences
 * @param userLevel - User's skill level (null defaults to 'intermediate')
 * @param userPrefs - User's learned preferences (optional)
 * @returns Complete digest match evaluation result
 *
 * @example
 * const result = evaluateDigestMatch(forecasts, beach, 'intermediate', null);
 * if (result.isMatch) {
 *   console.log(`Match quality: ${result.matchQuality}`);
 *   console.log(`Why: ${result.whyText.join(' ')}`);
 *   console.log(`Best window: ${result.bestWindow?.windowStart} - ${result.bestWindow?.windowEnd}`);
 * }
 */
export function evaluateDigestMatch(
  forecasts: EnhancedForecastEntity[],
  beach: BeachMetadata,
  userLevel: string | null,
  userPrefs: UserSurfPreferences | null
): DigestMatchResult {
  // Gate 1: Skill Gate (STRICT)
  const skillGate = checkSkillGate(userLevel, beach.skill_level);

  if (!skillGate.passed) {
    return {
      isMatch: false,
      matchQuality: 'no_match',
      skillGate,
      swellGate: { passed: false, reason: 'Skipped due to skill gate failure' },
      windGate: { passed: false, quality: 'unknown', reason: 'Skipped' },
      bestWindow: null,
      whyText: [],
      crowdWarning: null,
    };
  }

  // Gate 2: Swell Window Gate
  const swellGate = checkSwellGate(forecasts, beach);

  if (!swellGate.passed) {
    return {
      isMatch: false,
      matchQuality: 'no_match',
      skillGate,
      swellGate,
      windGate: { passed: false, quality: 'unknown', reason: 'Skipped' },
      bestWindow: null,
      whyText: [],
      crowdWarning: null,
    };
  }

  // Gate 3: Wind Gate (WARNING only)
  const windGate = checkWindGate(forecasts, beach);

  // Find optimal window using Magic Hour finder
  const magicHour = findMagicHour(forecasts, beach);

  if (!magicHour.found || !magicHour.peakTime) {
    return {
      isMatch: false,
      matchQuality: 'no_match',
      skillGate,
      swellGate,
      windGate,
      bestWindow: null,
      whyText: [],
      crowdWarning: null,
    };
  }

  const bestWindow: OptimalWindow = {
    peakTime: magicHour.peakTime,
    windowStart: magicHour.windowStart!,
    windowEnd: magicHour.windowEnd!,
    confidence: magicHour.confidence,
    swellMatch: magicHour.swellMatch,
    windQuality: magicHour.windQuality!,
    tideInRange: magicHour.tideInRange,
  };

  // Calculate match quality
  const matchQuality = calculateMatchQuality(
    skillGate.passed,
    swellGate.passed,
    bestWindow.windQuality,
    bestWindow.confidence
  );

  // Generate why text
  const whyText = generateWhyText(
    beach,
    bestWindow,
    skillGate,
    swellGate,
    windGate,
    userLevel
  );

  // Generate crowd warning
  const crowdWarning = generateCrowdWarning(matchQuality, bestWindow.peakTime);

  return {
    isMatch: true,
    matchQuality,
    skillGate,
    swellGate,
    windGate,
    bestWindow,
    whyText,
    crowdWarning,
  };
}
