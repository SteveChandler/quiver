import { Suspense, lazy } from "react";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BottomNavigation } from "@/components/bottom-navigation";

// Lazy load heavy map component
const MapView = lazy(() =>
  import("@/components/map-view").then((m) => ({ default: m.MapView }))
);

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
      {/* Map header placeholder */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-sm border-b animate-pulse">
        <div className="h-full px-4 flex items-center space-x-4">
          <div className="h-8 w-32 bg-gray-200 rounded"></div>
          <div className="h-8 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={<MapSkeleton />}>
        <MapView />
      </Suspense>
      <BottomNavigation />
    </div>
  );
}

export const metadata: Metadata = buildPageMetadata({
  title: "Surf Spots Map | Quiver",
  description:
    "Explore surf spots with reviews and live conditions. Find your next epic wave with Quiver's map.",
  path: "/map",
});
