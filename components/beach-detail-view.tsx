"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, MapPin, Waves, Users, Car, Loader2 } from "lucide-react";
import { ForecastCard } from "@/components/forecast-card";
import { BeachHeader } from "@/components/beach-detail/beach-header";
import { BeachHero } from "@/components/beach-detail/beach-hero";
import { BeachQuickActions } from "@/components/beach-detail/beach-quick-actions";
import { TodaysForecast } from "@/components/beach-detail/todays-forecast";
import { BeachCommunity } from "@/components/beach-detail/beach-community";
import Link from "next/link";
import { getBeachById } from "@/actions/beach-actions";
import { getBeachForecasts } from "@/actions/forecast-actions";
import { getSessionsByBeach } from "@/actions/session-actions";
import type { Beach, Forecast, SessionWithDetails } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { formatForecastTime } from "@/lib/utils";
import { getStaticMapImageUrl } from "@/lib/map-utils";

interface BeachDetailViewProps {
  id: string;
}

export function BeachDetailView({ id }: BeachDetailViewProps) {
  const { user } = useAuth();
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  ); // Today's date

  useEffect(() => {
    async function loadBeachData() {
      setLoading(true);
      try {
        // Fetch beach details
        const beachResult = await getBeachById(id);
        if (beachResult.success && beachResult.data) {
          setBeach(beachResult.data);
        }

        // Fetch forecasts
        const forecastsResult = await getBeachForecasts(id);
        if (forecastsResult.success && forecastsResult.data) {
          setForecasts(forecastsResult.data);
        }
      } catch (error) {
        console.error("Error loading beach data:", error);
      } finally {
        setLoading(false);
      }
    }

    async function loadBeachSessions() {
      setSessionsLoading(true);
      try {
        // Fetch community sessions for this beach
        const sessionsResult = await getSessionsByBeach(id);
        if (sessionsResult.success && sessionsResult.data) {
          setSessions(sessionsResult.data);
        }
      } catch (error) {
        console.error("Error loading beach sessions:", error);
      } finally {
        setSessionsLoading(false);
      }
    }

    loadBeachData();
    loadBeachSessions();
  }, [id]);

  // Group forecasts by date
  const forecastDates = [
    ...new Set(forecasts.map((f) => f.forecast_date)),
  ].sort();

  // Get forecasts for selected date
  const selectedDateForecasts = forecasts.filter(
    (f) => f.forecast_date === selectedDate
  );

  // Get today's forecast for prominent display
  const todaysForecast = forecasts.find(
    (f) => f.forecast_date === new Date().toISOString().split("T")[0]
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!beach) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Beach not found</h2>
          <Link href="/map">
            <Button>Back to Map</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <BeachHeader beachName={beach.name} />

      {/* Hero Image */}
      <BeachHero
        beach={beach}
        mapImageUrl={getStaticMapImageUrl(
          typeof beach.latitude === "number" ? beach.latitude : 32.7507,
          typeof beach.longitude === "number" ? beach.longitude : -117.254,
          {
            width: 800,
            height: 400,
            zoom: 14,
          }
        )}
      />

      {/* Quick Actions */}
      <BeachQuickActions beach={beach} isAuthenticated={!!user} />

      {/* Main Content */}
      <main className="flex-1 container px-4 py-2 space-y-6 overflow-auto pb-20">
        {/* Today's Forecast - Prominent Display */}
        <TodaysForecast forecast={todaysForecast} />

        {/* Community Section */}
        <BeachCommunity
          beach={beach}
          sessions={sessions}
          isLoading={sessionsLoading}
          isAuthenticated={!!user}
        />

        {/* Detailed Tabs */}
        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="forecast">More Forecasts</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="space-y-4">
            {forecastDates.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2 overflow-x-auto pb-2">
                  {forecastDates.slice(0, 5).map((date) => (
                    <Card
                      key={date}
                      className={`cursor-pointer ${
                        selectedDate === date ? "border-primary" : ""
                      }`}
                      onClick={() => setSelectedDate(date)}
                    >
                      <CardContent className="p-3">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">
                            {date === new Date().toISOString().split("T")[0]
                              ? "Today"
                              : formatDate(date)}
                          </p>
                          <p className="text-lg font-medium">
                            {new Date(date).toLocaleDateString("en-US", {
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedDateForecasts.length > 0 ? (
                  selectedDateForecasts.map((forecast) => (
                    <ForecastCard
                      key={forecast.id}
                      beachName={formatForecastTime(
                        forecast.forecast_date,
                        forecast.forecast_time
                      )}
                      waveHeight={forecast.wave_height}
                      waterTemp={forecast.water_temp}
                      windSpeed={forecast.wind_speed}
                      tide={forecast.tide || "Unknown"}
                      time={formatForecastTime(
                        forecast.forecast_date,
                        forecast.forecast_time
                      )}
                      windDirection={forecast.wind_direction || undefined}
                      weatherCondition={forecast.weather_condition || undefined}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No forecast data available for this date
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No forecast data available
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Beach Information</h3>
                <p className="text-sm">
                  {beach.description || "No description available."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-medium">Ratings & Reviews</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Wave Quality
                      </p>
                      <div className="flex">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.round(beach.wave_quality_rating || 0)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Crowd Density
                      </p>
                      <div className="flex">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.round(beach.crowd_density_rating || 0)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Parking</p>
                      <div className="flex">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.round(beach.parking_rating || 0)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Accessibility
                      </p>
                      <div className="flex">
                        {Array(5)
                          .fill(0)
                          .map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.round(beach.accessibility_rating || 0)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="w-full mt-2">
                  View All Reviews
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gallery" className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="aspect-square relative rounded-md overflow-hidden bg-muted"
                >
                  <img
                    src={`/placeholder.svg?height=200&width=200`}
                    alt={`Gallery image ${i}`}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full">
              View All Photos
            </Button>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
