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
 * - epic: Score >= 80
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
 * @returns ConditionTier - 'epic' (80+), 'good' (70-79), 'fair' (55-69), 'rideable' (40-54), 'meh' (<40)
 */
export function getConditionTier(score: number): ConditionTier {
  if (score >= CONDITION_TIER_THRESHOLDS.epic) return "epic";
  if (score >= CONDITION_TIER_THRESHOLDS.good) return "good";
  if (score >= CONDITION_TIER_THRESHOLDS.fair) return "fair";
  if (score >= CONDITION_TIER_THRESHOLDS.rideable) return "rideable";
  return "meh";
}

/**
 * Get Tailwind color class for score display based on condition tier
 * @param tier Condition tier
 * @returns Tailwind color class
 */
export function getScoreColorClass(tier: ConditionTier): string {
  switch (tier) {
    case "epic":
    case "good":
      return "text-accent-orange";
    case "fair":
      return "text-amber-400";
    case "rideable":
    case "meh":
      return "text-medium";
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
 * Headline text parts for recommendation display
 */
export interface HeadlineText {
  prefix: string;
  beachPart: string;
  connector: string;
}

/**
 * Check if the current time in a timezone is evening (6 PM or later).
 * After 6 PM, the day's surf windows (dawn-patrol, lunch-session, afternoon)
 * are over, so "tomorrow" is the natural framing instead of "skip today".
 * @param timezone IANA timezone string
 * @returns true if local time is 18:00 or later
 */
export function isEveningInTimezone(timezone: string): boolean {
  try {
    const now = new Date();
    const hourStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(now);
    return parseInt(hourStr, 10) >= 18;
  } catch {
    return false;
  }
}

/**
 * Build headline parts based on condition tier and time context
 * @param beachName Name of the beach
 * @param tier Condition tier
 * @param isTomorrow Whether the forecast is for tomorrow
 * @param timeSlot Optional time slot for tomorrow prefix
 * @param isEvening Whether it's evening (6 PM+) — uses plain "Tomorrow" instead of "Skip today"
 * @returns Object with prefix, beachPart, and connector strings
 */
export function buildHeadlineText(
  beachName: string,
  tier: ConditionTier,
  isTomorrow: boolean,
  timeSlot?: TimeSlot,
  isEvening?: boolean
): HeadlineText {
  // Build tomorrow prefix based on time slot
  // During evening hours, the day's surf windows are over so use plain "Tomorrow"
  // During daytime, "Skip today" signals that tomorrow is a better choice
  let prefix = "";
  if (isTomorrow) {
    if (isEvening) {
      switch (timeSlot) {
        case "dawn-patrol":
          prefix = "Tomorrow's dawn patrol at ";
          break;
        case "lunch-session":
          prefix = "Tomorrow midday at ";
          break;
        case "afternoon":
          prefix = "Tomorrow afternoon at ";
          break;
        default:
          prefix = "Tomorrow at ";
      }
    } else {
      switch (timeSlot) {
        case "dawn-patrol":
          prefix = "Skip today \u2014 tomorrow's dawn patrol at ";
          break;
        case "lunch-session":
          prefix = "Skip today \u2014 tomorrow midday at ";
          break;
        case "afternoon":
          prefix = "Skip today \u2014 tomorrow afternoon at ";
          break;
        default:
          prefix = "Skip today \u2014 tomorrow at ";
      }
    }
  }

  // Build main headline based on tier
  switch (tier) {
    case "epic":
      return { prefix, beachPart: beachName, connector: "is your best bet at" };
    case "good":
      return { prefix, beachPart: beachName, connector: "is a good option at" };
    case "fair":
      return {
        prefix: prefix || "Conditions are fair at ",
        beachPart: beachName,
        connector: prefix ? "— conditions are fair at" : "—",
      };
    case "rideable":
      return {
        prefix: prefix || "Conditions are rideable at ",
        beachPart: beachName,
        connector: prefix ? "— conditions are rideable at" : "—",
      };
    case "meh":
      return {
        prefix: prefix || "Conditions are meh at ",
        beachPart: beachName,
        connector: prefix ? "— conditions are meh at" : "—",
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
