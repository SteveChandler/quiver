"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { MapSkeleton } from "@/components/skeletons/map-skeleton";
import { DataErrorBoundary } from "@/components/error-boundaries";
import type { Beach } from "@/types/database";
import { LocationTimeoutBanner } from "@/components/map/location-timeout-banner";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";
import type { CustomSpot } from "@/hooks/use-custom-spots";
import type {
  MapCameraCommand,
  MapCameraOwner,
} from "@/components/map/map-camera-command";

const DEFAULT_MAP_CENTER = { lat: 32.7702, lon: -117.2525 } as const;

function hasValidCoordinates(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  );
}

interface MapContentProps {
  loading: boolean;
  locationError: string | null;
  usingDefaultLocation: boolean;
  hasTimedOut: boolean;
  userLocation: { lat: number; lon: number } | null;
  focusCenter?: { lat: number; lon: number } | null;
  selectedBeach: Beach | null;
  filteredBeaches: Beach[];
  customSpots?: CustomSpot[];
  searchQuery: string;
  regionViewport: {
    region: string;
    key: string;
    center: [number, number];
    bounds?: [[number, number], [number, number]];
    zoom?: number;
  } | null;
  cameraOwner?: MapCameraOwner;
  cameraCommand?: MapCameraCommand | null;
  onGetUserLocation: () => void;
  onUseDefaultLocation: () => void;
  onSearchPromptClick?: () => void;
  locationDeniedPromptDismissed?: boolean;
  onBeachSelect: (beach: Beach) => void;
  onBoundsChange?: (bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  }) => void;
  onWaveHeightsChange?: (map: Map<string, number | undefined>) => void;
  onDisplayForecastsChange?: (map: Map<string, ForecastDisplay | undefined>) => void;
  onMapClick?: () => void;
  onUserCameraInteraction?: (interaction: {
    action: "pan" | "zoom" | "rotate";
    center: { lat: number; lon: number };
    phase: "start" | "end";
  }) => void;
  autoNavigateOnMarkerClick?: boolean;
  showSwellField?: boolean;
  swellLayerId?: import("@/components/map/swell-map-theme").SwellLayerId;
  onSwellLayerChange?: (
    id: import("@/components/map/swell-map-theme").SwellLayerId,
  ) => void;
  swellTimelineSteps?: string[];
  swellTimelineIndex?: number;
  onSwellTimelineChange?: (index: number) => void;
  swellTimelineMode?: "legacy" | "hourly" | "expandable-hourly";
  viewTimezone?: string;
  timelineFocusBeachId?: string | null;
}

const InteractiveMap = dynamic(
  () =>
    import("@/components/map/interactive-map").then((mod) => ({
      default: mod.InteractiveMap,
    })),
  { ssr: false, loading: () => <MapSkeleton /> },
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
  customSpots,
  searchQuery,
  regionViewport,
  cameraCommand,
  onGetUserLocation,
  onUseDefaultLocation,
  onSearchPromptClick,
  locationDeniedPromptDismissed = false,
  onBeachSelect,
  onBoundsChange,
  onWaveHeightsChange,
  onDisplayForecastsChange,
  onMapClick,
  onUserCameraInteraction,
  autoNavigateOnMarkerClick,
  showSwellField,
  swellLayerId,
  onSwellLayerChange,
  swellTimelineSteps,
  swellTimelineIndex,
  onSwellTimelineChange,
  swellTimelineMode = "legacy",
  viewTimezone,
  timelineFocusBeachId,
}: MapContentProps) {
  const mapCenterState = useMemo(() => {
    if (
      cameraCommand?.center &&
      hasValidCoordinates(cameraCommand.center.lat, cameraCommand.center.lon)
    ) {
      return {
        center: cameraCommand.center,
        instanceKey: "camera-command",
      };
    }
    if (
      selectedBeach &&
      hasValidCoordinates(selectedBeach.lat, selectedBeach.lon)
    ) {
      return {
        center: {
          lat: selectedBeach.lat as number,
          lon: selectedBeach.lon as number,
        },
        instanceKey: "nearby",
      };
    }
    // If searching and have results, center on first result
    if (searchQuery && filteredBeaches.length > 0) {
      const firstBeach = filteredBeaches[0];
      if (hasValidCoordinates(firstBeach.lat, firstBeach.lon)) {
        return {
          center: {
            lat: firstBeach.lat as number,
            lon: firstBeach.lon as number,
          },
          instanceKey: `search-${firstBeach.id ?? searchQuery}`,
        };
      }
    }
    if (
      focusCenter &&
      hasValidCoordinates(focusCenter.lat, focusCenter.lon)
    ) {
      return {
        center: focusCenter,
        instanceKey: `focus-${focusCenter.lat.toFixed(4)}-${focusCenter.lon.toFixed(4)}`,
      };
    }
    if (
      userLocation &&
      hasValidCoordinates(userLocation.lat, userLocation.lon)
    ) {
      return {
        center: userLocation,
        instanceKey: "nearby",
      };
    }
    return {
      center: DEFAULT_MAP_CENTER,
      instanceKey: "nearby",
    };
  }, [
    cameraCommand,
    selectedBeach,
    searchQuery,
    filteredBeaches,
    focusCenter,
    userLocation,
  ]);
  const mapCenter = mapCenterState.center;
  const showLocationDeniedPrompt =
    !locationDeniedPromptDismissed &&
    !searchQuery.trim() &&
    !selectedBeach &&
    usingDefaultLocation &&
    !hasTimedOut &&
    typeof locationError === "string" &&
    locationError.toLowerCase().includes("denied");

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
      >
        {showLocationDeniedPrompt && (
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-20 w-[min(42rem,calc(100%-1.5rem))] -translate-x-1/2"
            data-testid="map-location-denied-prompt"
            role="status"
          >
            <div className="pointer-events-auto flex flex-col gap-3 rounded-lg border border-black/15 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Location is off. Search your break.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onSearchPromptClick}
                className="min-h-11 w-full justify-center sm:w-auto"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Search spots
              </Button>
            </div>
          </div>
        )}
        <DataErrorBoundary dataType="map data" componentName="InteractiveMap">
          <InteractiveMap
            initialCenter={initialCenterArray}
            initialZoom={12}
            onLocationClick={onBeachSelect}
            onMapClick={onMapClick ? () => onMapClick() : undefined}
            cameraCommand={cameraCommand}
            onUserCameraInteraction={onUserCameraInteraction}
            regionViewport={regionViewport}
            beaches={filteredBeaches}
            customSpots={customSpots}
            onBoundsChange={onBoundsChange}
            onWaveHeightsChange={onWaveHeightsChange}
            onDisplayForecastsChange={onDisplayForecastsChange}
            autoNavigateOnMarkerClick={autoNavigateOnMarkerClick}
            markerDisplay="points"
            disableBeachClustering
            showConditionsOnTap
            showSwellField={showSwellField}
            swellLayerId={swellLayerId}
            onSwellLayerChange={onSwellLayerChange}
            swellTimelineSteps={swellTimelineSteps}
            swellTimelineIndex={swellTimelineIndex}
            onSwellTimelineChange={onSwellTimelineChange}
            swellTimelineMode={swellTimelineMode}
            viewTimezone={viewTimezone}
            timelineFocusBeachId={timelineFocusBeachId}
            className="absolute inset-0 z-0 w-full h-full"
          />
        </DataErrorBoundary>
      </div>
    </>
  );
}
