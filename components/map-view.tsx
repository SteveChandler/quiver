"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { MapToolbar } from "@/components/map/map-toolbar";
import {
  MAP_REGION_PILLS,
  type MapRegionPill,
} from "@/components/map/map-regions";
import { MapContent } from "@/components/map/map-content";
import { MapBottomSheet } from "@/components/map/map-bottom-sheet";
import { calculateDistanceFormatted } from "@/lib/utils/distance-utils";
import { filterBeachesByViewport, type ViewportBounds } from "@/lib/utils/viewport-filter";
import { useIsMobile } from "@/hooks/use-mobile";
import { type SwellLayerId } from "@/components/map/swell-map-theme";
import type { Beach } from "@/types/database";

const MISSION_BEACH_COORDS = { lat: 32.7702, lon: -117.2525 } as const;

export function MapView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [showRecovery, setShowRecovery] = useState(false);
  const [mapFocusCenter, setMapFocusCenter] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  // Use ref to track if we've already loaded beaches for a location to prevent multiple calls
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const preserveSearchStateOnNextUrlClearRef = useRef(false);

  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [waveHeightMap, setWaveHeightMap] = useState<Map<string, number | undefined>>(new Map());
  const [showSwellField, setShowSwellField] = useState(true);
  const [swellLayerId, setSwellLayerId] = useState<SwellLayerId>("s1");
  const [swellTimelineIndex, setSwellTimelineIndex] = useState(0);
  const swellTimelineSteps = useMemo(
    () => ["Now", "+3h", "+6h", "+9h", "+12h"],
    []
  );

  // Custom hooks for state management
  const {
    userLocation,
    locationError,
    usingDefaultLocation,
    hasTimedOut,
    loading: locationLoading,
    getUserLocation,
    useDefaultLocation: applyDefaultLocation,
  } = useGeolocation({
    useLastBeach: false,
    defaultLocation: MISSION_BEACH_COORDS,
  });

  const {
    filteredBeaches,
    loading: beachLoading,
    searchQuery,
    selectedBeach,
    filters,
    loadNearbyBeaches,
    setSearchQuery,
    clearSearch,
    setSelectedBeach,
    toggleBeginnerFriendly,
    toggleBreakType,
    clearAllFilters,
  } = useBeachSearch();

  // Load nearby beaches when user location is available - prevent duplicate calls
  // Wait for geolocation to resolve before fetching to avoid using stale fallback coords
  useEffect(() => {
    if (!userLocation || locationLoading) {
      return;
    }

    // Check if we've already loaded beaches for this location
    const lastLocation = lastLocationRef.current;
    if (
      lastLocation &&
      Math.abs(lastLocation.lat - userLocation.lat) < 0.001 &&
      Math.abs(lastLocation.lon - userLocation.lon) < 0.001
    ) {
      return; // Same location, don't reload
    }

    // Update the last location and load nearby beaches
    lastLocationRef.current = userLocation;
    loadNearbyBeaches(userLocation.lat, userLocation.lon);
  }, [userLocation, locationLoading, loadNearbyBeaches]);

  // Hydrate deep-linked search state from the URL. Local toolbar edits may strip the
  // stale URL param without clearing the active input state.
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl === null) {
      if (preserveSearchStateOnNextUrlClearRef.current) {
        preserveSearchStateOnNextUrlClearRef.current = false;
        return;
      }
      setSearchQuery("");
      return;
    }

    preserveSearchStateOnNextUrlClearRef.current = false;
    setSearchQuery(searchFromUrl);
    if (searchFromUrl) {
      setMapFocusCenter(null);
    }
  }, [searchParams, setSearchQuery]);

  // Apply filters from URL params on initial mount (e.g. /map?type=reef or /map?level=beginner)
  const VALID_BREAK_TYPES = new Set(["beach", "point", "reef", "longboard", "bodyboard"]);
  const urlFiltersAppliedRef = useRef(false);
  useEffect(() => {
    if (urlFiltersAppliedRef.current) return;
    urlFiltersAppliedRef.current = true;

    const typeParam = searchParams.get("type")?.toLowerCase();
    const levelParam = searchParams.get("level");

    if (typeParam && VALID_BREAK_TYPES.has(typeParam)) {
      toggleBreakType(typeParam);
    }
    if (levelParam === "beginner") {
      toggleBeginnerFriendly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      setMapFocusCenter(null);
      setSelectedBeach(beach);
      // Smooth scroll to top to show the selected beach on map
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setSelectedBeach]
  );

  const stripMapUrlParams = useCallback(
    (
      keys: readonly string[],
      options?: { preserveSearchState?: boolean }
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      let mutated = false;
      for (const key of keys) {
        if (params.has(key)) {
          params.delete(key);
          mutated = true;
        }
      }
      if (mutated) {
        if (options?.preserveSearchState && keys.includes("search")) {
          preserveSearchStateOnNextUrlClearRef.current = true;
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    },
    [pathname, router, searchParams]
  );

  // Both clearers write state directly (immediate visual reset) AND strip the URL param.
  // The URL→state effect above will re-sync searchQuery="" on the next tick when the URL
  // update lands — same value, React bails — but skipping the direct hook write would
  // introduce a one-tick window where the UI still shows filtered results.
  const handleClearSearch = useCallback(() => {
    setMapFocusCenter(null);
    clearSearch();
    stripMapUrlParams(["search"]);
    // Reset to nearby beaches when clearing search
    if (userLocation) {
      loadNearbyBeaches(userLocation.lat, userLocation.lon);
    } else {
      getUserLocation();
    }
  }, [clearSearch, stripMapUrlParams, userLocation, loadNearbyBeaches, getUserLocation]);

  const handleSearchChange = useCallback(
    (query: string) => {
      setMapFocusCenter(null);
      setSelectedBeach(null);
      setSearchQuery(query);
      stripMapUrlParams(["search"], { preserveSearchState: true });
    },
    [setSearchQuery, setSelectedBeach, stripMapUrlParams]
  );

  const handleClearAll = useCallback(() => {
    setMapFocusCenter(null);
    clearAllFilters();
    stripMapUrlParams(["search", "type", "level"]);
  }, [clearAllFilters, stripMapUrlParams]);

  const handleUseMyLocation = useCallback(() => {
    setSelectedBeach(null);
    clearSearch();
    setMapFocusCenter(null);
    lastLocationRef.current = null;
    getUserLocation(true);
  }, [clearSearch, getUserLocation, setSelectedBeach]);

  const handleUseDefaultLocation = useCallback(() => {
    setMapFocusCenter(null);
    applyDefaultLocation();
  }, [applyDefaultLocation]);

  const handleRegionSelect = useCallback(
    (region: MapRegionPill) => {
      setSelectedBeach(null);
      clearSearch();
      setMapFocusCenter(region.center);
      stripMapUrlParams(["search"]);
      lastLocationRef.current = null;
      void loadNearbyBeaches(region.center.lat, region.center.lon);
    },
    [clearSearch, loadNearbyBeaches, setSelectedBeach, stripMapUrlParams]
  );

  // Distance calculation function using centralized utility
  // Uses userLocation from closure - child components call with (beachLat, beachLng) only
  const getDistanceFromUser = useCallback(
    (beachLat: number, beachLng: number): string => {
      if (!userLocation) return "";
      return (
        calculateDistanceFormatted(
          { lat: userLocation.lat, lon: userLocation.lon },
          { lat: beachLat, lon: beachLng },
          "miles"
        ) + " away"
      );
    },
    [userLocation]
  );

  const handleMapClick = useCallback(() => {
    setMapFocusCenter(null);
    setSelectedBeach(null);
  }, [setSelectedBeach]);

  const handleShowBeaches = useCallback(() => {
    setSelectedBeach(null);
    setShowRecovery(false);
  }, [setSelectedBeach]);

  const handleDismissAttempt = useCallback(() => {
    setShowRecovery(true);
  }, []);

  const handleBoundsChange = useCallback(
    (bounds: { west: number; south: number; east: number; north: number }) => {
      setViewportBounds(bounds);
    },
    []
  );

  const handleWaveHeightsChange = useCallback(
    (map: Map<string, number | undefined>) => {
      setWaveHeightMap(map);
    },
    []
  );

  const loading = locationLoading || beachLoading;

  const viewportBeaches = useMemo(
    () => filterBeachesByViewport(filteredBeaches, viewportBounds),
    [filteredBeaches, viewportBounds]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.beginnerFriendly ||
    filters.breakTypes.size > 0;

  const selectedBeachForMap = mapFocusCenter ? null : selectedBeach;

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="map-view">
      <MapToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        suggestions={filteredBeaches.slice(0, 6)}
        onSuggestionSelect={handleBeachSelect}
        regions={MAP_REGION_PILLS}
        onRegionSelect={handleRegionSelect}
        onUseMyLocation={handleUseMyLocation}
        filters={filters}
        onToggleBeginner={toggleBeginnerFriendly}
        onToggleBreakType={toggleBreakType}
        onClearAll={handleClearAll}
        hasActiveFilters={hasActiveFilters}
        showSwellField={showSwellField}
        onToggleSwellField={() => setShowSwellField((v) => !v)}
      />

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative min-h-0 flex flex-col">
          <MapContent
            loading={loading}
            locationError={locationError}
            usingDefaultLocation={usingDefaultLocation}
            hasTimedOut={hasTimedOut}
            userLocation={userLocation}
            focusCenter={mapFocusCenter}
            selectedBeach={selectedBeachForMap}
            filteredBeaches={filteredBeaches}
            searchQuery={searchQuery}
            regionViewport={null}
            onGetUserLocation={handleUseMyLocation}
            onUseDefaultLocation={handleUseDefaultLocation}
            onBeachSelect={handleBeachSelect}
            onBoundsChange={handleBoundsChange}
            onWaveHeightsChange={handleWaveHeightsChange}
            onMapClick={isMobile ? handleMapClick : undefined}
            autoNavigateOnMarkerClick={!isMobile}
            onShowBeaches={isMobile && showRecovery ? handleShowBeaches : undefined}
            showSwellField={showSwellField}
            swellLayerId={swellLayerId}
            onSwellLayerChange={setSwellLayerId}
            swellTimelineSteps={swellTimelineSteps}
            swellTimelineIndex={swellTimelineIndex}
            onSwellTimelineChange={setSwellTimelineIndex}
          />
        </div>

        {/* Mobile bottom sheet (JS-conditional: Vaul Drawer uses portal, escapes CSS) */}
        {isMobile && (
          <MapBottomSheet
            beaches={viewportBeaches}
            waveHeightMap={waveHeightMap}
            selectedBeach={selectedBeachForMap}
            userLocation={userLocation}
            onBeachSelect={handleBeachSelect}
            getDistanceFromUser={getDistanceFromUser}
            onDeselectBeach={handleMapClick}
            onDismissAttempt={handleDismissAttempt}
          />
        )}
      </div>
    </div>
  );
}
