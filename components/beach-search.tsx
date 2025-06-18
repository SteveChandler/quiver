"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { ForecastCard } from "@/components/forecast-card";
import { useAuth } from "@/context/auth-context";
import { getBeachById } from "@/actions/beach-actions";
import type { Beach, Profile } from "@/types/database";

interface BeachSearchProps {
  profile?: Profile | null;
}

/**
 * Beach search component that uses enhanced forecast data
 */
export function BeachSearch({ profile }: BeachSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWaitingForProfile, setIsWaitingForProfile] = useState(true);

  // Fetch beach data using utility functions
  const fetchBeachData = async (beachName: string) => {
    setLoading(true);
    setError(null);
    setBeach(null);
    setForecast(null);

    try {
      const { searchBeachWithForecast } = await import(
        "@/lib/utils/beach-search-utils"
      );
      const { beach: foundBeach, forecast: enhancedForecast } =
        await searchBeachWithForecast(beachName);

      setBeach(foundBeach);
      setForecast(enhancedForecast);
    } catch (err) {
      console.error("Error fetching beach forecast:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
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

    try {
      const result = await getBeachById(beachId);

      if (result.success && result.data) {
        const favoriteBeach = result.data;
        setQuery(favoriteBeach.name);
        await fetchBeachData(favoriteBeach.name);
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
    }
  };

  // Fetch beach by name when we have favorite_spot but no default_beach_id
  const fetchBeachByName = async (beachName: string) => {
    setLoading(true);
    setError(null);
    setBeach(null);
    setForecast(null);

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

    await fetchBeachData(query);
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
            <div className="text-green-600 text-sm p-2 bg-green-50 rounded mb-4">
              {user &&
              profile?.default_beach_id &&
              beach.id === profile.default_beach_id
                ? `Showing surf conditions for your favorite beach: ${beach.name}`
                : `Showing surf conditions for ${beach.name}`}
              {beach.location && `, ${beach.location}`}
            </div>

            <ForecastCard
              beachName={beach.name}
              waveHeight={forecast.wave_height}
              waterTemp={forecast.water_temp}
              windSpeed={forecast.wind_speed}
              tide={forecast.tide_status || "Unknown"}
              time={
                forecast.forecast_time
                  ? new Date(
                      forecast.forecast_date + "T" + forecast.forecast_time
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
              }
              windDirection={forecast.wind_direction}
              weatherCondition={forecast.weather_condition}
              beachId={beach.id}
            />
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
