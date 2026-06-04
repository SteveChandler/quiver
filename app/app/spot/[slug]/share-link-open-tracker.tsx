"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics";

interface ShareLinkOpenTrackerProps {
  slug: string;
  windowValue: string | null;
}

function normalizeForecastAt(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return Number.isNaN(Date.parse(trimmed)) ? null : trimmed;
}

export function ShareLinkOpenTracker({
  slug,
  windowValue,
}: ShareLinkOpenTrackerProps) {
  useEffect(() => {
    const forecastAt = normalizeForecastAt(windowValue);
    if (!forecastAt) return;

    track(
      "share_link_opened",
      {
        campaign: "forecast_window",
        target_type: "forecast_window",
        target_id: `${slug}:${forecastAt}`,
        selected_forecast_at: forecastAt,
        link_path_format: "app_spot_window",
      },
      { includeAttribution: false },
    );
  }, [slug, windowValue]);

  return null;
}
