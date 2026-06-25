"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { BookOpen, X } from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { MapToolbar } from "@/components/map/map-toolbar";
import { Button } from "@/components/ui/button";
import { useCustomSpots } from "@/hooks/use-custom-spots";
import {
  MAP_REGION_PILLS,
  type MapRegionPill,
} from "@/components/map/map-regions";
import { MapContent } from "@/components/map/map-content";
import { MapLearningPanel } from "@/components/map/map-learning-panel";
import { type SwellLayerId } from "@/components/map/swell-map-theme";
import type { Beach } from "@/types/database";

const MISSION_BEACH_COORDS = { lat: 32.7702, lon: -117.2525 } as const;

export function MapView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isShareView = searchParams.get("share") === "1";
  const [showFieldGuide, setShowFieldGuide] = useState(false);
  const [mapFocusCenter, setMapFocusCenter] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  // Use ref to track if we've already loaded beaches for a location to prevent multiple calls
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const preserveSearchStateOnNextUrlClearRef = useRef(false);

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
  const { customSpots } = useCustomSpots();

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

  const handleMapClick = useCallback(() => {
    setMapFocusCenter(null);
    setSelectedBeach(null);
  }, [setSelectedBeach]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.beginnerFriendly ||
    filters.breakTypes.size > 0;

  const selectedBeachForMap = mapFocusCenter ? null : selectedBeach;
  const fieldGuideVisible = showFieldGuide || isShareView;

  const handleOpenFieldGuide = useCallback((): void => {
    setShowFieldGuide(true);
  }, []);

  const handleCloseFieldGuide = useCallback((): void => {
    setShowFieldGuide(false);
  }, []);

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

      <div className="border-b bg-background px-3 py-2 sm:px-4">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-expanded={fieldGuideVisible}
            aria-controls="map-field-guide-panel"
            data-testid="map-field-guide-toggle"
            onClick={handleOpenFieldGuide}
            className="h-10 w-full justify-center whitespace-nowrap px-3 text-xs sm:w-auto sm:text-sm"
          >
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            How to read this map
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className={
          fieldGuideVisible
            ? "grid flex-1 grid-rows-[minmax(320px,1fr)_auto] min-h-0 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-1"
            : "grid flex-1 grid-rows-1 min-h-0"
        }
      >
        <div className="relative min-h-0 flex flex-col">
          <MapContent
            loading={false}
            locationError={locationError}
            usingDefaultLocation={usingDefaultLocation}
            hasTimedOut={hasTimedOut}
            userLocation={userLocation}
            focusCenter={mapFocusCenter}
            selectedBeach={selectedBeachForMap}
            filteredBeaches={filteredBeaches}
            customSpots={customSpots}
            searchQuery={searchQuery}
            regionViewport={null}
            onGetUserLocation={handleUseMyLocation}
            onUseDefaultLocation={handleUseDefaultLocation}
            onBeachSelect={handleBeachSelect}
            onMapClick={handleMapClick}
            autoNavigateOnMarkerClick={true}
            showSwellField={showSwellField}
            swellLayerId={swellLayerId}
            onSwellLayerChange={setSwellLayerId}
            swellTimelineSteps={swellTimelineSteps}
            swellTimelineIndex={swellTimelineIndex}
            onSwellTimelineChange={setSwellTimelineIndex}
          />
        </div>
        {fieldGuideVisible && (
          <div id="map-field-guide-panel" className="relative min-h-0">
            {showFieldGuide && !isShareView && (
              <button
                type="button"
                aria-label="Close map field guide"
                onClick={handleCloseFieldGuide}
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#11100D]/20 bg-[#F5EEDC] text-[#11100D] shadow-sm transition-colors hover:bg-[#F4EBD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <MapLearningPanel />
          </div>
        )}
      </div>
    </div>
  );
}
