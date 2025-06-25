"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Info } from "lucide-react";
import { ForecastCard } from "@/components/forecast-card";
import { useAuth } from "@/context/auth-context";
import { getBeachById, getBeaches } from "@/actions/beach-actions";
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
  const [originalSearchQuery, setOriginalSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWaitingForProfile, setIsWaitingForProfile] = useState(true);
  const [showFallbackMessage, setShowFallbackMessage] = useState(false);
  const [availableBeaches, setAvailableBeaches] = useState<Beach[]>([]);
  const [loadingBeaches, setLoadingBeaches] = useState(false);

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

    // Track the original search query for fallback detection
    if (isUserSearch) {
      setOriginalSearchQuery(beachName);
      console.log("🔍 User searching for:", beachName);
    }

    try {
      const { searchBeachWithForecast } = await import(
        "@/lib/utils/beach-search-utils"
      );
      const { beach: foundBeach, forecast: enhancedForecast } =
        await searchBeachWithForecast(beachName);

      console.log("🏖️ Found beach:", foundBeach.name);
      setBeach(foundBeach);
      setForecast(enhancedForecast);

      // Check if we need to show a fallback message
      if (isUserSearch && !doesBeachMatchSearch(foundBeach.name, beachName)) {
        console.log("⚠️ Beach mismatch detected!");
        console.log("- Original search:", beachName);
        console.log("- Found beach:", foundBeach.name);
        console.log(
          "- Match result:",
          doesBeachMatchSearch(foundBeach.name, beachName)
        );
        setShowFallbackMessage(true);
      } else if (isUserSearch) {
        console.log("✅ Beach matches search");
      }
    } catch (err) {
      console.error("Error fetching beach forecast:", err);

      // If this is a user search that failed, try to show Ocean Beach with fallback message
      if (isUserSearch) {
        console.log("🔄 Search failed, attempting Ocean Beach fallback...");
        try {
          const { searchBeachWithForecast } = await import(
            "@/lib/utils/beach-search-utils"
          );
          const { beach: fallbackBeach, forecast: fallbackForecast } =
            await searchBeachWithForecast("Ocean Beach");

          console.log("🏖️ Fallback beach loaded:", fallbackBeach.name);
          setBeach(fallbackBeach);
          setForecast(fallbackForecast);
          setShowFallbackMessage(true);
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
            {/* Fallback message with beach suggestions */}
            {showFallbackMessage && originalSearchQuery && (
              <div className="flex items-start gap-2 text-blue-600 text-sm p-4 bg-blue-50 rounded-lg mb-4 border border-blue-200">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-2">
                    Beach "{originalSearchQuery}" not found
                  </p>
                  <p className="text-blue-600/80 mb-3">
                    We're showing you {beach.name} instead. Try searching for
                    one of these available beaches:
                  </p>

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
                          className="text-left text-xs bg-white hover:bg-blue-100 border border-blue-200 rounded px-2 py-1 transition-colors duration-200"
                        >
                          {availableBeach.name}
                        </button>
                      ))}
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

            <ForecastCard
              day="Today"
              date={new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              waveHeight={forecast.wave_height || "No data"}
              windSpeed={forecast.wind_speed}
              waterTemp={forecast.water_temp}
              waveDirection={forecast.wave_direction}
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
