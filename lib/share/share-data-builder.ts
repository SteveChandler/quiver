/**
 * Share Data Builder
 *
 * Centralized utility for building share data from surf recommendations.
 * Extracts the complex share data computation logic from the home screen
 * component for better testability and reusability.
 */

import type { SurfDiscoveryRecommendation, TimeSlot } from "@/types/personalization";
import { formatDiscoveryScore } from "@/lib/utils/rating-formatters";
import { formatTimeWindowCompact } from "@/lib/utils/time-formatters";
import {
  getConditionTier,
  getConditionBadge,
  buildHeadlineText,
  isTomorrowInTimezone,
  isEveningInTimezone,
} from "@/lib/utils/condition-tier-utils";
import { buildSurfCallShareUrl } from "./build-share-card-url";

/**
 * Share data for the Share button
 */
export interface ShareData {
  /** URL to the OG image */
  imageUrl: string;
  /** Beach name */
  beachName: string;
  /** Share title text */
  title: string;
  /** Share description text */
  text: string;
}

/**
 * Input parameters for building share data
 */
export interface BuildShareDataInput {
  /** The surf discovery recommendation to share */
  recommendation: SurfDiscoveryRecommendation;
  /** Optional time slot filter for headline context */
  timeSlot?: TimeSlot;
}

/**
 * Build share data from a surf discovery recommendation
 *
 * This function extracts all the logic needed to create shareable content
 * from a recommendation, including:
 * - Condition tier calculation
 * - Time window formatting
 * - Headline text generation
 * - OG image URL construction
 *
 * @param input The recommendation and optional time slot
 * @returns ShareData object or null if invalid input
 *
 * @example
 * ```ts
 * const shareData = buildSurfCallShareData({
 *   recommendation: topRecommendation,
 *   timeSlot: 'lunch-session',
 * });
 *
 * if (shareData) {
 *   openShareSheet(shareData);
 * }
 * ```
 */
export function buildSurfCallShareData(input: BuildShareDataInput): ShareData | null {
  const { recommendation, timeSlot } = input;

  if (!recommendation) {
    return null;
  }

  try {
    const { beach, score, window, conditionBadges, waveHeightBadge, message } = recommendation;

    // Calculate condition tier and related data
    const tier = getConditionTier(score);
    const formattedScore = formatDiscoveryScore(score);
    const timeWindow = formatTimeWindowCompact(window.start, window.end, window.timezone);
    const conditionBadge = getConditionBadge(tier);

    // Determine if tomorrow using centralized utility
    const timezone = window.timezone || beach.timezone || "America/Los_Angeles";
    const isTomorrow = isTomorrowInTimezone(window.start, timezone);

    // Build headline text for share description
    const isEvening = isEveningInTimezone(timezone);
    const headlineText = buildHeadlineText(beach.name, tier, isTomorrow, timeSlot, isEvening);

    // Build time context for OG image subtitle (e.g., "Tomorrow Morning", "This Afternoon")
    // Time slots: dawn-patrol (6-11am), lunch-session (11am-2pm), afternoon (2-6pm)
    let timeContext = "";
    if (isTomorrow) {
      timeContext = timeSlot === "dawn-patrol" ? "Tomorrow Morning"
        : timeSlot === "lunch-session" ? "Tomorrow Midday"
        : timeSlot === "afternoon" ? "Tomorrow Afternoon"
        : "Tomorrow";
    } else {
      timeContext = timeSlot === "dawn-patrol" ? "This Morning"
        : timeSlot === "lunch-session" ? "Midday"
        : timeSlot === "afternoon" ? "This Afternoon"
        : "Today";
    }

    // Build the OG image URL with all parameters
    const imageUrl = buildSurfCallShareUrl({
      beach: beach.name,
      verdict: tier === "great" || tier === "good" ? "YES" : tier === "fair" ? "MAYBE" : "NO",
      window: timeWindow,
      waveHeight: waveHeightBadge || "",
      wind: "",
      tags: conditionBadges?.slice(0, 3).map((b) => b.label).join(",") || "",
      // New parameters for redesigned share card
      score: Math.round(score),
      headline: beach.name, // Beach name only - time context moved to separate param
      conditionLabel: conditionBadge?.label || "",
      message: message || "",
      timeContext,
    });

    return {
      imageUrl,
      beachName: beach.name,
      title: `Check out ${beach.name}!`,
      text: `${headlineText.prefix}${beach.name} ${headlineText.connector} ${formattedScore}/10`,
    };
  } catch (error) {
    console.error("[buildSurfCallShareData] Error building share data:", error);
    return null;
  }
}
