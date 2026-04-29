"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapEntryOverlay } from "@/components/map/map-entry-overlay";

// Loading skeleton for map
function MapSkeleton() {
  return (
    <div
      className="flex-1 relative bg-gray-100 animate-pulse"
      data-testid="map-container"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 font-medium">
            Loading Interactive Map...
          </p>
          <p className="text-sm text-gray-500">Finding nearby surf spots</p>
        </div>
      </div>
    </div>
  );
}

// Dynamic import with SSR disabled - map requires client-side geolocation and Mapbox GL
// This skips server-side rendering entirely, improving TTFB significantly
const MapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  }
);

export function MapPageClient() {
  const searchParams = useSearchParams();
  // If the URL already carries `?search=...`, the user has expressed search
  // intent (typically via the global header search) — skip the overlay so they
  // land directly on the map view.
  const hasSearchIntent = Boolean(searchParams.get("search"));
  const [overlayOpen, setOverlayOpen] = useState(!hasSearchIntent);

  // Mirror URL → state for the rare case where the param appears post-mount
  // (client-side nav into /map?search=...).
  useEffect(() => {
    if (hasSearchIntent) setOverlayOpen(false);
  }, [hasSearchIntent]);

  const handleDismiss = useCallback(() => {
    setOverlayOpen(false);
  }, []);

  return (
    <>
      <MapView />
      {overlayOpen && <MapEntryOverlay onDismiss={handleDismiss} />}
    </>
  );
}
