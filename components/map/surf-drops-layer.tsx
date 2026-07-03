/**
 * SurfDropsLayer — mounts alongside the InteractiveMap and imperatively
 * attaches Surf Drop markers to the shared Mapbox instance. The map instance
 * is picked up via the `quiver:map-ready` / `quiver:map-bounds-change` event
 * bridge that InteractiveMap dispatches on `window` (see interactive-map.tsx),
 * so no prop threading through MapContent / MapView is required.
 *
 * When disabled (layer toggle off), any existing markers are removed and no
 * fetch is fired. When re-enabled, the current viewport bbox is used to
 * hydrate.
 *
 * Sonar-pulse keyframes are declared inline via styled-jsx global so the
 * marker DOM (attached outside React's tree) can animate without depending on
 * `app/styles/zine.css`.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type mapboxgl from "mapbox-gl";
import {
  buildSurfDropMarkerElement,
  type SurfDropMarkerData,
} from "@/components/map/surf-drop-marker";
import {
  useSurfDropsInView,
  type MapBounds,
  type SurfDropInView,
} from "@/hooks/use-surf-drops-in-view";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SurfDropsLayerProps {
  enabled: boolean;
  /** External refetch trigger — increment to force a re-fetch. */
  refetchToken?: number;
  /** Optional callback for when a drop marker is clicked (before router push). */
  onDropClick?: (drop: SurfDropInView) => void;
}

type QuiverMapWindow = typeof window & {
  __quiverMap?: mapboxgl.Map | null;
};

function boundsFromMap(map: mapboxgl.Map | null): MapBounds | null {
  if (!map) return null;
  const bounds = map.getBounds?.();
  if (!bounds) return null;
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return null;
  }
  return { west, south, east, north };
}

export function SurfDropsLayer({
  enabled,
  refetchToken,
  onDropClick,
}: SurfDropsLayerProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const markerRefs = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const mapboxRef = useRef<typeof mapboxgl | null>(null);

  // Load mapbox-gl once so we can construct `new mapboxgl.Marker(...)`.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void import("mapbox-gl").then((mod) => {
      if (cancelled) return;
      mapboxRef.current = mod.default ?? (mod as unknown as typeof mapboxgl);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Subscribe to the InteractiveMap bridge events.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as QuiverMapWindow;
    if (w.__quiverMap) {
      setMap(w.__quiverMap);
      const currentBounds = boundsFromMap(w.__quiverMap);
      if (currentBounds) setBounds(currentBounds);
    }
    const onReady = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        map: mapboxgl.Map | null;
      };
      const nextMap = detail?.map ?? null;
      setMap(nextMap);
      const currentBounds = boundsFromMap(nextMap);
      if (currentBounds) setBounds(currentBounds);
    };
    const onBounds = (event: Event) => {
      const detail = (event as CustomEvent).detail as MapBounds | undefined;
      if (
        detail &&
        Number.isFinite(detail.west) &&
        Number.isFinite(detail.south) &&
        Number.isFinite(detail.east) &&
        Number.isFinite(detail.north)
      ) {
        setBounds(detail);
      }
    };
    window.addEventListener("quiver:map-ready", onReady);
    window.addEventListener("quiver:map-bounds-change", onBounds);
    return () => {
      window.removeEventListener("quiver:map-ready", onReady);
      window.removeEventListener("quiver:map-bounds-change", onBounds);
    };
  }, []);

  const { drops, refetch } = useSurfDropsInView(bounds, { enabled });

  // Wire external refetch trigger.
  useEffect(() => {
    if (refetchToken === undefined) return;
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchToken]);

  // Dedupe drops by id — server may return the same drop twice if bbox overlap.
  const dedupedDrops = useMemo(() => {
    const seen = new Set<string>();
    const out: SurfDropInView[] = [];
    for (const drop of drops) {
      if (seen.has(drop.id)) continue;
      seen.add(drop.id);
      out.push(drop);
    }
    return out;
  }, [drops]);

  // Sync markers to (map, drops, enabled) — remove missing, add new, leave the rest.
  useEffect(() => {
    if (!map || !mapboxRef.current) {
      // Also remove any leftover markers if the map instance is gone.
      if (markerRefs.current.size > 0) {
        markerRefs.current.forEach((marker) => marker.remove());
        markerRefs.current.clear();
      }
      return;
    }
    if (!enabled) {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current.clear();
      return;
    }

    const mapboxLib = mapboxRef.current;
    const nextIds = new Set(dedupedDrops.map((d) => d.id));

    // Remove markers that are no longer in view.
    markerRefs.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    });

    // Add / update markers.
    for (const drop of dedupedDrops) {
      if (markerRefs.current.has(drop.id)) continue;
      const el = buildSurfDropMarkerElement(dropToMarkerData(drop), {
        reducedMotion,
        onClick: (data) => {
          onDropClick?.(drop);
          router.push(`/drops/${data.id}`);
        },
      });
      const marker = new mapboxLib.Marker({ element: el, anchor: "center" })
        .setLngLat([drop.lon, drop.lat])
        .addTo(map);
      markerRefs.current.set(drop.id, marker);
    }
  }, [map, enabled, dedupedDrops, reducedMotion, router, onDropClick]);

  // Cleanup on unmount. Snapshot the ref value so the eslint
  // react-hooks/exhaustive-deps rule is happy (ref.current may drift by the
  // time cleanup runs, but for our use it points at the same Map instance).
  useEffect(() => {
    const markers = markerRefs.current;
    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
    };
  }, []);

  // Keyframes and reduced-motion overrides for sonar-pulse live in
  // app/styles/zine.css (owned by the pages/share slice).
  return null;
}

function dropToMarkerData(drop: SurfDropInView): SurfDropMarkerData {
  return {
    id: drop.id,
    share_slug: drop.share_slug,
    lat: drop.lat,
    lon: drop.lon,
    spot_name: drop.spot_name,
    general_area: drop.general_area,
    starts_at: drop.starts_at,
    ends_at: drop.ends_at,
    creator: drop.creator,
  };
}
