import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceScoreExplanation } from "@/components/forecast/confidence-score-explanation";
import { ForecastDataSourceIndicator } from "@/components/forecast/forecast-data-source-indicator";
import { Waves, Wind, Thermometer, MapPin } from "lucide-react";

interface ForecastPreviewData {
  wave_height: string;
  wind_speed: string;
  weather_condition: string;
  confidence_score: number;
  data_source: string;
  data_sources: string[];
  fallback_info?: {
    type: string;
    distance?: number;
  };
}

interface ForecastPreviewWithTransparencyProps {
  forecastPreview: ForecastPreviewData | null;
  loading: boolean;
  error: string | null;
  variant?: "grid" | "inline";
  showTransparency?: boolean;
  showConfidenceScore?: boolean;
  showDistance?: boolean;
  minimal?: boolean;
  mobile?: boolean;
  extraCompact?: boolean;
  className?: string;
  // Legacy support
  legacy_prop_support?: boolean;
}

export function ForecastPreviewWithTransparency({
  forecastPreview,
  loading,
  error,
  variant = "grid",
  showTransparency = false,
  showConfidenceScore = false,
  showDistance = false,
  minimal = false,
  mobile = false,
  extraCompact = false,
  className,
}: ForecastPreviewWithTransparencyProps) {
  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-3">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            {showTransparency && (
              <div
                data-testid="transparency-loading"
                className="h-3 bg-gray-200 rounded w-2/3"
              >
                <span className="sr-only">Loading transparency data...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !forecastPreview) {
    return (
      <Card className={cn("w-full border-red-200", className)}>
        <CardContent className="p-3">
          <div className="text-sm text-red-600">Error: {error}</div>
          {showTransparency && (
            <div
              data-testid="transparency-error"
              className="text-xs text-red-500 mt-1"
            >
              Transparency data unavailable
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!forecastPreview) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-3">
          <div className="text-sm text-gray-500">No forecast data</div>
        </CardContent>
      </Card>
    );
  }

  const isFallback = forecastPreview.data_source === "FALLBACK";
  const isLowConfidence = forecastPreview.confidence_score < 50;

  // Container styling based on data quality
  const getContainerStyling = () => {
    if (isFallback) return "border-yellow-200 bg-yellow-50";
    if (isLowConfidence) return "border-orange-200 bg-orange-50";
    return "border-gray-200 bg-white";
  };

  // Confidence badge styling
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
            {/* Main forecast data in grid layout */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="flex items-center space-x-1">
                <Waves className="h-3 w-3 text-blue-500" />
                <span className="font-medium">
                  {forecastPreview.wave_height}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Wind className="h-3 w-3 text-gray-500" />
                <span>{forecastPreview.wind_speed}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Thermometer className="h-3 w-3 text-orange-500" />
                <span className="text-xs">
                  {forecastPreview.weather_condition}
                </span>
              </div>
            </div>

            {/* Transparency indicators for grid */}
            {showTransparency && !extraCompact && (
              <div className="space-y-2">
                {!minimal && (
                  <ForecastDataSourceIndicator
                    dataSource={forecastPreview.data_source}
                    confidenceScore={forecastPreview.confidence_score}
                    dataSources={forecastPreview.data_sources}
                    compact={true}
                    data-testid="compact-data-source"
                  />
                )}
                <ConfidenceScoreExplanation
                  score={forecastPreview.confidence_score}
                  compact={true}
                  data-testid="compact-confidence"
                />
              </div>
            )}

            {/* Confidence score badge */}
            {showConfidenceScore && (
              <div className="flex justify-end">
                <Badge
                  className={cn(
                    "text-xs",
                    getConfidenceStyling(forecastPreview.confidence_score)
                  )}
                  data-testid="confidence-badge"
                  aria-label={
                    isLowConfidence ? "Low confidence forecast" : undefined
                  }
                >
                  {forecastPreview.confidence_score}%
                </Badge>
              </div>
            )}

            {/* Distance indicator for fallback data */}
            {showDistance &&
              isFallback &&
              forecastPreview.fallback_info?.distance && (
                <div
                  className="flex items-center justify-center"
                  data-testid="distance-indicator"
                >
                  <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                  <span className="text-xs text-gray-500">
                    ~{forecastPreview.fallback_info.distance} mi
                  </span>
                </div>
              )}
          </div>
        ) : (
          /* Inline variant */
          <div className={cn("flex items-center space-x-3 justify-between")}>
            {/* Main forecast data inline */}
            <div className="flex items-center space-x-2 text-sm">
              <span className="font-medium text-blue-600">
                {forecastPreview.wave_height}
              </span>
              <span className="text-gray-600">
                {forecastPreview.wind_speed}
              </span>
              {!mobile && (
                <span className="text-xs text-gray-500">
                  {forecastPreview.weather_condition}
                </span>
              )}
            </div>

            {/* Compact transparency for inline */}
            {showTransparency && !extraCompact && (
              <div className="flex items-center space-x-2">
                {!minimal && (
                  <ForecastDataSourceIndicator
                    dataSource={forecastPreview.data_source}
                    confidenceScore={forecastPreview.confidence_score}
                    dataSources={forecastPreview.data_sources}
                    compact={true}
                    data-testid="compact-data-source"
                  />
                )}
                <ConfidenceScoreExplanation
                  score={forecastPreview.confidence_score}
                  compact={true}
                  data-testid="compact-confidence"
                />
              </div>
            )}

            {/* Only confidence in extra compact mode */}
            {extraCompact && showTransparency ? (
              <ConfidenceScoreExplanation
                score={forecastPreview.confidence_score}
                compact={true}
                data-testid="compact-confidence"
              />
            ) : (
              showConfidenceScore && (
                <Badge
                  className={cn(
                    "text-xs",
                    getConfidenceStyling(forecastPreview.confidence_score)
                  )}
                  data-testid="confidence-badge"
                >
                  {forecastPreview.confidence_score}%
                </Badge>
              )
            )}
          </div>
        )}

        {/* Low confidence warning for screen readers */}
        {isLowConfidence && (
          <div className="sr-only" aria-label="Low confidence forecast">
            This forecast has low confidence due to limited data availability.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
