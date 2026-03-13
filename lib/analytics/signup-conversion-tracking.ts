/**
 * Signup conversion tracking — dual-fires to both GA4 and user_events table.
 *
 * Unlike auth-events.ts (GA4-only), these functions also POST to /api/events
 * so signup funnel data flows into the internal user_events table for
 * dashboard measurement.
 */

import { track } from "@/lib/analytics";
import { getVisitorId } from "@/lib/utils/visitor-id";

/**
 * Module-level deduplication Set for signup_cta_view events.
 *
 * Prevents IntersectionObserver-driven components (e.g. cam-hero, sticky-bar)
 * from inflating view counts by re-firing on every scroll intersection.
 * The Set resets on full page reload, which is the correct session boundary.
 *
 * Key = source identifier (e.g. "cam-hero", "inline-cta").
 */
const viewedSources = new Set<string>();

/**
 * Reset the deduplication Set. Only intended for use in tests.
 * Do NOT call this in application code.
 */
export function _resetViewedSourcesForTesting(): void {
  viewedSources.clear();
}

function fireToUserEvents(eventType: string, params: Record<string, any>) {
  if (typeof window === "undefined") return;

  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        metadata: params,
        sessionId: getVisitorId(),
        viewportWidth: window.innerWidth,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow errors — tracking must never break the app
  }
}

export function trackSignupCtaView(params: Record<string, any>) {
  // Deduplicate view events per source per page load.
  // Without this, scroll-triggered IntersectionObservers fire dozens of times
  // per session, making CTA view metrics completely unreliable.
  const sourceKey = String(params.source ?? "unknown");
  if (viewedSources.has(sourceKey)) return;
  viewedSources.add(sourceKey);

  track("signup_cta_view", params);
  fireToUserEvents("signup_cta_view", params);
}

export function trackSignupCtaClick(params: Record<string, any>) {
  track("signup_cta_click", params);
  fireToUserEvents("signup_cta_click", params);
}

export function trackSigninCtaClick(params: Record<string, any>) {
  track("signin_cta_click", params);
  fireToUserEvents("signin_cta_click", params);
}
