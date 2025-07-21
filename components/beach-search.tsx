"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Info, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getBeachById, getBeaches } from "@/actions/beach-actions";
import { COVERAGE_MESSAGES } from "@/lib/constants/coverage-areas";
import {
  searchBeachWithForecast,
  searchBeachWithForecastLegacy,
} from "@/lib/utils/beach-search-utils";
import { TideDirection } from "@/components/ui/tide-direction";
import { TideTiming } from "@/components/ui/tide-timing";
import { WavePeriodDisplay } from "@/components/ui/wave-period-display";
import { ForecastDataTransparency } from "@/components/ui/forecast-data-transparency";
import type { Beach, Profile } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { updateProfile } from "@/actions/profile-actions";

interface BeachSearchProps {
  profile?: Profile | null;
}

// Modern fallback forecast display component
function FallbackForecastDisplay({ forecast }: { forecast: any }) {
  return (
    <div className="space-y-4">
      {/* Today's Date Header */}
      <div className="text-center pb-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">
          Today's Forecast
        </h3>
        <p className="text-sm text-gray-600">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Basic Wave Information */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 mb-2">
            {forecast?.wave_height || "No data"}
          </div>
          <div className="text-sm text-gray-600">Wave Height</div>
        </div>
      </div>

      {/* Weather & Conditions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-800">
            {forecast?.wind_speed || "No data"}
          </div>
          <div className="text-sm text-gray-600">Wind</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-800">
            {forecast?.wind_direction || "N/A"}
          </div>
          <div className="text-sm text-gray-600">Direction</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-800">
            {forecast?.water_temp || "No data"}
          </div>
          <div className="text-sm text-gray-600">Water Temp</div>
        </div>
      </div>

      {/* Basic forecast notice */}
      <div className="flex items-center justify-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <Info className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-800">
          Basic forecast data - Enhanced forecast loading...
        </span>
      </div>
    </div>
  );
}

/**
 * Beach search component that uses enhanced forecast data
 */
export function BeachSearch({ profile }: BeachSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [originalSearchQuery, setOriginalSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecast, setForecast] = useState<EnhancedForecastEntity | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWaitingForProfile, setIsWaitingForProfile] = useState(true);
  const [showFallbackMessage, setShowFallbackMessage] = useState(false);
  const [outOfAreaMessage, setOutOfAreaMessage] = useState<string>("");
  const [isOutOfAreaSearch, setIsOutOfAreaSearch] = useState(false);
  const [availableBeaches, setAvailableBeaches] = useState<Beach[]>([]);
  const [loadingBeaches, setLoadingBeaches] = useState(false);
  const [refreshingForecast, setRefreshingForecast] = useState(false);

  // Fetch enhanced forecast data for a beach
  const fetchEnhancedForecast = async (
    beachId: string
  ): Promise<EnhancedForecastEntity | null> => {
    try {
      // Simple URL without cache-busting since NOAA data is predictable
      const url = `/api/forecasts/update-enhanced?beachId=${beachId}&days=1`;
      console.log(`🌊 Fetching enhanced forecast from: ${url}`);

      const response = await fetch(url);

      console.log(
        `📡 Fetch response status: ${response.status}, ok: ${response.ok}`
      );

      if (response.ok) {
        const data: {
          success: boolean;
          data?: { forecasts: EnhancedForecastEntity[] };
        } = await response.json();
        console.log(`📊 API Response data:`, {
          success: data.success,
          forecastCount: data.data?.forecasts?.length || 0,
          firstForecast: data.data?.forecasts?.[0]
            ? {
                wave_height: data.data.forecasts[0].wave_height,
                wave_period: data.data.forecasts[0].wave_period,
                data_source: data.data.forecasts[0].data_source,
                forecast_date: data.data.forecasts[0].forecast_date,
              }
            : "No forecast data",
        });

        if (data.success && data.data?.forecasts?.length > 0) {
          // Use time-aware selection to get the most appropriate forecast
          const { getCurrentForecast } = await import("@/lib/utils/current-forecast-utils");
          const bestForecast = getCurrentForecast(data.data.forecasts);
          
          if (bestForecast) {
            const { formatCurrentTime } = await import("@/lib/utils/current-forecast-utils");
            console.log(`✅ Enhanced forecast retrieved successfully - Current time: ${formatCurrentTime()}, selected forecast: ${bestForecast.forecast_date} ${bestForecast.forecast_time}:`, bestForecast);
            return bestForecast;
          }
        } else {
          console.warn(
            `⚠️ Enhanced forecast API returned success=${data.success}, but no forecast data`
          );
        }
      } else {
        console.error(
          `❌ Enhanced forecast API failed with status ${response.status}`
        );
        const errorText = await response.text();
        console.error(`Error details:`, errorText);
      }

      return null;
    } catch (error) {
      console.error("💥 Error fetching enhanced forecast:", error);
      return null;
    }
  };

  // Load available beaches for fallback display
  const loadAvailableBeaches = async () => {
    setLoadingBeaches(true);
    try {
      const result = await getBeaches();
      if (result.success && result.data) {
        // Sort beaches alphabetically and take first 12 for display
        const sortedBeaches = result.data
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 12);
        setAvailableBeaches(sortedBeaches);
      }
    } catch (err) {
      console.error("Error loading beaches:", err);
    } finally {
      setLoadingBeaches(false);
    }
  };

  // Refresh forecast data for current beach
  const refreshForecast = async () => {
    if (!beach) return;

    setRefreshingForecast(true);
    try {
      const enhancedForecast = await fetchEnhancedForecast(beach.id);
      if (enhancedForecast) {
        setForecast(enhancedForecast);
      } else {
        // Try legacy forecast if enhanced forecast fails
        console.log("Enhanced forecast not available, trying legacy...");
        const legacyResult = await searchBeachWithForecastLegacy(beach.name);
        if (legacyResult.success && legacyResult.data) {
          setForecast(legacyResult.data);
        }
      }
    } catch (err) {
      console.error("Error refreshing forecast:", err);
    } finally {
      setRefreshingForecast(false);
    }
  };

  // Load beaches when fallback message is shown
  useEffect(() => {
    if (showFallbackMessage && availableBeaches.length === 0) {
      loadAvailableBeaches();
    }
  }, [showFallbackMessage]);

  // Helper function to check if beach matches the search query
  const doesBeachMatchSearch = (
    beachName: string,
    searchQuery: string
  ): boolean => {
    const normalizedBeachName = beachName.toLowerCase();
    const normalizedSearchQuery = searchQuery.toLowerCase();
    return normalizedBeachName.includes(normalizedSearchQuery);
  };

  // Helper function to get default beach (Pacific Beach) for users without a default beach
  const getDefaultBeachForForecast = async (): Promise<Beach | null> => {
    try {
      const result = await getBeaches();
      if (result.success && result.data) {
        // Find Pacific Beach as the default (exact match to avoid Crystal Pier conflicts)
        const pacificBeach = result.data.find(
          (beach) =>
            beach.name.toLowerCase() === "pacific beach" ||
            beach.name.toLowerCase().startsWith("pacific beach")
        );
        if (pacificBeach) {
          return pacificBeach;
        }

        // Fallback to Ocean Beach if Pacific Beach not found
        const oceanBeach = result.data.find((beach) =>
          beach.name.toLowerCase().includes("ocean beach")
        );
        if (oceanBeach) {
          return oceanBeach;
        }

        // Last resort: first beach in the list
        return result.data[0] || null;
      }
    } catch (error) {
      console.error("Error getting default beach:", error);
    }
    return null;
  };

  // Helper function to migrate favorite_spot to default_beach_id
  const migrateFavoriteSpotToDefaultBeach = async (
    profile: any
  ): Promise<string | null> => {
    if (profile?.default_beach_id || !profile?.favorite_spot) {
      return profile?.default_beach_id || null;
    }

    try {
      // Try to find a beach that matches the favorite_spot text
      const result = await getBeaches();
      if (result.success && result.data) {
        const favoriteSpotText = profile.favorite_spot.toLowerCase().trim();
        const matchingBeach = result.data.find(
          (beach) =>
            beach.name.toLowerCase().includes(favoriteSpotText) ||
            favoriteSpotText.includes(beach.name.toLowerCase())
        );

        if (matchingBeach) {
          console.log(
            `Auto-migrating favorite spot "${profile.favorite_spot}" to beach ID:`,
            matchingBeach.id
          );
          // Update the profile with the matched beach ID
          try {
            await updateProfile({ default_beach_id: matchingBeach.id });
            return matchingBeach.id;
          } catch (updateError) {
            console.error("Failed to auto-update default beach:", updateError);
          }
        }
      }
    } catch (error) {
      console.error("Error during favorite spot migration:", error);
    }

    return null;
  };

  // Initialize component based on profile
  useEffect(() => {
    if (isInitialized) return;

    const initializeComponent = async () => {
      try {
        // Check if we have a profile with a default beach (or can migrate one)
        let defaultBeachId = profile?.default_beach_id;

        // Auto-migrate from favorite_spot if needed
        if (!defaultBeachId && profile?.favorite_spot) {
          defaultBeachId = await migrateFavoriteSpotToDefaultBeach(profile);
        }

        if (defaultBeachId) {
          setIsWaitingForProfile(false);

          const beachResult = await getBeachById(defaultBeachId);

          if (beachResult.success && beachResult.data) {
            setBeach(beachResult.data);
            setQuery(beachResult.data.name);
            setOriginalSearchQuery(beachResult.data.name);

            // Fetch enhanced forecast for the default beach
            const enhancedForecast = await fetchEnhancedForecast(
              defaultBeachId
            );

            if (enhancedForecast) {
              console.log(
                `✅ Using enhanced forecast for ${beachResult.data.name}`
              );
              setForecast(enhancedForecast);
            } else {
              // Try legacy forecast if enhanced forecast fails
              console.log(
                `⚠️ Enhanced forecast failed for ${beachResult.data.name}, trying legacy...`
              );
              const legacyResult = await searchBeachWithForecastLegacy(
                beachResult.data.name
              );
              if (legacyResult.success && legacyResult.data) {
                console.log(
                  `📜 Using legacy forecast for ${beachResult.data.name}:`,
                  {
                    wave_height: legacyResult.data.wave_height,
                    wave_period: legacyResult.data.wave_period,
                    data_source: legacyResult.data.data_source || "LEGACY",
                  }
                );
                setForecast(legacyResult.data);
              } else {
                console.error(
                  `❌ Both enhanced and legacy forecasts failed for ${beachResult.data.name}`
                );
              }
            }
          }
        } else {
          // No profile or default beach, show Pacific Beach forecast by default
          setIsWaitingForProfile(false);

          const defaultBeach = await getDefaultBeachForForecast();
          if (defaultBeach) {
            setBeach(defaultBeach);
            setQuery(defaultBeach.name);
            setOriginalSearchQuery(defaultBeach.name);

            // Fetch enhanced forecast for Pacific Beach
            const enhancedForecast = await fetchEnhancedForecast(
              defaultBeach.id
            );

            if (enhancedForecast) {
              console.log(
                `✅ Using enhanced forecast for ${defaultBeach.name}`
              );
              setForecast(enhancedForecast);
            } else {
              // Try legacy forecast if enhanced forecast fails
              console.log(
                `⚠️ Enhanced forecast failed for ${defaultBeach.name}, trying legacy...`
              );
              const legacyResult = await searchBeachWithForecastLegacy(
                defaultBeach.name
              );
              if (legacyResult.success && legacyResult.data) {
                console.log(
                  `📜 Using legacy forecast for ${defaultBeach.name}:`,
                  {
                    wave_height: legacyResult.data.wave_height,
                    wave_period: legacyResult.data.wave_period,
                    data_source: legacyResult.data.data_source || "LEGACY",
                  }
                );
                setForecast(legacyResult.data);
              } else {
                console.error(
                  `❌ Both enhanced and legacy forecasts failed for ${defaultBeach.name}`
                );
              }
            }
          }
        }
      } catch (err) {
        console.error("Error initializing component:", err);
        setError("Failed to initialize beach search");
        setIsWaitingForProfile(false);
      } finally {
        setIsInitialized(true);
      }
    };

    // Add a small delay to prevent flash of loading state
    const timeoutId = setTimeout(initializeComponent, 100);
    return () => clearTimeout(timeoutId);
  }, [profile]);

  // Reset when profile's default beach changes (but not when isInitialized changes)
  useEffect(() => {
    if (isInitialized) {
      setIsInitialized(false);
      setBeach(null);
      setForecast(null);
      setQuery("");
      setOriginalSearchQuery("");
      setError(null);
      setShowFallbackMessage(false);
      setOutOfAreaMessage("");
      setIsOutOfAreaSearch(false);
    }
  }, [profile?.default_beach_id]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setShowFallbackMessage(false);
    setOutOfAreaMessage("");
    setIsOutOfAreaSearch(false);

    try {
      // Try enhanced forecast search first
      const enhancedResult = await searchBeachWithForecast(query);

      if (enhancedResult.success && enhancedResult.data) {
        setBeach(enhancedResult.data.beach);
        setForecast(enhancedResult.data.forecast);
        setOriginalSearchQuery(query);
      } else {
        // Try legacy forecast if enhanced fails
        const legacyResult = await searchBeachWithForecastLegacy(query);

        if (legacyResult.success && legacyResult.data) {
          setBeach(legacyResult.data.beach);
          setForecast(legacyResult.data.forecast);
          setOriginalSearchQuery(query);
        } else {
          // Check if this is an out-of-area search
          const outOfAreaResult = COVERAGE_MESSAGES.find((area) =>
            query.toLowerCase().includes(area.location.toLowerCase())
          );

          if (outOfAreaResult) {
            setOutOfAreaMessage(outOfAreaResult.message);
            setIsOutOfAreaSearch(true);
            setBeach(null);
            setForecast(null);
          } else {
            // Search didn't match our coverage area
            setError(
              legacyResult.error ||
                "Beach not found. Please try another search."
            );
            setBeach(null);
            setForecast(null);
            setShowFallbackMessage(true);
          }
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Search failed. Please try again.");
      setBeach(null);
      setForecast(null);
      setShowFallbackMessage(true);
    } finally {
      setLoading(false);
    }
  };

  // Don't show loading state on initial render
  if (isWaitingForProfile) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Loading your forecast...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Available beaches display when showing fallback
  if (showFallbackMessage && availableBeaches.length > 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Available Beaches
            </h3>
            <p className="text-sm text-gray-600">
              Try searching for one of these beaches instead:
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {availableBeaches.map((availableBeach) => (
              <Button
                key={availableBeach.id}
                variant="outline"
                className="text-sm"
                onClick={() => {
                  setQuery(availableBeach.name);
                  setShowFallbackMessage(false);
                  handleSearch({ preventDefault: () => {} } as React.FormEvent);
                }}
              >
                {availableBeach.name}
              </Button>
            ))}
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search for a beach..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Out of area search message
  if (isOutOfAreaSearch) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Search Results
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">{outOfAreaMessage}</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search for a beach..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <form onSubmit={handleSearch} className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search for a beach..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </Button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {beach && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-800">
                {beach.name}
              </h2>
              <div className="text-sm text-gray-600 mt-1">
                {profile?.default_beach_id === beach.id ? (
                  `Showing surf conditions for your favorite beach: ${beach.name}`
                ) : profile?.default_beach_id ? (
                  `Showing surf conditions for ${beach.name}`
                ) : (
                  <div className="space-y-2">
                    <p>Showing surf conditions for {beach.name}</p>
                    <div className="flex items-center justify-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="text-sm text-blue-800">
                        💡 Want to see your favorite beach here?
                        <button
                          onClick={() => {
                            // Navigate to profile edit page
                            window.location.href = "/profile/edit";
                          }}
                          className="ml-1 text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          Set your default beach
                        </button>
                      </span>
                    </div>
                  </div>
                )}
                {beach.location && `, ${beach.location}`}
              </div>
            </div>

            {/* Enhanced Forecast Display */}
            {forecast && "forecast_date" in forecast ? (
              <div className="space-y-4">
                {/* Today's Date Header */}
                <div className="text-center pb-3 border-b border-gray-200">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Today's Forecast
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refreshForecast}
                      disabled={refreshingForecast}
                      className="h-8 w-8 p-0"
                      title="Refresh forecast"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          refreshingForecast ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    {(() => {
                      // Parse the date string correctly to avoid timezone issues
                      const [year, month, day] = forecast.forecast_date
                        .split("-")
                        .map(Number);
                      const localDate = new Date(year, month - 1, day); // month is 0-indexed
                      return localDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      });
                    })()}
                  </p>
                </div>

                {/* Wave Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <WavePeriodDisplay
                    waveHeight={forecast.wave_height}
                    wavePeriod={forecast.wave_period}
                    waveDirection={forecast.wave_direction}
                    variant="detailed"
                  />
                </div>

                {/* Tide Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TideDirection
                    status={forecast.tide_status}
                    currentHeight={forecast.tide_height}
                    variant="detailed"
                  />
                  <TideTiming
                    nextTideTime={forecast.next_tide_time}
                    nextTideType={forecast.next_tide_type}
                    nextTideHeight={forecast.next_tide_height}
                    variant="detailed"
                  />
                </div>

                {/* Weather & Conditions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800">
                      {forecast.wind_speed}
                    </div>
                    <div className="text-sm text-gray-600">Wind</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800">
                      {forecast.wind_direction}
                    </div>
                    <div className="text-sm text-gray-600">Direction</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800">
                      {forecast.water_temp}
                    </div>
                    <div className="text-sm text-gray-600">Water</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800">
                      {forecast.air_temperature}
                    </div>
                    <div className="text-sm text-gray-600">Air</div>
                  </div>
                </div>

                {/* Confidence Score */}
                <div className="flex items-center justify-center gap-2 p-3 bg-white border rounded-lg">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      forecast.confidence_score >= 80
                        ? "bg-green-500"
                        : forecast.confidence_score >= 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    Forecast Confidence: {forecast.confidence_score}%
                  </span>
                </div>

                {/* Swell Components */}
                {(forecast.swell_1_height ||
                  forecast.swell_2_height ||
                  forecast.wind_wave_height) && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-800">
                      Swell Components
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {forecast.swell_1_height && (
                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                          <span className="text-sm font-medium">
                            Primary Swell
                          </span>
                          <span className="text-sm">
                            {forecast.swell_1_height} @{" "}
                            {forecast.swell_1_period || "N/A"}
                            {forecast.swell_1_direction &&
                              ` ${forecast.swell_1_direction}`}
                          </span>
                        </div>
                      )}
                      {forecast.swell_2_height && (
                        <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <span className="text-sm font-medium">
                            Secondary Swell
                          </span>
                          <span className="text-sm">
                            {forecast.swell_2_height} @{" "}
                            {forecast.swell_2_period || "N/A"}
                            {forecast.swell_2_direction &&
                              ` ${forecast.swell_2_direction}`}
                          </span>
                        </div>
                      )}
                      {forecast.wind_wave_height && (
                        <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                          <span className="text-sm font-medium">
                            Wind Waves
                          </span>
                          <span className="text-sm">
                            {forecast.wind_wave_height} @{" "}
                            {forecast.wind_wave_period || "N/A"}
                            {forecast.wind_wave_direction &&
                              ` ${forecast.wind_wave_direction}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Data Source Transparency */}
                <div className="mt-4">
                  <ForecastDataTransparency
                    dataSource={forecast.data_source || "FALLBACK"}
                    className="text-xs"
                  />
                </div>
              </div>
            ) : (
              // Modern fallback display instead of legacy ForecastCard
              <FallbackForecastDisplay forecast={forecast} />
            )}
          </div>
        )}
      </CardContent>


    </Card>
  );
}
