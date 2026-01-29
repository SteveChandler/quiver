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

import type { TimeSlot } from "@/types/personalization";

/**
 * Condition tier based on score thresholds
 * - great: Score >= 80
 * - good: Score 60-79
 * - fair: Score 40-59
 * - marginal: Score < 40
 */
export type ConditionTier = "great" | "good" | "fair" | "marginal";

/**
 * Score thresholds for condition tiers
 */
export const CONDITION_TIER_THRESHOLDS = {
  great: 80,
  good: 60,
  fair: 40,
  marginal: 0,
} as const;

/**
 * Get condition tier based on score thresholds
 * @param score Score value (0-100)
 * @returns ConditionTier - 'great' (80+), 'good' (60-79), 'fair' (40-59), 'marginal' (<40)
 */
export function getConditionTier(score: number): ConditionTier {
  if (score >= CONDITION_TIER_THRESHOLDS.great) return "great";
  if (score >= CONDITION_TIER_THRESHOLDS.good) return "good";
  if (score >= CONDITION_TIER_THRESHOLDS.fair) return "fair";
  return "marginal";
}

/**
 * Get Tailwind color class for score display based on condition tier
 * @param tier Condition tier
 * @returns Tailwind color class
 */
export function getScoreColorClass(tier: ConditionTier): string {
  switch (tier) {
    case "great":
    case "good":
      return "text-accent-orange";
    case "fair":
      return "text-amber-400";
    case "marginal":
      return "text-white/60";
  }
}

/**
 * Condition badge configuration
 */
export interface ConditionBadgeConfig {
  label: string;
  className: string;
}

/**
 * Get condition badge configuration based on tier
 * @param tier Condition tier
 * @returns Badge config with label and className, or null for 'good' tier
 */
export function getConditionBadge(tier: ConditionTier): ConditionBadgeConfig | null {
  switch (tier) {
    case "great":
      return {
        label: "Great Conditions",
        className: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
      };
    case "good":
      return null;
    case "fair":
      return {
        label: "Fair Conditions",
        className: "bg-amber-500/20 text-amber-300 border-amber-400/30",
      };
    case "marginal":
      return {
        label: "Marginal",
        className: "bg-white/10 text-white/60 border-white/20",
      };
  }
}

/**
 * Headline text parts for recommendation display
 */
export interface HeadlineText {
  prefix: string;
  beachPart: string;
  connector: string;
}

/**
 * Build headline parts based on condition tier and time context
 * @param beachName Name of the beach
 * @param tier Condition tier
 * @param isTomorrow Whether the forecast is for tomorrow
 * @param timeSlot Optional time slot for tomorrow prefix
 * @returns Object with prefix, beachPart, and connector strings
 */
export function buildHeadlineText(
  beachName: string,
  tier: ConditionTier,
  isTomorrow: boolean,
  timeSlot?: TimeSlot
): HeadlineText {
  // Build tomorrow prefix based on time slot
  let prefix = "";
  if (isTomorrow) {
    switch (timeSlot) {
      case "dawn-patrol":
        prefix = "Tomorrow's dawn patrol at ";
        break;
      case "morning":
        prefix = "Tomorrow morning at ";
        break;
      case "afternoon":
        prefix = "Tomorrow afternoon at ";
        break;
      default:
        prefix = "Tomorrow at ";
    }
  }

  // Build main headline based on tier
  switch (tier) {
    case "great":
      return { prefix, beachPart: beachName, connector: "is your best bet at" };
    case "good":
      return { prefix, beachPart: beachName, connector: "is a good option at" };
    case "fair":
      return {
        prefix: prefix || "Conditions are fair at ",
        beachPart: beachName,
        connector: prefix ? "— conditions are fair at" : "—",
      };
    case "marginal":
      return {
        prefix: prefix || "Conditions are marginal at ",
        beachPart: beachName,
        connector: prefix ? "— conditions are marginal at" : "—",
      };
  }
}

/**
 * Check if a date is tomorrow relative to now in a given timezone
 * @param date Date to check
 * @param timezone IANA timezone string
 * @returns true if date is tomorrow in the given timezone
 */
export function isTomorrowInTimezone(date: Date, timezone: string): boolean {
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
