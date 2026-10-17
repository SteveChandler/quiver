"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { SessionWave, SessionWavesResponse } from "@/lib/sessions/waves/waves-api-types";

interface SessionRideMapProps {
  track: SessionWavesResponse["track"];
  waves: SessionWave[];
}

export function SessionRideMap({ track, waves }: SessionRideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token || !containerRef.current || track.coordinates.length === 0) return;

    mapboxgl.accessToken = token;
    const styles = getComputedStyle(containerRef.current);
    const orange = styles.getPropertyValue("--q-orange").trim();
    const ink = styles.getPropertyValue("--ink").trim();
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: track.coordinates[0],
        zoom: 14,
      });
    } catch (error) {
      console.warn("Unable to display session ride map:", error);
      return;
    }

    map.on("load", () => {
      map.addSource("session-track", { type: "geojson", data: { type: "Feature", properties: {}, geometry: track } });
      map.addLayer({
        id: "session-track",
        type: "line",
        source: "session-track",
        paint: { "line-color": ink, "line-opacity": 0.5, "line-width": 3 },
      });

      const activeWaves = waves.filter((wave) => !wave.excluded);
      map.addSource("session-waves", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: activeWaves.map((wave) => ({
            type: "Feature" as const,
            properties: { id: wave.id },
            geometry: {
              type: "LineString" as const,
              coordinates: [[wave.start.lon, wave.start.lat], [wave.end.lon, wave.end.lat]],
            },
          })),
        },
      });
      map.addLayer({
        id: "session-waves",
        type: "line",
        source: "session-waves",
        paint: { "line-color": orange, "line-width": 5 },
      });

      const bounds = new mapboxgl.LngLatBounds();
      track.coordinates.forEach((coordinate) => bounds.extend(coordinate));
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      map.fitBounds(bounds, { padding: 28, maxZoom: 16, duration: reducedMotion ? 0 : 500 });
    });

    return () => map.remove();
  }, [track, waves]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) return null;

  return <div ref={containerRef} role="img" aria-label="Map of this surf and its rides" className="h-64 w-full overflow-hidden rounded-lg border border-ink/20" />;
}
