"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, Waves, Clock } from "lucide-react";
import { useEnhancedForecast } from "@/hooks/use-enhanced-forecast";
import { ForecastStats } from "./forecast/forecast-stats";
import { DateNavigation } from "./forecast/date-navigation";
import { ForecastDisplay } from "./forecast/forecast-display";
import { LoadingSpinner, ErrorDisplay } from "@/lib/utils/forecast-ui-utils";

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
  defaultDays = 12,
}: BeachesEnhancedForecastProps) {
  const {
    forecasts,
    availableDates,
    selectedDate,
    selectedDateForecasts,
    loading,
    error,
    updating,
    setSelectedDate,
    refetch,
    handleRefresh,
  } = useEnhancedForecast({
    beachId,
    defaultDays,
    immediate: Boolean(beachId),
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
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
            {/* Forecast Stats Component */}
            <ForecastStats
              forecasts={forecasts}
              availableDates={availableDates}
            />

            {/* Last Updated Info */}
            <div className="flex justify-end">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Last updated:{" "}
                {forecasts.length > 0 &&
                  new Date(forecasts[0].updated_at).toLocaleString()}
              </div>
            </div>

            {/* Date Navigation Component */}
            <DateNavigation
              availableDates={availableDates}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />

            {/* Forecast Display Component */}
            <ForecastDisplay
              selectedDate={selectedDate}
              selectedDateForecasts={selectedDateForecasts}
            />

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
