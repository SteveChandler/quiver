/**
 * Relative Context Calculator
 *
 * Compares today's surf score against historical and upcoming scores to surface:
 * - Whether today is the best day of the week
 * - The trend direction vs yesterday
 * - Incoming swell events (future days with significantly higher scores)
 *
 * Pure function — no async, no side effects.
 */

import type { RelativeContext } from './types';

// How close today's score must be to the week's max to count as "best of week"
const BEST_OF_WEEK_TOLERANCE = 5;

// Threshold for trend classification (points above/below yesterday)
const TREND_IMPROVING_THRESHOLD = 8;
const TREND_DECLINING_THRESHOLD = -8;

// Minimum score jump from today to a future day to classify as "incoming swell"
const INCOMING_SWELL_JUMP = 20;

// Day names for description generation
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface DailyScore {
  /** ISO date string, e.g. "2026-03-25" */
  date: string;
  /** Condition score 0-100 */
  score: number;
}

/**
 * Generate a human-readable incoming swell description.
 *
 * @param isoDate - ISO date string for the swell arrival day
 * @param score - Estimated score for that day
 */
function buildSwellDescription(isoDate: string, score: number): string {
  // Parse the date as UTC midnight to get the correct day name
  const [year, month, day] = isoDate.split('-').map(Number);
  // Use Date.UTC to avoid timezone shifts when resolving the day of week
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayName = DAY_NAMES[d.getUTCDay()];

  const intensity = score >= 70 ? 'Solid' : score >= 55 ? 'Decent' : 'Some';
  return `${intensity} swell arriving ${dayName}`;
}

/**
 * Calculates relative context for today's surf conditions.
 *
 * @param todayScore - Today's condition score (0-100)
 * @param yesterdayScore - Yesterday's condition score, or null if unavailable
 * @param weekScores - Array of daily scores for the week (including today).
 *   The first entry is assumed to be today. Future entries are scanned for incoming swells.
 * @returns RelativeContext with isBestOfWeek, trend, trendDelta, and optional incomingSwell
 */
export function calculateRelativeContext(
  todayScore: number,
  yesterdayScore: number | null,
  weekScores: DailyScore[]
): RelativeContext {
  // --- isBestOfWeek ---
  let isBestOfWeek = false;
  if (weekScores.length > 0) {
    const maxScore = Math.max(...weekScores.map(d => d.score));
    isBestOfWeek = todayScore >= maxScore - BEST_OF_WEEK_TOLERANCE;
  }

  // --- trend & trendDelta ---
  let trend: RelativeContext['trend'] = 'stable';
  let trendDelta = 0;

  if (yesterdayScore !== null) {
    trendDelta = todayScore - yesterdayScore;
    if (trendDelta >= TREND_IMPROVING_THRESHOLD) {
      trend = 'improving';
    } else if (trendDelta <= TREND_DECLINING_THRESHOLD) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
  }

  // --- incomingSwell ---
  // Scan future entries (skip today = index 0) for the first day where the
  // score jumps 20+ pts above today's score.
  let incomingSwell: RelativeContext['incomingSwell'] = null;

  // weekScores[0] is today; scan from index 1 onward
  const futureDays = weekScores.slice(1);
  for (const day of futureDays) {
    if (day.score >= todayScore + INCOMING_SWELL_JUMP) {
      incomingSwell = {
        date: day.date,
        description: buildSwellDescription(day.date, day.score),
        estimatedScore: day.score,
      };
      break; // First qualifying day wins
    }
  }

  return {
    isBestOfWeek,
    trend,
    trendDelta,
    incomingSwell,
  };
}
