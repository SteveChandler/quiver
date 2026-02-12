/**
 * Engagement tracking for Content Gravity features.
 *
 * Dual-fires events to GA4 (rich attribution) and Vercel Analytics
 * (queryable from the /engagement-metrics skill).
 */

import { track as gaTrack } from "@/lib/analytics";

function trackEngagement(
  event: string,
  data: Record<string, string | number | boolean>
) {
  // GA4 (rich attribution)
  gaTrack(event, data);

  // Vercel Analytics (queryable) - fire and forget
  if (typeof window !== "undefined") {
    import("@vercel/analytics")
      .then((mod) => mod.track(event, data))
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Feature 1: Nearby Beaches
// ---------------------------------------------------------------------------

export const trackNearbyBeachClick = (
  beachName: string,
  rank: number,
  score: number
) =>
  trackEngagement("nearby_beach_click", {
    beach: beachName,
    rank,
    score,
  });

export const trackNearbyBeachesViewed = (
  sourceBeach: string,
  count: number
) =>
  trackEngagement("nearby_beaches_viewed", {
    source: sourceBeach,
    count,
  });

// ---------------------------------------------------------------------------
// Feature 2: Best Conditions Homepage
// ---------------------------------------------------------------------------

export const trackBestConditionsClick = (
  beachName: string,
  rank: number,
  score: number
) =>
  trackEngagement("best_conditions_click", {
    beach: beachName,
    rank,
    score,
  });

export const trackBestConditionsViewed = (
  count: number,
  locationAware: boolean
) =>
  trackEngagement("best_conditions_viewed", {
    count,
    location_aware: locationAware,
  });

// ---------------------------------------------------------------------------
// Feature 3: Partial Content Gate
// ---------------------------------------------------------------------------

export const trackPartialGateViewed = (
  contentType: string,
  totalCount: number
) =>
  trackEngagement("partial_gate_viewed", {
    content_type: contentType,
    total: totalCount,
  });

export const trackPartialGateSignupClick = (contentType: string) =>
  trackEngagement("partial_gate_signup", {
    content_type: contentType,
  });
