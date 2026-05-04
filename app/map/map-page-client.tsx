"use client";

import dynamic from "next/dynamic";

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
  return <MapView />;
}
