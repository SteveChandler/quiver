"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { formatTimeInBeachTimezone } from "@/lib/utils/date-time";
import { getLocalDateString, resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import { extractForecastDate } from "@/lib/utils/forecast-at-adapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Waves,
  Clock,
  Zap,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertTriangle,
  Wind,
  CloudSun,
  Droplet,
} from "lucide-react";
import { useEnhancedForecast } from "@/hooks/use-enhanced-forecast";
import { ForecastStats } from "./forecast/forecast-stats";
import { LoadingSpinner, ErrorDisplay } from "@/lib/utils/forecast-ui-utils";
import { getLatestUpdatedAt } from "@/lib/utils/forecast-client-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ForecastDataTransparency from "@/components/ui/forecast-data-transparency";
import {
  MultiDayForecastTable,
  SimplifiedForecastTable,
} from "./forecast/forecast-table";
import { TideChart } from "./forecast/tide-chart-recharts";
import { ForecastDataSourceIndicator } from "@/components/forecast/forecast-data-source-indicator";
import { ConfidenceScoreExplanation } from "@/components/forecast/confidence-score-explanation";
import { ForecastFallbackMessaging } from "@/components/forecast/forecast-fallback-messaging";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";

function getNormalizedDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeForecastDateKey(forecastDate: string): string | null {
  if (!forecastDate) return null;
  if (forecastDate.includes("T")) return forecastDate.split("T")[0] ?? null;
  // Common case: YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(forecastDate)) return forecastDate;
  const parsed = new Date(forecastDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return getNormalizedDateString(parsed);
}

function formatLocalTime(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface BeachesEnhancedForecastProps {
  beachId?: string;
  beachName?: string;
  /** Beach latitude - for timezone-aware tide time formatting */
  beachLat?: number;
  /** Beach longitude - for timezone-aware tide time formatting */
  beachLon?: number;
  beachTimezone?: string | null;
  showHeader?: boolean;
  defaultDays?: number;
  autoGenerate?: boolean;
  // Transparency props - opt-in for user activation
  showTransparency?: boolean;
  showQualitySummary?: boolean;
  allowToggleTransparency?: boolean;
  highlightQualityVariations?: boolean;
  showFallbackInfo?: boolean;
  showQualityChart?: boolean;
  expandableTransparency?: boolean;
  mobile?: boolean;
  compact?: boolean;
  className?: string;
  // Public mode for pre-login experience
  publicMode?: boolean;
}

export function BeachesEnhancedForecast({
  beachId,
  beachName = "Beach",
  beachLat,
  beachLon,
  beachTimezone,
  showHeader = true,
  defaultDays = 12,
  autoGenerate = true,
  showTransparency = false,
  showQualitySummary = false,
  allowToggleTransparency = false,
  highlightQualityVariations = false,
  showFallbackInfo = true,
  showQualityChart = false,
  expandableTransparency = false,
  mobile = false,
  compact = false,
  className,
  publicMode = false,
}: BeachesEnhancedForecastProps) {
  const [transparencyVisible, setTransparencyVisible] =
    useState(showTransparency);
  const [transparencyExpanded, setTransparencyExpanded] = useState(false);

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
    beachTimezone,
  });

  const staleHours =
    typeof cacheAgeMs === "number"
      ? Math.max(1, Math.round(cacheAgeMs / (1000 * 60 * 60)))
      : null;

  // Determine if any transparency feature is requested
  const transparencyRequested =
    showTransparency || showQualitySummary || allowToggleTransparency;

  // Calculate transparency summary (used when transparency is requested)
  const transparencySummary = React.useMemo(() => {
    if (!transparencyRequested || !forecasts.length) return null;

    const highConfidenceCount = forecasts.filter(
      (f) => f.confidence_score != null && f.confidence_score >= 75
    ).length;
    const fallbackCount = forecasts.filter(
      (f) => f.data_source === "FALLBACK"
    ).length;
    const cdipCount = forecasts.filter((f) => f.data_source === "CDIP").length;

    return {
      total: forecasts.length,
      highConfidence: highConfidenceCount,
      highConfidencePercent: Math.round(
        (highConfidenceCount / forecasts.length) * 100
      ),
      fallbackPercent: Math.round((fallbackCount / forecasts.length) * 100),
      cdipPercent: Math.round((cdipCount / forecasts.length) * 100),
      qualityLevel:
        highConfidenceCount / forecasts.length > 0.7
          ? "high"
          : highConfidenceCount / forecasts.length > 0.4
          ? "medium"
          : "low",
    };
  }, [transparencyRequested, forecasts]);

  // Derivations used by both guest and authed renders for transparency mode.
  // Must be defined before any early returns to keep Hook order stable.
  const primaryForecast = forecasts.length > 0 ? forecasts[0] : null;
  const todayKey = React.useMemo(
    () => getLocalDateString(new Date(), resolveBeachTimezone(beachTimezone)),
    [beachTimezone]
  );
  const todayForecast = React.useMemo(() => {
    if (!forecasts.length) return null;
    const tz = resolveBeachTimezone(beachTimezone);
    const match = forecasts.find((f) => {
      const key = f.forecast_at
        ? extractForecastDate(f.forecast_at, tz)
        : normalizeForecastDateKey(f.forecast_date);
      return key === todayKey;
    });
    return match ?? primaryForecast;
  }, [forecasts, todayKey, primaryForecast, beachTimezone]);

  const hasFallbackData = forecasts.some((f) => f.data_source === "FALLBACK");

  const todayConfidence =
    typeof todayForecast?.confidence_score === "number"
      ? Math.max(0, Math.min(100, Math.round(todayForecast.confidence_score)))
      : null;
  const todayDataSources =
    todayForecast?.raw_forecast?.data_sources ??
    (todayForecast?.data_source ? [todayForecast.data_source] : []);

  // -------------------------------------------------------------------------
  // Transparency-enhanced render path
  // -------------------------------------------------------------------------
  if (transparencyRequested) {
    if (loading) {
      return (
        <Card className={cn("w-full", className)}>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card className={cn("w-full border-red-200", className)}>
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
              <div className="text-red-600 font-medium">Forecast Error</div>
              <div className="text-sm text-gray-600">{error}</div>
              {showTransparency && (
                <div
                  data-testid="transparency-error"
                  className="text-xs text-red-500"
                >
                  Transparency data unavailable
                </div>
              )}
              <Button onClick={refetch} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    const fullExperienceContent = (
      <div className="space-y-6" data-testid="forecast-full-experience">
        {/* Tides */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-700">Tides</h4>
            <div className="text-xs text-muted-foreground">Next ~18 hours</div>
          </div>
          <TideChart forecasts={forecasts} now={new Date()} compact={true} />
        </div>

        {/* Forecast table */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">10‑Day Forecast</h4>
          <MultiDayForecastTable forecasts={forecasts} beachTimezone={beachTimezone} />
        </div>

        {/* Transparency section (optional) */}
        <div className="space-y-4">
          {transparencyVisible &&
            showQualitySummary &&
            transparencySummary && (
              <div
                data-testid="transparency-summary"
                className="bg-gray-50 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Forecast Quality Overview</h4>
                  <Badge
                    variant={
                      transparencySummary.qualityLevel === "high"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {transparencySummary.qualityLevel === "high"
                      ? "High Quality"
                      : transparencySummary.qualityLevel === "medium"
                      ? "Mixed Quality"
                      : "Limited Quality"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">High Confidence:</span>
                    <span className="font-medium ml-2">
                      {transparencySummary.highConfidencePercent}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">CDIP Data:</span>
                    <span className="font-medium ml-2">
                      {transparencySummary.cdipPercent}%
                    </span>
                  </div>
                </div>
                {transparencySummary.qualityLevel !== "high" && (
                  <div className="mt-2 text-xs text-yellow-600">
                    Mixed data quality - some forecasts use fallback data
                  </div>
                )}
              </div>
            )}

          {/* Primary Forecast with Transparency */}
          {primaryForecast && transparencyVisible && (
            <div className="space-y-3">
              <ForecastDataSourceIndicator
                dataSource={primaryForecast.data_source}
                confidenceScore={primaryForecast.confidence_score}
                dataSources={
                  primaryForecast.raw_forecast?.data_sources || [
                    primaryForecast.data_source,
                  ]
                }
                isRealTimeData={primaryForecast.raw_forecast?.data_sources?.includes(
                  "CDIP"
                )}
                lastUpdated={primaryForecast.updated_at}
                expandable={expandableTransparency}
                compact={compact}
                data-testid="forecast-transparency-indicator"
              />

              {expandableTransparency && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setTransparencyExpanded(!transparencyExpanded)
                    }
                    className="w-full justify-between"
                    aria-label="Show detailed transparency"
                  >
                    <span>Detailed Transparency Information</span>
                    {transparencyExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  {transparencyExpanded && (
                    <div
                      data-testid="detailed-transparency"
                      className="bg-gray-50 rounded-lg p-4 space-y-3"
                    >
                      <h5 className="font-medium">Data source breakdown</h5>
                      <ConfidenceScoreExplanation
                        score={primaryForecast.confidence_score}
                        beachName={beachName}
                        showFactors={true}
                        expandable={true}
                      />
                    </div>
                  )}
                </div>
              )}

              {showFallbackInfo && hasFallbackData && (
                <ForecastFallbackMessaging
                  fallbackType="nearest_beach"
                  originalLocation={beachName}
                  fallbackLocation="Santa Monica"
                  distance={15.5}
                  reason="Limited data available for this location"
                  accuracyImpact="medium"
                  data-testid="forecast-fallback-messaging"
                />
              )}
            </div>
          )}

          {transparencyVisible && showQualityChart && forecasts.length > 0 && (
            <div
              data-testid="data-quality-chart"
              className="bg-gray-50 rounded-lg p-4"
            >
              <div className="flex items-center space-x-2 mb-3">
                <BarChart3 className="h-4 w-4" />
                <h4 className="font-medium">Forecast confidence over time</h4>
              </div>
              <div className="grid grid-cols-10 gap-1 h-8">
                {forecasts.slice(0, 10).map((forecast, index) => {
                  const score = forecast.confidence_score;
                  return (
                    <div
                      key={index}
                      className={cn("rounded", {
                        "bg-green-400": score != null && score >= 75,
                        "bg-yellow-400":
                          score != null && score >= 50 && score < 75,
                        "bg-red-400": score != null && score < 50,
                        "bg-gray-300": score == null,
                      })}
                      title={`${
                        forecast.forecast_at
                          ? new Date(forecast.forecast_at).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : `${forecast.forecast_date} ${forecast.forecast_time}`
                      }: ${score != null ? `${score}%` : "N/A"}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {transparencyVisible && highlightQualityVariations && (
            <div className="space-y-2">
              {forecasts
                .filter(
                  (f) => f.confidence_score != null && f.confidence_score < 50
                )
                .map((forecast) => (
                  <div
                    key={forecast.id}
                    data-testid="low-confidence-highlight"
                    className="border-l-4 border-red-400 bg-red-50 p-3 rounded-r"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {forecast.forecast_at
                          ? new Date(forecast.forecast_at).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : `${forecast.forecast_date} ${forecast.forecast_time}`}
                      </span>
                      <Badge className="bg-red-100 text-red-700 text-xs">
                        {forecast.confidence_score}% confidence
                      </Badge>
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      Limited data quality - check conditions before relying on
                      this forecast
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <Card className={cn("w-full", className)}>
        {showHeader && (
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Enhanced Forecast for {beachName}</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                {allowToggleTransparency && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransparencyVisible(!transparencyVisible)}
                    aria-label="Toggle transparency"
                  >
                    {transparencyVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  disabled={updating}
                >
                  <RefreshCw
                    className={cn("h-4 w-4 mr-2", { "animate-spin": updating })}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
        )}

        <CardContent
          className={cn("space-y-4", {
            "mobile-layout": mobile,
          })}
          data-testid="transparency-container"
        >
          {/* Updating State */}
          {updating && (
            <div
              data-testid="transparency-updating"
              className="flex items-center justify-center p-4 bg-blue-50 rounded-lg"
            >
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Updating transparency data...</span>
            </div>
          )}

          {/* Guest: premium Today preview + gated full experience */}
          {publicMode && todayForecast ? (
            <div className="space-y-5">
              <div
                className="rounded-2xl border bg-gradient-to-br from-blue-50/70 via-white to-white p-4 sm:p-5"
                data-testid="public-today-preview"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-900">
                      Today at {beachName}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-semibold text-slate-900">
                        <WaveHeightDisplay
                          height={todayForecast.wave_height}
                          showTooltip={false}
                          isMlCalibrated={todayForecast.is_ml_calibrated}
                          isCalibrated={todayForecast.isCalibrated}
                        />
                      </div>
                      <div className="text-sm text-slate-500">face</div>
                    </div>
                  </div>
                  {todayConfidence !== null ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {todayConfidence}% confidence
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Preview</Badge>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Wind className="h-4 w-4 text-slate-500" />
                    <span>{todayForecast.wind_speed ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <CloudSun className="h-4 w-4 text-slate-500" />
                    <span>{todayForecast.weather_condition ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Droplet className="h-4 w-4 text-slate-500" />
                    <span>
                      {todayForecast.next_tide_type &&
                      (todayForecast.next_tide_at || todayForecast.next_tide_time)
                        ? `${todayForecast.next_tide_type} @ ${
                            // Prefer timezone-aware formatting using ISO timestamp + timezone
                            todayForecast.next_tide_at && beachTimezone
                              ? formatTimeInBeachTimezone(
                                  todayForecast.next_tide_at,
                                  beachTimezone
                                )
                              : formatLocalTime(todayForecast.next_tide_time)
                          }`
                        : "Next tide —"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span>
                      Updated{" "}
                      {todayForecast.updated_at
                        ? formatLocalTime(todayForecast.updated_at) ?? "—"
                        : "—"}
                    </span>
                  </div>
                </div>

                {todayDataSources.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">Sources:</span>
                    {todayDataSources.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                    {todayDataSources.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{todayDataSources.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <PublicContentGate
                ctaTitle="See the full 7-day forecast"
                ctaDescription="Create a free account to view detailed surf forecasts and conditions"
                blurLevel="md"
                source="forecast-page"
                className="min-h-[520px]"
              >
                {fullExperienceContent}
              </PublicContentGate>
            </div>
          ) : (
            fullExperienceContent
          )}

          {/* Accessibility region for transparency */}
          <div
            role="region"
            aria-label="forecast transparency"
            aria-live="polite"
            className="sr-only"
          >
            {transparencyVisible
              ? "Transparency information displayed"
              : "Transparency information hidden"}
          </div>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Base render path (no transparency)
  // -------------------------------------------------------------------------
  if (loading) {
    return <LoadingSpinner label="Loading enhanced forecasts..." />;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorDisplay message={error} />
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
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
                  Last refreshed {staleHours ? `${staleHours}h` : "recently"}{" "}
                  ago. Tap refresh once you have a connection for the latest
                  tide and swell details.
                </span>
              ) : (
                <span>
                  You&apos;re viewing the most recent forecast saved on this device.
                  We&apos;ll sync updated data automatically when you&apos;re back online.
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

            {/* Show preview of first 2 days for public users, full content for authenticated */}
            {publicMode ? (
              <>
                {/* Preview content - first 2 rows visible */}
                <SimplifiedForecastTable forecasts={forecasts.slice(0, 2)} beachTimezone={beachTimezone} />

                {/* Gated detailed content */}
                <PublicContentGate
                  ctaTitle="Unlock the extended 10-day outlook"
                  ctaDescription="Sign up to plan your week with the full forecast"
                  blurLevel="md"
                  source="forecast-page"
                  className="min-h-[400px]"
                >
                  {/* Last Updated Info - uses max(updated_at) for accurate freshness */}
                  <div className="flex justify-end">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Last updated:{" "}
                      {forecasts.length > 0 && getLatestUpdatedAt(forecasts) &&
                        new Date(getLatestUpdatedAt(forecasts)!).toLocaleString()}
                    </div>
                  </div>

                  {/* Multi-Day Tide Chart Display */}
                  <TideChart forecasts={forecasts} now={new Date()} />

                  {/* Full Forecast Table */}
                  <SimplifiedForecastTable forecasts={forecasts} beachTimezone={beachTimezone} />

                  {/* Data Sources Info - Collapsible */}
                  <details className="group mt-4">
                    <summary className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <TrendingUp className="h-4 w-4 transition-transform group-open:rotate-90" />
                      Enhanced Forecast Data Sources
                    </summary>
                    <div className="mt-3 p-4 bg-muted/30 rounded-lg text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Wave Data</h4>
                          <ul className="text-muted-foreground space-y-1">
                            <li>• NOAA WaveWatch III Global Model</li>
                            <li>• Real-time NDBC Buoy Observations</li>
                            <li>• Swell component analysis</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Weather & Tides</h4>
                          <ul className="text-muted-foreground space-y-1">
                            <li>• NOAA Weather Service API</li>
                            <li>• CO-OPS Tidal Predictions</li>
                            <li>• Real-time tidal observations</li>
                          </ul>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pt-3 mt-3 border-t">
                        Confidence scores are calculated based on data
                        freshness, source reliability, and forecast horizon.
                        Enhanced forecasts combine multiple data sources for
                        improved accuracy.
                      </p>
                    </div>
                  </details>
                </PublicContentGate>
              </>
            ) : (
              <>
                {/* Full content for authenticated users */}
                {/* Last Updated Info - uses max(updated_at) for accurate freshness */}
                <div className="flex justify-end">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Last updated:{" "}
                    {forecasts.length > 0 && getLatestUpdatedAt(forecasts) &&
                      new Date(getLatestUpdatedAt(forecasts)!).toLocaleString()}
                  </div>
                </div>

                {/* Multi-Day Tide Chart Display */}
                <TideChart forecasts={forecasts} now={new Date()} />

                {/* Simplified Forecast Table */}
                <SimplifiedForecastTable forecasts={forecasts} beachTimezone={beachTimezone} />

                {/* Data Sources Info - Collapsible */}
                <details className="group mt-4">
                  <summary className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <TrendingUp className="h-4 w-4 transition-transform group-open:rotate-90" />
                    Enhanced Forecast Data Sources
                  </summary>
                  <div className="mt-3 p-4 bg-muted/30 rounded-lg text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Wave Data</h4>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• NOAA WaveWatch III Global Model</li>
                          <li>• Real-time NDBC Buoy Observations</li>
                          <li>• Swell component analysis</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Weather & Tides</h4>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• NOAA Weather Service API</li>
                          <li>• CO-OPS Tidal Predictions</li>
                          <li>• Real-time tidal observations</li>
                        </ul>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-3 mt-3 border-t">
                      Confidence scores are calculated based on data freshness,
                      source reliability, and forecast horizon. Enhanced
                      forecasts combine multiple data sources for improved
                      accuracy.
                    </p>
                  </div>
                </details>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
