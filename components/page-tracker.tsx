"use client";

/**
 * PageTracker Component
 *
 * Tracks page view events when users navigate through the app.
 * Uses the useTrackEvent hook to fire events to /api/events.
 *
 * @see docs/plans/user-engagement-tracking.md
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTrackEvent } from "@/hooks/use-track-event";

/**
 * Maps pathname to a human-readable page name
 */
function getPageName(pathname: string): string {
  // Home/dashboard
  if (pathname === "/home" || pathname === "/dashboard") return "home";

  // Discovery/explore pages
  if (pathname === "/discover" || pathname === "/explore") return "discover";

  // Beach detail pages
  if (pathname.startsWith("/beach/")) return "beach_detail";
  if (pathname.startsWith("/beaches/")) return "beaches";

  // Map pages
  if (pathname.startsWith("/map")) return "map";

  // Profile and settings
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return "profile";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "settings";

  // Session logging
  if (pathname.startsWith("/session")) return "session";

  // Forecast pages
  if (pathname.startsWith("/forecast")) return "forecast";

  // Onboarding
  if (pathname.startsWith("/onboarding")) return "onboarding";

  // Auth pages
  if (pathname === "/login" || pathname === "/signup" || pathname === "/auth") {
    return "auth";
  }

  // Landing page
  if (pathname === "/") return "landing";

  // Fallback to pathname segment
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment || "unknown";
}

/**
 * Generates a simple session ID for grouping page views
 * Persists for the browser session (cleared on tab close)
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";

  const key = "__quiver_session_id";
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}

export function PageTracker() {
  const pathname = usePathname();
  const { track } = useTrackEvent();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    // Skip if pathname hasn't changed (initial mount is fine)
    if (prevPathname.current === pathname) return;

    const page = getPageName(pathname);
    const sessionId = getSessionId();
    const metadata = {
      page,
      pathname,
      referrer: prevPathname.current || "",
      browser_session_id: sessionId,
    };

    track("page_view", {
      metadata,
      debounceMs: 500, // Shorter debounce for page views
    });

    prevPathname.current = pathname;
  }, [pathname, track]);

  return null;
}
