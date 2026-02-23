/**
 * Level calculation and progression service
 *
 * Handles level calculation from XP and progression tracking.
 */

import type { LevelInfo, LevelThreshold } from "./types";
import { LEVEL_THRESHOLDS } from "./constants";

/**
 * Calculate the level and title for a given total XP
 *
 * @param totalXP - The user's total XP
 * @returns The level number and title
 */
export function calculateLevel(totalXP: number): LevelInfo {
  // Find the highest level the user qualifies for
  let currentLevel = LEVEL_THRESHOLDS[0] as LevelThreshold;

  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalXP >= threshold.xp_required) {
      currentLevel = threshold;
    } else {
      break;
    }
  }

  return { level: currentLevel.level, title: currentLevel.title };
}

/**
 * Get the level threshold for a specific level
 *
 * @param level - The level number
 * @returns The level threshold or undefined if not found
 */
function getLevelThreshold(level: number): LevelThreshold | undefined {
  return LEVEL_THRESHOLDS.find((t) => t.level === level);
}

/**
 * Get the next level threshold after the current level
 *
 * @param currentLevel - The current level number
 * @returns The next level threshold or undefined if at max level
 */
function getNextLevelThreshold(
  currentLevel: number
): LevelThreshold | undefined {
  const currentIndex = LEVEL_THRESHOLDS.findIndex(
    (t) => t.level === currentLevel
  );
  return LEVEL_THRESHOLDS[currentIndex + 1];
}

/**
 * Calculate progress to the next level
 *
 * @param totalXP - The user's total XP
 * @param currentLevel - The user's current level
 * @returns Object with progress percentage and XP needed
 */
export function calculateLevelProgress(
  totalXP: number,
  currentLevel: number
): {
  progressPercent: number;
  xpToNext: number;
  nextLevelTitle: string;
} {
  const currentThreshold = getLevelThreshold(currentLevel);
  const nextThreshold = getNextLevelThreshold(currentLevel);

  if (!currentThreshold) {
    return { progressPercent: 0, xpToNext: 0, nextLevelTitle: "Unknown" };
  }

  if (!nextThreshold) {
    // Max level reached
    return { progressPercent: 100, xpToNext: 0, nextLevelTitle: "Max Level" };
  }

  const xpInCurrentLevel = totalXP - currentThreshold.xp_required;
  const xpNeededForLevel =
    nextThreshold.xp_required - currentThreshold.xp_required;
  const progressPercent = Math.round(
    (xpInCurrentLevel / xpNeededForLevel) * 100
  );
  const xpToNext = nextThreshold.xp_required - totalXP;

  return {
    progressPercent,
    xpToNext,
    nextLevelTitle: nextThreshold.title,
  };
}

