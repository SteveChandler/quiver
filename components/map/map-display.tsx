import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { MapImage } from "@/components/map-image";
import { getStaticMapImageUrlWithWaveHeight } from "@/lib/map-utils";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Beach } from "@/types/database";

interface MapDisplayProps {
  isLoading: boolean;
  locationError: string | null;
  usingDefaultLocation: boolean;
  selectedBeach: Beach | null;
  userLocation: { lat: number; lon: number } | null;
  filteredBeaches: Beach[];
  searchQuery: string;
  onRetryLocation: () => void;
}

interface BuoyConditions {
  measurements?: {
    wave_height?: number;
    water_temperature?: number;
    air_temperature?: number;
    wind_speed?: number;
    wind_direction?: number;
  };
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
  const [waveHeight, setWaveHeight] = useState<number | undefined>(undefined);

  // Calculate map coordinates - prioritize search results when searching
  const mapCoordinates = useMemo(
    () => ({
      lat:
        selectedBeach?.lat ||
        (searchQuery && filteredBeaches.length > 0
          ? filteredBeaches[0].lat
          : null) ||
        userLocation?.lat ||
        OCEAN_BEACH_LAT,
      lon:
        selectedBeach?.lon ||
        (searchQuery && filteredBeaches.length > 0
          ? filteredBeaches[0].lon
          : null) ||
        userLocation?.lon ||
        OCEAN_BEACH_LNG,
    }),
    [
      selectedBeach?.lat,
      selectedBeach?.lon,
      searchQuery,
      filteredBeaches,
      userLocation?.lat,
      userLocation?.lon,
    ]
  );

  // Fetch wave height data for the current location
  const fetchWaveHeight = useCallback(async () => {
    const { lat, lon } = mapCoordinates;

    try {
      const response = await fetch(
        `/api/buoys/conditions?latitude=${lat}&longitude=${lon}`
      );

      if (response.ok) {
        const data: BuoyConditions = await response.json();
        return data.measurements?.wave_height;
      }
    } catch (error) {
      console.warn("Failed to fetch wave height data:", error);
    }

    return undefined;
  }, [mapCoordinates]);

  const {
    data: fetchedWaveHeight,
    loading: waveHeightLoading,
    error: waveHeightError,
  } = useDataFetcher(fetchWaveHeight, { initialData: undefined });

  // Update wave height when data is fetched
  useEffect(() => {
    if (fetchedWaveHeight !== undefined) {
      setWaveHeight(fetchedWaveHeight || undefined);
    }
  }, [fetchedWaveHeight]);

  // Generate map image URL with wave height data
  const mapImageUrl = getStaticMapImageUrlWithWaveHeight(
    mapCoordinates.lat,
    mapCoordinates.lon,
    waveHeight,
    { width: 800, height: 400, zoom: 12 }
  );

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
      {/* Static map image with wave height data */}
      <div className="flex-1 relative overflow-hidden">
        <MapImage
          src={mapImageUrl}
          alt="Beach locations map with wave heights"
          latitude={mapCoordinates.lat}
          longitude={mapCoordinates.lon}
          fill
          className="object-cover"
        />

        {/* Map overlay with beach count and wave height info */}
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
          {waveHeight && (
            <p className="text-xs text-blue-600 mt-1 font-medium">
              📊 Current wave height: {waveHeight}ft
            </p>
          )}
          {waveHeightLoading && (
            <p className="text-xs text-gray-500 mt-1">
              🌊 Loading wave conditions...
            </p>
          )}
          {filteredBeaches.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery && filteredBeaches.length === 1
                ? `Showing ${filteredBeaches[0].name} on the map`
                : searchQuery && filteredBeaches.length > 1
                ? `Showing ${filteredBeaches[0].name} - tap other beach cards below to see them on the map`
                : selectedBeach
                ? `Showing ${selectedBeach.name} on the map`
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
