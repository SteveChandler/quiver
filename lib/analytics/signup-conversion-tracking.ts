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

// Explicit US state / territory slugs per app/[intent]/[city]/[beachSlug].
// Mirrors covered regions in lib/constants/coverage-areas.ts — keep in sync.
// Allowlist (vs a 2-letter regex) prevents locale prefixes (`/en`, `/js`) and
// arbitrary short segments from false-matching as state-hub.
const STATE_SLUGS = new Set([
  "ca", "or", "wa",                                      // West Coast
  "me", "nh", "ma", "ri", "ny", "nj",                    // Northeast
  "nc", "sc", "ga", "fl", "tx",                          // Southeast / Gulf
  "hi", "pr",                                            // Islands / territory
]);

// Auto-derives a canonical surface label from the URL so the signup funnel
// dashboard can group by page type even when the caller forgot to pass one.
// Caller-provided `surface` always wins (see enrichWithSurface).
// `pathname` arg is optional — defaults to `window.location.pathname` in the
// browser, or "" in SSR. Exported primarily for testability; prefer passing
// undefined in app code so the browser pathname is used.
export function deriveSurfaceFromPath(pathname?: string): string {
  const raw =
    pathname ??
    (typeof window === "undefined" ? null : window.location.pathname);
  if (raw === null) return "server";

  // Normalize: strip trailing slashes so /about/ and /about bucket together.
  const path = raw.replace(/\/+$/, "") || "/";

  if (path === "/") return "landing-page";
  if (path === "/about") return "about-page";
  if (path === "/features" || path.startsWith("/features/")) return "features-page";
  if (path === "/map" || path.startsWith("/map/")) return "map";
  if (path.startsWith("/guides/")) return "guides-page";
  if (path === "/tools" || path.startsWith("/tools/")) return "tools-page";

  // Authenticated account surfaces — meaningfully distinct from "other"
  // because `public-content-gate` fires on some of these pages too.
  if (path === "/profile" || path.startsWith("/profile/")) return "auth-gated";
  if (path === "/settings" || path.startsWith("/settings/")) return "auth-gated";
  if (path === "/account" || path.startsWith("/account/")) return "auth-gated";

  // State hierarchy: /[state]/[city]/[beach] per app/[intent]/[city]/[beachSlug].
  // Uses explicit STATE_SLUGS allowlist instead of a 2-letter regex to prevent
  // locale prefixes (/en/...) and arbitrary short segments (/js, /ts) from
  // false-matching.
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 1 && STATE_SLUGS.has(segments[0])) {
    if (segments.length >= 3) return "beach-detail";
    if (segments.length === 2) return "city-hub";
    return "state-hub";
  }

  return "other";
}

function enrichWithSurface(params: Record<string, any>): Record<string, any> {
  if (typeof params.surface === "string" && params.surface.length > 0) return params;
  return { ...params, surface: deriveSurfaceFromPath() };
}

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
    const enriched = enrichWithSurface(params);
    track("signup_cta_view", enriched);
    fireToUserEvents("signup_cta_view", enriched);
  };

  if (typeof window === "undefined") return;
  window.setTimeout(fire, VIEW_DWELL_MS);
}

export function trackSignupCtaClick(params: Record<string, any>) {
  const enriched = enrichWithSurface(params);
  track("signup_cta_click", enriched);
  fireToUserEvents("signup_cta_click", enriched);
}

export function trackSigninCtaClick(params: Record<string, any>) {
  const enriched = enrichWithSurface(params);
  track("signin_cta_click", enriched);
  fireToUserEvents("signin_cta_click", enriched);
}
