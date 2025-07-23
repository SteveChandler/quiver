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
import { TideChart } from "@/components/forecast/tide-chart-recharts";
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sandy-beige via-white to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-blue" />
      </div>
    );
  }

  if (error || !forecasts) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sandy-beige via-white to-blue-50">
        <div className="text-center">
          <h2 className="text-xl font-roboto font-bold mb-2 text-dark-grey">
            {error || "Beach forecast not found"}
          </h2>
          <Button
            onClick={() => router.push("/map")}
            className="bg-ocean-blue hover:bg-ocean-blue/90"
          >
            Back to Map
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container flex items-center h-16 px-4 max-w-7xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/map")}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-roboto font-bold text-dark-grey">
            Beach Details
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl md:text-4xl font-roboto font-extrabold mb-8 text-center bg-gradient-to-r from-ocean-blue to-blue-600 bg-clip-text text-transparent">
          Multi-Day Tide Flow
        </h1>

        {/* Enhanced Tide Chart - Shows complete multi-day tide flow */}
        <div className="mb-8">
          <TideChart
            forecasts={forecasts}
            className="rounded-2xl shadow-xl border-0 overflow-hidden bg-white/90 backdrop-blur-sm"
          />
        </div>

        {/* Today's Overview (First Day) */}
        {forecasts && forecasts.length > 0 && (
          <Card className="rounded-2xl shadow-xl mb-8 bg-gradient-to-br from-white to-blue-50 border-ocean-blue/20 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-ocean-blue to-blue-600 text-white rounded-t-2xl">
              <CardTitle className="text-xl md:text-2xl font-roboto font-bold">
                Today's Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div className="bg-ocean-blue/10 p-3 rounded-lg border border-ocean-blue/20">
                  <strong className="font-roboto text-ocean-blue">
                    Wave Height:
                  </strong>{" "}
                  <span className="font-open-sans text-ocean-blue/80">
                    {forecasts[0].wave_height || "N/A"}
                  </span>
                </div>
                <div className="bg-ocean-blue/10 p-3 rounded-lg border border-ocean-blue/20">
                  <strong className="font-roboto text-ocean-blue">
                    Wave Period:
                  </strong>{" "}
                  <span className="font-open-sans text-ocean-blue/80">
                    {forecasts[0].wave_period || "N/A"}
                  </span>
                </div>
                <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                  <strong className="font-roboto text-blue-700">
                    Water Temp:
                  </strong>{" "}
                  <span className="font-open-sans text-blue-600">
                    {forecasts[0].water_temp}°F
                  </span>
                </div>
                <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                  <strong className="font-roboto text-blue-700">
                    Wind Speed:
                  </strong>{" "}
                  <span className="font-open-sans text-blue-600">
                    {forecasts[0].wind_speed}
                  </span>
                </div>
                <div className="bg-cyan-50/70 p-3 rounded-lg border border-cyan-200">
                  <strong className="font-roboto text-cyan-700">
                    Wind Dir:
                  </strong>{" "}
                  <span className="font-open-sans text-cyan-600">
                    {forecasts[0].wind_direction}
                  </span>
                </div>
                <div className="bg-cyan-50/70 p-3 rounded-lg border border-cyan-200">
                  <strong className="font-roboto text-cyan-700">
                    Condition:
                  </strong>{" "}
                  <span className="font-open-sans text-cyan-600">
                    {forecasts[0].weather_condition}
                  </span>
                </div>
                <div className="bg-teal-50/70 p-3 rounded-lg border border-teal-200">
                  <strong className="font-roboto text-teal-700">
                    Tide Status:
                  </strong>{" "}
                  <span className="font-open-sans text-teal-600">
                    {forecasts[0].tide_status}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                  <strong className="font-roboto text-emerald-700">
                    Confidence:
                  </strong>{" "}
                  <span className="font-open-sans text-emerald-600">
                    {Math.round(forecasts[0].confidence_score)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Day Detail */}
        {selectedDay && selectedDayForecast && (
          <Card className="rounded-2xl shadow-xl mb-8 bg-gradient-to-br from-ocean-blue/5 to-blue-50 border-2 border-ocean-blue/30 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-ocean-blue to-blue-700 text-white rounded-t-2xl">
              <CardTitle className="text-lg md:text-xl font-roboto font-bold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  Close
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                <div className="bg-ocean-blue/10 p-3 rounded-lg border border-ocean-blue/20">
                  <strong className="font-roboto text-ocean-blue">
                    Wave Height:
                  </strong>{" "}
                  <span className="font-open-sans text-ocean-blue/80">
                    {selectedDayForecast.wave_height || "N/A"}
                  </span>
                </div>
                <div className="bg-ocean-blue/10 p-3 rounded-lg border border-ocean-blue/20">
                  <strong className="font-roboto text-ocean-blue">
                    Wave Period:
                  </strong>{" "}
                  <span className="font-open-sans text-ocean-blue/80">
                    {selectedDayForecast.wave_period || "N/A"}
                  </span>
                </div>
                <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                  <strong className="font-roboto text-blue-700">
                    Water Temp:
                  </strong>{" "}
                  <span className="font-open-sans text-blue-600">
                    {selectedDayForecast.water_temp}°F
                  </span>
                </div>
                <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                  <strong className="font-roboto text-blue-700">
                    Wind Speed:
                  </strong>{" "}
                  <span className="font-open-sans text-blue-600">
                    {selectedDayForecast.wind_speed}
                  </span>
                </div>
                <div className="bg-cyan-50/70 p-3 rounded-lg border border-cyan-200">
                  <strong className="font-roboto text-cyan-700">
                    Wind Dir:
                  </strong>{" "}
                  <span className="font-open-sans text-cyan-600">
                    {selectedDayForecast.wind_direction}
                  </span>
                </div>
                <div className="bg-cyan-50/70 p-3 rounded-lg border border-cyan-200">
                  <strong className="font-roboto text-cyan-700">
                    Condition:
                  </strong>{" "}
                  <span className="font-open-sans text-cyan-600">
                    {selectedDayForecast.weather_condition}
                  </span>
                </div>
                <div className="bg-teal-50/70 p-3 rounded-lg border border-teal-200">
                  <strong className="font-roboto text-teal-700">
                    Tide Status:
                  </strong>{" "}
                  <span className="font-open-sans text-teal-600">
                    {selectedDayForecast.tide_status}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                  <strong className="font-roboto text-emerald-700">
                    Confidence:
                  </strong>{" "}
                  <span className="font-open-sans text-emerald-600">
                    {Math.round(selectedDayForecast.confidence_score)}%
                  </span>
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="swells" className="border-ocean-blue/20">
                  <AccordionTrigger className="font-roboto text-ocean-blue hover:text-ocean-blue/80">
                    Swell & Wind Wave Details
                  </AccordionTrigger>
                  <AccordionContent className="bg-white/60 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-ocean-blue/10 p-4 rounded-lg border border-ocean-blue/20">
                        <strong className="font-roboto text-ocean-blue">
                          Swell 1:
                        </strong>
                        <br />
                        <span className="font-open-sans text-ocean-blue/80">
                          Height: {selectedDayForecast.swell_1_height || "N/A"}
                          <br />
                          Period: {selectedDayForecast.swell_1_period || "N/A"}
                          <br />
                          Dir: {selectedDayForecast.swell_1_direction || "N/A"}
                        </span>
                      </div>
                      <div className="bg-blue-50/70 p-4 rounded-lg border border-blue-200">
                        <strong className="font-roboto text-blue-700">
                          Swell 2:
                        </strong>
                        <br />
                        <span className="font-open-sans text-blue-600">
                          Height: {selectedDayForecast.swell_2_height || "N/A"}
                          <br />
                          Period: {selectedDayForecast.swell_2_period || "N/A"}
                          <br />
                          Dir: {selectedDayForecast.swell_2_direction || "N/A"}
                        </span>
                      </div>
                      <div className="bg-cyan-50/70 p-4 rounded-lg border border-cyan-200">
                        <strong className="font-roboto text-cyan-700">
                          Wind Wave:
                        </strong>
                        <br />
                        <span className="font-open-sans text-cyan-600">
                          Height:{" "}
                          {selectedDayForecast.wind_wave_height || "N/A"}
                          <br />
                          Period:{" "}
                          {selectedDayForecast.wind_wave_period || "N/A"}
                          <br />
                          Dir:{" "}
                          {selectedDayForecast.wind_wave_direction || "N/A"}
                        </span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* 10-Day Tide Chart */}
        {forecasts && forecasts.length > 0 && (
          <div className="mb-8">
            <TideChart forecasts={forecasts} />
          </div>
        )}

        {/* Daily Forecast Cards */}
        <div className="space-y-6">
          <h2 className="text-2xl md:text-3xl font-roboto font-bold bg-gradient-to-r from-ocean-blue to-blue-600 bg-clip-text text-transparent">
            Daily Forecasts
          </h2>
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
                  className={`rounded-2xl shadow-lg bg-gradient-to-br from-white to-blue-50/60 cursor-pointer transition-all hover:shadow-xl hover:scale-105 backdrop-blur-sm border-ocean-blue/20 ${
                    selectedDay === date
                      ? "ring-2 ring-ocean-blue shadow-2xl scale-105"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedDay(selectedDay === date ? null : date)
                  }
                >
                  <CardHeader className="bg-gradient-to-r from-ocean-blue to-blue-500 text-white rounded-t-2xl">
                    <CardTitle className="text-base md:text-lg font-roboto font-semibold">
                      {dayName} ({dayForecasts.length} forecasts)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="text-sm font-open-sans">
                        <strong className="font-roboto text-ocean-blue">
                          Wave Height:
                        </strong>{" "}
                        <span className="text-ocean-blue/80">
                          {representative.wave_height || "N/A"}
                        </span>
                      </div>
                      <div className="text-sm font-open-sans">
                        <strong className="font-roboto text-ocean-blue">
                          Wave Period:
                        </strong>{" "}
                        <span className="text-ocean-blue/80">
                          {representative.wave_period || "N/A"}
                        </span>
                      </div>
                      <div className="text-sm font-open-sans">
                        <strong className="font-roboto text-blue-700">
                          Water Temp:
                        </strong>{" "}
                        <span className="text-blue-600">
                          {representative.water_temp}°F
                        </span>
                      </div>
                      <div className="text-sm font-open-sans">
                        <strong className="font-roboto text-blue-700">
                          Wind Speed:
                        </strong>{" "}
                        <span className="text-blue-600">
                          {representative.wind_speed}
                        </span>
                      </div>
                      <div className="text-sm font-open-sans">
                        <strong className="font-roboto text-cyan-700">
                          Wind Dir:
                        </strong>{" "}
                        <span className="text-cyan-600">
                          {representative.wind_direction}
                        </span>
                      </div>
                      <div className="text-sm font-open-sans">
                        <strong className="font-roboto text-cyan-700">
                          Condition:
                        </strong>{" "}
                        <span className="text-cyan-600">
                          {representative.weather_condition}
                        </span>
                      </div>
                      <div className="text-sm font-open-sans">
                        <strong className="font-roboto text-teal-700">
                          Tide Status:
                        </strong>{" "}
                        <span className="text-teal-600">
                          {representative.tide_status}
                        </span>
                      </div>
                      <div className="text-sm font-open-sans">
                        <strong className="font-roboto text-emerald-700">
                          Confidence:
                        </strong>{" "}
                        <span className="text-emerald-600">
                          {Math.round(representative.confidence_score)}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 text-xs font-open-sans text-muted-foreground bg-ocean-blue/5 p-2 rounded border border-ocean-blue/10">
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
