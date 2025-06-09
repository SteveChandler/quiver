"use client";

import { useState } from "react";
import { InteractiveMap } from "@/components/map/interactive-map";
import { BuoyConditions } from "@/components/buoy-conditions";
import { BottomNavigation } from "@/components/bottom-navigation";
import type { Beach } from "@/types/database";

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
          <InteractiveMap
            onBuoyConditions={setCurrentConditions}
            onLocationClick={handleLocationClick}
            onMapClick={handleMapClick}
            className="h-full w-full"
          />

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
                <BuoyConditions conditions={currentConditions} />
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
