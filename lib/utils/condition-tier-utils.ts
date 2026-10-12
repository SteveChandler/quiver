/**
 * Condition Tier Utilities
 *
 * Centralized utilities for condition tier calculations, badge configurations,
 * and headline text generation based on surf condition scores.
 *
 * These functions are used across multiple components:
 * - HeroRecommendation
 * - HorizonStrip
 * - CompactSpotCard
 * - Share data builder
 */

import { scoreLabel } from "@/lib/utils/score-color-utils";

/**
 * Condition tier based on score thresholds
 * - epic: Score >= 80, only while EPIC_LABEL_ENABLED (score-color-utils)
 * - good: Score 70-79
 * - fair: Score 55-69
 * - rideable: Score 40-54
 * - meh: Score < 40
 */
export type ConditionTier = "epic" | "good" | "fair" | "rideable" | "meh";

/**
 * Score thresholds for condition tiers
 */
export const CONDITION_TIER_THRESHOLDS = {
  epic: 80,
  good: 70,
  fair: 55,
  rideable: 40,
  meh: 0,
} as const;

/**
 * Get condition tier based on score thresholds
 * @param score Score value (0-100)
 * @returns ConditionTier - the lowercase scoreLabel: 'good' (70+ while EPIC is off), 'fair' (55-69), 'rideable' (40-54), 'meh' (<40)
 */
export function getConditionTier(score: number): ConditionTier {
  return scoreLabel(score).toLowerCase() as ConditionTier;
}

/**
 * Condition badge configuration
 */
interface ConditionBadgeConfig {
  label: string;
  className: string;
}

/**
 * Get condition badge configuration based on tier
 * @param tier Condition tier
 * @returns Badge config with label and className for the condition tier
 */
export function getConditionBadge(tier: ConditionTier): ConditionBadgeConfig | null {
  switch (tier) {
    case "epic":
      return {
        label: "EPIC Conditions",
        className: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
      };
    case "good":
      return null;
    case "fair":
      return {
        label: "FAIR Conditions",
        className: "bg-amber-500/20 text-amber-300 border-amber-400/30",
      };
    case "rideable":
      return {
        label: "RIDEABLE Conditions",
        className: "bg-white/10 text-white/60 border-white/20",
      };
    case "meh":
      return {
        label: "MEH Conditions",
        className: "bg-white/10 text-white/60 border-white/20",
      };
  }
}

/**
 * Check if a date is tomorrow relative to now in a given timezone
 * @param date Date to check
 * @param timezone IANA timezone string
 * @returns true if date is tomorrow in the given timezone
 */
export function isFutureDayInTimezone(date: Date, timezone: string): boolean {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });
  const todayStr = dateFormatter.format(now);
  const dateStr = dateFormatter.format(date);
  return todayStr !== dateStr && date > now;
}
