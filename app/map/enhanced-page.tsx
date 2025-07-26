"use client";

import { useState, Suspense, lazy } from "react";
import { BottomNavigation } from "@/components/bottom-navigation";
import type { Beach } from "@/types/database";

// Lazy load heavy map components
const InteractiveMap = lazy(() =>
  import("@/components/map/interactive-map").then((m) => ({
    default: m.InteractiveMap,
  }))
);
const BuoyConditions = lazy(() =>
  import("@/components/buoy-conditions").then((m) => ({
    default: m.BuoyConditions,
  }))
);

interface BuoyConditions {
  water_temperature?: number;
  air_temperature?: number;
  wind_speed?: number;
  wind_direction?: number;
  wind_direction_name?: string;
  wind_gust?: number;
  wave_height?: number;
  wave_period?: number;
  tides?: Array<{
    time: number;
    height: number;
    name: string;
  }>;
}

// Loading components
function MapLoadingSkeleton() {
  return (
    <div className="h-full w-full bg-gradient-to-br from-blue-50 to-blue-100 animate-pulse flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-3 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        <p className="text-blue-700 font-medium">Loading Enhanced Map...</p>
      </div>
    </div>
  );
}

function BuoyLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
        ))}
      </div>
    </div>
  );
}

export default function EnhancedMapPage() {
  const [currentConditions, setCurrentConditions] =
    useState<BuoyConditions | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  const handleLocationClick = (beach: Beach) => {
    setSelectedLocation(`${beach.name} - ${beach.location || "San Diego"}`);
  };

  const handleMapClick = (latlng: any) => {
    setSelectedLocation(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex">
        {/* Interactive Map - Takes most of the space */}
        <div className="flex-1 relative">
          <Suspense fallback={<MapLoadingSkeleton />}>
            <InteractiveMap
              onBuoyConditions={setCurrentConditions}
              onLocationClick={handleLocationClick}
              onMapClick={handleMapClick}
              className="h-full w-full"
            />
          </Suspense>

          {/* Location indicator overlay */}
          {selectedLocation && (
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md max-w-xs">
              <p className="text-sm font-medium text-gray-900">
                📍 {selectedLocation}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Click anywhere to see buoy conditions
              </p>
            </div>
          )}
        </div>

        {/* Buoy Conditions Panel - Collapsible sidebar */}
        <div
          className={`transition-all duration-300 ${
            currentConditions ? "w-96" : "w-0"
          } bg-gray-50 border-l overflow-hidden`}
        >
          <div className="p-4 h-full overflow-y-auto">
            {currentConditions ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Marine Conditions</h2>
                  <button
                    onClick={() => setCurrentConditions(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <Suspense fallback={<BuoyLoadingSkeleton />}>
                  <BuoyConditions conditions={currentConditions} />
                </Suspense>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-sm">Click on the map to view</p>
                  <p className="text-sm">buoy conditions</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
