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
interface ScoreColorConfig {
  /** Fill class for a badge with white numerals (e.g., "bg-[#06765F]") */
  bg: string;
  /** Label text class on paper (e.g., "text-[#06765F] dark:text-[#06765F]") */
  text: string;
  /** Opaque ink badge treatment for score numbers on paper surfaces */
  paperBadge: string;
  /** Border color class (e.g., "border-[#06765F]/30") */
  border: string;
  /** Quality label (e.g., "EPIC", "GOOD", "FAIR", "RIDEABLE", "MEH") */
  label: string;
}

const PAPER_SCORE_BADGE_CLASSES = "bg-[#11100D] text-[#F4EBD8]";

/**
 * Score thresholds for quality categories
 *
 * 80-100: EPIC conditions (off: see EPIC_LABEL_ENABLED)
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
 * EPIC is off until the server can mark a day rare for its beach (score >= 85
 * and a top-10% swell day for that beach over the last ~6-8 weeks). Measured
 * 2026-09-26: the plain >= 80 rule read EPIC on 15-23% of beginner and
 * intermediate beach-days, mostly ordinary 2-3 ft days. While this is false,
 * every score label reads GOOD at 80+ and nothing emits EPIC.
 */
export const EPIC_LABEL_ENABLED = false as boolean;

export type ScoreLabel = "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH";

/** The single score-to-label rule; every web surface routes through here. */
export function scoreLabel(score: number): ScoreLabel {
  if (EPIC_LABEL_ENABLED && score >= SCORE_THRESHOLDS.EPIC) return "EPIC";
  if (score >= SCORE_THRESHOLDS.GOOD) return "GOOD";
  if (score >= SCORE_THRESHOLDS.FAIR) return "FAIR";
  if (score >= SCORE_THRESHOLDS.RIDEABLE) return "RIDEABLE";
  return "MEH";
}

/**
 * Every class `getScoreColorClasses` can return. This file sits outside
 * Tailwind's `content` globs, so `tailwind.config.ts` safelists these; without
 * that, the fills and label colours are never generated.
 */
export const SCORE_COLOR_CLASS_SAFELIST: readonly string[] = [
  "bg-[#06765F]",
  "text-[#06765F]",
  "dark:text-[#06765F]",
  "border-[#06765F]/30",
  "bg-[#8A5E00]",
  "text-[#8A5E00]",
  "dark:text-[#8A5E00]",
  "border-[#8A5E00]/30",
  "bg-[#4A463C]",
  "text-[#11100D]",
  "dark:text-[#11100D]",
  "border-[#11100D]/25",
];

/**
 * A label computed elsewhere (a database match band, a stored snapshot),
 * brought in line with what Quiver shows today.
 */
export function gateScoreLabel<T extends string>(label: T): T | "GOOD" {
  return !EPIC_LABEL_ENABLED && label === "EPIC" ? "GOOD" : label;
}

/**
 * Get color classes based on score range
 *
 * @param score - Score value from 0-100
 * @returns ScoreColorConfig with bg, text, border, and label properties
 *
 * @example
 * ```typescript
 * const colors = getScoreColorClasses(85);
 * // Returns GOOD styling while EPIC_LABEL_ENABLED is false.
 * ```
 */
export function getScoreColorClasses(score: number): ScoreColorConfig {
  const label = scoreLabel(score);
  // Native's call colours on paper (quiver-native score-labels.ts): teal ink
  // for EPIC/GOOD, gold ink for FAIR/RIDEABLE, ink for MEH. Every score
  // surface sits on cream paper, and `dark:` always applies under
  // `.theme-retro-dark`, so both variants carry the paper colour. Fills take
  // white numerals: teal ink 5.6:1, gold ink 5.0:1, muted ink 9.3:1.
  if (label === "EPIC" || label === "GOOD") {
    return {
      bg: "bg-[#06765F]",
      text: "text-[#06765F] dark:text-[#06765F]",
      paperBadge: PAPER_SCORE_BADGE_CLASSES,
      border: "border-[#06765F]/30",
      label,
    };
  }
  if (label === "FAIR" || label === "RIDEABLE") {
    return {
      bg: "bg-[#8A5E00]",
      text: "text-[#8A5E00] dark:text-[#8A5E00]",
      paperBadge: PAPER_SCORE_BADGE_CLASSES,
      border: "border-[#8A5E00]/30",
      label,
    };
  }
  return {
    bg: "bg-[#4A463C]",
    text: "text-[#11100D] dark:text-[#11100D]",
    paperBadge: PAPER_SCORE_BADGE_CLASSES,
    border: "border-[#11100D]/25",
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
 * getQualityLabel(90) // "GOOD" while EPIC_LABEL_ENABLED is false
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
  const label = scoreLabel(score);
  if (label === "EPIC") return QUALITY_CONFIG.epic;
  if (label === "GOOD") return QUALITY_CONFIG.good;
  if (label === "FAIR") return QUALITY_CONFIG.fair;
  if (label === "RIDEABLE") return QUALITY_CONFIG.rideable;
  return QUALITY_CONFIG.poor;
}
