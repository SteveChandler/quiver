"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNavigation } from "@/components/bottom-navigation";
import { ForecastCard } from "@/components/forecast-card";
import { BeachCard } from "@/components/beach-card";
import { SessionCard } from "@/components/session-card";
import { ForecastPrompt } from "@/components/forecast-prompt";
import { BeachSearch } from "@/components/beach-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Waves, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { getBeaches, getNearbyBeaches } from "@/actions/beach-actions";
import { getBeachForecasts } from "@/actions/forecast-actions";
import { getAllSessions } from "@/actions/session-actions";
import type { Beach, Forecast, SessionWithDetails } from "@/types/database";

// Ocean Beach, San Diego coordinates
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;

// Cache keys and expiration time (30 minutes)
const CACHE_KEYS = {
  OCEAN_BEACH_FORECAST: "oceanBeachForecast",
  OCEAN_BEACH_TIMESTAMP: "oceanBeachTimestamp",
};
const CACHE_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState("forecast");
  const { user, isLoading: authLoading } = useAuth();
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [forecasts, setForecasts] = useState<{ [beachId: string]: Forecast[] }>(
    {}
  );
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForecastPrompt, setShowForecastPrompt] = useState(false);
  const [showBeachSearch, setShowBeachSearch] = useState(false);
  const [oceanBeach, setOceanBeach] = useState<Beach | null>(null);
  const [oceanBeachForecastData, setOceanBeachForecastData] =
    useState<any>(null);
  const [loadingOceanBeach, setLoadingOceanBeach] = useState(true);

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user?.email) return "G";
    return user.email.charAt(0).toUpperCase();
  };

  // Check if cached data is still valid
  const isCacheValid = () => {
    const timestamp = localStorage.getItem(CACHE_KEYS.OCEAN_BEACH_TIMESTAMP);
    if (!timestamp) return false;

    const cacheTime = parseInt(timestamp);
    const currentTime = Date.now();
    return currentTime - cacheTime < CACHE_EXPIRATION_MS;
  };

  // Load Ocean Beach forecast from cache or API
  const loadOceanBeachForecast = async () => {
    setLoadingOceanBeach(true);

    // Check cache first
    if (isCacheValid()) {
      const cachedData = localStorage.getItem(CACHE_KEYS.OCEAN_BEACH_FORECAST);
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          setOceanBeachForecastData(parsedData);
          setLoadingOceanBeach(false);
          return;
        } catch (error) {
          console.error("Error parsing cached data:", error);
        }
      }
    }

    // Fetch fresh data
    try {
      const response = await fetch("/api/surf?beach=Ocean Beach, San Diego");
      if (response.ok) {
        const data = await response.json();
        setOceanBeachForecastData(data);

        // Cache the data
        localStorage.setItem(
          CACHE_KEYS.OCEAN_BEACH_FORECAST,
          JSON.stringify(data)
        );
        localStorage.setItem(
          CACHE_KEYS.OCEAN_BEACH_TIMESTAMP,
          Date.now().toString()
        );
      }
    } catch (error) {
      console.error("Error fetching Ocean Beach forecast:", error);
    } finally {
      setLoadingOceanBeach(false);
    }
  };

  // Load Ocean Beach forecast immediately when component mounts
  useEffect(() => {
    loadOceanBeachForecast();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch beaches
        const beachesResult = await getBeaches();

        if (beachesResult.success && beachesResult.data) {
          setBeaches(beachesResult.data);

          // Find Ocean Beach
          const oceanBeachData = beachesResult.data.find((beach) =>
            beach.name.toLowerCase().includes("ocean beach")
          );

          if (oceanBeachData) {
            setOceanBeach(oceanBeachData);
          }

          // Get forecasts for top beaches
          const forecastsData: { [beachId: string]: Forecast[] } = {};

          // Limit to top 5 beaches to avoid too many API calls
          const beachesToFetch = beachesResult.data.slice(0, 5);

          // If we found Ocean Beach, make sure it's included
          if (
            oceanBeachData &&
            !beachesToFetch.some((beach) => beach.id === oceanBeachData.id)
          ) {
            beachesToFetch.pop(); // Remove the last beach
            beachesToFetch.unshift(oceanBeachData); // Add Ocean Beach at the beginning
          }

          for (const beach of beachesToFetch) {
            const forecastResult = await getBeachForecasts(beach.id);
            if (forecastResult.success && forecastResult.data) {
              forecastsData[beach.id] = forecastResult.data;
            }
          }

          setForecasts(forecastsData);
        }

        // Fetch all sessions for community tab
        const communitySessions = await getAllSessions(10);
        if (communitySessions) {
          setSessions(communitySessions);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <h1 className="text-2xl font-bold text-primary">Quiver</h1>
          <div className="flex items-center space-x-2">
            {authLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : user ? (
              <Link href="/profile">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src="/placeholder.svg?height=32&width=32"
                    alt="User"
                  />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Link href="/auth/sign-in">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6 space-y-6 overflow-auto">
        {/* Welcome Section */}
        <section className="space-y-2">
          <h2 className="text-2xl font-bold">
            Hey, {user ? user.user_metadata?.full_name || "Surfer" : "Guest"}!
          </h2>
          <p className="text-muted-foreground">
            The waves are looking good today. Ready to catch some?
          </p>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Link href="/plan-session">
            <Button
              className="h-auto py-4 flex flex-col items-center gap-2 w-full"
              variant="default"
            >
              <CalendarDays className="h-6 w-6" />
              <span>Plan Session</span>
            </Button>
          </Link>
          <Link href="/log-session">
            <Button
              className="h-auto py-4 flex flex-col items-center gap-2 w-full"
              variant="outline"
            >
              <Waves className="h-6 w-6" />
              <span>Log Session</span>
            </Button>
          </Link>
        </section>

        {/* Tabs Section */}
        <Tabs
          defaultValue="forecast"
          className="space-y-4"
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsList className="grid grid-cols-3 w-full max-w-2xl mx-auto ">
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="nearby">Nearby</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="space-y-4">
            {/* Search methods selection */}
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-center space-x-2 mb-4">
                <Button
                  variant={showBeachSearch ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShowBeachSearch(true);
                    setShowForecastPrompt(false);
                  }}
                >
                  Quick Search
                </Button>
                <Button
                  variant={showForecastPrompt ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShowForecastPrompt(true);
                    setShowBeachSearch(false);
                  }}
                >
                  Advanced Search
                </Button>
              </div>
            </div>

            {/* Display Ocean Beach forecast by default */}
            {!showBeachSearch && !showForecastPrompt && (
              <div className="max-w-2xl mx-auto ">
                <h3 className="text-lg font-semibold mb-4">
                  Search Beach Forecast
                </h3>

                {loadingOceanBeach ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : oceanBeachForecastData ? (
                  <div className="space-y-4">
                    <div className="bg-muted/20 p-4 rounded-lg border">
                      <Input
                        placeholder="Ocean Beach"
                        value="Ocean Beach"
                        readOnly
                        className="mb-4"
                      />
                      <Button className="w-full" disabled>
                        Search
                      </Button>
                    </div>

                    <div className="text-green-600 text-sm p-2 bg-green-50 rounded dark:bg-green-950 dark:text-green-400">
                      Showing surf conditions for Ocean Beach
                    </div>

                    <ForecastCard
                      beachName={oceanBeachForecastData.beach}
                      waveHeight={oceanBeachForecastData.forecast.wave_height}
                      waterTemp={oceanBeachForecastData.forecast.water_temp}
                      windSpeed={oceanBeachForecastData.forecast.wind_speed}
                      tide={oceanBeachForecastData.forecast.tide}
                      time={
                        oceanBeachForecastData.forecast.forecast_time
                          ? new Date(
                              oceanBeachForecastData.forecast.forecast_date +
                                "T" +
                                oceanBeachForecastData.forecast.forecast_time
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : new Date().toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                      }
                      windDirection={
                        oceanBeachForecastData.forecast.wind_direction
                      }
                      weatherCondition={
                        oceanBeachForecastData.forecast.weather_condition ||
                        "Sunny"
                      }
                    />

                    <div className="text-xs text-muted-foreground p-2">
                      Data provided for San Diego beaches. Results show the
                      beach that most closely matches your search.
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Unable to load Ocean Beach forecast
                  </div>
                )}
              </div>
            )}

            {showBeachSearch && (
              <div className="max-w-2xl mx-auto ">
                <BeachSearch />
              </div>
            )}

            {showForecastPrompt && (
              <div className="max-w-2xl mx-auto ">
                <ForecastPrompt />
              </div>
            )}
          </TabsContent>

          <TabsContent value="nearby" className="space-y-4">
            <div className="max-w-2xl mx-auto  space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : beaches.length > 0 ? (
                beaches.slice(0, 5).map((beach) => (
                  <BeachCard
                    key={beach.id}
                    name={beach.name}
                    distance={`${Math.floor(Math.random() * 20) + 1} miles`} // Placeholder distance
                    rating={4.0}
                    reviewCount={Math.floor(Math.random() * 200) + 50} // Placeholder review count
                    imageUrl="/placeholder.svg?height=120&width=300"
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No beaches found nearby
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="community" className="space-y-4">
            <div className="max-w-2xl mx-auto  space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : sessions.length > 0 ? (
                sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    username={session.user?.full_name || "Anonymous Surfer"}
                    beachName={session.beach?.name || "Unknown Beach"}
                    date={
                      new Date(session.session_date).toLocaleDateString() +
                      ", " +
                      (session.start_time || "")
                    }
                    rating={session.wave_quality || 0}
                    description={session.notes || "No description provided."}
                    imageUrl={"/placeholder.svg?height=200&width=300"}
                    likes={0}
                    comments={0}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No community sessions found
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-20 right-4 z-10">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
