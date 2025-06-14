"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { MapHeader } from "@/components/map/map-header";
import { MapContent } from "@/components/map/map-content";
import { BeachList } from "@/components/map/beach-list";
import { SelectedBeachCard } from "@/components/map/selected-beach-card";
import { NearbyBeachScroll } from "@/components/map/nearby-beach-scroll";
import type { Beach } from "@/types/database";

export function MapView() {
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

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
    beaches,
    filteredBeaches,
    loading: beachLoading,
    searchQuery,
    selectedBeach,
    nearbyBeachesForScroll,
    loadBeaches,
    loadNearbyBeaches,
    setSearchQuery,
    clearSearch,
    setSelectedBeach,
  } = useBeachSearch();

  // Load beaches when location changes
  const handleLocationUpdate = useCallback(
    (lat: number, lng: number) => {
      loadNearbyBeaches(lat, lng);
    },
    [loadNearbyBeaches]
  );

  // Load nearby beaches when user location is available
  useEffect(() => {
    if (userLocation) {
      handleLocationUpdate(userLocation.lat, userLocation.lng);
    }
  }, [userLocation, handleLocationUpdate]);

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

  // Distance calculation function
  const getDistanceFromUser = useCallback(
    (beachLat: number, beachLng: number): string => {
      if (!userLocation) return "Unknown distance";

      // Simple distance calculation using Haversine formula
      const R = 3958.8; // Earth's radius in miles
      const dLat = ((beachLat - userLocation.lat) * Math.PI) / 180;
      const dLng = ((beachLng - userLocation.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((userLocation.lat * Math.PI) / 180) *
          Math.cos((beachLat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return `${distance.toFixed(1)} miles away`;
    },
    [userLocation]
  );

  const loading = locationLoading || beachLoading;

  return (
    <div className="flex-1 flex flex-col">
      {/* Search Header */}
      <MapHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={handleClearSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

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
