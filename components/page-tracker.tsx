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
import { usePathname, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useTrackEvent } from "@/hooks/use-track-event";
import { getLaunchPageMetadata } from "@/lib/analytics/launch-campaign";
import { getBrowserSessionId } from "@/lib/utils/browser-session-id";

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

  // Launch pricing and blog pages
  if (pathname === "/pricing") return "pricing";
  if (pathname === "/blog") return "blog_index";
  if (pathname.startsWith("/blog/")) return "blog_post";

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

type ShareAttributionMetadata = {
  share_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

const ATTRIBUTION_QUERY_KEYS = [
  "share_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

function getShareAttributionMetadata(
  searchParams: URLSearchParams | ReadonlyURLSearchParams | null
): ShareAttributionMetadata {
  const metadata: ShareAttributionMetadata = {};

  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = searchParams?.get(key);
    if (value) metadata[key] = value;
  }

  return metadata;
}

function getSharedSessionId(pathname: string): string | null {
  const match = pathname.match(/^\/sessions\/([^/?#]+)/);
  const sessionId = match?.[1];
  if (!sessionId || sessionId === "new") return null;
  return decodeURIComponent(sessionId);
}

export function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { track } = useTrackEvent();
  const prevTrackingKey = useRef<string | null>(null);
  const prevPathname = useRef<string | null>(null);
  const trackedShareIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const attributionMetadata = getShareAttributionMetadata(searchParams);
    const trackingKey = [
      pathname,
      attributionMetadata.share_id ?? "",
      attributionMetadata.utm_source ?? "",
      attributionMetadata.utm_medium ?? "",
      attributionMetadata.utm_campaign ?? "",
    ].join("|");

    // Skip if the route plus safe attribution params haven't changed.
    if (prevTrackingKey.current === trackingKey) return;

    const page = getPageName(pathname);
    const sessionId = getBrowserSessionId();
    const launchMetadata = getLaunchPageMetadata(pathname);
    const metadata = {
      page,
      pathname,
      previous_pathname: prevPathname.current || "",
      browser_session_id: sessionId,
      ...attributionMetadata,
      ...(launchMetadata ?? {}),
    };

    track("page_view", {
      metadata,
      debounceMs: 500, // Shorter debounce for page views
    });

    const sharedSessionId = getSharedSessionId(pathname);
    const shareId = attributionMetadata.share_id;
    if (shareId && sharedSessionId && !trackedShareIds.current.has(shareId)) {
      trackedShareIds.current.add(shareId);
      track("share_link_opened", {
        metadata: {
          share_id: shareId,
          session_id: sharedSessionId,
          pathname,
          previous_pathname: prevPathname.current || "",
          browser_session_id: sessionId,
          source: "web_page_tracker",
          utm_source: attributionMetadata.utm_source,
          utm_medium: attributionMetadata.utm_medium,
          utm_campaign: attributionMetadata.utm_campaign,
        },
        debounceMs: 0,
      });
    }

    prevTrackingKey.current = trackingKey;
    prevPathname.current = pathname;
  }, [pathname, searchParams, track]);

  return null;
}
