/**
 * useSurfDropsInView — fetches the list of active Surf Drops within a map
 * bounding box. Refetches on bbox change (debounced) and exposes a manual
 * `refetch` so the CreateDropSheet can force a refresh after a POST.
 *
 * The endpoint (`GET /api/surf-drops/map`) is authed; on 401 we return an empty
 * list without throwing so the map still renders for signed-out users.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface SurfDropInView {
  id: string;
  share_slug: string;
  location_type: "known_spot" | "custom_pin";
  lat: number;
  lon: number;
  beach_id: string | null;
  spot_name: string | null;
  general_area: string | null;
  exact_label: string | null;
  starts_at: string;
  ends_at: string;
  audience: "mutuals" | "friends" | "link" | "private";
  creator: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  participants_count: number;
}

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface Options {
  enabled?: boolean;
  debounceMs?: number;
}

interface UseSurfDropsResult {
  drops: SurfDropInView[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function bboxParam(bounds: MapBounds): string {
  return [bounds.west, bounds.south, bounds.east, bounds.north].join(",");
}

export function useSurfDropsInView(
  bounds: MapBounds | null,
  { enabled = true, debounceMs = 400 }: Options = {},
): UseSurfDropsResult {
  const [drops, setDrops] = useState<SurfDropInView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refetchTokenRef = useRef(0);

  const bboxKey = useMemo(
    () => (bounds ? bboxParam(bounds) : null),
    [bounds],
  );

  const doFetch = useCallback(async () => {
    if (!bboxKey || !enabled) return;
    setLoading(true);
    setError(null);
    const token = ++refetchTokenRef.current;
    try {
      const res = await fetch(`/api/surf-drops/map?bbox=${bboxKey}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (res.status === 401) {
        if (token === refetchTokenRef.current) setDrops([]);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load Surf Drops (${res.status})`);
      }
      const json = await res.json();
      const list: SurfDropInView[] = json?.data?.drops ?? [];
      // Coord validation — server should already return finite numbers, but
      // guard against nulls from custom_pin edge cases so we never call
      // Marker#setLngLat with NaN.
      const clean = list.filter(
        (drop) =>
          typeof drop.lat === "number" &&
          typeof drop.lon === "number" &&
          Number.isFinite(drop.lat) &&
          Number.isFinite(drop.lon),
      );
      if (token === refetchTokenRef.current) setDrops(clean);
    } catch (err) {
      if (token === refetchTokenRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load drops");
        setDrops([]);
      }
    } finally {
      if (token === refetchTokenRef.current) setLoading(false);
    }
  }, [bboxKey, enabled]);

  useEffect(() => {
    if (!bboxKey || !enabled) return;
    const timer = setTimeout(doFetch, debounceMs);
    return () => clearTimeout(timer);
  }, [bboxKey, enabled, doFetch, debounceMs]);

  const refetch = useCallback(() => {
    void doFetch();
  }, [doFetch]);

  return { drops, loading, error, refetch };
}
