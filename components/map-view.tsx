"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { MapToolbar } from "@/components/map/map-toolbar";
import { useCustomSpots } from "@/hooks/use-custom-spots";
import { MapContent } from "@/components/map/map-content";
import { MapLearningPanel } from "@/components/map/map-learning-panel";
import {
  createCameraCommand,
  type MapCameraCommand,
  type MapCameraOwner,
} from "@/components/map/map-camera-command";
import { type SwellLayerId } from "@/components/map/swell-map-theme";
import { useProfileContext } from "@/context/profile-context";
import type { Beach } from "@/types/database";

const MISSION_BEACH_COORDS = { lat: 32.7702, lon: -117.2525 } as const;

// Shared with use-geolocation / use-nearest-beach. The two writers disagree on
// shape ({lat,lon} vs {id,name}), so the resolver below handles both.
const LAST_BEACH_KEY = "quiver:lastBeach";

function isFiniteCoord(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function deviceTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isTimeZone(timezone) ? timezone : "UTC";
}

export function resolveViewedMapTimezone({
  selectedBeach,
  loadedBeaches,
  viewCenter,
}: {
  selectedBeach: Beach | null;
  loadedBeaches: Beach[];
  viewCenter: { lat: number; lon: number } | null;
}): string {
  const selectedTimezone = selectedBeach?.timezone;
  if (isTimeZone(selectedTimezone)) return selectedTimezone;

  if (viewCenter) {
    const nearestBeach = loadedBeaches.reduce<Beach | null>((nearest, beach) => {
      if (!isFiniteCoord(beach.lat) || !isFiniteCoord(beach.lon) || !isTimeZone(beach.timezone)) {
        return nearest;
      }
      if (!nearest || !isFiniteCoord(nearest.lat) || !isFiniteCoord(nearest.lon)) return beach;
      const currentDistance = (beach.lat - viewCenter.lat) ** 2 + (beach.lon - viewCenter.lon) ** 2;
      const nearestDistance = (nearest.lat - viewCenter.lat) ** 2 + (nearest.lon - viewCenter.lon) ** 2;
      return currentDistance < nearestDistance ? beach : nearest;
    }, null);
    if (isTimeZone(nearestBeach?.timezone)) return nearestBeach.timezone;
  }

  return deviceTimezone();
}

/**
 * Resolve the last beach the user was looking at into map coordinates.
 * Accepts both stored shapes: `{lat,lon}` (geolocation writer) directly, or
 * `{id,name}` (session-save writer) by looking the beach up via the API.
 */
async function resolveLastViewedCenter(): Promise<{
  lat: number;
  lon: number;
} | null> {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LAST_BEACH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (isFiniteCoord(parsed?.lat) && isFiniteCoord(parsed?.lon)) {
      return { lat: parsed.lat, lon: parsed.lon };
    }

    if (parsed?.id) {
      const res = await fetch(`/api/beaches/${parsed.id}`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const json = await res.json();
        const beach = json?.data?.beach ?? json?.beach;
        if (isFiniteCoord(beach?.lat) && isFiniteCoord(beach?.lon)) {
          return { lat: beach.lat, lon: beach.lon };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function MapView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isShareView = searchParams.get("share") === "1";
  const [showFieldGuide, setShowFieldGuide] = useState(false);
  const [cameraOwner, setCameraOwner] = useState<MapCameraOwner>("initial");
  const [cameraCommand, setCameraCommand] = useState<MapCameraCommand | null>(null);
  const cameraOwnerRef = useRef<MapCameraOwner>("initial");
  const explicitGpsRequestRef = useRef<{
    baseline: { lat: number; lon: number } | null;
    sawLoading: boolean;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fieldGuideTriggerRef = useRef<HTMLButtonElement | null>(null);
  const exploredCenterRef = useRef<{ lat: number; lon: number } | null>(null);
  const [exploredCenter, setExploredCenter] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const issueCameraCommand = useCallback(
    (input: Omit<MapCameraCommand, "id">, owner: MapCameraOwner) => {
      if (input.source !== "gps") {
        explicitGpsRequestRef.current = null;
      }
      setCameraCommand((previous) => createCameraCommand(previous, input));
      cameraOwnerRef.current = owner;
      setCameraOwner(owner);
    },
    [],
  );

  // Tracks the last location we loaded beaches for, to prevent duplicate calls.
  // Seeded with the default center so the userLocation effect below doesn't fire
  // a redundant default-area load before the center resolver (home/last/nearest)
  // has run; the resolver owns the initial load.
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(
    MISSION_BEACH_COORDS
  );
  const initialCenterResolvedRef = useRef(false);
  const preserveSearchStateOnNextUrlClearRef = useRef(false);

  const [showSwellField, setShowSwellField] = useState(true);
  const [swellLayerId, setSwellLayerId] = useState<SwellLayerId>("s1");
  const [locationDeniedPromptDismissed, setLocationDeniedPromptDismissed] =
    useState(false);
  // Custom hooks for state management
  const { homeBeach, isLoading: profileLoading } = useProfileContext();

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
    // Don't auto-prompt for GPS: a signed-in home beach or last-viewed beach
    // should center the map first (and skip the permission prompt entirely).
    // GPS is requested only as the final fallback, in the resolver effect below.
    autoRequest: false,
  });

  const {
    filteredBeaches,
    resultsQuery,
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
  const viewCenter = exploredCenter ?? cameraCommand?.center ?? null;
  const viewTimezone = useMemo(
    () =>
      resolveViewedMapTimezone({
        selectedBeach,
        loadedBeaches: filteredBeaches,
        viewCenter,
      }),
    [filteredBeaches, selectedBeach, viewCenter],
  );

  // Load nearby beaches when user location is available - prevent duplicate calls
  // Wait for geolocation to resolve before fetching to avoid using stale fallback coords
  useEffect(() => {
    if (!userLocation || locationLoading) {
      return;
    }

    const locationOwnsBeachLoading =
      cameraOwner === "initial" ||
      cameraCommand?.source === "gps" ||
      cameraCommand?.source === "fallback";
    if (!locationOwnsBeachLoading) {
      return;
    }

    if (
      cameraOwner === "initial" &&
      (cameraCommand?.source === "home" ||
        cameraCommand?.source === "last-viewed")
    ) {
      return;
    }

    if (
      !initialCenterResolvedRef.current &&
      homeBeach &&
      isFiniteCoord(homeBeach.lat) &&
      isFiniteCoord(homeBeach.lon)
    ) {
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
  }, [
    cameraCommand?.source,
    cameraOwner,
    homeBeach,
    userLocation,
    locationLoading,
    loadNearbyBeaches,
  ]);

  // Resolve the initial map center once, in priority order: signed-in home
  // beach → last beach the user was looking at → nearest to their GPS location.
  // Gated on `profileLoading` so a signed-in user's home beach wins before any
  // fallback fires (and we never prompt for GPS when we already have a center).
  useEffect(() => {
    if (initialCenterResolvedRef.current) return;
    if (profileLoading) return;
    if (cameraOwner !== "initial") return;

    let cancelled = false;

    const centerOn = (
      lat: number,
      lon: number,
      source: "home" | "last-viewed",
    ) => {
      if (cancelled) return;
      if (cameraOwnerRef.current !== "initial") return;
      initialCenterResolvedRef.current = true;
      issueCameraCommand({ source, center: { lat, lon } }, "initial");
      lastLocationRef.current = { lat, lon };
      void loadNearbyBeaches(lat, lon);
    };

    // 1. Signed-in home beach.
    if (homeBeach && isFiniteCoord(homeBeach.lat) && isFiniteCoord(homeBeach.lon)) {
      centerOn(homeBeach.lat, homeBeach.lon, "home");
      return;
    }

    // 2. Last beach the user was looking at, then 3. nearest to their location.
    void (async () => {
      const last = await resolveLastViewedCenter();
      if (cancelled || initialCenterResolvedRef.current) return;
      if (cameraOwnerRef.current !== "initial") return;
      if (last) {
        centerOn(last.lat, last.lon, "last-viewed");
        return;
      }
      // 3. Nearest to the user — only now do we request GPS. Load the default
      // area first as a baseline so a denied or slow GPS still shows beaches;
      // a granted GPS fix updates userLocation and the effect above reloads.
      initialCenterResolvedRef.current = true;
      issueCameraCommand(
        { source: "fallback", center: MISSION_BEACH_COORDS },
        "initial",
      );
      lastLocationRef.current = { ...MISSION_BEACH_COORDS };
      void loadNearbyBeaches(MISSION_BEACH_COORDS.lat, MISSION_BEACH_COORDS.lon);
      getUserLocation();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    cameraOwner,
    getUserLocation,
    homeBeach,
    issueCameraCommand,
    loadNearbyBeaches,
    profileLoading,
  ]);

  const initialGpsCommandIssuedRef = useRef(false);
  useEffect(() => {
    if (
      cameraOwner !== "initial" ||
      usingDefaultLocation ||
      !initialCenterResolvedRef.current ||
      initialGpsCommandIssuedRef.current ||
      !userLocation
    ) {
      return;
    }

    initialGpsCommandIssuedRef.current = true;
    issueCameraCommand({ source: "gps", center: userLocation }, "initial");
  }, [cameraOwner, issueCameraCommand, userLocation, usingDefaultLocation]);

  useEffect(() => {
    const request = explicitGpsRequestRef.current;
    if (!request) return;

    if (locationLoading) {
      request.sawLoading = true;
      return;
    }
    if (usingDefaultLocation || !userLocation) return;

    const locationChanged =
      !request.baseline ||
      Math.abs(request.baseline.lat - userLocation.lat) >= 0.000001 ||
      Math.abs(request.baseline.lon - userLocation.lon) >= 0.000001;
    if (!request.sawLoading && !locationChanged) return;

    explicitGpsRequestRef.current = null;
    issueCameraCommand(
      { source: "gps", center: userLocation },
      "explicit-command",
    );
  }, [issueCameraCommand, locationLoading, userLocation, usingDefaultLocation]);

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
  }, [searchParams, setSearchQuery]);

  const searchCommandQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      searchCommandQueryRef.current = null;
      return;
    }
    if (resultsQuery !== normalizedQuery) return;
    if (searchCommandQueryRef.current === normalizedQuery) return;

    const firstBeach = filteredBeaches[0];
    if (
      !firstBeach ||
      !isFiniteCoord(firstBeach.lat) ||
      !isFiniteCoord(firstBeach.lon)
    ) {
      return;
    }

    searchCommandQueryRef.current = normalizedQuery;
    issueCameraCommand(
      { source: "search", center: { lat: firstBeach.lat, lon: firstBeach.lon } },
      "explicit-command",
    );
  }, [filteredBeaches, issueCameraCommand, resultsQuery, searchQuery]);

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
      setLocationDeniedPromptDismissed(true);
      if (isFiniteCoord(beach.lat) && isFiniteCoord(beach.lon)) {
        issueCameraCommand(
          { source: "pin", center: { lat: beach.lat, lon: beach.lon } },
          "explicit-command",
        );
      }
      // Smooth scroll to top to show the selected beach on map
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [issueCameraCommand, setSelectedBeach]
  );

  const handleSuggestionSelect = useCallback(
    (beach: Beach) => {
      handleBeachSelect(beach);
    },
    [handleBeachSelect]
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
      setSelectedBeach(null);
      setSearchQuery(query);
      stripMapUrlParams(["search"], { preserveSearchState: true });
    },
    [setSearchQuery, setSelectedBeach, stripMapUrlParams]
  );

  const handleClearAll = useCallback(() => {
    clearAllFilters();
    stripMapUrlParams(["search", "type", "level"]);
  }, [clearAllFilters, stripMapUrlParams]);

  const handleUseMyLocation = useCallback(() => {
    setLocationDeniedPromptDismissed(true);
    setSelectedBeach(null);
    clearSearch();
    explicitGpsRequestRef.current = {
      baseline: userLocation,
      sawLoading: false,
    };
    lastLocationRef.current = null;
    getUserLocation(true);
  }, [clearSearch, getUserLocation, setSelectedBeach, userLocation]);

  const handleUseDefaultLocation = useCallback(() => {
    issueCameraCommand(
      { source: "fallback", center: MISSION_BEACH_COORDS },
      "explicit-command",
    );
    applyDefaultLocation();
  }, [applyDefaultLocation, issueCameraCommand]);

  const handleMapClick = useCallback(() => {
    setSelectedBeach(null);
  }, [setSelectedBeach]);

  const handleUserCameraInteraction = useCallback((interaction: {
    action: "pan" | "zoom" | "rotate";
    center: { lat: number; lon: number };
    phase: "start" | "end";
  }) => {
    if (interaction.phase === "end") {
      exploredCenterRef.current = interaction.center;
      setExploredCenter(interaction.center);
      if (interaction.action === "pan" && !searchQuery.trim()) {
        void loadNearbyBeaches(interaction.center.lat, interaction.center.lon, { background: true });
      }
      return;
    }
    cameraOwnerRef.current = "user";
    setCameraOwner("user");
  }, [loadNearbyBeaches, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.beginnerFriendly ||
    filters.breakTypes.size > 0;

  const fieldGuideVisible = showFieldGuide || isShareView;

  const handleOpenFieldGuide = useCallback((): void => {
    setShowFieldGuide(true);
  }, []);

  const handleCloseFieldGuide = useCallback((): void => {
    setShowFieldGuide(false);
    fieldGuideTriggerRef.current?.focus();
  }, []);

  const handleSearchPromptClick = useCallback((): void => {
    setLocationDeniedPromptDismissed(true);
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="map-view">
      <MapToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchInputRef={searchInputRef}
        onClearSearch={handleClearSearch}
        suggestions={selectedBeach ? [] : filteredBeaches.slice(0, 6)}
        onSuggestionSelect={handleSuggestionSelect}
        onUseMyLocation={handleUseMyLocation}
        filters={filters}
        onToggleBeginner={toggleBeginnerFriendly}
        onToggleBreakType={toggleBreakType}
        onClearAll={handleClearAll}
        hasActiveFilters={hasActiveFilters}
        showSwellField={showSwellField}
        onToggleSwellField={() => setShowSwellField((v) => !v)}
        fieldGuideVisible={fieldGuideVisible}
        fieldGuideTriggerRef={fieldGuideTriggerRef}
        onOpenFieldGuide={handleOpenFieldGuide}
      />

      {/* Content */}
      <div
        className={
          fieldGuideVisible
            ? "grid flex-1 min-h-0 grid-rows-[minmax(240px,1fr)_minmax(0,1fr)] overflow-hidden xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-1"
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
            selectedBeach={selectedBeach}
            filteredBeaches={filteredBeaches}
            customSpots={customSpots}
            searchQuery={searchQuery}
            regionViewport={null}
            cameraOwner={cameraOwner}
            cameraCommand={cameraCommand}
            onGetUserLocation={handleUseMyLocation}
            onUseDefaultLocation={handleUseDefaultLocation}
            onSearchPromptClick={handleSearchPromptClick}
            locationDeniedPromptDismissed={locationDeniedPromptDismissed}
            onBeachSelect={handleBeachSelect}
            onMapClick={handleMapClick}
            onUserCameraInteraction={handleUserCameraInteraction}
            autoNavigateOnMarkerClick={true}
            showSwellField={showSwellField}
            swellLayerId={swellLayerId}
            onSwellLayerChange={setSwellLayerId}
            swellTimelineMode="expandable-hourly"
            viewTimezone={viewTimezone}
            timelineFocusBeachId={
              selectedBeach?.id
              ?? (cameraCommand?.source === "home" ? homeBeach?.id : null)
              ?? (cameraCommand?.source === "search" ? filteredBeaches[0]?.id : null)
            }
          />
        </div>
        {fieldGuideVisible && (
          <div id="map-field-guide-panel" className="relative min-h-0 overflow-hidden">
            {showFieldGuide && !isShareView && (
              <button
                type="button"
                aria-label="Close map field guide"
                onClick={handleCloseFieldGuide}
                className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#11100D]/20 bg-[#F5EEDC] text-[#11100D] shadow-sm transition-colors hover:bg-[#F4EBD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
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
