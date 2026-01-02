"use client";

import { useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";

const InteractiveMap = dynamic(
  () =>
    import("@/components/map/interactive-map").then((mod) => ({
      default: mod.InteractiveMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600 mx-auto" />
          <p className="text-sm text-slate-500">Loading map...</p>
        </div>
      </div>
    ),
  }
);

function computeCenterZoom(beaches: Beach[]): {
  center: [number, number];
  zoom: number;
} {
  if (!beaches.length) return { center: [32.7157, -117.1611], zoom: 4 };

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const b of beaches) {
    if (typeof b.lat !== "number" || typeof b.lon !== "number") continue;
    minLat = Math.min(minLat, b.lat);
    maxLat = Math.max(maxLat, b.lat);
    minLon = Math.min(minLon, b.lon);
    maxLon = Math.max(maxLon, b.lon);
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;
  const maxDiff = Math.max(latDiff, lonDiff);

  // Rough heuristics: state view should be more zoomed-out than a city view.
  let zoom = 6;
  if (maxDiff > 12) zoom = 4;
  else if (maxDiff > 6) zoom = 5;
  else if (maxDiff > 3) zoom = 6;
  else if (maxDiff > 1.5) zoom = 7;
  else zoom = 8;

  return { center: [centerLat, centerLon], zoom };
}

export function StateMapView({
  beaches,
  ariaLabel,
  className = "h-[520px] w-full rounded-xl overflow-hidden border border-slate-200",
}: {
  beaches: Beach[];
  ariaLabel: string;
  className?: string;
}) {
  const { center, zoom } = useMemo(() => computeCenterZoom(beaches), [beaches]);

  if (!beaches.length) {
    return (
      <div className={className} role="region" aria-label={ariaLabel}>
        <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
          No beaches to display on the map.
        </div>
      </div>
    );
  }

  return (
    <div className={className} role="region" aria-label={ariaLabel}>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-slate-100">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600 mx-auto" />
              <p className="text-sm text-slate-500">Loading map...</p>
            </div>
          </div>
        }
      >
        <InteractiveMap
          initialCenter={center}
          initialZoom={zoom}
          beaches={beaches}
          className="h-full w-full"
        />
      </Suspense>
    </div>
  );
}


