"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { ForecastCard } from "@/components/forecast-card";
import type { Beach } from "@/types/database";

/**
 * Beach search component that uses enhanced forecast data
 */
export function BeachSearch() {
  const [query, setQuery] = useState("Ocean Beach");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecast, setForecast] = useState<any>(null);

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
    }
  };

  // Fetch Ocean Beach forecast on mount
  useEffect(() => {
    fetchBeachData("Ocean Beach");
  }, []);

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

        {!loading && beach && forecast && (
          <div className="mt-6">
            <div className="text-green-600 text-sm p-2 bg-green-50 rounded mb-4">
              Showing surf conditions for {beach.name}
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
