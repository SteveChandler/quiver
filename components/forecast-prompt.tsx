"use client";

import { useState, useEffect } from "react";
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
import type { Beach, Forecast } from "@/types/database";

// Maximum distance in miles for nearby beaches
const MAX_DISTANCE_MILES = 30;

// Handling states for the component
type PromptState = "initial" | "loading" | "input" | "results" | "error";

// Mock forecast data in case API fails
const DEFAULT_FORECAST: Forecast = {
  id: "mock-forecast-1",
  beach_id: "ocean-beach",
  forecast_date: new Date().toISOString().split("T")[0],
  forecast_time: new Date().toTimeString().split(" ")[0],
  wave_height: "3-4 ft",
  water_temp: "68°F",
  wind_speed: "5 mph",
  wind_direction: "Offshore",
  tide: "Rising",
  weather_condition: "Sunny",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Default Ocean Beach data if database query fails
const DEFAULT_BEACH: Beach = {
  id: "ocean-beach",
  name: "Ocean Beach",
  location: "San Diego, CA",
  latitude: OCEAN_BEACH_LAT,
  longitude: OCEAN_BEACH_LNG,
  description: "A popular surf spot in San Diego",
  wave_quality_rating: 4.2,
  crowd_density_rating: 3.8,
  parking_rating: 3.5,
  accessibility_rating: 4.0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function ForecastPrompt() {
  const [state, setState] = useState<PromptState>("initial");
  const [location, setLocation] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // On mount, try to get Ocean Beach forecast if state is initial
  useEffect(() => {
    if (state === "initial") {
      handleManualSubmit(new Event("submit") as any);
    }
  }, []);

  // Get user's current location
  const getCurrentLocation = async () => {
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
  };

  // Get beaches near coordinates
  const fetchBeachesNearLocation = async (
    latitude: number,
    longitude: number
  ) => {
    try {
      // Try to find beaches within 30 miles
      const result = await getNearbyBeaches(
        latitude,
        longitude,
        MAX_DISTANCE_MILES
      );

      if (result.success && result.data && result.data.length > 0) {
        // Sort beaches by distance
        const sortedBeaches = [...result.data].sort((a, b) => {
          const distA = calculateDistance(
            latitude,
            longitude,
            a.latitude,
            a.longitude
          );
          const distB = calculateDistance(
            latitude,
            longitude,
            b.latitude,
            b.longitude
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
          nearestBeach.longitude
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
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (
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

  // Fetch forecast data for a beach
  const fetchForecastForBeach = async (beachData: Beach) => {
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
        await refreshForecast(beachData.id);
      }
    } catch (err) {
      console.error("Error fetching forecast:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setDebugInfo(`API Error: ${errorMessage}`);
      setError(
        `Error getting forecast for ${beachData.name}. Showing default data.`
      );

      // Use default forecast data if all else fails
      if (beachData.id === DEFAULT_BEACH.id) {
        setForecast(DEFAULT_FORECAST);
        setState("results");
      } else {
        // Try Ocean Beach as fallback
        await fetchOceanBeachData();
      }
    }
  };

  // Fetch Ocean Beach data (default location)
  const fetchOceanBeachData = async () => {
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
              b.location.toLowerCase().includes("san diego")
          ) || result.data[0];

        setBeach(oceanBeach);
        setDebugInfo(`Using fallback: ${oceanBeach.name}`);
        await fetchForecastForBeach(oceanBeach);
      } else {
        setDebugInfo("No beaches found near Ocean Beach coordinates");
        // If still no results, use hardcoded default data
        setBeach(DEFAULT_BEACH);
        setForecast(DEFAULT_FORECAST);
        setState("results");

        // Try to update forecast data in the background
        getDirectOceanBeachForecast().catch((e) => {
          setDebugInfo(
            `Error in background forecast update: ${
              e instanceof Error ? e.message : String(e)
            }`
          );
        });
      }
    } catch (err) {
      console.error("Error fetching Ocean Beach data:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setDebugInfo(`Ocean Beach lookup error: ${errorMessage}`);

      // Last resort - use hardcoded default data
      setBeach(DEFAULT_BEACH);
      setForecast(DEFAULT_FORECAST);
      setState("results");
    }
  };

  // Refresh forecast data from API
  const refreshForecast = async (beachId: string) => {
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

      // Use default forecast as a last resort
      if (beach?.id === DEFAULT_BEACH.id || !beach) {
        setBeach(DEFAULT_BEACH);
        setForecast(DEFAULT_FORECAST);
        setState("results");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle manual location input submission
  const handleManualSubmit = async (e: React.FormEvent) => {
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
  };

  // Search for beaches by name
  const searchBeachesByName = async (
    searchText: string
  ): Promise<Beach | null> => {
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
        const beachLocation = beach.location.toLowerCase();

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
  };

  // Reset to initial state
  const reset = () => {
    setState("initial");
    setLocation("");
    setError(null);
    setDebugInfo(null);
    setBeach(null);
    setForecast(null);
  };

  // For developers: test the API connection directly
  const testApiConnection = async () => {
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
  };

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
              waveHeight={forecast.wave_height}
              waterTemp={forecast.water_temp}
              windSpeed={forecast.wind_speed}
              tide={forecast.tide || "Unknown"}
              time={new Date(
                forecast.forecast_date + "T" + forecast.forecast_time
              ).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              windDirection={forecast.wind_direction}
              weatherCondition={forecast.weather_condition}
            />

            {/* Debug information for developers */}
            {!error && debugInfo && (
              <details className="mt-2 text-xs text-gray-500">
                <summary>Debug Info</summary>
                <pre className="whitespace-pre-wrap">{debugInfo}</pre>
              </details>
            )}

            {/* For developers: hidden API test button */}
            {process.env.NODE_ENV === "development" && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <details>
                  <summary className="text-xs text-gray-500 cursor-pointer">
                    Developer Options
                  </summary>
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testApiConnection}
                      disabled={isRefreshing}
                      className="text-xs"
                    >
                      {isRefreshing ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Test API Connection
                    </Button>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-md">
              <h3 className="font-medium mb-2">Error Loading Forecast</h3>
              <p>{error}</p>
              {debugInfo && (
                <details className="mt-4 text-xs text-gray-500">
                  <summary>Debug Info</summary>
                  <pre className="whitespace-pre-wrap">{debugInfo}</pre>
                </details>
              )}
              <Button onClick={reset} className="mt-4">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
