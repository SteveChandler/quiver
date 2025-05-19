"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { getPublicSessions } from "@/actions/session-actions";
import type { Beach, Forecast, SessionWithDetails } from "@/types/database";

// Ocean Beach, San Diego coordinates
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;

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
  const [showBeachSearch, setShowBeachSearch] = useState(true);
  const [oceanBeach, setOceanBeach] = useState<Beach | null>(null);

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user?.email) return "G";
    return user.email.charAt(0).toUpperCase();
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch beaches
        const beachesResult = await getBeaches();

        if (beachesResult.success && beachesResult.data) {
          setBeaches(beachesResult.data);

          // Find Ocean Beach
          const oceanBeachData = beachesResult.data.find(
            (beach) =>
              beach.name.toLowerCase().includes("ocean beach") &&
              beach.location.toLowerCase().includes("san diego")
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

        // Fetch public sessions
        const sessionsResult = await getPublicSessions(5);
        if (sessionsResult.success && sessionsResult.data) {
          setSessions(sessionsResult.data);
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
        <section className="grid grid-cols-2 gap-4">
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
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="nearby">Nearby</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="space-y-4">
            {/* Search methods selection */}
            <div className="flex space-x-2 mb-4">
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

            {showBeachSearch && <BeachSearch />}

            {showForecastPrompt && <ForecastPrompt />}

            {!showBeachSearch && !showForecastPrompt && loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !showBeachSearch &&
              !showForecastPrompt &&
              beaches.length > 0 &&
              Object.keys(forecasts).length > 0 ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Top Beaches</h3>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBeachSearch(true)}
                    >
                      Quick Search
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowForecastPrompt(true)}
                    >
                      Advanced Search
                    </Button>
                  </div>
                </div>

                {/* Show Ocean Beach first if we have it */}
                {oceanBeach &&
                  forecasts[oceanBeach.id] &&
                  forecasts[oceanBeach.id].length > 0 && (
                    <div className="mb-2">
                      <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-md mb-2">
                        Default Location: Ocean Beach, San Diego
                      </div>
                      <ForecastCard
                        key={oceanBeach.id}
                        beachName={oceanBeach.name}
                        waveHeight={forecasts[oceanBeach.id][0].wave_height}
                        waterTemp={forecasts[oceanBeach.id][0].water_temp}
                        windSpeed={forecasts[oceanBeach.id][0].wind_speed}
                        tide={forecasts[oceanBeach.id][0].tide || "Unknown"}
                        time={new Date(
                          forecasts[oceanBeach.id][0].forecast_date +
                            "T" +
                            forecasts[oceanBeach.id][0].forecast_time
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        windDirection={
                          forecasts[oceanBeach.id][0].wind_direction
                        }
                        weatherCondition={
                          forecasts[oceanBeach.id][0].weather_condition
                        }
                      />
                    </div>
                  )}

                {/* Show other beaches */}
                {Object.keys(forecasts)
                  .filter((id) => oceanBeach?.id !== id)
                  .map((beachId) => {
                    const beach = beaches.find((b) => b.id === beachId);
                    const forecast = forecasts[beachId][0];

                    if (!beach || !forecast) return null;

                    return (
                      <div key={beachId} className="mb-2">
                        <ForecastCard
                          beachName={beach.name}
                          waveHeight={forecast.wave_height}
                          waterTemp={forecast.water_temp}
                          windSpeed={forecast.wind_speed}
                          tide={forecast.tide || "Unknown"}
                          time={new Date(
                            forecast.forecast_date +
                              "T" +
                              forecast.forecast_time
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          windDirection={forecast.wind_direction}
                          weatherCondition={forecast.weather_condition}
                        />
                      </div>
                    );
                  })}
              </>
            ) : (
              !showBeachSearch &&
              !showForecastPrompt && (
                <div className="text-center py-8 text-muted-foreground">
                  No forecast data available
                </div>
              )
            )}
          </TabsContent>

          <TabsContent value="nearby" className="space-y-4">
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
                  rating={beach.wave_quality_rating || 4.0}
                  reviewCount={Math.floor(Math.random() * 200) + 50} // Placeholder review count
                  imageUrl="/placeholder.svg?height=120&width=300"
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No beaches found nearby
              </div>
            )}
          </TabsContent>

          <TabsContent value="community" className="space-y-4">
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
                    session.session_time
                  }
                  rating={session.rating}
                  description={
                    session.description || "No description provided."
                  }
                  imageUrl={
                    session.image_url || "/placeholder.svg?height=200&width=300"
                  }
                  likes={session.likes_count}
                  comments={session.comments_count}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No community sessions found
              </div>
            )}
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
