"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { MapSkeleton } from "@/components/skeletons/map-skeleton";
import { DataErrorBoundary } from "@/components/error-boundaries";
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
  onBoundsChange?: (bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  }) => void;
  onWaveHeightsChange?: (map: Map<string, number | undefined>) => void;
  onMapClick?: () => void;
  autoNavigateOnMarkerClick?: boolean;
  onShowBeaches?: () => void;
  visibleBeachCount?: number;
  showSwellField?: boolean;
  swellLayerId?: import("@/components/map/swell-map-theme").SwellLayerId;
  onSwellLayerChange?: (
    id: import("@/components/map/swell-map-theme").SwellLayerId,
  ) => void;
  swellTimelineSteps?: string[];
  swellTimelineIndex?: number;
  onSwellTimelineChange?: (index: number) => void;
}

const MAX_DISTANCE_MILES = 30;

const InteractiveMap = dynamic(
  () =>
    import("@/components/map/interactive-map").then((mod) => ({
      default: mod.InteractiveMap,
    })),
  { ssr: false },
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
  onBoundsChange,
  onWaveHeightsChange,
  onMapClick,
  autoNavigateOnMarkerClick,
  onShowBeaches,
  visibleBeachCount,
  showSwellField,
  swellLayerId,
  onSwellLayerChange,
  swellTimelineSteps,
  swellTimelineIndex,
  onSwellTimelineChange,
}: MapContentProps) {
  const [shouldLoadInteractiveMap, setShouldLoadInteractiveMap] =
    useState(false);

  const loadInteractiveMap = useCallback((): void => {
    setShouldLoadInteractiveMap(true);
  }, []);

  useEffect(() => {
    if (loading || shouldLoadInteractiveMap) return;

    const browserWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout?: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(loadInteractiveMap, {
        timeout: 1200,
      });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(loadInteractiveMap, 300);
    return () => globalThis.clearTimeout(timeoutId);
  }, [loading, loadInteractiveMap, shouldLoadInteractiveMap]);

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
    return { lat: 32.7702, lon: -117.2525 }; // Mission Beach default
  }, [selectedBeach, searchQuery, filteredBeaches, userLocation]);

  // Stable array reference — only changes when lat/lon values actually change
  const initialCenterArray = useMemo(
    () => [mapCenter.lat, mapCenter.lon] as [number, number],
    [mapCenter.lat, mapCenter.lon],
  );

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
        className="flex-1 relative overflow-hidden min-h-[200px] sm:min-h-[400px] bg-gray-200 map-container"
        data-testid="map-container"
        onPointerDown={loadInteractiveMap}
        onFocusCapture={loadInteractiveMap}
      >
        {shouldLoadInteractiveMap ? (
          <DataErrorBoundary dataType="map data" componentName="InteractiveMap">
            <InteractiveMap
              key={`${mapCenter.lat.toFixed(4)}-${mapCenter.lon.toFixed(4)}`}
              initialCenter={initialCenterArray}
              initialZoom={12}
              onLocationClick={onBeachSelect}
              onMapClick={onMapClick ? () => onMapClick() : undefined}
              regionViewport={regionViewport}
              beaches={filteredBeaches}
              onBoundsChange={onBoundsChange}
              onWaveHeightsChange={onWaveHeightsChange}
              autoNavigateOnMarkerClick={autoNavigateOnMarkerClick}
              showSwellField={showSwellField}
              swellLayerId={swellLayerId}
              onSwellLayerChange={onSwellLayerChange}
              swellTimelineSteps={swellTimelineSteps}
              swellTimelineIndex={swellTimelineIndex}
              onSwellTimelineChange={onSwellTimelineChange}
              className="absolute inset-0 z-0 w-full h-full"
            />
          </DataErrorBoundary>
        ) : (
          <div
            className="absolute inset-0 z-0 bg-[linear-gradient(135deg,#17213a_0%,#0f766e_45%,#1d4ed8_100%)]"
            aria-hidden="true"
          />
        )}

        {/* Map overlay with beach count */}
        <div
          data-testid="map-overlay"
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md max-w-[55vw] sm:max-w-xs z-10"
        >
          <p className="text-sm font-medium">
            {(() => {
              const displayCount = visibleBeachCount ?? filteredBeaches.length;

              if (searchQuery) {
                if (filteredBeaches.length > 0) {
                  return `Found ${displayCount} ${displayCount === 1 ? "beach" : "beaches"} for "${searchQuery}"`;
                }
                return isLikelyOutOfAreaSearch(searchQuery)
                  ? `"${searchQuery}" is outside our coverage area`
                  : `No beaches found for "${searchQuery}"`;
              }

              if (userLocation) {
                if (usingDefaultLocation) {
                  return `Showing beaches near Mission Beach`;
                }
                if (displayCount > 0) {
                  return `Found ${displayCount} ${displayCount === 1 ? "beach" : "beaches"} near you`;
                }
                return `No beaches within ${MAX_DISTANCE_MILES} miles of your location`;
              }

              return "Loading beach locations...";
            })()}
          </p>
          {(() => {
            const displayCount = visibleBeachCount ?? filteredBeaches.length;
            const hasMoreOffscreen =
              visibleBeachCount != null &&
              visibleBeachCount < filteredBeaches.length;
            if (hasMoreOffscreen) {
              return (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedBeach
                    ? `Showing ${selectedBeach.name} · Zoom out to find more`
                    : "Zoom out to find more"}
                </p>
              );
            }
            if (displayCount > 0) {
              return (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedBeach
                    ? `Showing ${selectedBeach.name}`
                    : searchQuery && displayCount === 1
                      ? `Showing ${filteredBeaches[0].name} on the map`
                      : searchQuery && displayCount > 1
                        ? `Showing ${filteredBeaches[0].name} - tap other beach cards below to see them on the map`
                        : "Tap a beach card below to see it on the map"}
                </p>
              );
            }
            return null;
          })()}
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

        {/* Recovery button to bring back bottom sheet */}
        {onShowBeaches && (
          <button
            onClick={onShowBeaches}
            aria-label="Show beach list"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-primary text-primary-foreground rounded-full px-4 py-2 shadow-lg text-sm font-medium md:hidden"
          >
            Show Beaches
          </button>
        )}
      </div>
    </>
  );
}
