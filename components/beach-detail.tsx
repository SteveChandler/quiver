"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { TideChart } from "@/components/forecast/tide-chart";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface BeachDetailProps {
  id: string;
}

export function BeachDetail({ id }: BeachDetailProps) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Single data fetch - 10-day enhanced forecast
  const fetchForecasts = useCallback(async () => {
    console.log("🚀 Starting fresh forecast fetch for beach:", id);
    const result = await getEnhancedBeachForecasts(id, 10);
    if (result.success && result.data) {
      console.log("🔍 Raw forecast data:", {
        totalForecasts: result.data.length,
        dateRange: {
          first: result.data[0]?.forecast_date,
          last: result.data[result.data.length - 1]?.forecast_date,
        },
        sampleForecast: result.data[0],
        uniqueDates: [...new Set(result.data.map((f) => f.forecast_date))],
        forecastsByDate: result.data.reduce((acc, f) => {
          acc[f.forecast_date] = (acc[f.forecast_date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch forecasts");
  }, [id]);

  const {
    data: forecasts,
    loading,
    error,
    refetch,
  } = useDataFetcher(fetchForecasts, {
    immediate: true,
  });

  // Process data for display
  const forecastsByDate: Record<string, EnhancedForecastEntity[]> = {};

  if (forecasts) {
    console.log("📊 Processing forecasts:", {
      totalForecasts: forecasts.length,
      firstForecast: forecasts[0],
    });

    // Group forecasts by date
    forecasts.forEach((forecast) => {
      const date = forecast.forecast_date;
      if (!forecastsByDate[date]) {
        forecastsByDate[date] = [];
      }
      forecastsByDate[date].push(forecast);
    });

    console.log("📅 Grouped forecasts by date:", {
      dates: Object.keys(forecastsByDate),
      forecastsPerDate: Object.entries(forecastsByDate).map(
        ([date, forecasts]) => ({
          date,
          count: forecasts.length,
          firstForecast: forecasts[0]?.wave_height,
        })
      ),
    });
  }

  // Get the first day's forecast for overview
  const sortedDates = Object.keys(forecastsByDate).sort();
  const selectedDayData = selectedDay ? forecastsByDate[selectedDay] : null;
  const selectedDayForecast = selectedDayData?.[0];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !forecasts) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">
            {error || "Beach forecast not found"}
          </h2>
          <Button onClick={() => router.push("/map")}>Back to Map</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center h-16 px-4 max-w-7xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/map")}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Beach Details</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-2xl md:text-3xl font-extrabold mb-6 text-center">
          Multi-Day Tide Flow
        </h1>

        {/* Debug Info */}
        <div className="mb-6 p-3 bg-blue-100 rounded text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <strong>Debug Info:</strong> Found {forecasts?.length || 0}{" "}
              forecasts across multiple days, Today:{" "}
              {new Date().toISOString().split("T")[0]}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                console.log("🔄 Force refreshing forecasts...");
                refetch();
              }}
            >
              Force Refresh
            </Button>
          </div>
        </div>

        {/* Enhanced Tide Chart - Shows complete multi-day tide flow */}
        <div className="mb-8">
          <TideChart forecasts={forecasts} className="rounded-2xl shadow-lg" />
        </div>

        {/* Today's Overview (First Day) */}
        {forecasts && forecasts.length > 0 && (
          <Card className="rounded-2xl shadow-lg mb-8 bg-white">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-semibold">
                Today's Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div>
                  <strong>Wave Height:</strong>{" "}
                  {forecasts[0].wave_height || "N/A"}
                </div>
                <div>
                  <strong>Wave Period:</strong>{" "}
                  {forecasts[0].wave_period || "N/A"}
                </div>
                <div>
                  <strong>Water Temp:</strong> {forecasts[0].water_temp}°F
                </div>
                <div>
                  <strong>Wind Speed:</strong> {forecasts[0].wind_speed}
                </div>
                <div>
                  <strong>Wind Dir:</strong> {forecasts[0].wind_direction}
                </div>
                <div>
                  <strong>Condition:</strong> {forecasts[0].weather_condition}
                </div>
                <div>
                  <strong>Tide Status:</strong> {forecasts[0].tide_status}
                </div>
                <div>
                  <strong>Confidence:</strong>{" "}
                  {Math.round(forecasts[0].confidence_score)}%
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Day Detail */}
        {selectedDay && selectedDayForecast && (
          <Card className="rounded-2xl shadow-lg mb-8 bg-blue-50 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-semibold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span>
                  Detailed Forecast -{" "}
                  {new Date(selectedDay).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDay(null)}
                >
                  Close
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                <div>
                  <strong>Wave Height:</strong>{" "}
                  {selectedDayForecast.wave_height || "N/A"}
                </div>
                <div>
                  <strong>Wave Period:</strong>{" "}
                  {selectedDayForecast.wave_period || "N/A"}
                </div>
                <div>
                  <strong>Water Temp:</strong> {selectedDayForecast.water_temp}
                  °F
                </div>
                <div>
                  <strong>Wind Speed:</strong> {selectedDayForecast.wind_speed}
                </div>
                <div>
                  <strong>Wind Dir:</strong>{" "}
                  {selectedDayForecast.wind_direction}
                </div>
                <div>
                  <strong>Condition:</strong>{" "}
                  {selectedDayForecast.weather_condition}
                </div>
                <div>
                  <strong>Tide Status:</strong>{" "}
                  {selectedDayForecast.tide_status}
                </div>
                <div>
                  <strong>Confidence:</strong>{" "}
                  {Math.round(selectedDayForecast.confidence_score)}%
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="swells">
                  <AccordionTrigger>Swell & Wind Wave Details</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <strong>Swell 1:</strong>
                        <br />
                        Height: {selectedDayForecast.swell_1_height || "N/A"}
                        <br />
                        Period: {selectedDayForecast.swell_1_period || "N/A"}
                        <br />
                        Dir: {selectedDayForecast.swell_1_direction || "N/A"}
                      </div>
                      <div>
                        <strong>Swell 2:</strong>
                        <br />
                        Height: {selectedDayForecast.swell_2_height || "N/A"}
                        <br />
                        Period: {selectedDayForecast.swell_2_period || "N/A"}
                        <br />
                        Dir: {selectedDayForecast.swell_2_direction || "N/A"}
                      </div>
                      <div>
                        <strong>Wind Wave:</strong>
                        <br />
                        Height: {selectedDayForecast.wind_wave_height || "N/A"}
                        <br />
                        Period: {selectedDayForecast.wind_wave_period || "N/A"}
                        <br />
                        Dir: {selectedDayForecast.wind_wave_direction || "N/A"}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Daily Forecast Cards */}
        <div className="space-y-6">
          <h2 className="text-xl md:text-2xl font-bold">Daily Forecasts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {sortedDates.map((date) => {
              const dayForecasts = forecastsByDate[date];
              const representative = dayForecasts[0];

              if (!representative) return null;

              const dateObj = new Date(date + "T12:00:00");
              const dayName = dateObj.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });

              return (
                <Card
                  key={date}
                  className={`rounded-2xl shadow-md bg-white cursor-pointer transition-all hover:shadow-lg ${
                    selectedDay === date ? "ring-2 ring-blue-500" : ""
                  }`}
                  onClick={() =>
                    setSelectedDay(selectedDay === date ? null : date)
                  }
                >
                  <CardHeader>
                    <CardTitle className="text-base md:text-lg font-medium">
                      {dayName} ({dayForecasts.length} forecasts)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="text-sm">
                        <strong>Wave Height:</strong>{" "}
                        {representative.wave_height || "N/A"}
                      </div>
                      <div className="text-sm">
                        <strong>Wave Period:</strong>{" "}
                        {representative.wave_period || "N/A"}
                      </div>
                      <div className="text-sm">
                        <strong>Water Temp:</strong> {representative.water_temp}
                        °F
                      </div>
                      <div className="text-sm">
                        <strong>Wind Speed:</strong> {representative.wind_speed}
                      </div>
                      <div className="text-sm">
                        <strong>Wind Dir:</strong>{" "}
                        {representative.wind_direction}
                      </div>
                      <div className="text-sm">
                        <strong>Condition:</strong>{" "}
                        {representative.weather_condition}
                      </div>
                      <div className="text-sm">
                        <strong>Tide Status:</strong>{" "}
                        {representative.tide_status}
                      </div>
                      <div className="text-sm">
                        <strong>Confidence:</strong>{" "}
                        {Math.round(representative.confidence_score)}%
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Click to see detailed swell information
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
