"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useGeolocation } from "@/hooks/use-geolocation";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { MapSearchHeader } from "@/components/map/map-search-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MapContent } from "@/components/map/map-content";
import { BeachList } from "@/components/map/beach-list";
import { MapSidebar } from "@/components/map/map-sidebar";
import { MapBottomSheet } from "@/components/map/map-bottom-sheet";
import { calculateDistanceFormatted } from "@/lib/utils/distance-utils";
import { filterBeachesByViewport, type ViewportBounds } from "@/lib/utils/viewport-filter";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Beach } from "@/types/database";

const MISSION_BEACH_COORDS = { lat: 32.7702, lon: -117.2525 } as const;

export function MapView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [showRecovery, setShowRecovery] = useState(false);

  // Use ref to track if we've already loaded beaches for a location to prevent multiple calls
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  type RegionViewport = {
    region: string;
    key: string;
    center: [number, number];
    bounds?: [[number, number], [number, number]];
    zoom?: number;
  };

  const [regionViewport, setRegionViewport] = useState<RegionViewport | null>(
    null
  );

  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [waveHeightMap, setWaveHeightMap] = useState<Map<string, number | undefined>>(new Map());

  // Custom hooks for state management
  const {
    userLocation,
    locationError,
    usingDefaultLocation,
    hasTimedOut,
    loading: locationLoading,
    getUserLocation,
    useDefaultLocation,
  } = useGeolocation({
    useLastBeach: false,
    defaultLocation: MISSION_BEACH_COORDS,
  });

  const {
    filteredBeaches,
    loading: beachLoading,
    searchQuery,
    selectedBeach,
    beaches,
    regions,
    activeRegion,
    filters,
    loadBeaches,
    loadNearbyBeaches,
    setSearchQuery,
    clearSearch,
    setSelectedBeach,
    setActiveRegion,
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

  // URL is the source of truth for the search query.
  // Syncing both directions (state → URL via router.replace in clearers; URL → state here)
  // prevents snap-back when Clear all strips ?search= while state also clears.
  useEffect(() => {
    const searchFromUrl = searchParams.get("search") ?? "";
    setSearchQuery(searchFromUrl);
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
      setSelectedBeach(beach);
      // Smooth scroll to top to show the selected beach on map
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setSelectedBeach]
  );

  const handleSidebarNavigate = useCallback(
    (beach: Beach) => {
      const beachUrl = getBeachHrefSafe({
        id: beach.id,
        slug: beach.slug,
        city: beach.city,
        state: beach.state,
      });
      if (beachUrl) router.push(beachUrl);
    },
    [router]
  );

  const stripMapUrlParams = useCallback(
    (keys: readonly string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      let mutated = false;
      for (const key of keys) {
        if (params.has(key)) {
          params.delete(key);
          mutated = true;
        }
      }
      if (mutated) {
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
    clearSearch();
    stripMapUrlParams(["search"]);
    // Reset to nearby beaches when clearing search
    if (userLocation) {
      loadNearbyBeaches(userLocation.lat, userLocation.lon);
    } else {
      getUserLocation();
    }
  }, [clearSearch, stripMapUrlParams, userLocation, loadNearbyBeaches, getUserLocation]);

  const handleClearAll = useCallback(() => {
    clearAllFilters();
    stripMapUrlParams(["search", "type", "level"]);
  }, [clearAllFilters, stripMapUrlParams]);

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

  // Update region viewport when the active region changes
  useEffect(() => {
    if (!activeRegion || activeRegion === "ALL") {
      setRegionViewport(null);
      return;
    }

    const regionBeaches = (beaches || []).filter(
      (beach) => (beach.region || "") === activeRegion
    );

    const coordinates = regionBeaches
      .map((beach) => {
        if (typeof beach.lat === "number" && typeof beach.lon === "number") {
          return { lat: beach.lat, lon: beach.lon };
        }
        return null;
      })
      .filter(Boolean) as Array<{ lat: number; lon: number }>;

    if (coordinates.length === 0) {
      setRegionViewport(null);
      return;
    }

    const lats = coordinates.map((coord) => coord.lat);
    const lons = coordinates.map((coord) => coord.lon);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    const latSpan = Math.abs(maxLat - minLat);
    const lonSpan = Math.abs(maxLon - minLon);
    const keyBase = `${minLat.toFixed(5)}-${minLon.toFixed(5)}-${maxLat.toFixed(
      5
    )}-${maxLon.toFixed(5)}`;

    if (latSpan < 0.002 && lonSpan < 0.002) {
      setRegionViewport({
        region: activeRegion,
        key: `${activeRegion}-center-${keyBase}`,
        center: [centerLat, centerLon],
        zoom: 13,
      });
      return;
    }

    setRegionViewport({
      region: activeRegion,
      key: `${activeRegion}-bounds-${keyBase}`,
      center: [centerLat, centerLon],
      bounds: [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
    });
  }, [activeRegion, beaches]);

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="map-view">
      {/* Map Controls (View Mode Toggle & Near Me) */}
      <MapSearchHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNearMe={() => {
          // Clear selection so map centers on user location
          setSelectedBeach(null);
          clearSearch();
          lastLocationRef.current = null; // Allow reload at same location
          getUserLocation(true); // Force fresh geolocation
        }}
      />

      {/* Region Tabs + Filter Chips */}
      <div className="sticky top-[64px] z-10 bg-background border-b px-4 py-2">
        {/* Regions */}
        {regions && regions.length > 0 && (
          <Tabs
            defaultValue="ALL"
            onValueChange={(v) => setActiveRegion(v as any)}
          >
            <TabsList className="flex flex-wrap gap-1 overflow-x-auto">
              <TabsTrigger value="ALL">All</TabsTrigger>
              {regions.map((r) => (
                <TabsTrigger key={r} value={r}>
                  {r}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Filter Chips */}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge
            variant={filters.beginnerFriendly ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleBeginnerFriendly()}
          >
            Beginner-friendly
          </Badge>
          {["beach", "point", "reef", "longboard", "bodyboard"].map((t) => (
            <Badge
              key={t}
              variant={filters.breakTypes.has(t) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleBreakType(t)}
            >
              {t}
            </Badge>
          ))}
          {(searchQuery || filters.beginnerFriendly || filters.breakTypes.size > 0) && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={handleClearAll}
              data-testid="map-clear-all"
            >
              Clear all
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === "map" ? (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Desktop sidebar (JS-conditional: portal-based Drawer can't be hidden via CSS) */}
          {!isMobile && (
            <div className="flex w-[380px] shrink-0 border-r">
              <MapSidebar
                beaches={viewportBeaches}
                waveHeightMap={waveHeightMap}
                selectedBeach={selectedBeach}
                userLocation={userLocation}
                onBeachSelect={handleSidebarNavigate}
              />
            </div>
          )}

          {/* Map fills remaining space */}
          <div className="flex-1 relative min-h-0 flex flex-col">
            <MapContent
              loading={loading}
              locationError={locationError}
              usingDefaultLocation={usingDefaultLocation}
              hasTimedOut={hasTimedOut}
              userLocation={userLocation}
              selectedBeach={selectedBeach}
              filteredBeaches={filteredBeaches}
              searchQuery={searchQuery}
              regionViewport={regionViewport}
              onGetUserLocation={() => getUserLocation(true)}
              onUseDefaultLocation={useDefaultLocation}
              onBeachSelect={handleBeachSelect}
              onBoundsChange={handleBoundsChange}
              onWaveHeightsChange={handleWaveHeightsChange}
              onMapClick={isMobile ? handleMapClick : undefined}
              autoNavigateOnMarkerClick={!isMobile}
              onShowBeaches={isMobile && showRecovery ? handleShowBeaches : undefined}
              visibleBeachCount={viewportBeaches.length}
            />

          </div>

          {/* Mobile bottom sheet (JS-conditional: Vaul Drawer uses portal, escapes CSS) */}
          {isMobile && (
            <MapBottomSheet
              beaches={viewportBeaches}
              waveHeightMap={waveHeightMap}
              selectedBeach={selectedBeach}
              userLocation={userLocation}
              onBeachSelect={handleBeachSelect}
              getDistanceFromUser={getDistanceFromUser}
              onDeselectBeach={handleMapClick}
              onDismissAttempt={handleDismissAttempt}
            />
          )}

        </div>
      ) : (
        <BeachList
          filteredBeaches={filteredBeaches}
          searchQuery={searchQuery}
          userLocation={userLocation}
          usingDefaultLocation={usingDefaultLocation}
          loading={loading}
          onBeachSelect={handleBeachSelect}
          onClearSearch={handleClearSearch}
          onGetUserLocation={getUserLocation}
          onLoadBeaches={loadBeaches}
          getDistanceFromUser={getDistanceFromUser}
        />
      )}
    </div>
  );
}
