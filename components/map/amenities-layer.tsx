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
 * Provenance chip on click reads `source · confidence · imported_at`. The
 * `source` label stays neutral (`SEED · verified …` vs `OSM · verified …`) so
 * the UI stays honest before the OSM importer lands.
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

function formatProvenance(row: AmenityRow): string {
  const src = (row.source || "unknown").toUpperCase();
  const conf = Math.max(0, Math.min(100, Math.round(row.confidence ?? 0)));
  const imported = row.imported_at
    ? new Date(row.imported_at).toISOString().slice(0, 10)
    : "unknown";
  return `${src} · ${conf}% confidence · imported ${imported}`;
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
    if (w.__quiverMap) setMap(w.__quiverMap);
    const onReady = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        map: mapboxgl.Map | null;
      };
      setMap(detail?.map ?? null);
    };
    const onBounds = (event: Event) => {
      const detail = (event as CustomEvent).detail as MapBounds | undefined;
      if (detail) setBounds(detail);
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
    if (!map || !mapboxRef.current) {
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
          closeButton: true,
          closeOnClick: true,
          offset: 12,
        })
          .setLngLat([row.lon, row.lat])
          .setDOMContent(buildProvenancePopupContent(row))
          .addTo(map);
      });
      const marker = new mapboxLib.Marker({ element: el, anchor: "center" })
        .setLngLat([row.lon, row.lat])
        .addTo(map);
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

function buildProvenancePopupContent(row: AmenityRow): HTMLElement {
  const wrap = document.createElement("div");
  wrap.setAttribute("data-testid", "amenity-provenance");
  wrap.style.cssText =
    "font-family: 'DM Sans', system-ui, sans-serif; color: #11100D; padding: 4px 6px; max-width: 220px;";
  const title = document.createElement("div");
  title.style.cssText = "font-weight: 700; font-size: 12px; margin-bottom: 2px;";
  title.textContent = row.label || row.type.replace(/_/g, " ");
  const meta = document.createElement("div");
  meta.style.cssText = "font-size: 11px; color: #4A4A4A;";
  meta.textContent = formatProvenance(row);
  wrap.append(title, meta);
  return wrap;
}
