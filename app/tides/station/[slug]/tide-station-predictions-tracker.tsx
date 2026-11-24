"use client";

import { useEffect, useRef } from "react";

import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";

export function TideStationPredictionsTracker({ stationSlug }: { stationSlug: string }): null {
  const trackedSlug = useRef<string | null>(null);

  useEffect(() => {
    if (trackedSlug.current === stationSlug) return;
    trackedSlug.current = stationSlug;
    captureClientPostHogEventAfterConsent("tide_station_predictions_rendered", {
      station_slug: stationSlug,
    });
  }, [stationSlug]);

  return null;
}
