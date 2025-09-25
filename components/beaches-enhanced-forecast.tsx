"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Waves,
  Clock,
  Zap,
} from "lucide-react";
import { useEnhancedForecast } from "@/hooks/use-enhanced-forecast";
import { ForecastStats } from "./forecast/forecast-stats";
import { LoadingSpinner, ErrorDisplay } from "@/lib/utils/forecast-ui-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ForecastDataTransparency,
  createMockDataSources,
} from "@/components/ui/forecast-data-transparency";
import {
  MultiDayForecastTable,
  SimplifiedForecastTable,
} from "./forecast/forecast-table";
import { TideChart } from "./forecast/tide-chart-recharts";
import { BeachesEnhancedForecastWithTransparency } from "./forecast/beaches-enhanced-forecast-with-transparency";

interface BeachesEnhancedForecastProps {
  beachId?: string;
  beachName?: string;
  showHeader?: boolean;
  defaultDays?: number;
  autoGenerate?: boolean;
  // New transparency props - opt-in for user activation
  showTransparency?: boolean;
  showQualitySummary?: boolean;
  allowToggleTransparency?: boolean;
  highlightQualityVariations?: boolean;
}

export function BeachesEnhancedForecast({
  beachId,
  beachName = "Beach",
  showHeader = true,
  defaultDays = 12,
  autoGenerate = true,
  showTransparency = false,
  showQualitySummary = false,
  allowToggleTransparency = false,
  highlightQualityVariations = false,
}: BeachesEnhancedForecastProps) {
  // Always call hooks unconditionally per Rules of Hooks
  const {
    forecasts,
    availableDates,
    selectedDate,
    selectedDateForecasts,
    loading,
    error,
    updating,
    autoGenerating,
    isOfflineData,
    isStale,
    cacheAgeMs,
    setSelectedDate,
    refetch,
    handleRefresh,
  } = useEnhancedForecast({
    beachId,
    defaultDays,
    immediate: Boolean(beachId),
    autoGenerate,
  });

  const staleHours =
    typeof cacheAgeMs === "number"
      ? Math.max(1, Math.round(cacheAgeMs / (1000 * 60 * 60)))
      : null;

  // If advanced transparency is requested, use the enhanced version
  if (showTransparency || showQualitySummary || allowToggleTransparency) {
    return (
      <BeachesEnhancedForecastWithTransparency
        beachId={beachId}
        beachName={beachName}
        showHeader={showHeader}
        showTransparency={showTransparency}
        showTransparencySummary={showQualitySummary}
        allowToggleTransparency={allowToggleTransparency}
        highlightQualityVariations={highlightQualityVariations}
        showFallbackInfo={true}
        expandableTransparency={true}
        showQualityChart={showQualitySummary}
      />
    );
  }

  if (loading) {
    return <LoadingSpinner label="Loading enhanced forecasts..." />;
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
    <Card className="w-full">
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between pb-4">
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
              disabled={updating || autoGenerating}
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

      <CardContent className="space-y-4">
        {(isOfflineData || isStale) && (
          <Alert className="border-amber-200/70 bg-amber-50 text-amber-900">
            <AlertTitle>
              {isStale ? "Forecast data may be out of date" : "Offline preview"}
            </AlertTitle>
            <AlertDescription>
              {isStale ? (
                <span>
                  Last refreshed {staleHours ? `${staleHours}h` : "recently"} ago.
                  Tap refresh once you have a connection for the latest tide
                  and swell details.
                </span>
              ) : (
                <span>
                  You’re viewing the most recent forecast saved on this
                  device. We’ll sync updated data automatically when you’re
                  back online.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
        {autoGenerating ? (
          <div className="text-center py-6">
            <div className="relative">
              <Waves className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
              <Zap className="h-6 w-6 text-yellow-500 absolute top-0 right-1/2 transform translate-x-1/2 animate-bounce" />
            </div>
            <h3 className="text-lg font-medium mb-2">Generating Forecasts</h3>
            <p className="text-muted-foreground mb-4">
              Creating enhanced forecast data for {beachName}. This may take a
              few moments...
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fetching wave data from NOAA WaveWatch III</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Combining multiple data sources for accurate surf forecasting
            </div>
          </div>
        ) : forecasts.length === 0 ? (
          <div className="text-center py-6">
            <Waves className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Forecast Data</h3>
            <p className="text-muted-foreground mb-4">
              {autoGenerate
                ? "We're having trouble generating forecast data for this beach. Please try again."
                : "Enhanced forecast data is not available for this beach yet."}
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
          <div className="space-y-4">
            {/* Enhanced Forecast Stats and Overview */}
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

            {/* Multi-Day Tide Chart Display */}
            <TideChart forecasts={forecasts} />

            {/* Simplified Forecast Table */}
            <SimplifiedForecastTable forecasts={forecasts} />

            {/* Data Sources Info - Collapsible */}
            <details className="group mt-4">
              <summary className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <TrendingUp className="h-4 w-4 transition-transform group-open:rotate-90" />
                Enhanced Forecast Data Sources
              </summary>
              <div className="mt-3 p-4 bg-muted/30 rounded-lg text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium mb-2">Wave Data</h5>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• NOAA WaveWatch III Global Model</li>
                      <li>• Real-time NDBC Buoy Observations</li>
                      <li>• Swell component analysis</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium mb-2">Weather & Tides</h5>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• NOAA Weather Service API</li>
                      <li>• CO-OPS Tidal Predictions</li>
                      <li>• Real-time tidal observations</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-3 mt-3 border-t">
                  Confidence scores are calculated based on data freshness,
                  source reliability, and forecast horizon. Enhanced forecasts
                  combine multiple data sources for improved accuracy.
                </p>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
