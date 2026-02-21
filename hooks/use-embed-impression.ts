import { useEffect, useRef } from "react";

/**
 * Track embed widget impressions (conditions or tides).
 * Fire-and-forget analytics tracking with single-fire protection.
 */
export function useEmbedImpression(
  widgetType: "conditions" | "tides" | "surf-terminal" | "ticker",
  slug: string
): void {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    fetch("/api/embed-impressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetType, beachSlug: slug }),
      keepalive: true,
    }).catch((e) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Embed] impression tracking failed:", e);
      }
    });
  }, [widgetType, slug]);
}
