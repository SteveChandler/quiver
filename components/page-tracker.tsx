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
import { getWebAnalyticsContext } from "@/lib/analytics/web-context";

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

    const context = getWebAnalyticsContext({ pathname });
    const launchMetadata = getLaunchPageMetadata(pathname);
    const metadata = {
      ...context,
      previous_pathname: prevPathname.current || "",
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
          browser_session_id: context.browser_session_id,
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
