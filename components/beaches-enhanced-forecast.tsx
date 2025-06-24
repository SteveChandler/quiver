"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Waves,
  Calendar,
  MapPin,
  Clock,
} from "lucide-react";
import { EnhancedForecastCard } from "./enhanced-forecast-card";
import { useCachedApi } from "@/hooks/use-cached-api";
import { forecastCache, RequestCache } from "@/lib/utils/request-cache";
import { dateUtils } from "@/lib/utils/date-utils";
import {
  formatForecastDate,
  getConfidenceColor,
  getTodayDateString,
  isToday,
  findBestForecastForDate,
  LoadingSpinner,
  ErrorDisplay,
} from "@/lib/utils/forecast-ui-utils";

interface EnhancedForecast {
  id: string;
  forecast_date: string;
  forecast_time: string;
  wave_height: string | null;
  wave_period: string | null;
  wave_direction: string | null;
  swell_1_height: string | null;
  swell_1_period: string | null;
  swell_1_direction: string | null;
  swell_2_height: string | null;
  swell_2_period: string | null;
  swell_2_direction: string | null;
  wind_wave_height: string | null;
  wind_wave_period: string | null;
  wind_wave_direction: string | null;
  water_temp: string;
  air_temperature: string;
  wind_speed: string;
  wind_direction: string;
  tide_status: string;
  tide_height: string;
  next_tide_time: string;
  next_tide_type: string;
  next_tide_height: string;
  current_speed: string;
  current_direction: string;
  weather_condition: string;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

interface BeachesEnhancedForecastProps {
  beachId?: string;
  beachName?: string;
  showHeader?: boolean;
  defaultDays?: number;
}

export function BeachesEnhancedForecast({
  beachId,
  beachName = "Beach",
  showHeader = true,
  defaultDays = 10,
}: BeachesEnhancedForecastProps) {
  const [updating, setUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"overview" | "detailed">("overview");

  // Cached API call for enhanced forecasts
  const fetchForecasts = async () => {
    if (!beachId) {
      throw new Error("Beach ID is required");
    }

    const response = await fetch(
      `/api/forecasts/update-enhanced?beachId=${beachId}&days=${defaultDays}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch enhanced forecasts");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch forecasts");
    }

    return {
      forecasts: data.data?.forecasts || [],
      forecastsByDate: data.data?.forecastsByDate || {},
    };
  };

  const cacheKey = RequestCache.createKey(
    "enhanced-forecasts",
    beachId,
    defaultDays
  );

  const {
    data: forecastData,
    loading,
    error,
    refetch,
    invalidateCache,
  } = useCachedApi(fetchForecasts, cacheKey, {
    cache: forecastCache,
    immediate: Boolean(beachId),
  });

  const forecasts = forecastData?.forecasts || [];
  const forecastsByDate = forecastData?.forecastsByDate || {};

  // Set default selected date when data loads
  useEffect(() => {
    if (
      forecastsByDate &&
      Object.keys(forecastsByDate).length > 0 &&
      !selectedDate
    ) {
      setSelectedDate(getTodayDateString());
    }
  }, [forecastsByDate, selectedDate]);

  // Update forecasts
  const updateForecasts = async () => {
    if (!beachId) return;

    try {
      setUpdating(true);

      const response = await fetch("/api/forecasts/update-enhanced", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ beachId }),
      });

      if (!response.ok) {
        throw new Error("Failed to update forecasts");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to update forecasts");
      }

      // Invalidate cache and refresh
      invalidateCache();
      await refetch();
    } catch (err) {
      console.error("Error updating forecasts:", err);
      // Error is handled by the useCachedApi hook
    } finally {
      setUpdating(false);
    }
  };

  // Get available dates - limit to exactly 10 days from today
  const todayDateString = getTodayDateString();
  const allDates = Object.keys(forecastsByDate).sort();
  const todayIndex = allDates.indexOf(todayDateString);
  const availableDates =
    todayIndex >= 0
      ? allDates.slice(todayIndex, todayIndex + 10)
      : allDates.slice(0, 10);
  const selectedDateForecasts = forecastsByDate[selectedDate] || [];

  // Get today's best forecast summary
  const todaysBest = (() => {
    const todaysForecasts = forecastsByDate[todayDateString] || [];
    return findBestForecastForDate(todaysForecasts, true);
  })();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <ErrorDisplay error={error} onRetry={() => fetchForecasts()} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      {showHeader && (
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Waves className="h-6 w-6 text-blue-600" />
              10-Day Enhanced Forecast
            </h2>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <MapPin className="h-4 w-4" />
              {beachName}
            </p>
          </div>
          <Button
            onClick={updateForecasts}
            disabled={updating}
            size="sm"
            variant="outline"
          >
            {updating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Update Forecasts
          </Button>
        </div>
      )}

      {/* Today's Summary */}
      {todaysBest && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <TrendingUp className="h-5 w-5" />
              Today's Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-blue-600">Wave Height</p>
                <p className="font-bold text-lg">
                  {todaysBest.wave_height || "No data"}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Tide</p>
                <p className="font-medium">{todaysBest.tide_status}</p>
                <p className="text-sm text-muted-foreground">
                  {todaysBest.tide_height}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Wind</p>
                <p className="font-medium">{todaysBest.wind_speed}</p>
                <p className="text-sm text-muted-foreground">
                  {todaysBest.wind_direction}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Confidence</p>
                <Badge
                  className={getConfidenceColor(todaysBest.confidence_score)}
                >
                  {todaysBest.confidence_score}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <Tabs
          value={viewMode}
          onValueChange={(value) =>
            setViewMode(value as "overview" | "detailed")
          }
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Last updated:{" "}
          {forecasts.length > 0 &&
            new Date(forecasts[0].updated_at).toLocaleString()}
        </div>
      </div>

      {/* Date Navigation - 5x2 Grid */}
      {availableDates.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {availableDates.map((date) => {
            const isSelected = date === selectedDate;
            const dateObj = new Date(date);
            const isTodayDate = isToday(date);

            return (
              <Button
                key={date}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(date)}
                className={`h-auto py-2 flex flex-col ${
                  isTodayDate ? "ring-2 ring-blue-500" : ""
                }`}
              >
                <span className="text-xs">
                  {isTodayDate
                    ? "Today"
                    : dateObj.toLocaleDateString([], { weekday: "short" })}
                </span>
                <span className="font-medium">
                  {dateObj.toLocaleDateString([], { day: "numeric" })}
                </span>
                <span className="text-xs">
                  {dateObj.toLocaleDateString([], { month: "short" })}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Forecast Display */}
      {selectedDateForecasts.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isToday(selectedDate)
              ? "Today's Forecast"
              : new Date(selectedDate).toLocaleDateString([], {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
          </h3>

          {viewMode === "overview" ? (
            <div className="grid gap-3">
              {/* For today, show only the best forecast. For other days, show all */}
              {isToday(selectedDate) && todaysBest
                ? [todaysBest].map((forecast) => (
                    <EnhancedForecastCard
                      key={forecast.id}
                      forecast={forecast}
                      variant="compact"
                      showDate={false}
                    />
                  ))
                : selectedDateForecasts.map((forecast) => (
                    <EnhancedForecastCard
                      key={forecast.id}
                      forecast={forecast}
                      variant="compact"
                      showDate={false}
                    />
                  ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* For today, show only the best forecast. For other days, show all */}
              {isToday(selectedDate) && todaysBest
                ? [todaysBest].map((forecast) => (
                    <EnhancedForecastCard
                      key={forecast.id}
                      forecast={forecast}
                      variant="detailed"
                      showDate={false}
                    />
                  ))
                : selectedDateForecasts.map((forecast) => (
                    <EnhancedForecastCard
                      key={forecast.id}
                      forecast={forecast}
                      variant="detailed"
                      showDate={false}
                    />
                  ))}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              No forecast data available for {selectedDate}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Data Sources Info - Collapsible */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          View Data Sources
        </summary>
        <Card className="mt-2">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Data Sources:</p>
              <ul className="space-y-1 text-xs">
                <li>• Wave forecasts: NOAA WaveWatch III Global Wave Model</li>
                <li>
                  • Tide predictions: NOAA Center for Operational Oceanographic
                  Products and Services (CO-OPS)
                </li>
                <li>• Weather data: NOAA National Weather Service</li>
                <li>• Real-time conditions: NDBC Buoy Network</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
