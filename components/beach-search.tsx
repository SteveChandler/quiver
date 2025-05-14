"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { ForecastCard } from "@/components/forecast-card";

/**
 * Beach search component that utilizes both the new API and existing components
 */
export function BeachSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beachData, setBeachData] = useState<{
    beach: string;
    coords: { lat: number; lng: number };
    forecast: any;
  } | null>(null);

  // Handle search submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/surf?beach=${encodeURIComponent(query)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch forecast");
      }

      setBeachData(data);
    } catch (err) {
      console.error("Error fetching beach forecast:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">Search Beach Forecast</h2>

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

        {!loading && beachData && (
          <div className="mt-6">
            <div className="text-green-600 text-sm p-2 bg-green-50 rounded mb-4">
              Showing surf conditions for {beachData.beach}
            </div>

            <ForecastCard
              beachName={beachData.beach}
              waveHeight={beachData.forecast.wave_height}
              waterTemp={beachData.forecast.water_temp}
              windSpeed={beachData.forecast.wind_speed}
              tide={beachData.forecast.tide}
              time={
                beachData.forecast.forecast_time
                  ? new Date(
                      beachData.forecast.forecast_date +
                        "T" +
                        beachData.forecast.forecast_time
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
              }
              windDirection={beachData.forecast.wind_direction}
              weatherCondition={beachData.forecast.weather_condition || "Sunny"}
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/20 px-6 py-4">
        <div className="text-xs text-muted-foreground">
          Data provided for San Diego beaches. Results show the beach that most
          closely matches your search.
        </div>
      </CardFooter>
    </Card>
  );
}
