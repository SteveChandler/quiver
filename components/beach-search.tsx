"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Info } from "lucide-react";
import { ForecastCard } from "@/components/forecast-card";
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
import type { EnhancedForecast } from "@/types/database";

interface BeachSearchProps {
  profile?: Profile | null;
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
  const [forecast, setForecast] = useState<EnhancedForecast | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWaitingForProfile, setIsWaitingForProfile] = useState(true);
  const [showFallbackMessage, setShowFallbackMessage] = useState(false);
  const [outOfAreaMessage, setOutOfAreaMessage] = useState<string>("");
  const [isOutOfAreaSearch, setIsOutOfAreaSearch] = useState(false);
  const [availableBeaches, setAvailableBeaches] = useState<Beach[]>([]);
  const [loadingBeaches, setLoadingBeaches] = useState(false);

  // Fetch enhanced forecast data for a beach
  const fetchEnhancedForecast = async (
    beachId: string
  ): Promise<EnhancedForecast | null> => {
    try {
      const response = await fetch(
        `/api/forecasts/update-enhanced?beachId=${beachId}&days=1`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.forecasts?.length > 0) {
          // Get today's forecast (first available)
          return data.data.forecasts[0];
        }
      }

      return null;
    } catch (error) {
      console.error("Error fetching enhanced forecast:", error);
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
    if (!searchQuery.trim()) return true;

    const normalizedBeach = beachName.toLowerCase().trim();
    const normalizedSearch = searchQuery.toLowerCase().trim();

    // Check if the beach name contains the search query or vice versa
    return (
      normalizedBeach.includes(normalizedSearch) ||
      normalizedSearch.includes(normalizedBeach)
    );
  };

  // Handle clicking on a suggested beach
  const handleBeachSuggestionClick = async (suggestedBeach: Beach) => {
    setQuery(suggestedBeach.name);
    setShowFallbackMessage(false);
    await fetchBeachData(suggestedBeach.name, false); // Don't treat as user search to avoid fallback loop
  };

  // Fetch beach data using utility functions
  const fetchBeachData = async (
    beachName: string,
    isUserSearch: boolean = false
  ) => {
    setLoading(true);
    setError(null);
    setBeach(null);
    setForecast(null);
    setShowFallbackMessage(false);
    setOutOfAreaMessage("");
    setIsOutOfAreaSearch(false);

    // Track the original search query for fallback detection
    if (isUserSearch) {
      setOriginalSearchQuery(beachName);
    }

    try {
      // First, search for the beach using the existing function
      const result = await searchBeachWithForecast(beachName);

      setBeach(result.beach);

      // Then fetch enhanced forecast data
      const enhancedForecast = await fetchEnhancedForecast(result.beach.id);

      if (enhancedForecast) {
        setForecast(enhancedForecast);
      } else {
        // Fallback to basic forecast if enhanced forecast fails
        setForecast(result.forecast);
      }

      // Check if we need to show a fallback message
      if (isUserSearch && !doesBeachMatchSearch(result.beach.name, beachName)) {
        setShowFallbackMessage(true);

        // Check if this was an out-of-area search
        if (result.searchMetadata?.isOutOfAreaSearch) {
          setIsOutOfAreaSearch(true);
          setOutOfAreaMessage(
            result.searchMetadata.suggestedMessage ||
              COVERAGE_MESSAGES.getOutOfAreaMessage(beachName)
          );
        }
      }
    } catch (err: any) {
      console.error("Error fetching beach forecast:", err);

      // Check if this error contains search metadata for out-of-area detection
      const isOutOfArea = err.searchMetadata?.isOutOfAreaSearch || false;
      const suggestedMessage = err.searchMetadata?.suggestedMessage;

      // If this is a user search that failed, try to show Ocean Beach with fallback message
      if (isUserSearch) {
        try {
          const { beach: fallbackBeach } = await searchBeachWithForecastLegacy(
            "Ocean Beach"
          );
          setBeach(fallbackBeach);

          // Try to get enhanced forecast for fallback beach
          const enhancedForecast = await fetchEnhancedForecast(
            fallbackBeach.id
          );
          if (enhancedForecast) {
            setForecast(enhancedForecast);
          }

          setShowFallbackMessage(true);

          // Set out-of-area messaging if applicable
          if (isOutOfArea) {
            setIsOutOfAreaSearch(true);
            setOutOfAreaMessage(
              suggestedMessage ||
                COVERAGE_MESSAGES.getOutOfAreaMessage(beachName)
            );
          }
        } catch (fallbackErr) {
          console.error("Fallback also failed:", fallbackErr);
          setError(
            err instanceof Error ? err.message : "Unknown error occurred"
          );
        }
      } else {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      }
    } finally {
      setLoading(false);
      setIsWaitingForProfile(false);
    }
  };

  // Fetch beach by ID and then get its forecast
  const fetchBeachById = async (beachId: string) => {
    setLoading(true);
    setError(null);
    setBeach(null);
    setForecast(null);
    setShowFallbackMessage(false);

    try {
      const result = await getBeachById(beachId);

      if (result.success && result.data) {
        const favoriteBeach = result.data;
        setBeach(favoriteBeach);
        setQuery(favoriteBeach.name);

        // Fetch enhanced forecast data
        const enhancedForecast = await fetchEnhancedForecast(favoriteBeach.id);
        if (enhancedForecast) {
          setForecast(enhancedForecast);
        }

        return;
      }

      // Favorite beach not found, use fallback
      setQuery("Huntington Beach");
      await fetchBeachData("Huntington Beach");
    } catch (err) {
      console.error("Error fetching beach by ID:", err);
      // Fall back to Huntington Beach
      setQuery("Huntington Beach");
      await fetchBeachData("Huntington Beach");
    } finally {
      setLoading(false);
      setIsWaitingForProfile(false);
    }
  };

  // Fetch beach by name when we have favorite_spot but no default_beach_id
  const fetchBeachByName = async (beachName: string) => {
    setLoading(true);
    setError(null);
    setBeach(null);
    setForecast(null);
    setShowFallbackMessage(false);

    try {
      setQuery(beachName);
      await fetchBeachData(beachName);
    } catch (err) {
      console.error("Error fetching beach by name:", err);
      // Fall back to Huntington Beach
      setQuery("Huntington Beach");
      await fetchBeachData("Huntington Beach");
    }
  };

  // Initialize with user's favorite beach or default
  useEffect(() => {
    if (!isInitialized) {
      // Don't initialize until we have a definitive auth state
      // If user is still loading (undefined), wait
      if (user === undefined) {
        return;
      }

      setIsInitialized(true);

      if (user && profile) {
        // Check for default_beach_id first
        if (profile.default_beach_id) {
          fetchBeachById(profile.default_beach_id);
        }
        // Fallback to favorite_spot name
        else if (profile.favorite_spot && profile.favorite_spot.trim() !== "") {
          fetchBeachByName(profile.favorite_spot.trim());
        }
        // No favorite beach set
        else {
          setQuery("Huntington Beach");
          fetchBeachData("Huntington Beach");
        }
        setIsWaitingForProfile(false);
      } else if (user && !profile) {
        // User logged in, waiting for profile to load
        setIsWaitingForProfile(true);
      } else if (user === false) {
        // Confirmed guest user - use Huntington Beach
        setQuery("Huntington Beach");
        fetchBeachData("Huntington Beach");
        setIsWaitingForProfile(false);
      }
      // If user === undefined, we're still loading auth, so don't initialize yet
      // If user === true but profile === null, we're still loading profile, so don't initialize yet
    }
  }, [user, profile, isInitialized]);

  // Re-initialize if user logs in or profile updates after initial load
  useEffect(() => {
    // If initialized but no content loaded yet, and profile just loaded, initialize now
    if (isInitialized && user && profile && !beach && !loading) {
      // Check for default_beach_id first
      if (profile.default_beach_id) {
        fetchBeachById(profile.default_beach_id);
      }
      // Fallback to favorite_spot name
      else if (profile.favorite_spot && profile.favorite_spot.trim() !== "") {
        fetchBeachByName(profile.favorite_spot.trim());
      }
      // No favorite beach set
      else {
        setQuery("Huntington Beach");
        fetchBeachData("Huntington Beach");
      }
      setIsWaitingForProfile(false);
    }
  }, [
    user,
    profile?.default_beach_id,
    profile?.favorite_spot,
    isInitialized,
    beach,
    loading,
  ]);

  // Handle search submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      return;
    }

    await fetchBeachData(query, true);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">Beach Forecast</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter beach name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>

          {error && (
            <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
              {error}
            </div>
          )}
        </form>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {isWaitingForProfile && !loading && (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Loading your favorite beach...
              </p>
            </div>
          </div>
        )}

        {!loading && !isWaitingForProfile && beach && forecast && (
          <div className="mt-6">
            {/* Enhanced fallback message for out-of-area and general searches */}
            {showFallbackMessage && originalSearchQuery && (
              <div
                className={`flex items-start gap-2 text-sm p-4 rounded-lg mb-4 border ${
                  isOutOfAreaSearch
                    ? "text-amber-700 bg-amber-50 border-amber-200"
                    : "text-blue-600 bg-blue-50 border-blue-200"
                }`}
              >
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  {isOutOfAreaSearch ? (
                    <>
                      <p className="font-medium mb-2">
                        {COVERAGE_MESSAGES.OUT_OF_AREA_TITLE}
                      </p>
                      <p
                        className={`${
                          isOutOfAreaSearch
                            ? "text-amber-700/80"
                            : "text-blue-600/80"
                        } mb-2`}
                      >
                        {outOfAreaMessage}
                      </p>
                      <p
                        className={`${
                          isOutOfAreaSearch
                            ? "text-amber-700/80"
                            : "text-blue-600/80"
                        } mb-3 text-xs`}
                      >
                        {COVERAGE_MESSAGES.COVERAGE_AREA_INFO}
                      </p>
                      <p
                        className={`${
                          isOutOfAreaSearch
                            ? "text-amber-700/80"
                            : "text-blue-600/80"
                        } mb-3`}
                      >
                        {COVERAGE_MESSAGES.getSuggestionMessage(beach.name)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium mb-2">
                        Beach "{originalSearchQuery}" not found
                      </p>
                      <p className="text-blue-600/80 mb-3">
                        We're showing you {beach.name} instead. Try searching
                        for one of these available beaches:
                      </p>
                    </>
                  )}

                  {loadingBeaches ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Loading beaches...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {availableBeaches.map((availableBeach) => (
                        <button
                          key={availableBeach.id}
                          onClick={() =>
                            handleBeachSuggestionClick(availableBeach)
                          }
                          className={`text-left text-xs bg-white border rounded px-2 py-1 transition-colors duration-200 ${
                            isOutOfAreaSearch
                              ? "hover:bg-amber-100 border-amber-200"
                              : "hover:bg-blue-100 border-blue-200"
                          }`}
                        >
                          {availableBeach.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {isOutOfAreaSearch && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <p className="text-xs text-amber-700/70">
                        {COVERAGE_MESSAGES.getCoverageExpansionMessage()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success message */}
            {!showFallbackMessage && (
              <div className="text-green-600 text-sm p-2 bg-green-50 rounded mb-4">
                {user &&
                profile?.default_beach_id &&
                beach.id === profile.default_beach_id
                  ? `Showing surf conditions for your favorite beach: ${beach.name}`
                  : `Showing surf conditions for ${beach.name}`}
                {beach.location && `, ${beach.location}`}
              </div>
            )}

            {/* Enhanced Forecast Display */}
            {forecast && "forecast_date" in forecast ? (
              <div className="space-y-4">
                {/* Today's Date Header */}
                <div className="text-center pb-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Today's Forecast
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(forecast.forecast_date).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      }
                    )}
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
              </div>
            ) : (
              // Fallback to basic forecast card if enhanced forecast is not available
              <ForecastCard
                day="Today"
                date={new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                waveHeight={forecast?.wave_height || "No data"}
                windSpeed={forecast?.wind_speed || "No data"}
                waterTemp={forecast?.water_temp}
                waveDirection={forecast?.wave_direction}
              />
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/20 px-6 py-4">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="font-medium">Enhanced Forecast Data Sources:</span>
          </div>
          <div className="ml-4 space-y-1">
            <div>• NOAA WaveWatch III Global Wave Model</div>
            <div>• NOAA CO-OPS Tidal Predictions & Observations</div>
            <div>• NOAA Weather Service API</div>
            <div>• NDBC Buoy Network (Real-time Conditions)</div>
          </div>
          <div className="mt-2 text-xs opacity-80">
            Forecasts updated every 6 hours with confidence scoring based on
            data quality and freshness.
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
