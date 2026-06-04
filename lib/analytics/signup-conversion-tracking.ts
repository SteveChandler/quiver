/**
 * Signup conversion tracking — dual-fires to both GA4 and user_events table.
 *
 * Unlike auth-events.ts (GA4-only), these functions also POST to /api/events
 * so signup funnel data flows into the internal user_events table for
 * dashboard measurement.
 */

import { track } from "@/lib/analytics";
import {
  deriveSurfaceFromPath,
  enrichWithWebAnalyticsContext,
} from "@/lib/analytics/web-context";
import { getVisitorId } from "@/lib/utils/visitor-id";

/**
 * Session-level deduplication for signup_cta_view events.
 *
 * Each CTA source fires at most once per browser session (tab lifetime),
 * regardless of page navigations, re-renders, or component remounts.
 * Uses sessionStorage so dedup survives Next.js client-side navigations
 * AND full page loads within the same tab session.
 *
 * The in-memory Set acts as a fast path and SSR-safe fallback.
 */
const viewedSources = new Set<string>();

function hasViewedInSession(source: string): boolean {
  if (viewedSources.has(source)) return true;
  try {
    return sessionStorage.getItem(`quiver_cta_viewed_${source}`) === "1";
  } catch {
    return false;
  }
}

function markViewedInSession(source: string): void {
  viewedSources.add(source);
  try {
    sessionStorage.setItem(`quiver_cta_viewed_${source}`, "1");
  } catch {
    // SSR or storage unavailable
  }
}

/**
 * Reset the deduplication state. Only intended for use in tests.
 * Do NOT call this in application code.
 */
export function _resetViewedSourcesForTesting(): void {
  viewedSources.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("quiver_cta_viewed_")) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // SSR or storage unavailable
  }
}

function fireToUserEvents(eventType: string, params: Record<string, any>) {
  if (typeof window === "undefined") return;

  // Lift beach_id from params to top-level beachId. Route handler
  // (app/api/events/route.ts:399,448,500) reads body.beachId only and
  // never touches metadata.beach_id — without this lift the column
  // stays NULL on every signup CTA fired from a beach detail page,
  // and the dashboard can't attribute signups to the beach that drove
  // them. Mirrors the lift in quiver-native/src/lib/analytics.ts.
  const beachIdCandidate = params.beach_id;
  const beachId =
    typeof beachIdCandidate === "string" && beachIdCandidate.length > 0
      ? beachIdCandidate
      : undefined;

  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        ...(beachId ? { beachId } : {}),
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

export { deriveSurfaceFromPath };

const VIEW_DWELL_MS = 500;

export function trackSignupCtaView(params: Record<string, any>) {
  // Deduplicate view events per source per browser session.
  // Without this, scroll-triggered IntersectionObservers and page navigations
  // fire thousands of events per day, drowning out real behavioral signals.
  const sourceKey = String(params.source ?? "unknown");
  if (hasViewedInSession(sourceKey)) return;

  // Delay fire by VIEW_DWELL_MS and verify the tab is still visible.
  // Filters out fast-bouncers and background-tab prefetches that would
  // otherwise inflate the denominator of the CTA conversion rate.
  const fire = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    if (hasViewedInSession(sourceKey)) return;
    markViewedInSession(sourceKey);
    const enriched = enrichWithWebAnalyticsContext(params);
    track("signup_cta_view", enriched);
    fireToUserEvents("signup_cta_view", enriched);
  };

  if (typeof window === "undefined") return;
  window.setTimeout(fire, VIEW_DWELL_MS);
}

export function trackSignupCtaClick(params: Record<string, any>) {
  const enriched = enrichWithWebAnalyticsContext(params);
  track("signup_cta_click", enriched);
  fireToUserEvents("signup_cta_click", enriched);
}

export function trackSigninCtaClick(params: Record<string, any>) {
  const enriched = enrichWithWebAnalyticsContext(params);
  track("signin_cta_click", enriched);
  fireToUserEvents("signin_cta_click", enriched);
}
