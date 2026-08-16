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
  /** Background color class (e.g., "bg-teal-500") */
  bg: string;
  /** Text color class for score labels (e.g., "text-teal-700 dark:text-teal-300") */
  text: string;
  /** Opaque ink badge treatment for score numbers on paper surfaces */
  paperBadge: string;
  /** Border color class (e.g., "border-teal-500/30") */
  border: string;
  /** Quality label (e.g., "EPIC", "GOOD", "FAIR", "RIDEABLE", "MEH") */
  label: string;
}

const PAPER_SCORE_BADGE_CLASSES = "bg-[#11100D] text-[#F4EBD8]";

/**
 * Score thresholds for quality categories
 *
 * 80-100: EPIC conditions
 * 70-79: GOOD conditions
 * 55-69: FAIR conditions
 * 40-54: RIDEABLE conditions
 * 0-39: MEH conditions
 */
export const SCORE_THRESHOLDS = {
  EPIC: 80,
  GOOD: 70,
  FAIR: 55,
  RIDEABLE: 40,
  MEH: 0,
  /** @deprecated Use MEH for the native-aligned score vocabulary. */
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
 * // Returns: { bg: "bg-teal-500", text: "text-teal-700 dark:text-teal-300", border: "border-teal-500/30", label: "EPIC" }
 * ```
 */
export function getScoreColorClasses(score: number): ScoreColorConfig {
  if (score >= SCORE_THRESHOLDS.EPIC) {
    return {
      bg: "bg-teal-500",
      text: "text-teal-700 dark:text-teal-300",
      paperBadge: PAPER_SCORE_BADGE_CLASSES,
      border: "border-teal-500/30",
      label: "EPIC",
    };
  }
  if (score >= SCORE_THRESHOLDS.GOOD) {
    return {
      bg: "bg-ocean-blue-decorative",
      text: "text-ocean-blue dark:text-ocean-blue-decorative",
      paperBadge: PAPER_SCORE_BADGE_CLASSES,
      border: "border-ocean-blue-decorative/40",
      label: "GOOD",
    };
  }
  if (score >= SCORE_THRESHOLDS.FAIR) {
    return {
      bg: "bg-accent-orange",
      text: "text-amber-800 dark:text-accent-orange",
      paperBadge: PAPER_SCORE_BADGE_CLASSES,
      border: "border-accent-orange/40",
      label: "FAIR",
    };
  }
  if (score >= SCORE_THRESHOLDS.RIDEABLE) {
    return {
      bg: "bg-slate-500",
      text: "text-slate-600 dark:text-slate-300",
      paperBadge: PAPER_SCORE_BADGE_CLASSES,
      border: "border-slate-500/30",
      label: "RIDEABLE",
    };
  }
  return {
    bg: "bg-slate-400",
    text: "text-slate-500 dark:text-slate-400",
    paperBadge: PAPER_SCORE_BADGE_CLASSES,
    border: "border-slate-400/30",
    label: "MEH",
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
 * getQualityLabel(75) // "GOOD"
 * getQualityLabel(90) // "EPIC"
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
    label: "EPIC",
    minScore: SCORE_THRESHOLDS.EPIC,
    badgeClass: "bg-teal-100 text-teal-700 border-teal-200",
    textClass: "text-teal-700",
  },
  good: {
    label: "GOOD",
    minScore: SCORE_THRESHOLDS.GOOD,
    badgeClass: "bg-ocean-blue-decorative/15 text-ocean-blue border-ocean-blue-decorative/40",
    textClass: "text-ocean-blue",
  },
  fair: {
    label: "FAIR",
    minScore: SCORE_THRESHOLDS.FAIR,
    badgeClass: "bg-accent-orange/20 text-amber-800 border-accent-orange/40",
    textClass: "text-amber-800",
  },
  rideable: {
    label: "RIDEABLE",
    minScore: SCORE_THRESHOLDS.RIDEABLE,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    textClass: "text-slate-700",
  },
  poor: {
    label: "MEH",
    minScore: SCORE_THRESHOLDS.MEH,
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    textClass: "text-slate-600",
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
 * // Returns: { label: "GOOD", minScore: 70, badgeClass: "...", textClass: "..." }
 * ```
 */
export function getQualityConfig(score: number) {
  if (score >= QUALITY_CONFIG.epic.minScore) return QUALITY_CONFIG.epic;
  if (score >= QUALITY_CONFIG.good.minScore) return QUALITY_CONFIG.good;
  if (score >= QUALITY_CONFIG.fair.minScore) return QUALITY_CONFIG.fair;
  if (score >= QUALITY_CONFIG.rideable.minScore) return QUALITY_CONFIG.rideable;
  return QUALITY_CONFIG.poor;
}
