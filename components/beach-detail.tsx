"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { TideChart } from "@/components/forecast/tide-chart-recharts";
import { BeachIntelSection } from "@/components/intel/beach-intel-section";
import { SessionForecastComparison } from "@/components/forecast/session-forecast-comparison";
import { DetailedSwellModal } from "@/components/beach-detail/detailed-swell-modal";
import { SpotConditionsSummary } from "@/components/forecast/spot-conditions-summary";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getBeachById } from "@/actions/beach/beach-query-actions";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

interface BeachDetailProps {
  id: string;
}

export function BeachDetail({ id }: BeachDetailProps) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch forecast calibration data
  const { sessionSnapshots } = useForecastCalibration({ beachId: id });

  // Fetch beach information
  const fetchBeach = useCallback(async () => {
    console.log("🏖️ Fetching beach data for:", id);
    const result = await getBeachById(id);
    if (result.success && result.data) {
      console.log("✅ Beach data:", result.data);
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch beach data");
  }, [id]);

  const {
    data: beach,
    loading: beachLoading,
    error: beachError,
  } = useDataFetcher(fetchBeach, {
    immediate: true,
  });

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
    loading: forecastsLoading,
    error: forecastsError,
    refetch,
  } = useDataFetcher(fetchForecasts, {
    immediate: true,
  });

  // New: normalized forecast window for summary (next 24h)
  const now = useMemo(() => new Date(), []);
  const startIso = useMemo(() => new Date(now).toISOString(), [now]);
  const endIso = useMemo(() => {
    const d = new Date(now);
    d.setHours(d.getHours() + 24);
    return d.toISOString();
  }, [now]);
  // Fetch normalized window via API route using the standard data fetching pattern
  const fetchWindow = useCallback(async () => {
    const params = new URLSearchParams({
      beachId: id,
      start: startIso,
      end: endIso,
    });
    const res = await fetch(`/api/forecasts/window?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (json?.success && json?.data) {
      return json.data;
    }
    return null;
  }, [id, startIso, endIso]);
  const {
    data: normalizedWindow,
    loading: windowLoading,
    error: windowError,
  } = useDataFetcher(fetchWindow, { immediate: true });

  // Combined loading and error states
  const loading = beachLoading || forecastsLoading;
  const error = beachError || forecastsError;

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sandy-beige via-white to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-blue" />
      </div>
    );
  }

  if (error || !forecasts || !beach) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sandy-beige via-white to-blue-50">
        <div className="text-center">
          <h2 className="text-xl font-roboto font-bold mb-2 text-dark-grey">
            {error || "Beach data not found"}
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
            {beach.name}
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl md:text-4xl font-roboto font-extrabold mb-8 text-center bg-gradient-to-r from-ocean-blue to-blue-600 bg-clip-text text-transparent">
          {beach.name}
        </h1>

        {/* Conditions Summary (normalized, next 24h) */}
        {normalizedWindow && (
          <div className="mb-6">
            <SpotConditionsSummary data={normalizedWindow} />
          </div>
        )}

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
                    {forecasts[0].water_temp}
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

        {/* Local Intel Section */}
        {beach && (
          <BeachIntelSection
            beachId={id}
            beachName={beach.name}
            latitude={beach.latitude}
            longitude={beach.longitude}
            className="mb-8"
          />
        )}

        {/* 5-Day Tide Chart */}
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
                  className="rounded-2xl shadow-lg bg-gradient-to-br from-white to-blue-50/60 cursor-pointer transition-all hover:shadow-xl hover:scale-105 backdrop-blur-sm border-ocean-blue/20"
                  onClick={() => {
                    setSelectedDay(date);
                    setIsModalOpen(true);
                  }}
                >
                  <CardHeader className="bg-gradient-to-r from-ocean-blue to-blue-500 text-white rounded-t-2xl">
                    <CardTitle className="text-base md:text-lg font-roboto font-semibold">
                      {dayName}
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
                          {representative.water_temp}
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
                        <strong className="font-roboto text-emerald-700">
                          Confidence:
                        </strong>{" "}
                        <span className="text-emerald-600">
                          {Math.round(representative.confidence_score)}%
                        </span>
                      </div>
                    </div>
                    <button
                      className="mt-3 text-xs font-open-sans text-muted-foreground bg-ocean-blue/5 p-2 rounded border border-ocean-blue/10 w-full hover:bg-ocean-blue/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click
                        setSelectedDay(date);
                        setIsModalOpen(true);
                      }}
                    >
                      Click to see detailed swell information
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Forecast Accuracy Section */}
        {sessionSnapshots && sessionSnapshots.length > 0 && (
          <div className="space-y-6 mt-8">
            <h2 className="text-2xl md:text-3xl font-roboto font-bold bg-gradient-to-r from-ocean-blue to-blue-600 bg-clip-text text-transparent">
              Forecast Accuracy
            </h2>
            <SessionForecastComparison
              snapshots={sessionSnapshots}
              maxItems={5}
              className="bg-white/80 backdrop-blur-sm border-ocean-blue/20"
            />
          </div>
        )}

        {/* Detailed Swell Modal */}
        <DetailedSwellModal
          forecast={selectedDay ? forecastsByDate[selectedDay]?.[0] : null}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDay(null);
          }}
          selectedDate={selectedDay}
        />
      </div>
    </div>
  );
}
