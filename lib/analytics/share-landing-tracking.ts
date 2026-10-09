import { track } from "@/lib/analytics";
import { getVisitorId } from "@/lib/utils/visitor-id";

const SHARE_LANDING_OPEN_APP_FAMILY = "share_landing_open_app";

interface ShareLandingOpenAppClick {
  shareId: string | null;
  destinationUrl: string;
}

/**
 * Taps on "Open in Quiver". Kept off the ios_app CTA family so store-tap
 * counts (cta_click with utm_campaign=share) are not inflated by app-open taps.
 */
export function trackShareLandingOpenAppClick({
  shareId,
  destinationUrl,
}: ShareLandingOpenAppClick): void {
  if (typeof window === "undefined") return;

  const metadata = {
    cta_family: SHARE_LANDING_OPEN_APP_FAMILY,
    source: "share_landing",
    surface: "app_spot",
    placement: "open_in_quiver",
    destination_url: destinationUrl,
    ...(shareId ? { share_id: shareId } : {}),
  };

  try {
    track("cta_click", metadata);
  } catch {
    // Product analytics is best effort and must not block navigation.
  }

  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "cta_click",
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
