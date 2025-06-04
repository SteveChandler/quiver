"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, List, MapIcon, Loader2 } from "lucide-react";
import { BeachCard } from "@/components/beach-card";
import { getBeaches, getNearbyBeaches } from "@/actions/beach-actions";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import type { Beach } from "@/types/database";

// Default to Ocean Beach, San Diego coordinates
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;
const MAX_DISTANCE_MILES = 30; // Maximum distance in miles for nearby beaches

export function MapView() {
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredBeaches, setFilteredBeaches] = useState<Beach[]>([]);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [usingDefaultLocation, setUsingDefaultLocation] = useState(false);

  // Get user's location on component mount
  useEffect(() => {
    getUserLocation();
  }, []);

  // Filter beaches based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredBeaches(beaches);
    } else {
      const normalizedQuery = searchQuery.toLowerCase().trim();

      const filtered = beaches.filter(
        (beach) =>
          beach.name.toLowerCase().includes(normalizedQuery) ||
          (beach.location &&
            beach.location.toLowerCase().includes(normalizedQuery))
      );

      if (filtered.length > 0) {
        // We found matches in the currently loaded beaches
        setFilteredBeaches(filtered);
        // Select the first matched beach
        setSelectedBeach(filtered[0]);
      } else {
        // No matches in currently loaded beaches
        // Show the "no results" message but keep the current beaches visible
        setFilteredBeaches([]);
      }
    }
  }, [searchQuery, beaches]);

  // Handle search submission - for when user presses Enter
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);

    try {
      // First try to find any beach by name in the entire database
      const result = await getBeaches();

      if (result.success && result.data) {
        const normalizedQuery = searchQuery.toLowerCase().trim();

        // Look for beaches that match the search query
        const matchingBeaches = result.data.filter(
          (beach) =>
            beach.name.toLowerCase().includes(normalizedQuery) ||
            (beach.location &&
              beach.location.toLowerCase().includes(normalizedQuery))
        );

        if (matchingBeaches.length > 0) {
          // Found beach(es) matching the search
          setBeaches(matchingBeaches);
          setFilteredBeaches(matchingBeaches);
          setSelectedBeach(matchingBeaches[0]);
          setUsingDefaultLocation(false);
        } else {
          // No matches found, show "no results" message
          setFilteredBeaches([]);
        }
      }
    } catch (error) {
      console.error("Error searching beaches:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load all beaches from database
  const loadBeaches = async () => {
    setLoading(true);
    try {
      const result = await getBeaches();
      if (result.success && result.data) {
        setBeaches(result.data);
        setFilteredBeaches(result.data);
      }
    } catch (error) {
      console.error("Error loading beaches:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get nearby beaches based on user location
  const loadNearbyBeaches = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      // First try to find beaches within 30 miles
      const result = await getNearbyBeaches(
        latitude,
        longitude,
        MAX_DISTANCE_MILES
      );

      if (result.success && result.data && result.data.length > 0) {
        // Store the user location for distance calculations
        const userLoc = { lat: latitude, lng: longitude };
        setUserLocation(userLoc);

        // Sort beaches by distance from user location
        const sortedBeaches = [...result.data].sort((a, b) => {
          const distA = calculateDistanceBetween(
            userLoc.lat,
            userLoc.lng,
            a.latitude,
            a.longitude
          );
          const distB = calculateDistanceBetween(
            userLoc.lat,
            userLoc.lng,
            b.latitude,
            b.longitude
          );
          return distA - distB;
        });

        setBeaches(sortedBeaches);
        setFilteredBeaches(sortedBeaches);
        setUsingDefaultLocation(false);

        // Select the nearest beach by default
        if (sortedBeaches.length > 0) {
          setSelectedBeach(sortedBeaches[0]);
        }
      } else {
        // If no beaches found within 30 miles, fall back to Ocean Beach
        console.log(
          "No beaches found within 30 miles, using Ocean Beach as fallback"
        );
        useDefaultLocation();
      }
    } catch (error) {
      console.error("Error loading nearby beaches:", error);
      // If failed to load nearby beaches, load all beaches as fallback
      loadBeaches();
    } finally {
      setLoading(false);
    }
  };

  // Use Ocean Beach, San Diego as default location
  const useDefaultLocation = () => {
    setUserLocation({ lat: OCEAN_BEACH_LAT, lng: OCEAN_BEACH_LNG });
    setUsingDefaultLocation(true);
    // Load beaches near Ocean Beach with a wider radius to ensure we get results
    loadOceanBeachFallback();
  };

  // Load Ocean Beach and nearby beaches as fallback
  const loadOceanBeachFallback = async () => {
    setLoading(true);
    try {
      const result = await getNearbyBeaches(
        OCEAN_BEACH_LAT,
        OCEAN_BEACH_LNG,
        50
      );
      if (result.success && result.data) {
        setBeaches(result.data);
        setFilteredBeaches(result.data);
      } else {
        // Last resort - load all beaches
        loadBeaches();
      }
    } catch (error) {
      console.error("Error loading Ocean Beach fallback:", error);
      loadBeaches();
    } finally {
      setLoading(false);
    }
  };

  // Get user's current location
  const getUserLocation = () => {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      // Fall back to Ocean Beach, San Diego
      useDefaultLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        await loadNearbyBeaches(latitude, longitude);
      },
      (err) => {
        console.error("Error getting location:", err);
        setLocationError("Using default location: Ocean Beach, San Diego");
        // Fall back to Ocean Beach, San Diego
        useDefaultLocation();
      }
    );
  };

  const handleBeachSelect = (beach: Beach) => {
    setSelectedBeach(beach);
  };

  const getDistanceFromUser = (beachLat: number, beachLng: number): string => {
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
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistanceBetween = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate numeric distance from user location
  const calculateDistance = (beachLat: number, beachLng: number): number => {
    if (!userLocation) return Infinity;
    return calculateDistanceBetween(
      userLocation.lat,
      userLocation.lng,
      beachLat,
      beachLng
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search beaches..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 rounded-full p-0"
                onClick={() => {
                  setSearchQuery("");
                  // Reload all beaches when clearing search
                  getUserLocation();
                }}
              >
                <span className="sr-only">Clear</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </Button>
            )}
          </div>
          <Button type="submit" size="sm">
            Search
          </Button>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "map" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("map")}
            >
              <MapIcon className="h-4 w-4 mr-1" />
              Map
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
        </form>
      </div>

      {/* Map View */}
      {viewMode === "map" && (
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : locationError && !usingDefaultLocation ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-4">
                <p className="text-lg font-medium text-destructive">
                  {locationError}
                </p>
                <Button onClick={getUserLocation} size="sm" className="mt-4">
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col">
              {/* Static map image */}
              <div className="flex-1 relative overflow-hidden">
                <img
                  src={getStaticMapImageUrl(
                    selectedBeach?.latitude ||
                      userLocation?.lat ||
                      OCEAN_BEACH_LAT,
                    selectedBeach?.longitude ||
                      userLocation?.lng ||
                      OCEAN_BEACH_LNG,
                    { width: 800, height: 600, zoom: 12 }
                  )}
                  alt="Beach locations map"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Map overlay with beach count */}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md">
                  <p className="text-sm font-medium">
                    {userLocation
                      ? usingDefaultLocation
                        ? `Showing beaches near Ocean Beach, San Diego`
                        : `Found ${filteredBeaches.length} beaches near your location`
                      : "Loading beach locations..."}
                  </p>
                  {filteredBeaches.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {searchQuery
                        ? "Search results"
                        : "Tap a beach card below to see it on the map"}
                    </p>
                  )}
                </div>

                {/* Location controls */}
                {(usingDefaultLocation || !userLocation) && (
                  <div className="absolute top-4 right-4">
                    <Button
                      onClick={getUserLocation}
                      size="sm"
                      variant="secondary"
                      className="shadow-md"
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      {!userLocation
                        ? "Use My Location"
                        : "Use My Actual Location"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Beach Quick View */}
          {selectedBeach && (
            <div className="absolute bottom-4 left-4 right-4">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-md bg-gray-200 flex items-center justify-center">
                      <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{selectedBeach.name}</h3>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span>
                          {userLocation
                            ? getDistanceFromUser(
                                selectedBeach.latitude,
                                selectedBeach.longitude
                              )
                            : selectedBeach.location || "San Diego"}
                        </span>
                      </div>
                      <div className="flex items-center mt-1">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <MapPin
                              key={i}
                              className={`h-3 w-3 ${
                                i < (selectedBeach.wave_quality_rating || 4)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        <span className="text-xs ml-1 text-muted-foreground">
                          (128)
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        (window.location.href = `/beach/${selectedBeach.id}`)
                      }
                    >
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="flex-1 p-4 space-y-4 overflow-auto pb-20">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredBeaches.length > 0 ? (
            <>
              {usingDefaultLocation && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md">
                  <p className="text-sm">
                    Showing beaches near Ocean Beach, San Diego
                  </p>
                </div>
              )}
              {!usingDefaultLocation &&
                userLocation &&
                filteredBeaches.length > 0 && (
                  <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
                    <p className="text-sm">
                      {filteredBeaches.length === 1
                        ? `Found 1 beach within ${MAX_DISTANCE_MILES} miles: ${
                            filteredBeaches[0].name
                          } (${calculateDistance(
                            filteredBeaches[0].latitude,
                            filteredBeaches[0].longitude
                          ).toFixed(1)} miles away)`
                        : `Showing the ${
                            filteredBeaches.length
                          } closest beaches within ${MAX_DISTANCE_MILES} miles. Nearest: ${
                            filteredBeaches[0].name
                          } (${calculateDistance(
                            filteredBeaches[0].latitude,
                            filteredBeaches[0].longitude
                          ).toFixed(1)} miles away)`}
                    </p>
                  </div>
                )}
              {filteredBeaches.map((beach) => (
                <div
                  key={beach.id}
                  onClick={() => handleBeachSelect(beach)}
                  className="cursor-pointer"
                >
                  <BeachCard
                    id={beach.id}
                    name={beach.name}
                    distance={
                      userLocation
                        ? getDistanceFromUser(beach.latitude, beach.longitude)
                        : beach.location || "San Diego"
                    }
                    rating={beach.wave_quality_rating || 4.0}
                    reviewCount={128} // This would be dynamic in a real app
                    imageUrl={getStaticMapImageUrl(
                      beach.latitude,
                      beach.longitude,
                      { width: 300, height: 120, zoom: 15 }
                    )}
                  />
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery
                ? `No beaches found matching "${searchQuery}". Try a different search term.`
                : "No beaches found. Try a different search."}
              {!searchQuery && (
                <Button
                  onClick={getUserLocation}
                  size="sm"
                  variant="outline"
                  className="mt-4"
                >
                  Use my location
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
