"use client";

import { useEffect, useRef } from "react";

import { track } from "@/lib/analytics";

interface ShareLinkOpenTrackerProps {
  slug: string;
  windowValue: string | null;
  shareId?: string | null;
  host?: string | null;
  /** True on the go-host hop after "Open in Quiver"; the www landing already counted this visit. */
  isSecondHop?: boolean;
}

function normalizeForecastAt(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return Number.isNaN(Date.parse(trimmed)) ? null : trimmed;
}

export function ShareLinkOpenTracker({
  slug,
  windowValue,
  shareId = null,
  host = null,
  isSecondHop = false,
}: ShareLinkOpenTrackerProps) {
  const trackedKey = useRef<string | null>(null);

  useEffect(() => {
    const forecastAt = normalizeForecastAt(windowValue);
    if (isSecondHop || (!forecastAt && !shareId)) return;

    const key = `${shareId ?? ""}|${forecastAt ?? ""}`;
    if (trackedKey.current === key) return;
    trackedKey.current = key;

    track(
      "share_link_opened",
      {
        campaign: forecastAt ? "forecast_window" : "beach",
        target_type: forecastAt ? "forecast_window" : "beach",
        target_id: forecastAt ? `${slug}:${forecastAt}` : slug,
        link_path_format: forecastAt ? "app_spot_window" : "app_spot_beach",
        viewer_context: "web_landing",
        ...(host ? { host } : {}),
        ...(forecastAt ? { selected_forecast_at: forecastAt } : {}),
        ...(shareId ? { share_id: shareId } : {}),
      },
      { includeAttribution: false },
    );
  }, [host, isSecondHop, shareId, slug, windowValue]);

  return null;
}
