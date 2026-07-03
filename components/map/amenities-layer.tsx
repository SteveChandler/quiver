/**
 * AmenitiesLayer — fetches amenities within the current map viewport and
 * attaches small letter-chip markers to the Mapbox instance. Uses the same
 * `quiver:map-ready` / `quiver:map-bounds-change` bridge that SurfDropsLayer
 * uses (see surf-drops-layer.tsx / interactive-map.tsx).
 *
 * Icons are rendered as cream letter-chips (P, WC, LG, ♿, …) rather than SVG
 * so we can ship the V1 without asset pipeline changes. The chip letter is
 * derived from `amenity_type`; unknown types fall back to a dot.
 *
 * Amenity chips open a compact zine-style popup. Provenance stays out of the
 * marker popup; the import/source metadata is retained in the API payload for
 * internal QA but not exposed in the map callout.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import type { MapBounds } from "@/hooks/use-surf-drops-in-view";

interface AmenityRow {
  id: string;
  type: string;
  lat: number;
  lon: number;
  source: string;
  source_ref: string | null;
  confidence: number;
  label: string | null;
  verified_at?: string | null;
  imported_at?: string | null;
}

interface AmenitiesLayerProps {
  enabled: boolean;
  /** Optional whitelist of amenity types to fetch (defaults to all). */
  types?: string[];
}

type QuiverMapWindow = typeof window & {
  __quiverMap?: mapboxgl.Map | null;
};

const CHIP_LABEL: Record<string, string> = {
  parking_free: "P",
  parking_paid: "$P",
  restrooms: "WC",
  showers: "◐",
  lifeguard: "LG",
  beach_access: "→",
  ada_access: "♿",
  stairs: "≡",
  path: "…",
  water_fountain: "☂",
  bike_parking: "B",
  transit_stop: "T",
  trash: "🗑",
  first_aid: "+",
  phone: "☏",
  pier: "▬",
  boat_ramp: "⛵",
};

function chipLabel(type: string): string {
  return CHIP_LABEL[type] ?? "•";
}

function bboxParam(b: MapBounds): string {
  return [b.west, b.south, b.east, b.north].join(",");
}

function amenityTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function boundsFromMap(map: mapboxgl.Map | null): MapBounds | null {
  if (!map) return null;
  try {
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
  } catch {
    return null;
  }
}

function hasMarkerContainer(map: mapboxgl.Map | null): boolean {
  if (!map) return false;
  try {
    return Boolean(map.getCanvasContainer?.());
  } catch {
    return false;
  }
}

export function AmenitiesLayer({ enabled, types }: AmenitiesLayerProps) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [amenities, setAmenities] = useState<AmenityRow[]>([]);
  const markerRefs = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const mapboxRef = useRef<typeof mapboxgl | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

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

  // Bridge to the shared map instance.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as QuiverMapWindow;
    if (hasMarkerContainer(w.__quiverMap ?? null)) {
      setMap(w.__quiverMap ?? null);
      const currentBounds = boundsFromMap(w.__quiverMap ?? null);
      if (currentBounds) setBounds(currentBounds);
    }
    const onReady = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        map: mapboxgl.Map | null;
      };
      const nextMap = detail?.map ?? null;
      if (!hasMarkerContainer(nextMap)) {
        setMap(null);
        return;
      }
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

  // Fetch amenities within bbox when enabled.
  useEffect(() => {
    if (!enabled || !bounds) {
      setAmenities([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams({ bbox: bboxParam(bounds) });
    if (types && types.length > 0) params.set("types", types.join(","));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/amenities?${params.toString()}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        const list: AmenityRow[] = json?.data?.amenities ?? [];
        if (!cancelled) setAmenities(list);
      } catch {
        // ignore aborts / transient errors — layer will re-fetch on next move.
      }
    }, 400);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, bounds, types]);

  // Sync markers.
  useEffect(() => {
    const activeMap = map;
    if (!activeMap || !hasMarkerContainer(activeMap) || !mapboxRef.current) {
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current.clear();
      return;
    }
    if (!enabled) {
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current.clear();
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }
    const mapboxLib = mapboxRef.current;
    const nextIds = new Set(amenities.map((a) => a.id));
    markerRefs.current.forEach((m, id) => {
      if (!nextIds.has(id)) {
        m.remove();
        markerRefs.current.delete(id);
      }
    });
    for (const row of amenities) {
      if (
        !Number.isFinite(row.lat) ||
        !Number.isFinite(row.lon) ||
        markerRefs.current.has(row.id)
      ) {
        continue;
      }
      const el = buildAmenityChip(row, (event) => {
        event.stopPropagation();
        popupRef.current?.remove();
        popupRef.current = new mapboxLib.Popup({
          className: "quiver-amenity-popup",
          closeButton: true,
          closeOnClick: true,
          offset: 12,
        })
          .setLngLat([row.lon, row.lat])
          .setDOMContent(buildAmenityPopupContent(row))
          .addTo(activeMap);
      });
      const marker = new mapboxLib.Marker({ element: el, anchor: "center" })
        .setLngLat([row.lon, row.lat])
        .addTo(activeMap);
      markerRefs.current.set(row.id, marker);
    }
  }, [map, enabled, amenities]);

  useEffect(() => {
    const markers = markerRefs.current;
    const popup = popupRef;
    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
      popup.current?.remove();
    };
  }, []);

  return null;
}

function buildAmenityChip(
  row: AmenityRow,
  onClick: (event: MouseEvent) => void,
): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-testid", "amenity-chip");
  el.setAttribute("data-amenity-type", row.type);
  el.setAttribute("data-amenity-id", row.id);
  el.style.cssText = `
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #F5EEDC;
    color: #11100D;
    border: 1px solid #11100D;
    border-radius: 6px 4px 6px 4px;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-weight: 700;
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(17, 16, 13, 0.25);
    pointer-events: auto;
  `;
  el.textContent = chipLabel(row.type);
  el.addEventListener("click", onClick as EventListener);
  return el;
}

export function buildAmenityPopupContent(row: AmenityRow): HTMLElement {
  const wrap = document.createElement("div");
  wrap.setAttribute("data-testid", "amenity-popup");
  wrap.style.cssText = `
    width: min(252px, calc(100vw - 56px));
    color: #11100D;
    padding: 12px 14px 14px;
    background:
      radial-gradient(circle at 18% 20%, rgba(247, 142, 66, 0.16), transparent 42%),
      #F5EEDC;
    font-family: 'DM Sans', system-ui, sans-serif;
  `;
  const eyebrow = document.createElement("div");
  eyebrow.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    padding: 3px 7px;
    background: #11100D;
    color: #F5EEDC;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  `;
  eyebrow.textContent = "Map note";
  const title = document.createElement("div");
  title.style.cssText = `
    font-size: 15px;
    font-weight: 900;
    line-height: 1.15;
    margin-bottom: 8px;
  `;
  title.textContent = row.label || row.type.replace(/_/g, " ");
  const meta = document.createElement("div");
  meta.style.cssText = `
    display: inline-flex;
    border: 1px solid rgba(17, 16, 13, 0.28);
    background: rgba(11, 58, 117, 0.08);
    padding: 4px 7px;
    font-size: 11px;
    font-weight: 800;
    line-height: 1.2;
    text-transform: capitalize;
  `;
  meta.textContent = amenityTypeLabel(row.type);
  wrap.append(eyebrow, title, meta);
  return wrap;
}
