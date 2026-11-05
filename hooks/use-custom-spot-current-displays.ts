"use client";

import { useEffect, useState } from "react";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";

const MAX_SPOTS = 50;

interface CurrentDisplayResponse {
  data?: { displays?: Record<string, ForecastDisplay> };
}

/**
 * Current wave labels for custom spots adjusted to their own terrain. Spots
 * missing from the map keep their anchor beach's label. `refreshKey` should
 * change whenever the anchors' current rows do, so both labels share an hour.
 */
export function useCustomSpotCurrentDisplays(
  spotIds: string[],
  refreshKey: string,
  getAccessToken?: () => string | null,
  onAuthTokenExpired?: () => void,
): Map<string, ForecastDisplay> {
  const [displays, setDisplays] = useState<Map<string, ForecastDisplay>>(new Map());
  const idsKey = [...new Set(spotIds)].sort().slice(0, MAX_SPOTS).join(",");

  useEffect(() => {
    if (!idsKey || typeof fetch !== "function") {
      setDisplays((current) => (current.size === 0 ? current : new Map()));
      return;
    }
    const controller = new AbortController();
    const url = `/api/custom-spots/current-display?ids=${idsKey}`;
    const accessToken = getAccessToken?.();
    // Same contract as the bulk map fetch: an expired token retries as a guest.
    const request = async (): Promise<Response> => {
      if (!accessToken) return fetch(url, { signal: controller.signal });
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (![401, 403].includes(response.status)) return response;
      onAuthTokenExpired?.();
      return fetch(url, { signal: controller.signal });
    };
    request()
      .then((response) => (response.ok ? response.json() : null))
      .then((json: CurrentDisplayResponse | null) => {
        if (controller.signal.aborted) return;
        setDisplays(new Map(Object.entries(json?.data?.displays ?? {})));
      })
      .catch(() => {
        // Best effort: on failure the pins keep their anchor beach's label.
      });
    return () => controller.abort();
    // The auth callbacks are read per request, not triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, refreshKey]);

  return displays;
}
