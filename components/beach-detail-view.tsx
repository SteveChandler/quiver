"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Star,
  MapPin,
  Waves,
  Users,
  Car,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { ForecastCard } from "@/components/forecast-card";
import { SessionCard } from "@/components/session-card";
import Link from "next/link";
import Image from "next/image";
import { getBeachById } from "@/actions/beach-actions";
import { getBeachForecasts } from "@/actions/forecast-actions";
import type { Beach, Forecast } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { formatForecastTime } from "@/lib/utils";

interface BeachDetailViewProps {
  id: string;
}

export function BeachDetailView({ id }: BeachDetailViewProps) {
  const { user } = useAuth();
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
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

    loadBeachData();
  }, [id]);

  // Group forecasts by date
  const forecastDates = [
    ...new Set(forecasts.map((f) => f.forecast_date)),
  ].sort();

  // Get forecasts for selected date
  const selectedDateForecasts = forecasts.filter(
    (f) => f.forecast_date === selectedDate
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
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center h-16 px-4">
          <Link href="/map" className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">{beach.name}</h1>
        </div>
      </header>

      {/* Hero Image */}
      <div className="relative h-48">
        <Image
          src="/placeholder.svg?height=400&width=800"
          alt={beach.name}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4 text-white">
          <h2 className="text-2xl font-bold">{beach.name}</h2>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{beach.location}</span>
          </div>
          <div className="flex items-center mt-1">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(beach.wave_quality_rating || 0)
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-gray-300"
                  }`}
                />
              ))}
            <span className="ml-1">(128 reviews)</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 flex gap-2">
        <Link
          href={user ? `/plan-session?beach=${beach.id}` : "/auth/sign-in"}
          className="flex-1"
        >
          <Button className="w-full">
            <CalendarDays className="h-4 w-4 mr-1" />
            Plan Session
          </Button>
        </Link>
        <Link
          href={user ? `/log-session?beach=${beach.id}` : "/auth/sign-in"}
          className="flex-1"
        >
          <Button variant="outline" className="w-full">
            <Waves className="h-4 w-4 mr-1" />
            Log Session
          </Button>
        </Link>
      </div>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-2 space-y-6 overflow-auto pb-20">
        {/* Tabs */}
        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
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
                      windDirection={forecast.wind_direction}
                      weatherCondition={forecast.weather_condition}
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

            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-medium">Recent Sessions</h3>

                <SessionCard
                  username="SurfDude92"
                  beachName={beach.name}
                  date="Today, 8:30 AM"
                  rating={5}
                  description="Perfect morning session! Glassy conditions and consistent sets."
                  imageUrl="/placeholder.svg?height=200&width=300"
                  likes={24}
                  comments={8}
                />

                <Button variant="outline" size="sm" className="w-full">
                  View More Sessions
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
