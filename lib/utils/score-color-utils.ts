/**
 * Score Color Utilities
 *
 * Shared utilities for consistent score-based color coding across the application.
 * Used by BestDaysSection, BeachConditionsGrid, RegionalForecastCard, and other
 * components that display condition scores.
 *
 * @module lib/utils/score-color-utils
 */

/**
 * Color configuration for score-based styling
 */
export interface ScoreColorConfig {
  /** Background color class (e.g., "bg-green-500") */
  bg: string;
  /** Text color class for score labels (e.g., "text-green-700 dark:text-green-400") */
  text: string;
  /** Border color class (e.g., "border-green-500/30") */
  border: string;
  /** Quality label (e.g., "Epic", "Good", "Fair", "Poor") */
  label: string;
}

/**
 * Score thresholds for quality categories
 *
 * 80-100: Epic conditions
 * 60-79: Good conditions
 * 40-59: Fair conditions
 * 0-39: Poor conditions
 */
export const SCORE_THRESHOLDS = {
  EPIC: 80,
  GOOD: 60,
  FAIR: 40,
  POOR: 0,
} as const;

/**
 * Get color classes based on score range
 *
 * @param score - Score value from 0-100
 * @returns ScoreColorConfig with bg, text, border, and label properties
 *
 * @example
 * ```typescript
 * const colors = getScoreColorClasses(85);
 * // Returns: { bg: "bg-green-500", text: "text-green-700 dark:text-green-400", border: "border-green-500/30", label: "Epic" }
 * ```
 */
export function getScoreColorClasses(score: number): ScoreColorConfig {
  if (score >= SCORE_THRESHOLDS.EPIC) {
    return {
      bg: "bg-green-500",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-500/30",
      label: "Epic",
    };
  }
  if (score >= SCORE_THRESHOLDS.GOOD) {
    return {
      bg: "bg-blue-500",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-500/30",
      label: "Good",
    };
  }
  if (score >= SCORE_THRESHOLDS.FAIR) {
    return {
      bg: "bg-yellow-500",
      text: "text-yellow-700 dark:text-yellow-400",
      border: "border-yellow-500/30",
      label: "Fair",
    };
  }
  return {
    bg: "bg-gray-400",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-400/30",
    label: "Poor",
  };
}

/**
 * Get quality label for a score
 *
 * @param score - Score value from 0-100
 * @returns Quality label string
 *
 * @example
 * ```typescript
 * getQualityLabel(75) // "Good"
 * getQualityLabel(90) // "Epic"
 * ```
 */
export function getQualityLabel(score: number): string {
  return getScoreColorClasses(score).label;
}

/**
 * Quality configuration for badge-style displays (used by RegionalForecastCard)
 *
 * This provides an alternative styling configuration optimized for badge/chip displays
 * with lighter backgrounds suitable for light mode interfaces.
 */
export const QUALITY_CONFIG = {
  epic: {
    label: "Epic",
    minScore: SCORE_THRESHOLDS.EPIC,
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    textClass: "text-emerald-700",
  },
  good: {
    label: "Good",
    minScore: SCORE_THRESHOLDS.GOOD,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    textClass: "text-blue-700",
  },
  fair: {
    label: "Fair",
    minScore: SCORE_THRESHOLDS.FAIR,
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    textClass: "text-amber-700",
  },
  poor: {
    label: "Poor",
    minScore: SCORE_THRESHOLDS.POOR,
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    textClass: "text-gray-600",
  },
} as const;

/**
 * Get quality configuration based on score (for badge-style displays)
 *
 * @param score - Score value from 0-100
 * @returns Quality config with label, badgeClass, and textClass
 *
 * @example
 * ```typescript
 * const config = getQualityConfig(75);
 * // Returns: { label: "Good", minScore: 60, badgeClass: "bg-blue-100 text-blue-700 border-blue-200", textClass: "text-blue-700" }
 * ```
 */
export function getQualityConfig(score: number) {
  if (score >= QUALITY_CONFIG.epic.minScore) return QUALITY_CONFIG.epic;
  if (score >= QUALITY_CONFIG.good.minScore) return QUALITY_CONFIG.good;
  if (score >= QUALITY_CONFIG.fair.minScore) return QUALITY_CONFIG.fair;
  return QUALITY_CONFIG.poor;
}
