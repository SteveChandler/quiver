"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { MapSkeleton } from "@/components/skeletons/map-skeleton";
import {
  COVERAGE_MESSAGES,
  isLikelyOutOfAreaSearch,
} from "@/lib/constants/coverage-areas";
import type { Beach } from "@/types/database";
import { LocationTimeoutBanner } from "@/components/map/location-timeout-banner";

interface MapContentProps {
  loading: boolean;
  locationError: string | null;
  usingDefaultLocation: boolean;
  hasTimedOut: boolean;
  userLocation: { lat: number; lon: number } | null;
  selectedBeach: Beach | null;
  filteredBeaches: Beach[];
  searchQuery: string;
  regionViewport: {
    region: string;
    key: string;
    center: [number, number];
    bounds?: [[number, number], [number, number]];
    zoom?: number;
  } | null;
  onGetUserLocation: () => void;
  onUseDefaultLocation: () => void;
  onBeachSelect: (beach: Beach) => void;
}

const MAX_DISTANCE_MILES = 30;

const InteractiveMap = dynamic(
  () =>
    import("@/components/map/interactive-map").then((mod) => ({
      default: mod.InteractiveMap,
    })),
  { ssr: false }
);

export function MapContent({
  loading,
  locationError,
  usingDefaultLocation,
  hasTimedOut,
  userLocation,
  selectedBeach,
  filteredBeaches,
  searchQuery,
  regionViewport,
  onGetUserLocation,
  onUseDefaultLocation,
  onBeachSelect,
}: MapContentProps) {
  // Memoize the map display coordinates
  const mapCenter = useMemo(() => {
    // Helper to check if coordinates are valid
    const hasValidCoordinates = (lat: any, lon: any) =>
      typeof lat === "number" &&
      typeof lon === "number" &&
      !isNaN(lat) &&
      !isNaN(lon);

    if (
      selectedBeach &&
      hasValidCoordinates(selectedBeach.lat, selectedBeach.lon)
    ) {
      return {
        lat: selectedBeach.lat as number,
        lon: selectedBeach.lon as number,
      };
    }
    // If searching and have results, center on first result
    if (searchQuery && filteredBeaches.length > 0) {
      const firstBeach = filteredBeaches[0];
      if (hasValidCoordinates(firstBeach.lat, firstBeach.lon)) {
        return {
          lat: firstBeach.lat as number,
          lon: firstBeach.lon as number,
        };
      }
    }
    if (
      userLocation &&
      hasValidCoordinates(userLocation.lat, userLocation.lon)
    ) {
      return userLocation;
    }
    return { lat: 32.7503, lon: -117.2534 }; // Ocean Beach default
  }, [selectedBeach, searchQuery, filteredBeaches, userLocation]);

  // Temporarily bypass loading state to debug rendering issues
  // if (loading) {
  //   return <MapSkeleton />;
  // }

  if (locationError && !usingDefaultLocation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-4 max-w-md">
          <p className="text-lg font-medium text-destructive mb-2">
            {locationError}
          </p>
          {locationError.includes("blocked") && (
            <div className="text-sm text-muted-foreground mb-4 space-y-2">
              <p>To enable location:</p>
              <div className="text-left bg-muted p-3 rounded-lg">
                <p>1. Click the 🔒 lock icon next to the URL</p>
                <p>2. Set Location to &quot;Allow&quot;</p>
                <p>3. Refresh the page</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Button onClick={onGetUserLocation} size="sm">
              Try Again
            </Button>
            <Button
              onClick={onUseDefaultLocation}
              variant="outline"
              size="sm"
              className="ml-2"
            >
              Use San Diego Location
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Location Timeout Banner */}
      {hasTimedOut && usingDefaultLocation && (
        <div className="px-4 py-3">
          <LocationTimeoutBanner onGrantLocation={onGetUserLocation} />
        </div>
      )}

      {/* Interactive Map */}
      <div
        className="flex-1 relative overflow-hidden min-h-[400px] bg-gray-200 map-container"
        style={{ height: "400px" }}
        data-testid="map-container"
      >
        <InteractiveMap
          key={`${mapCenter.lat.toFixed(4)}-${mapCenter.lon.toFixed(4)}`}
          initialCenter={[mapCenter.lat, mapCenter.lon]}
          initialZoom={12}
          onLocationClick={onBeachSelect}
          regionViewport={regionViewport}
          beaches={filteredBeaches}
          className="absolute inset-0 z-0 w-full h-full"
        />

        {/* Map overlay with beach count */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md max-w-xs z-10">
          <p className="text-sm font-medium">
            {searchQuery
              ? filteredBeaches.length > 0
                ? `Found ${filteredBeaches.length} ${
                    filteredBeaches.length === 1 ? "beach" : "beaches"
                  } for \"${searchQuery}\"`
                : isLikelyOutOfAreaSearch(searchQuery)
                ? `\"${searchQuery}\" is outside our coverage area`
                : `No beaches found for \"${searchQuery}\"`
              : userLocation
              ? usingDefaultLocation
                ? `Showing beaches near Ocean Beach, San Diego`
                : filteredBeaches.length > 0
                ? `Found ${filteredBeaches.length} beaches near your location`
                : `No beaches within ${MAX_DISTANCE_MILES} miles of your location`
              : "Loading beach locations..."}
          </p>
          {filteredBeaches.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {selectedBeach
                ? `Showing ${selectedBeach.name}`
                : searchQuery && filteredBeaches.length === 1
                ? `Showing ${filteredBeaches[0].name} on the map`
                : searchQuery && filteredBeaches.length > 1
                ? `Showing ${filteredBeaches[0].name} - tap other beach cards below to see them on the map`
                : "Tap a beach card below to see it on the map"}
            </p>
          )}
          {filteredBeaches.length === 0 && searchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              {isLikelyOutOfAreaSearch(searchQuery)
                ? COVERAGE_MESSAGES.COVERAGE_AREA_INFO
                : "Try a different search term or clear your search"}
            </p>
          )}
          {filteredBeaches.length === 0 &&
            userLocation &&
            !usingDefaultLocation &&
            !searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for a specific beach or expand your search area
              </p>
            )}
        </div>

        {/* Location controls */}
        {(usingDefaultLocation || !userLocation) && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              onClick={onGetUserLocation}
              size="sm"
              variant="secondary"
              className="shadow-md"
            >
              <MapPin className="h-4 w-4 mr-1" />
              {!userLocation ? "Use My Location" : "Use My Actual Location"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
