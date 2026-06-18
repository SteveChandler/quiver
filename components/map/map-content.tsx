"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { MapSkeleton } from "@/components/skeletons/map-skeleton";
import { DataErrorBoundary } from "@/components/error-boundaries";
import type { Beach } from "@/types/database";
import { LocationTimeoutBanner } from "@/components/map/location-timeout-banner";

interface MapContentProps {
  loading: boolean;
  locationError: string | null;
  usingDefaultLocation: boolean;
  hasTimedOut: boolean;
  userLocation: { lat: number; lon: number } | null;
  focusCenter?: { lat: number; lon: number } | null;
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
  showSwellField?: boolean;
  swellLayerId?: import("@/components/map/swell-map-theme").SwellLayerId;
  onSwellLayerChange?: (
    id: import("@/components/map/swell-map-theme").SwellLayerId,
  ) => void;
  swellTimelineSteps?: string[];
  swellTimelineIndex?: number;
  onSwellTimelineChange?: (index: number) => void;
}

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
  focusCenter,
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
      focusCenter &&
      hasValidCoordinates(focusCenter.lat, focusCenter.lon)
    ) {
      return focusCenter;
    }
    if (
      userLocation &&
      hasValidCoordinates(userLocation.lat, userLocation.lon)
    ) {
      return userLocation;
    }
    return { lat: 32.7702, lon: -117.2525 }; // Mission Beach default
  }, [selectedBeach, searchQuery, filteredBeaches, focusCenter, userLocation]);

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
      </div>
    </>
  );
}
