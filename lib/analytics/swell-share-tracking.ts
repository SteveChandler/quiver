import { track } from "@/lib/analytics";
import type { SwellKind } from "@/lib/notifications/copy/swell-card-headline";
import { getVisitorId } from "@/lib/utils/visitor-id";

export const SWELL_SHARE_SURFACE = "swell_share";

export type SwellSharePlacement =
  | "open_in_quiver"
  | "store_fallback"
  | "store_primary"
  | "desktop_app_store"
  | "desktop_android";

interface SwellShareContext {
  kind: SwellKind;
  /** Null when the link did not resolve to a stored event. */
  eventKey: string | null;
}

function swellShareMetadata({ kind, eventKey }: SwellShareContext): Record<string, string> {
  return {
    surface: SWELL_SHARE_SURFACE,
    kind,
    ...(eventKey ? { event_key: eventKey } : {}),
  };
}

function postUserEvent(
  eventType: "share_link_opened" | "cta_click",
  metadata: Record<string, string>,
): void {
  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        metadata,
        sessionId: getVisitorId(),
        viewportWidth: window.innerWidth,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking must never block navigation.
  }
}

/** Reuses share_link_opened so the swell page needs no new event type. */
export function trackSwellShareOpened(
  context: SwellShareContext & { platform: string },
): void {
  if (typeof window === "undefined") return;

  const metadata = {
    ...swellShareMetadata(context),
    campaign: "swell",
    target_type: "swell_event",
    ...(context.eventKey ? { target_id: context.eventKey } : {}),
    link_path_format: "app_swell",
    viewer_context: "web_landing",
    platform: context.platform,
  };
  track("share_link_opened", metadata, { includeAttribution: false });
  postUserEvent("share_link_opened", metadata);
}

export function trackSwellShareCtaClick(
  context: SwellShareContext & {
    placement: SwellSharePlacement;
    platform: string;
    destinationUrl: string;
  },
): void {
  if (typeof window === "undefined") return;

  const metadata = {
    ...swellShareMetadata(context),
    cta_family: "swell_share",
    source: "swell_share",
    placement: context.placement,
    platform: context.platform,
    destination_url: context.destinationUrl,
  };

  try {
    track("cta_click", metadata);
  } catch {
    // Product analytics is best effort and must not block navigation.
  }

  postUserEvent("cta_click", metadata);
}
