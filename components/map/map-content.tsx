"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { MapImage } from "@/components/map-image";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import { MapSkeleton } from "@/components/skeletons/map-skeleton";
import type { Beach } from "@/types/database";

interface MapContentProps {
  loading: boolean;
  locationError: string | null;
  usingDefaultLocation: boolean;
  userLocation: { lat: number; lng: number } | null;
  selectedBeach: Beach | null;
  filteredBeaches: Beach[];
  searchQuery: string;
  onGetUserLocation: () => void;
  onUseDefaultLocation: () => void;
}

const MAX_DISTANCE_MILES = 30;

export function MapContent({
  loading,
  locationError,
  usingDefaultLocation,
  userLocation,
  selectedBeach,
  filteredBeaches,
  searchQuery,
  onGetUserLocation,
  onUseDefaultLocation,
}: MapContentProps) {
  // Memoize the map display coordinates
  const mapCenter = useMemo(() => {
    if (selectedBeach) {
      return { lat: selectedBeach.latitude, lng: selectedBeach.longitude };
    }
    if (userLocation) {
      return userLocation;
    }
    return { lat: 32.7503, lng: -117.2534 }; // Ocean Beach default
  }, [selectedBeach, userLocation]);

  if (loading) {
    return <MapSkeleton />;
  }

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
                <p>2. Set Location to "Allow"</p>
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
      {/* Static map image */}
      <div className="flex-1 relative overflow-hidden min-h-[400px]">
        <MapImage
          src={getStaticMapImageUrl(mapCenter.lat, mapCenter.lng, {
            width: 800,
            height: 600,
            zoom: 12,
          })}
          alt="Beach locations map"
          latitude={mapCenter.lat}
          longitude={mapCenter.lng}
          fill
          className="object-cover"
        />

        {/* Map overlay with beach count */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md max-w-xs">
          <p className="text-sm font-medium">
            {searchQuery
              ? filteredBeaches.length > 0
                ? `Found ${filteredBeaches.length} ${
                    filteredBeaches.length === 1 ? "beach" : "beaches"
                  } for "${searchQuery}"`
                : `No beaches found for "${searchQuery}"`
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
                : "Tap a beach card below to see it on the map"}
            </p>
          )}
          {filteredBeaches.length === 0 && searchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              Try a different search term or clear your search
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
          <div className="absolute top-4 right-4">
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
