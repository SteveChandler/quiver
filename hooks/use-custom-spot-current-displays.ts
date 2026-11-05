"use client";

import { useEffect, useState } from "react";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";

const HOUR_MS = 60 * 60 * 1000;
const MAX_SPOTS = 50;

interface CurrentDisplayResponse {
  data?: { displays?: Record<string, ForecastDisplay> };
}

/**
 * Current wave labels for custom spots adjusted to their own terrain. Spots
 * missing from the map keep their anchor beach's label. Refreshes hourly.
 */
export function useCustomSpotCurrentDisplays(
  spotIds: string[],
  getAccessToken?: () => string | null,
): Map<string, ForecastDisplay> {
  const [displays, setDisplays] = useState<Map<string, ForecastDisplay>>(new Map());
  const idsKey = [...new Set(spotIds)].sort().slice(0, MAX_SPOTS).join(",");
  const hourBucket = Math.floor(Date.now() / HOUR_MS);

  useEffect(() => {
    if (!idsKey || typeof fetch !== "function") {
      setDisplays((current) => (current.size === 0 ? current : new Map()));
      return;
    }
    const controller = new AbortController();
    const accessToken = getAccessToken?.();
    fetch(`/api/custom-spots/current-display?ids=${idsKey}`, {
      signal: controller.signal,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: CurrentDisplayResponse | null) => {
        if (controller.signal.aborted) return;
        setDisplays(new Map(Object.entries(json?.data?.displays ?? {})));
      })
      .catch(() => {
        // Best effort: on failure the pins keep their anchor beach's label.
      });
    return () => controller.abort();
    // getAccessToken is read per request, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, hourBucket]);

  return displays;
}
