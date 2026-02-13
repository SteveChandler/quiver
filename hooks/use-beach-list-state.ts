import { useEffect, useRef, useCallback, useMemo } from "react";
import { calculateDistanceFormatted } from "@/lib/utils/distance-utils";
import type { Coordinates } from "@/lib/types/coordinates";
import type { Beach } from "@/types/database";

/**
 * Shared state logic for beach list components (MapSidebar and MapBottomSheet).
 * Handles card refs for auto-scrolling, distance computation, and selected-beach scroll sync.
 */
export function useBeachListState(
  beaches: Beach[],
  selectedBeach: Beach | null,
  userLocation: { lat: number; lon: number } | null
) {
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Extract ID to satisfy exhaustive-deps without eslint-disable
  const selectedBeachId = selectedBeach?.id ?? null;

  // Auto-scroll to selected beach card
  useEffect(() => {
    if (!selectedBeachId) return;
    const el = cardRefsMap.current.get(selectedBeachId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedBeachId]);

  // Callback ref setter for individual cards
  const setCardRef = useCallback(
    (beachId: string, el: HTMLDivElement | null) => {
      if (el) {
        cardRefsMap.current.set(beachId, el);
      } else {
        cardRefsMap.current.delete(beachId);
      }
    },
    []
  );

  // Pre-compute distances
  const distanceMap = useMemo(() => {
    if (!userLocation) return null;
    const from: Coordinates = { lat: userLocation.lat, lon: userLocation.lon };
    const map = new Map<string, string>();
    for (const beach of beaches) {
      if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon)) {
        const to: Coordinates = { lat: beach.lat, lon: beach.lon };
        map.set(beach.id, calculateDistanceFormatted(from, to, "miles"));
      }
    }
    return map;
  }, [userLocation, beaches]);

  return { setCardRef, distanceMap };
}
