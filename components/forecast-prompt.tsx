"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Loader2, RefreshCw } from "lucide-react";
import { getNearbyBeaches, getBeaches } from "@/actions/beach-actions";
import {
  getBeachForecasts,
  updateBeachForecasts,
} from "@/actions/forecast-actions";
import { ForecastCard } from "@/components/forecast-card";
import {
  updateBeachForecastData,
  getDirectOceanBeachForecast,
  OCEAN_BEACH_LAT,
  OCEAN_BEACH_LNG,
} from "@/lib/client-fetch";
import { calculateDistance } from "@/lib/utils/distance-utils";
import type { Beach, Forecast } from "@/types/database";
import { formatForecastTimeDetailed } from "@/lib/utils";

// Maximum distance in miles for nearby beaches
const MAX_DISTANCE_MILES = 30;

// Handling states for the component
type PromptState = "initial" | "loading" | "input" | "results" | "error";

export function ForecastPrompt() {
  const [state, setState] = useState<PromptState>("initial");
  const [location, setLocation] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Flag to prevent multiple initial loads
  const hasInitialLoaded = useRef(false);

  // Separate refresh function with no dependencies
  const refreshForecastById = useCallback(async (beachId: string) => {
    setIsRefreshing(true);
    try {
      // Use client-side API to update forecast data
      const result = await updateBeachForecastData(beachId);

      if (result.success) {
        // Fetch updated forecast data
        const updatedForecast = await getBeachForecasts(beachId);
        if (
          updatedForecast.success &&
          updatedForecast.data &&
          updatedForecast.data.length > 0
        ) {
          setForecast(updatedForecast.data[0]);
          setState("results");
          setError(null);
          setDebugInfo(null);
        } else {
          throw new Error("No forecast data available after refresh");
        }
      } else {
        const errorDetails = result.error ? `: ${result.error}` : "";
        throw new Error(`Failed to update forecast${errorDetails}`);
      }
    } catch (err) {
      console.error("Error refreshing forecast:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes("API key")) {
        setDebugInfo(`API Key Error: ${errorMessage}`);
        setError(
          "There appears to be an issue with the API key for forecast data."
        );
      } else {
        setDebugInfo(`Refresh Error: ${errorMessage}`);
        setError("Could not get latest forecast. Showing default data.");
      }

      // Show error instead of using mock data
      setState("error");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch forecast data for a beach - stable with minimal dependencies
  const fetchForecastForBeach = useCallback(
    async (beachData: Beach) => {
      try {
        const forecastResult = await getBeachForecasts(beachData.id);

        if (
          forecastResult.success &&
          forecastResult.data &&
          forecastResult.data.length > 0
        ) {
          setForecast(forecastResult.data[0]);
          setState("results");
        } else {
          setDebugInfo(
            "No forecast data found in database. Trying to refresh..."
          );
          // No forecast in database, try to update it
          await refreshForecastById(beachData.id);
        }
      } catch (err) {
        console.error("Error fetching forecast:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setDebugInfo(`API Error: ${errorMessage}`);
        setError(
          `Error getting forecast for ${beachData.name}. Showing default data.`
        );

        // Show error instead of mock data
        setState("error");
      }
    },
    [refreshForecastById]
  );

  // Fetch Ocean Beach data (default location) - stable with minimal dependencies
  const fetchOceanBeachData = useCallback(async () => {
    try {
      // Find Ocean Beach in nearby beaches with a larger radius to ensure we get results
      const result = await getNearbyBeaches(
        OCEAN_BEACH_LAT,
        OCEAN_BEACH_LNG,
        50
      );

      if (result.success && result.data && result.data.length > 0) {
        // Find the beach that most closely matches Ocean Beach
        const oceanBeach =
          result.data.find(
            (b) =>
              b.name.toLowerCase().includes("ocean") &&
              (b.location || "").toLowerCase().includes("san diego")
          ) || result.data[0];

        setBeach(oceanBeach);
        setDebugInfo(`Using fallback: ${oceanBeach.name}`);
        await fetchForecastForBeach(oceanBeach);
      } else {
        setDebugInfo("No beaches found near Ocean Beach coordinates");
        setError(
          "No forecast data available. Please try refreshing or try a different location."
        );
        setState("error");
      }
    } catch (err) {
      console.error("Error fetching Ocean Beach data:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setDebugInfo(`Ocean Beach lookup error: ${errorMessage}`);
      setError("Unable to load forecast data. Please try again.");
      setState("error");
    }
  }, [fetchForecastForBeach]);

  // Get beaches near coordinates - stable with minimal dependencies
  const fetchBeachesNearLocation = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        // Try to find beaches within 30 miles
        const result = await getNearbyBeaches(
          latitude,
          longitude,
          MAX_DISTANCE_MILES
        );

        if (result.success && result.data && result.data.length > 0) {
          // Sort beaches by distance using centralized utility
          const sortedBeaches = [...result.data].sort((a, b) => {
            const distA = calculateDistance(
              latitude,
              longitude,
              a.latitude,
              a.longitude,
              "miles"
            );
            const distB = calculateDistance(
              latitude,
              longitude,
              b.latitude,
              b.longitude,
              "miles"
            );
            return distA - distB;
          });

          // Select the nearest beach
          const nearestBeach = sortedBeaches[0];
          setBeach(nearestBeach);

          // Display distance in debug info
          const distance = calculateDistance(
            latitude,
            longitude,
            nearestBeach.latitude,
            nearestBeach.longitude,
            "miles"
          ).toFixed(1);

          setDebugInfo(
            `Found nearest beach within ${MAX_DISTANCE_MILES} miles: ${nearestBeach.name} (${distance} miles away)`
          );

          // Get forecast for nearest beach
          await fetchForecastForBeach(nearestBeach);
        } else {
          // If no beach found within 30 miles, use Ocean Beach as default
          setError(
            `No beaches found within ${MAX_DISTANCE_MILES} miles of your location. Showing Ocean Beach, San Diego instead.`
          );
          await fetchOceanBeachData();
        }
      } catch (err) {
        console.error("Error fetching nearby beaches:", err);
        setError(
          "Failed to find beaches near your location. Showing Ocean Beach, San Diego instead."
        );
        await fetchOceanBeachData();
      }
    },
    [fetchForecastForBeach, fetchOceanBeachData]
  );

  // Search for beaches by name - stable with no dependencies
  const searchBeachesByName = useCallback(
    async (searchText: string): Promise<Beach | null> => {
      try {
        // Get all beaches first
        const allBeachesResult = await getBeaches();

        if (!allBeachesResult.success || !allBeachesResult.data) {
          return null;
        }

        // Normalize the search text (lowercase, trim whitespace)
        const normalizedSearch = searchText.toLowerCase().trim();

        // Look for exact or partial matches
        const matchingBeaches = allBeachesResult.data.filter((beach) => {
          const beachName = beach.name.toLowerCase();
          const beachLocation = (beach.location || "").toLowerCase();

          // Check for matches in name or location
          return (
            beachName.includes(normalizedSearch) ||
            beachLocation.includes(normalizedSearch)
          );
        });

        if (matchingBeaches.length > 0) {
          // Return the first match
          return matchingBeaches[0];
        }

        return null;
      } catch (error) {
        console.error("Error searching beaches by name:", error);
        return null;
      }
    },
    []
  );

  // Get user's current location - stable dependencies
  const getCurrentLocation = useCallback(async () => {
    setState("loading");
    setError(null);
    setDebugInfo(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setState("input");
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await fetchBeachesNearLocation(latitude, longitude);
        },
        (err) => {
          console.error("Error getting location:", err);
          setError(
            "Unable to get your location. Please try entering it manually."
          );
          setState("input");
        }
      );
    } catch (err) {
      console.error("Error:", err);
      setError(
        "An error occurred. Please try entering your location manually."
      );
      setState("input");
    }
  }, [fetchBeachesNearLocation]);

  // Handle manual location input submission - stable dependencies
  const handleManualSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setState("loading");
      setError(null);
      setDebugInfo(null);

      try {
        if (!location.trim()) {
          // Try to get user's location if no input provided
          await getCurrentLocation();
          return;
        }

        setDebugInfo(`Searching for: ${location}`);

        // First, try to find beaches by name match
        const beachByNameResult = await searchBeachesByName(location);

        if (beachByNameResult) {
          // We found a beach by name, use it
          setBeach(beachByNameResult);
          setDebugInfo(`Found beach by name: ${beachByNameResult.name}`);
          await fetchForecastForBeach(beachByNameResult);
        } else {
          // No beach found by name, treat as location coordinates
          setDebugInfo(
            `No beach found by name. Treating "${location}" as location coordinates.`
          );

          // In a real app, we would use a geocoding service here
          // For now, use Ocean Beach coordinates but in a real app would use geocoded location
          await fetchBeachesNearLocation(OCEAN_BEACH_LAT, OCEAN_BEACH_LNG);
        }
      } catch (err) {
        console.error("Error with location search:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setDebugInfo(`Location search error: ${errorMessage}`);
        setError(
          "Unable to find that location. Showing Ocean Beach, San Diego instead."
        );
        await fetchOceanBeachData();
      }
    },
    [
      location,
      getCurrentLocation,
      searchBeachesByName,
      fetchForecastForBeach,
      fetchBeachesNearLocation,
      fetchOceanBeachData,
    ]
  );

  // Reset to initial state - stable with no dependencies
  const reset = useCallback(() => {
    setState("initial");
    setLocation("");
    setError(null);
    setDebugInfo(null);
    setBeach(null);
    setForecast(null);
    // Reset the flag to allow initial load again
    hasInitialLoaded.current = false;
  }, []);

  // Refresh forecast data from API - stable with no dependencies
  const refreshForecast = useCallback(
    async (beachId: string) => {
      await refreshForecastById(beachId);
    },
    [refreshForecastById]
  );

  // For developers: test the API connection directly
  const testApiConnection = useCallback(async () => {
    setIsRefreshing(true);
    setDebugInfo("Testing API connection...");

    try {
      // Call our API with debug option enabled
      const result = await updateBeachForecastData(undefined, true);

      if (result.success) {
        setDebugInfo(
          `API connection successful: ${JSON.stringify(result, null, 2)}`
        );
      } else {
        setDebugInfo(
          `API connection failed: ${
            result.error || "Unknown error"
          }\n\nDetails: ${JSON.stringify(result.details || {}, null, 2)}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setDebugInfo(`Error testing API: ${errorMessage}`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial load effect - FIXED: Prevent infinite loops with stable function
  const handleInitialLoad = useCallback(async () => {
    if (hasInitialLoaded.current) return;
    hasInitialLoaded.current = true;

    setState("loading");
    setError(null);
    setDebugInfo(null);

    try {
      // Load Ocean Beach data as default - don't trigger manual submit
      await fetchOceanBeachData();
    } catch (error) {
      console.error("Error in initial load:", error);
      setError("Unable to load initial forecast data");
      setState("error");
    }
  }, [fetchOceanBeachData]);

  // On mount, try to get Ocean Beach forecast if state is initial
  // FIXED: Remove dependency on handleManualSubmit to prevent infinite loop
  useEffect(() => {
    if (state === "initial") {
      handleInitialLoad();
    }
  }, [state, handleInitialLoad]);

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {state === "initial" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Find Surf Forecast</h3>
            <p className="text-muted-foreground">
              To show you surf conditions at the beach nearest to you, I can
              either detect your current location or you can type in a city, ZIP
              code, or beach name.
            </p>
            <div className="flex flex-col space-y-2">
              <Button
                onClick={getCurrentLocation}
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Use my current location
              </Button>
              <Button
                variant="outline"
                onClick={() => setState("input")}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                I'll enter it manually
              </Button>
            </div>
          </div>
        )}

        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">
              Finding the closest beach with surf conditions...
            </p>
          </div>
        )}

        {state === "input" && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <h3 className="text-lg font-medium">Enter Your Location</h3>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ocean Beach, San Diego"
                  className="pl-9"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <Button type="submit">Search</Button>
            </div>
            <Button variant="ghost" onClick={reset} size="sm" className="mt-2">
              Back
            </Button>
          </form>
        )}

        {state === "results" && beach && forecast && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Surf Conditions</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshForecast(beach.id)}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Refresh
                </Button>
                <Button variant="ghost" onClick={reset} size="sm">
                  Search Again
                </Button>
              </div>
            </div>

            {error && (
              <div className="text-amber-500 text-sm p-2 bg-amber-50 rounded-md">
                {error}
                {debugInfo && (
                  <details className="mt-1 text-xs text-gray-500">
                    <summary>Debug Info</summary>
                    <pre className="whitespace-pre-wrap">{debugInfo}</pre>
                  </details>
                )}
              </div>
            )}

            {!error && beach.name.toLowerCase().includes("ocean beach") && (
              <div className="text-blue-600 text-sm p-2 bg-blue-50 rounded-md">
                Showing surf conditions for Ocean Beach, San Diego.
              </div>
            )}

            {!error && !beach.name.toLowerCase().includes("ocean beach") && (
              <div className="text-green-600 text-sm p-2 bg-green-50 rounded-md">
                Showing surf conditions for {beach.name}, your nearest beach.
              </div>
            )}

            <ForecastCard
              beachName={beach.name}
              waveHeight={forecast.wave_height || "No data"}
              waterTemp={forecast.water_temp}
              windSpeed={forecast.wind_speed}
              tide={forecast.tide || "Unknown"}
              time={formatForecastTimeDetailed(
                forecast.forecast_date,
                forecast.forecast_time
              )}
              windDirection={forecast.wind_direction || undefined}
              weatherCondition={forecast.weather_condition || undefined}
              variant="legacy"
            />

            {/* Debug information for developers */}
            {!error && debugInfo && (
              <details className="mt-2 text-xs text-gray-500">
                <summary>Debug Info</summary>
                <pre className="whitespace-pre-wrap">{debugInfo}</pre>
              </details>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Unable to Load Forecast</h3>
            {error && (
              <div className="text-destructive text-sm p-2 bg-red-50 rounded-md">
                {error}
              </div>
            )}
            {debugInfo && (
              <details className="text-xs text-gray-500">
                <summary>Debug Info</summary>
                <pre className="whitespace-pre-wrap">{debugInfo}</pre>
              </details>
            )}
            <div className="flex gap-2">
              <Button onClick={reset} variant="outline">
                Try Again
              </Button>
              <Button onClick={testApiConnection} variant="ghost" size="sm">
                Test API Connection
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/20 px-6 py-4">
        <div className="text-xs text-muted-foreground">
          Enhanced forecast data from NOAA WaveWatch III, CO-OPS tidal
          predictions, and real-time buoy conditions.
        </div>
      </CardFooter>
    </Card>
  );
}
