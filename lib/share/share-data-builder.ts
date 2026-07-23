/**
 * Share Data Builder
 *
 * Centralized utility for building share data from surf recommendations.
 * Extracts the complex share data computation logic from the home screen
 * component for better testability and reusability.
 */

import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import type { SurfDiscoveryRecommendation, TimeSlot } from "@/types/personalization";
import { formatTimeWindowCompact } from "@/lib/utils/date-time";
import {
  isFutureDayInTimezone,
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
  /** Canonical authority that selected this exact recommendation */
  sessionDecision: CanonicalSessionDecision | null;
  /** Optional time slot filter for headline context */
  timeSlot?: TimeSlot;
}

/**
 * Build share data from a surf discovery recommendation
 *
 * This function extracts all the logic needed to create shareable content
 * from a recommendation, including:
 * - Exact canonical-selection validation
 * - Time window formatting
 * - Canonical verdict projection
 * - OG image URL construction without legacy scores
 *
 * @param input The recommendation and optional time slot
 * @returns ShareData object or null if invalid input
 *
 * @example
 * ```ts
 * const shareData = buildSurfCallShareData({
 *   recommendation: topRecommendation,
 *   sessionDecision,
 *   timeSlot: 'lunch-session',
 * });
 *
 * if (shareData) {
 *   openShareSheet(shareData);
 * }
 * ```
 */
export function buildSurfCallShareData(input: BuildShareDataInput): ShareData | null {
  const { recommendation, sessionDecision, timeSlot } = input;

  const selection = sessionDecision?.selection;
  const expiresAt = Date.parse(sessionDecision?.expiresAt ?? "");
  const recommendationStart = recommendation?.window?.start;
  const recommendationEnd = recommendation?.window?.end;
  if (
    !recommendation
    || !sessionDecision
    || sessionDecision.verdict === "no"
    || !selection
    || !Number.isFinite(expiresAt)
    || Date.now() >= expiresAt
    || recommendation.recommendationId !== selection.candidateId
    || recommendation.beach?.id !== selection.beachId
    || !(recommendationStart instanceof Date)
    || !(recommendationEnd instanceof Date)
    || recommendationStart.toISOString() !== selection.windowStart
    || recommendationEnd.toISOString() !== selection.windowEnd
  ) {
    return null;
  }

  try {
    const { beach, window, conditionBadges, waveHeightBadge, message } = recommendation;
    const timeWindow = formatTimeWindowCompact(window.start, window.end, window.timezone);

    // Determine if tomorrow using centralized utility
    const timezone = window.timezone || beach.timezone || "America/Los_Angeles";
    const isTomorrow = isFutureDayInTimezone(window.start, timezone);

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
      verdict: sessionDecision.verdict === "go" ? "YES" : "MAYBE",
      window: timeWindow,
      waveHeight: waveHeightBadge || "",
      wind: "",
      tags: conditionBadges?.slice(0, 3).map((b) => b.label).join(",") || "",
      headline: beach.name, // Beach name only - time context moved to separate param
      conditionLabel: sessionDecision.verdict === "go" ? "Go" : "Consider",
      message: message || "",
      timeContext,
    });

    return {
      imageUrl,
      beachName: beach.name,
      title: `Surf ${beach.name}`,
      text: `${sessionDecision.verdict === "go" ? "Go" : "Consider"}: ${beach.name}, ${timeWindow}`,
    };
  } catch (error) {
    console.error("[buildSurfCallShareData] Error building share data:", error);
    return null;
  }
}
