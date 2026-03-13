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
 * Deduplicates signup_cta_view events per source per page session.
 *
 * Without this guard, components using IntersectionObserver or scroll
 * listeners re-trigger on every visibility change (e.g. scroll direction
 * reversal), inflating view counts ~27x for sources like "cam-hero".
 * A module-level Set survives component unmount/remount cycles, unlike
 * a per-component useRef.
 */
const firedCtaViews = new Set<string>();

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
  const key = String(params.source ?? "unknown");
  if (firedCtaViews.has(key)) return; // Already fired this session — skip duplicate
  firedCtaViews.add(key);
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
