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
  HelpCircle,
} from "lucide-react";
import { ForecastCard } from "./forecast-card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  // Handle manual refresh
  const handleRefresh = async () => {
    setUpdating(true);
    try {
      await invalidateCache();
      await refetch();
    } catch (err) {
      console.error("Error refreshing forecasts:", err);
    } finally {
      setUpdating(false);
    }
  };

  // Get available dates and selected date forecasts
  const availableDates = Object.keys(forecastsByDate).sort();
  const selectedDateForecasts = selectedDate
    ? forecastsByDate[selectedDate] || []
    : [];

  // Get today's best forecast
  const todaysBest = isToday(selectedDate)
    ? findBestForecastForDate(selectedDateForecasts, true)
    : null;

  if (loading) {
    return <LoadingSpinner message="Loading enhanced forecasts..." />;
  }

  if (error) {
    return (
      <ErrorDisplay
        title="Failed to Load Enhanced Forecasts"
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!beachId) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            Please select a beach to view enhanced forecasts
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Waves className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">
              Enhanced Forecast - {beachName}
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={updating}
            >
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-6">
        {forecasts.length === 0 ? (
          <div className="text-center py-8">
            <Waves className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Forecast Data</h3>
            <p className="text-muted-foreground mb-4">
              Enhanced forecast data is not available for this beach yet.
            </p>
            <Button onClick={handleRefresh} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating Forecasts...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate Forecasts
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Forecast Stats */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {availableDates.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {forecasts.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Forecasts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {Math.round(
                      forecasts.reduce(
                        (sum: number, f: EnhancedForecast) =>
                          sum + (f.confidence_score || 0),
                        0
                      ) / forecasts.length
                    )}
                    %
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center cursor-help">
                          Avg Confidence
                          <HelpCircle className="h-3 w-3" />
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          How reliable the forecast data is based on data
                          freshness, source quality, and forecast timeframe.
                          Higher scores mean more reliable predictions.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-800 border-blue-200"
              >
                Enhanced Data
              </Badge>
            </div>

            {/* Controls */}
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
                          : dateObj.toLocaleDateString([], {
                              weekday: "short",
                            })}
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
                      ? [todaysBest].map((forecast: EnhancedForecast) => (
                          <ForecastCard
                            key={forecast.id}
                            forecast={forecast}
                            variant="compact"
                            showDate={false}
                            showBeachName={false}
                          />
                        ))
                      : selectedDateForecasts.map(
                          (forecast: EnhancedForecast) => (
                            <ForecastCard
                              key={forecast.id}
                              forecast={forecast}
                              variant="compact"
                              showDate={false}
                              showBeachName={false}
                            />
                          )
                        )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* For today, show only the best forecast. For other days, show all */}
                    {isToday(selectedDate) && todaysBest
                      ? [todaysBest].map((forecast: EnhancedForecast) => (
                          <ForecastCard
                            key={forecast.id}
                            forecast={forecast}
                            variant="detailed"
                            showDate={false}
                            showBeachName={false}
                          />
                        ))
                      : selectedDateForecasts.map(
                          (forecast: EnhancedForecast) => (
                            <ForecastCard
                              key={forecast.id}
                              forecast={forecast}
                              variant="detailed"
                              showDate={false}
                              showBeachName={false}
                            />
                          )
                        )}
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
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <TrendingUp className="h-4 w-4 transition-transform group-open:rotate-90" />
                Enhanced Forecast Data Sources
              </summary>
              <div className="mt-3 p-4 bg-muted/30 rounded-lg text-sm space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium mb-1">Wave Data</h5>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• NOAA WaveWatch III Global Model</li>
                      <li>• Real-time NDBC Buoy Observations</li>
                      <li>• Swell component analysis</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium mb-1">Weather & Tides</h5>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• NOAA Weather Service API</li>
                      <li>• CO-OPS Tidal Predictions</li>
                      <li>• Real-time tidal observations</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Confidence scores are calculated based on data freshness,
                  source reliability, and forecast horizon. Enhanced forecasts
                  combine multiple data sources for improved accuracy.
                </p>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
