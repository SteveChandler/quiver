import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { MapImage } from "@/components/map-image";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import type { Beach } from "@/types/database";

interface MapDisplayProps {
  isLoading: boolean;
  locationError: string | null;
  usingDefaultLocation: boolean;
  selectedBeach: Beach | null;
  userLocation: { lat: number; lng: number } | null;
  filteredBeaches: Beach[];
  searchQuery: string;
  onRetryLocation: () => void;
}

const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;
const MAX_DISTANCE_MILES = 30;

export function MapDisplay({
  isLoading,
  locationError,
  usingDefaultLocation,
  selectedBeach,
  userLocation,
  filteredBeaches,
  searchQuery,
  onRetryLocation,
}: MapDisplayProps) {
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (locationError && !usingDefaultLocation) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-destructive">
            {locationError}
          </p>
          <Button onClick={onRetryLocation} size="sm" className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Static map image */}
      <div className="flex-1 relative overflow-hidden">
        <MapImage
          src={getStaticMapImageUrl(
            selectedBeach?.latitude || userLocation?.lat || OCEAN_BEACH_LAT,
            selectedBeach?.longitude || userLocation?.lng || OCEAN_BEACH_LNG,
            { width: 800, height: 600, zoom: 12 }
          )}
          alt="Beach locations map"
          latitude={
            selectedBeach?.latitude || userLocation?.lat || OCEAN_BEACH_LAT
          }
          longitude={
            selectedBeach?.longitude || userLocation?.lng || OCEAN_BEACH_LNG
          }
          fill
          className="object-cover"
        />

        {/* Map overlay with beach count */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md">
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
              {searchQuery
                ? "Tap a beach card below to see it on the map"
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
              onClick={onRetryLocation}
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
    </div>
  );
}
