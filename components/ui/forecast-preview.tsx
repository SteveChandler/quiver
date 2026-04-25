"use client";

import { memo } from "react";
import { Waves, Wind, Thermometer, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceScoreExplanation } from "@/components/forecast/confidence-score-explanation";
import { ForecastDataSourceIndicator } from "@/components/forecast/forecast-data-source-indicator";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import type { ForecastPreview as ForecastPreviewType } from "@/types/forecast";

// Extended data shape required when showTransparency, showDistance, or confidence
// badge styling is enabled. Superset of the base ForecastPreviewType.
interface ForecastPreviewData extends ForecastPreviewType {
  data_source: string;
  data_sources: string[];
  fallback_info?: {
    type: string;
    distance?: number;
  };
}

interface ForecastPreviewProps {
  forecastPreview: ForecastPreviewType | ForecastPreviewData | null;
  loading: boolean;
  error?: string | null;
  showConfidenceScore?: boolean;
  className?: string;
  variant?: "grid" | "inline";
  // Transparency props (Phase 2C — defaults to false for backward compat)
  showTransparency?: boolean;
  showDistance?: boolean;
  minimal?: boolean;
  mobile?: boolean;
  extraCompact?: boolean;
  // Legacy support passthrough
  legacy_prop_support?: boolean;
}

function isForecastPreviewData(
  fp: ForecastPreviewType | ForecastPreviewData
): fp is ForecastPreviewData {
  return (fp as ForecastPreviewData).data_source !== undefined;
}

function ForecastPreviewComponent({
  forecastPreview,
  loading,
  error,
  showConfidenceScore = false,
  className = "",
  variant = "grid",
  showTransparency = false,
  showDistance = false,
  minimal = false,
  mobile = false,
  extraCompact = false,
}: ForecastPreviewProps) {
  // --- Loading state ---
  if (loading) {
    if (showTransparency) {
      return (
        <Card className={cn("w-full", className)}>
          <CardContent className="p-3">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              <div
                data-testid="transparency-loading"
                className="h-3 bg-gray-200 rounded w-2/3"
              >
                <span className="sr-only">Loading transparency data...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div
        className={`flex items-center text-sm text-muted-foreground ${className}`}
      >
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Loading forecast...
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    if (showTransparency && !forecastPreview) {
      return (
        <Card className={cn("w-full border-red-200", className)}>
          <CardContent className="p-3">
            <div className="text-sm text-red-600">Error: {error}</div>
            <div
              data-testid="transparency-error"
              className="text-xs text-red-500 mt-1"
            >
              Transparency data unavailable
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        {error}
      </div>
    );
  }

  // --- No data state ---
  if (!forecastPreview) {
    if (showTransparency) {
      return (
        <Card className={cn("w-full", className)}>
          <CardContent className="p-3">
            <div className="text-sm text-gray-500">No forecast data</div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No forecast data available
      </div>
    );
  }

  // --- Transparency-enhanced rendering (Card-wrapped) ---
  if (showTransparency || (isForecastPreviewData(forecastPreview) && (showDistance || showConfidenceScore))) {
    const fp = forecastPreview as ForecastPreviewData;
    const hasTransparencyData = isForecastPreviewData(fp);
    const isFallback = hasTransparencyData && fp.data_source === "FALLBACK";
    const confidenceScore = fp.confidence_score ?? 0;
    const isLowConfidence = confidenceScore < 50;

    const getContainerStyling = () => {
      if (isFallback) return "border-yellow-200 bg-yellow-50";
      if (isLowConfidence) return "border-orange-200 bg-orange-50";
      return "border-gray-200 bg-white";
    };

    const getConfidenceStyling = (score: number) => {
      if (score >= 75) return "bg-green-100 text-green-700";
      if (score >= 50) return "bg-yellow-100 text-yellow-700";
      return "bg-red-100 text-red-700";
    };

    return (
      <Card
        className={cn(
          "w-full transition-colors",
          getContainerStyling(),
          {
            "mobile-compact": mobile,
          },
          className
        )}
        data-testid="forecast-preview-container"
        aria-label="Forecast preview with transparency information"
      >
        <CardContent className="p-3">
          {variant === "grid" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center space-x-1">
                  <Waves className="h-3 w-3 text-blue-500" />
                  <WaveHeightDisplay
                    height={fp.wave_height}
                    dataSource={hasTransparencyData ? fp.data_source : null}
                    confidenceScore={fp.confidence_score ?? null}
                    showTooltip={hasTransparencyData}
                    className="font-medium"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <Wind className="h-3 w-3 text-gray-500" />
                  <span>{fp.wind_speed}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Thermometer className="h-3 w-3 text-orange-500" />
                  <span className="text-xs">{fp.weather_condition}</span>
                </div>
              </div>

              {showTransparency && !extraCompact && hasTransparencyData && (
                <div className="space-y-2">
                  {!minimal && (
                    <ForecastDataSourceIndicator
                      dataSource={fp.data_source}
                      confidenceScore={confidenceScore}
                      dataSources={fp.data_sources}
                      compact={true}
                      data-testid="compact-data-source"
                    />
                  )}
                  <ConfidenceScoreExplanation
                    score={confidenceScore}
                    compact={true}
                    data-testid="compact-confidence"
                  />
                </div>
              )}

              {showConfidenceScore && (
                <div className="flex justify-end">
                  <Badge
                    className={cn(
                      "text-xs",
                      getConfidenceStyling(confidenceScore)
                    )}
                    data-testid="confidence-badge"
                    aria-label={
                      isLowConfidence ? "Low confidence forecast" : undefined
                    }
                  >
                    {confidenceScore}%
                  </Badge>
                </div>
              )}

              {showDistance &&
                isFallback &&
                fp.fallback_info?.distance && (
                  <div
                    className="flex items-center justify-center"
                    data-testid="distance-indicator"
                  >
                    <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                    <span className="text-xs text-gray-500">
                      ~{fp.fallback_info.distance} mi
                    </span>
                  </div>
                )}
            </div>
          ) : (
            /* Inline variant */
            <div className={cn("flex items-center space-x-3 justify-between")}>
              <div className="flex items-center space-x-2 text-sm">
                <WaveHeightDisplay
                  height={fp.wave_height}
                  dataSource={hasTransparencyData ? fp.data_source : null}
                  confidenceScore={fp.confidence_score ?? null}
                  showTooltip={hasTransparencyData}
                  className="font-medium text-blue-600"
                />
                <span className="text-gray-600">{fp.wind_speed}</span>
                {!mobile && (
                  <span className="text-xs text-gray-500">
                    {fp.weather_condition}
                  </span>
                )}
              </div>

              {showTransparency && !extraCompact && hasTransparencyData && (
                <div className="flex items-center space-x-2">
                  {!minimal && (
                    <ForecastDataSourceIndicator
                      dataSource={fp.data_source}
                      confidenceScore={confidenceScore}
                      dataSources={fp.data_sources}
                      compact={true}
                      data-testid="compact-data-source"
                    />
                  )}
                  <ConfidenceScoreExplanation
                    score={confidenceScore}
                    compact={true}
                    data-testid="compact-confidence"
                  />
                </div>
              )}

              {extraCompact && showTransparency ? (
                <ConfidenceScoreExplanation
                  score={confidenceScore}
                  compact={true}
                  data-testid="compact-confidence"
                />
              ) : (
                showConfidenceScore && (
                  <Badge
                    className={cn(
                      "text-xs",
                      getConfidenceStyling(confidenceScore)
                    )}
                    data-testid="confidence-badge"
                  >
                    {confidenceScore}%
                  </Badge>
                )
              )}
            </div>
          )}

          {isLowConfidence && (
            <div className="sr-only" aria-label="Low confidence forecast">
              This forecast has low confidence due to limited data availability.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- Original simple rendering (no transparency, no Card wrapper) ---
  if (variant === "inline") {
    return (
      <div className={`flex items-center justify-between text-sm ${className}`}>
        <div className="flex items-center text-blue-600">
          <Waves className="h-4 w-4 mr-1" />
          <WaveHeightDisplay
            height={forecastPreview.wave_height}
            showTooltip={false}
          />
        </div>
        <div className="flex items-center text-gray-600">
          <Wind className="h-4 w-4 mr-1" />
          <span>{forecastPreview.wind_speed}</span>
        </div>
        <div className="flex items-center text-orange-600">
          <Thermometer className="h-4 w-4 mr-1" />
          <span>
            {forecastPreview.weather_condition || "N/A"}
          </span>
        </div>
        {showConfidenceScore && forecastPreview.confidence_score && (
          <div className="text-sm text-muted-foreground">
            Confidence: {forecastPreview.confidence_score}%
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center text-blue-600">
          <Waves className="h-4 w-4 mr-1" />
          <WaveHeightDisplay
            height={forecastPreview.wave_height}
            showTooltip={false}
          />
        </div>
        <div className="flex items-center text-gray-600">
          <Wind className="h-4 w-4 mr-1" />
          <span>{forecastPreview.wind_speed}</span>
        </div>
        <div className="flex items-center text-orange-600">
          <Thermometer className="h-4 w-4 mr-1" />
          <span>
            {forecastPreview.weather_condition || "N/A"}
          </span>
        </div>
      </div>
      {showConfidenceScore && forecastPreview.confidence_score && (
        <div className="text-sm text-muted-foreground">
          Confidence: {forecastPreview.confidence_score}%
        </div>
      )}
    </div>
  );
}

/**
 * Custom comparison function for ForecastPreview memoization
 * Handles ForecastPreview object prop correctly
 */
const areForecastPreviewPropsEqual = (
  prev: ForecastPreviewProps,
  next: ForecastPreviewProps
): boolean => {
  // Simple props
  if (prev.loading !== next.loading) return false;
  if (prev.error !== next.error) return false;
  if (prev.showConfidenceScore !== next.showConfidenceScore) return false;
  if (prev.className !== next.className) return false;
  if (prev.variant !== next.variant) return false;
  if (prev.showTransparency !== next.showTransparency) return false;
  if (prev.showDistance !== next.showDistance) return false;
  if (prev.minimal !== next.minimal) return false;
  if (prev.mobile !== next.mobile) return false;
  if (prev.extraCompact !== next.extraCompact) return false;

  // Compare forecastPreview object
  if (!prev.forecastPreview && !next.forecastPreview) return true;
  if (!prev.forecastPreview || !next.forecastPreview) return false;

  // Compare key forecast properties that affect display
  return (
    prev.forecastPreview.wave_height === next.forecastPreview.wave_height &&
    prev.forecastPreview.wind_speed === next.forecastPreview.wind_speed &&
    prev.forecastPreview.weather_condition ===
      next.forecastPreview.weather_condition &&
    prev.forecastPreview.confidence_score ===
      next.forecastPreview.confidence_score
  );
};

/**
 * Memoized ForecastPreview to prevent unnecessary re-renders
 * This component is used frequently in beach cards and detail views
 */
export const ForecastPreview = memo(
  ForecastPreviewComponent,
  areForecastPreviewPropsEqual
);
ForecastPreview.displayName = "ForecastPreview";
