"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiDayForecastTable } from "@/components/forecast/forecast-table";
import { ForecastDataSourceIndicator } from "@/components/forecast/forecast-data-source-indicator";
import { ConfidenceScoreExplanation } from "@/components/forecast/confidence-score-explanation";
import { ForecastFallbackMessaging } from "@/components/forecast/forecast-fallback-messaging";
import ForecastDataTransparency from "@/components/ui/forecast-data-transparency";
import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

interface ForecastDisplayProps {
  forecasts: EnhancedForecastEntity[];
  beach: {
    id: string;
    name: string;
    coordinates: { latitude: number; longitude: number };
    county: string;
    state: string;
    country: string;
    timezone: string;
  } | null;
  loading: boolean;
  error: string | null;
  // New transparency props - opt-in for backward compatibility
  showTransparency?: boolean;
  showQualitySummary?: boolean;
  showFallbackInfo?: boolean;
  allowToggleTransparency?: boolean;
  highlightQualityVariations?: boolean;
  expandableByDay?: boolean;
  mobile?: boolean;
  compact?: boolean;
  parseUrlParams?: boolean;
  className?: string;
}

export function ForecastDisplay({
  forecasts,
  beach,
  loading,
  error,
  showTransparency = false,
  showQualitySummary = false,
  showFallbackInfo = true,
  allowToggleTransparency = false,
  highlightQualityVariations = false,
  expandableByDay = false,
  mobile = false,
  compact = false,
  parseUrlParams = false,
  className,
}: ForecastDisplayProps) {
  const searchParams = useSearchParams();
  const [transparencyVisible, setTransparencyVisible] =
    useState(showTransparency);
  const [dailyBreakdownExpanded, setDailyBreakdownExpanded] = useState(false);

  // Parse URL parameters for transparency settings
  useEffect(() => {
    if (parseUrlParams && searchParams) {
      const transparencyParam = searchParams.get("transparency");
      const qualityParam = searchParams.get("quality");

      if (transparencyParam === "detailed") {
        setTransparencyVisible(true);
      }
      if (qualityParam === "expanded") {
        setDailyBreakdownExpanded(true);
      }
    }
  }, [parseUrlParams, searchParams]);

  // Calculate forecast quality metrics
  const qualityMetrics = React.useMemo(() => {
    if (!forecasts?.length) return null;

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
      hasVariations: fallbackCount > 0 && cdipCount > 0,
      qualityLevel:
        highConfidenceCount / forecasts.length > 0.8
          ? "high"
          : highConfidenceCount / forecasts.length > 0.5
          ? "medium"
          : "low",
    };
  }, [forecasts]);

  // Determine if any transparency feature is requested
  const transparencyRequested =
    showTransparency || showQualitySummary || allowToggleTransparency;

  // Handle loading state
  if (loading) {
    if (transparencyRequested) {
      return (
        <div
          className={cn("max-w-6xl mx-auto px-4 space-y-6", className)}
          data-testid="forecast-display-container"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {beach?.name || "Loading..."}
            </h2>
            <h3 className="text-lg text-muted-foreground">
              10-Day Surf Forecast
            </h3>
          </div>

          <div className="text-center py-8">
            <p className="text-gray-600">Loading forecasts...</p>
          </div>

          {transparencyVisible && (
            <div
              data-testid="transparency-loading-skeleton"
              className="space-y-4"
            >
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">{beach?.name}</h2>
          <h3 className="text-lg text-muted-foreground">
            10-Day Surf Forecast
          </h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-600">Loading forecasts...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    if (transparencyRequested) {
      return (
        <div
          className={cn("max-w-6xl mx-auto px-4 space-y-6", className)}
          data-testid="forecast-display-container"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {beach?.name || "Forecast Error"}
            </h2>
            <h3 className="text-lg text-muted-foreground">
              10-Day Surf Forecast
            </h3>
          </div>

          <div className="text-center py-8 space-y-3">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-red-500 font-semibold">Error loading forecasts</p>
            <p className="text-gray-600">{error}</p>
          </div>

          {transparencyVisible && (
            <div data-testid="transparency-error-state" className="text-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">
                  Transparency data unavailable due to forecast error
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">{beach?.name}</h2>
          <h3 className="text-lg text-muted-foreground">
            10-Day Surf Forecast
          </h3>
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 font-semibold">Error loading forecasts</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Handle no data state
  if (!forecasts || forecasts.length === 0) {
    return (
      <div
        className={cn(
          "max-w-6xl mx-auto px-4 space-y-6",
          transparencyRequested ? className : undefined
        )}
        data-testid={transparencyRequested ? "forecast-display-container" : undefined}
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            {beach?.name || (transparencyRequested ? "No Data" : undefined)}
          </h2>
          <h3 className="text-lg text-muted-foreground">
            10-Day Surf Forecast
          </h3>
        </div>

        <div className="text-center py-8">
          <p className="text-gray-600">No forecast data available</p>
        </div>
      </div>
    );
  }

  // Transparency-enhanced render path
  if (transparencyRequested) {
    const primaryForecast = forecasts[0];
    const hasFallbackData = forecasts.some((f) => f.data_source === "FALLBACK");

    return (
      <div
        className={cn(
          "max-w-6xl mx-auto px-4 space-y-6",
          {
            "mobile-optimized": mobile,
          },
          className
        )}
        data-testid="forecast-display-container"
      >
        {/* Header Section */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {beach?.name || "Surf Forecast"}
            </h2>
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
          </div>
          <h3 className="text-lg text-gray-600">10-Day Surf Forecast</h3>
        </div>

        {/* Transparency Section */}
        {transparencyVisible && (
          <div
            className="space-y-4"
            role="region"
            aria-label="forecast transparency"
          >
            {/* Quality Summary */}
            {showQualitySummary && qualityMetrics && (
              <Card>
                <CardContent className="p-4">
                  <div
                    data-testid="forecast-quality-summary"
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        Forecast Quality Overview (next 10 days)
                      </h4>
                      <Badge
                        variant={
                          qualityMetrics.qualityLevel === "high"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {qualityMetrics.qualityLevel === "high"
                          ? "High quality data"
                          : qualityMetrics.qualityLevel === "medium"
                          ? "Mixed quality data"
                          : "Limited quality data"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">
                          High-confidence windows:
                        </span>
                        <span className="font-medium ml-2">
                          {qualityMetrics.highConfidencePercent}% high confidence
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">CDIP Data usage:</span>
                        <span className="font-medium ml-2">
                          {qualityMetrics.cdipPercent}%
                        </span>
                      </div>
                    </div>

                    {qualityMetrics.qualityLevel !== "high" && (
                      <div className="text-xs text-yellow-600">
                        Mixed data quality - some forecasts use fallback data
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Primary Data Source */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                compact={compact}
                data-testid="detailed-data-source-indicator"
              />

              <ConfidenceScoreExplanation
                score={primaryForecast.confidence_score}
                beachName={beach?.name}
                compact={compact}
                data-testid="detailed-confidence-explanation"
              />
            </div>

            {/* Quality Variations Warning */}
            {highlightQualityVariations && qualityMetrics?.hasVariations && (
              <div
                data-testid="quality-variation-warning"
                className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
              >
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium">
                    Data quality varies by day
                  </span>
                </div>
                <p className="text-xs text-yellow-600 mt-1">
                  Some days use high-quality CDIP data while others rely on
                  fallback sources
                </p>
              </div>
            )}

            {/* Fallback Information */}
            {showFallbackInfo && hasFallbackData && (
              <ForecastFallbackMessaging
                fallbackType="nearest_beach"
                originalLocation={beach?.name || "this location"}
                fallbackLocation="nearby area"
                reason="Limited data available for some forecast periods"
                accuracyImpact="medium"
                data-testid="detailed-fallback-messaging"
              />
            )}

            {/* Daily Breakdown */}
            {expandableByDay && qualityMetrics?.hasVariations && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Daily Transparency Breakdown
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDailyBreakdownExpanded(!dailyBreakdownExpanded)
                      }
                      aria-label="Show daily breakdown"
                    >
                      <span>Details</span>
                      {dailyBreakdownExpanded ? (
                        <ChevronUp className="h-4 w-4 ml-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {dailyBreakdownExpanded && (
                  <CardContent>
                    <div
                      data-testid="daily-transparency-breakdown"
                      className="space-y-2"
                    >
                      {forecasts.slice(0, 5).map((forecast, index) => {
                        const date = new Date(forecast.forecast_date);
                        const dateString = date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                        const score = forecast.confidence_score;
                        const isHigh = score != null && score >= 75;
                        const isMedium =
                          score != null && score >= 50 && score < 75;
                        const isLow = score != null && score < 50;
                        const isUnknown = score == null;

                        return (
                          <div
                            key={forecast.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>{dateString}:</span>
                            <div className="flex items-center space-x-2">
                              <Badge
                                variant={isHigh ? "default" : "secondary"}
                                className={cn("text-xs", {
                                  "bg-green-100 text-green-700": isHigh,
                                  "bg-red-100 text-red-700": isLow,
                                  "bg-gray-100 text-gray-600": isUnknown,
                                })}
                              >
                                {isHigh
                                  ? "High confidence"
                                  : isMedium
                                  ? "Medium confidence"
                                  : isLow
                                  ? "Low confidence"
                                  : "Unknown confidence"}
                              </Badge>
                              <span className="text-gray-500 text-xs">
                                {forecast.data_source}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Screen Reader Announcement */}
            <div
              role="status"
              aria-label="forecast quality"
              className="sr-only"
              aria-live="polite"
            >
              {qualityMetrics?.hasVariations
                ? "Mixed data quality - some forecasts use fallback data"
                : "High quality forecast data available"}
            </div>
          </div>
        )}

        {/* Main Forecast Table */}
        <div role="region" aria-label="10-day forecast">
          <MultiDayForecastTable forecasts={forecasts} beachTimezone={beach?.timezone} />
        </div>
      </div>
    );
  }

  // Base render path (no transparency)
  // Get the data source from the first forecast (all forecasts from the same generation will have the same data source)
  const dataSource = (forecasts[0]?.data_source || "FALLBACK") as "NOAA_NWS" | "CDIP" | "FALLBACK";

  return (
    <div className="max-w-6xl mx-auto px-4 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{beach?.name}</h2>
        <h3 className="text-lg text-gray-600">10-Day Surf Forecast</h3>
      </div>

      <ForecastDataTransparency dataSource={dataSource} />

      <MultiDayForecastTable forecasts={forecasts} beachTimezone={beach?.timezone} />
    </div>
  );
}
