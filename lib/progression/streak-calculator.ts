export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
  lastSessionDate: string | null;
}

/**
 * Calculates current and best consecutive-day surf streaks from a list of
 * session ISO timestamps.
 *
 * @param sessionDates - Array of ISO date strings (e.g. arrival_time values).
 *   May contain duplicates (multiple sessions per day) and unsorted entries.
 * @param today - YYYY-MM-DD string representing the reference date for
 *   "current" streak evaluation. Pass `new Date().toISOString().slice(0, 10)`
 *   in production; inject a fixed value in tests for determinism.
 * @returns StreakResult with currentStreak, bestStreak, and lastSessionDate.
 *
 * Rules:
 * - Multiple sessions on the same calendar day count as a single day.
 * - The current streak counts backward from today or yesterday. If the most
 *   recent session is older than yesterday the current streak is 0.
 * - The best streak is the longest consecutive run across all history.
 */
export function calculateStreak(
  sessionDates: string[],
  today: string
): StreakResult {
  if (sessionDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0, lastSessionDate: null };
  }

  // 1. Deduplicate to calendar days and sort ascending.
  const uniqueDays = Array.from(
    new Set(sessionDates.map((iso) => iso.slice(0, 10)))
  ).sort();

  const lastSessionDate = uniqueDays[uniqueDays.length - 1];

  // 2. Walk through sorted days finding consecutive runs.
  let bestStreak = 1;
  let runLength = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    if (runLength > bestStreak) bestStreak = runLength;
  }

  // 3. Determine current streak.
  // The current streak is only active if the last session was today or yesterday.
  const todayMs = new Date(today).getTime();
  const lastMs = new Date(lastSessionDate).getTime();
  const daysSinceLast = Math.round((todayMs - lastMs) / (1000 * 60 * 60 * 24));

  let currentStreak: number;
  if (daysSinceLast > 1) {
    // Last session was more than 1 day ago — streak is broken.
    currentStreak = 0;
  } else {
    // Count backward from lastSessionDate through the sorted unique days.
    currentStreak = 1;
    for (let i = uniqueDays.length - 2; i >= 0; i--) {
      const curr = new Date(uniqueDays[i + 1]);
      const prev = new Date(uniqueDays[i]);
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return { currentStreak, bestStreak, lastSessionDate };
}
