"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { MapSearchHeader } from "@/components/map/map-search-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MapContent } from "@/components/map/map-content";
import { BeachList } from "@/components/map/beach-list";
import { SelectedBeachCard } from "@/components/map/selected-beach-card";
import { NearbyBeachScroll } from "@/components/map/nearby-beach-scroll";
import { calculateDistanceFormatted } from "@/lib/utils/distance-utils";
import type { Beach } from "@/types/database";

export function MapView() {
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  // Use ref to track if we've already loaded beaches for a location to prevent multiple calls
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Custom hooks for state management
  const {
    userLocation,
    locationError,
    usingDefaultLocation,
    loading: locationLoading,
    getUserLocation,
    useDefaultLocation,
  } = useGeolocation();

  const {
    filteredBeaches,
    loading: beachLoading,
    searchQuery,
    selectedBeach,
    beaches,
    nearbyBeachesForScroll,
    regions,
    loadBeaches,
    loadNearbyBeaches,
    setSearchQuery,
    clearSearch,
    setSelectedBeach,
    setActiveRegion,
    toggleBeginnerFriendly,
    toggleBreakType,
    setMinParkingRating,
  } = useBeachSearch();

  // Load nearby beaches when user location is available - prevent duplicate calls
  useEffect(() => {
    if (!userLocation) {
      return;
    }

    // Check if we've already loaded beaches for this location
    const lastLocation = lastLocationRef.current;
    if (
      lastLocation &&
      Math.abs(lastLocation.lat - userLocation.lat) < 0.001 &&
      Math.abs(lastLocation.lng - userLocation.lng) < 0.001
    ) {
      return; // Same location, don't reload
    }

    // Update the last location and load nearby beaches
    lastLocationRef.current = userLocation;
    loadNearbyBeaches(userLocation.lat, userLocation.lng);
  }, [userLocation, loadNearbyBeaches]);

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      setSelectedBeach(beach);
      // Smooth scroll to top to show the selected beach on map
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setSelectedBeach]
  );

  const handleClearSearch = useCallback(() => {
    clearSearch();
    // Reset to nearby beaches when clearing search
    if (userLocation) {
      loadNearbyBeaches(userLocation.lat, userLocation.lng);
    } else {
      getUserLocation();
    }
  }, [clearSearch, userLocation, loadNearbyBeaches, getUserLocation]);

  // Distance calculation function using centralized utility
  const getDistanceFromUser = useCallback(
    (beachLat: number, beachLng: number): string => {
      if (!userLocation) return "Unknown distance";
      return (
        calculateDistanceFormatted(
          userLocation.lat,
          userLocation.lng,
          beachLat,
          beachLng,
          "miles"
        ) + " away"
      );
    },
    [userLocation]
  );

  const loading = locationLoading || beachLoading;

  return (
    <div className="flex-1 flex flex-col" data-testid="map-view">
      {/* Search Header */}
      <MapSearchHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={handleClearSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        suggestions={(beaches || []).map((b) => ({
          id: b.id,
          name: b.name,
          location: b.location || undefined,
        }))}
        onResultSelect={(id) => {
          const beach = (beaches || []).find((b) => b.id === id);
          if (beach) {
            setSelectedBeach(beach);
            setSearchQuery(beach.name);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        // Near Me chip control
        onNearMe={() => {
          if (userLocation) {
            loadNearbyBeaches(userLocation.lat, userLocation.lng);
          } else {
            getUserLocation();
          }
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
            variant="outline"
            className="cursor-pointer"
            onClick={() => toggleBeginnerFriendly()}
          >
            Beginner-friendly
          </Badge>
          {["beach", "point", "reef"].map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="cursor-pointer"
              onClick={() => toggleBreakType(t)}
            >
              {t}
            </Badge>
          ))}
          <Badge
            variant="outline"
            className="cursor-pointer"
            onClick={() => setMinParkingRating(3)}
          >
            Parking 3+
          </Badge>
          <Badge
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setMinParkingRating(null)}
          >
            Clear filters
          </Badge>
        </div>
      </div>

      {/* Content */}
      {viewMode === "map" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <MapContent
            loading={loading}
            locationError={locationError}
            usingDefaultLocation={usingDefaultLocation}
            userLocation={userLocation}
            selectedBeach={selectedBeach}
            filteredBeaches={filteredBeaches}
            searchQuery={searchQuery}
            onGetUserLocation={getUserLocation}
            onUseDefaultLocation={useDefaultLocation}
            onBeachSelect={handleBeachSelect}
          />

          {/* Selected Beach Quick View */}
          <SelectedBeachCard
            selectedBeach={selectedBeach}
            getDistanceFromUser={getDistanceFromUser}
            userLocation={userLocation}
          />

          {/* Nearby Beach Cards */}
          <NearbyBeachScroll
            nearbyBeachesForScroll={nearbyBeachesForScroll}
            selectedBeach={selectedBeach}
            onBeachSelect={handleBeachSelect}
            onViewModeChange={setViewMode}
            getDistanceFromUser={getDistanceFromUser}
            userLocation={userLocation}
          />
        </div>
      ) : (
        <BeachList
          filteredBeaches={filteredBeaches}
          searchQuery={searchQuery}
          userLocation={userLocation}
          usingDefaultLocation={usingDefaultLocation}
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
