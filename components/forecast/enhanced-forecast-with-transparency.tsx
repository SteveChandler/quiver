import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ForecastDataSourceIndicator } from "@/components/forecast/forecast-data-source-indicator";
import { ConfidenceScoreExplanation } from "@/components/forecast/confidence-score-explanation";
import { ForecastFallbackMessaging } from "@/components/forecast/forecast-fallback-messaging";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface EnhancedForecastWithTransparencyProps {
  forecast: EnhancedForecastEntity;
  beachName: string;
  showDataSource?: boolean;
  showConfidence?: boolean;
  showFallbackInfo?: boolean;
  compact?: boolean;
  minimal?: boolean;
  interactive?: boolean;
  className?: string;
}

export function EnhancedForecastWithTransparency({
  forecast,
  beachName,
  showDataSource = true,
  showConfidence = true,
  showFallbackInfo = true,
  compact = false,
  minimal = false,
  interactive = false,
  className,
}: EnhancedForecastWithTransparencyProps) {
  // Extract transparency data from forecast
  const rawForecast = forecast.raw_forecast as any;
  const dataSources = rawForecast?.data_sources || [forecast.data_source];
  const isFallback = forecast.data_source === "FALLBACK";
  const confidenceScore = forecast.confidence_score;
  const isLowConfidence = confidenceScore != null && confidenceScore < 50;

  // Determine container styling based on data quality
  const getContainerStyling = () => {
    if (isFallback) {
      return "border-yellow-200 bg-yellow-50";
    }
    if (isLowConfidence) {
      return "border-orange-200 bg-orange-50";
    }
    return "border-gray-200 bg-white";
  };

  // Extract fallback information
  const fallbackInfo = rawForecast?.fallback_info;

  return (
    <Card
      className={cn(
        "w-full transition-colors",
        getContainerStyling(),
        className
      )}
      data-testid="forecast-container"
      aria-label={`Enhanced forecast for ${beachName} with transparency information`}
      role="region"
      aria-labelledby="forecast-transparency"
    >
      <CardContent className="p-4 space-y-4">
        {/* Main Forecast Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <div className="text-lg font-semibold text-blue-600">
                  {forecast.wave_height}
                </div>
                <div className="text-sm text-gray-600">
                  {forecast.wind_speed}
                </div>
                <div className="text-sm text-gray-600">
                  {forecast.weather_condition}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {forecast.forecast_at ? new Date(forecast.forecast_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : `${forecast.forecast_date} ${forecast.forecast_time}`}
              </div>
            </div>

            {/* Quick confidence indicator */}
            {showConfidence && confidenceScore != null && (
              <Badge
                variant={
                  confidenceScore >= 75 ? "default" : "secondary"
                }
                className={cn("text-xs", {
                  "bg-green-100 text-green-700":
                    confidenceScore >= 75,
                  "bg-yellow-100 text-yellow-700":
                    confidenceScore >= 50 &&
                    confidenceScore < 75,
                  "bg-red-100 text-red-700": confidenceScore < 50,
                })}
              >
                {confidenceScore}%
              </Badge>
            )}
          </div>
        </div>

        {/* Transparency Information */}
        <div
          id="forecast-transparency"
          className="space-y-3"
          role="region"
          aria-label="forecast transparency"
        >
          {/* Data Source Indicator */}
          {showDataSource && (
            <ForecastDataSourceIndicator
              dataSource={forecast.data_source}
              confidenceScore={confidenceScore}
              dataSources={dataSources}
              fallbackLocation={fallbackInfo?.fallback_location}
              nearestBuoyDistance={fallbackInfo?.distance}
              nearestBuoyName={fallbackInfo?.fallback_location}
              isRealTimeData={dataSources.includes("CDIP")}
              isStaleData={false} // Could be enhanced with timestamp checking
              lastUpdated={forecast.updated_at}
              expandable={interactive}
              compact={compact}
            />
          )}

          {/* Confidence Score Explanation */}
          {showConfidence && (
            <ConfidenceScoreExplanation
              score={confidenceScore}
              beachName={beachName}
              expandable={interactive}
              compact={compact || minimal}
              showWarning={isLowConfidence}
            />
          )}

          {/* Fallback Messaging */}
          {showFallbackInfo && isFallback && fallbackInfo && (
            <ForecastFallbackMessaging
              fallbackType={fallbackInfo.type as any}
              originalLocation={fallbackInfo.original_location}
              fallbackLocation={fallbackInfo.fallback_location}
              distance={fallbackInfo.distance}
              reason="Limited data available for this location"
              accuracyImpact={
                fallbackInfo.distance > 20
                  ? "high"
                  : fallbackInfo.distance > 10
                  ? "medium"
                  : "low"
              }
              confidenceReduction={Math.round((fallbackInfo.distance || 0) * 2)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
