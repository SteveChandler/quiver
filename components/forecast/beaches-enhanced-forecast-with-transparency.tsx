import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import { useEnhancedForecast } from "@/hooks/use-enhanced-forecast";
import { ForecastDataSourceIndicator } from "@/components/forecast/forecast-data-source-indicator";
import { ConfidenceScoreExplanation } from "@/components/forecast/confidence-score-explanation";
import { ForecastFallbackMessaging } from "@/components/forecast/forecast-fallback-messaging";
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  BarChart3,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

interface BeachesEnhancedForecastWithTransparencyProps {
  beachId?: string;
  beachName?: string;
  showHeader?: boolean;
  showTransparency?: boolean;
  showTransparencySummary?: boolean;
  showFallbackInfo?: boolean;
  showQualityChart?: boolean;
  highlightLowConfidence?: boolean;
  allowToggleTransparency?: boolean;
  expandableTransparency?: boolean;
  mobile?: boolean;
  compact?: boolean;
  className?: string;
  publicMode?: boolean;
}

export function BeachesEnhancedForecastWithTransparency({
  beachId,
  beachName = "Beach",
  showHeader = true,
  showTransparency = true,
  showTransparencySummary = false,
  showFallbackInfo = true,
  showQualityChart = false,
  highlightLowConfidence = false,
  allowToggleTransparency = false,
  expandableTransparency = false,
  mobile = false,
  compact = false,
  className,
  publicMode = false,
}: BeachesEnhancedForecastWithTransparencyProps) {
  const [transparencyVisible, setTransparencyVisible] =
    useState(showTransparency);
  const [transparencyExpanded, setTransparencyExpanded] = useState(false);

  const {
    forecasts,
    availableDates,
    selectedDate,
    loading,
    error,
    updating,
    autoGenerating,
    setSelectedDate,
    refetch,
    handleRefresh,
  } = useEnhancedForecast({
    beachId,
    defaultDays: 12,
    immediate: Boolean(beachId),
    autoGenerate: true,
  });

  // Calculate transparency summary
  const transparencySummary = React.useMemo(() => {
    if (!forecasts.length) return null;

    const highConfidenceCount = forecasts.filter(
      (f) => f.confidence_score >= 75
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
  }, [forecasts]);

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

  const primaryForecast = forecasts.length > 0 ? forecasts[0] : null;
  const hasFallbackData = forecasts.some((f) => f.data_source === "FALLBACK");
  const averageConfidence =
    forecasts.length > 0
      ? Math.round(
          forecasts.reduce((sum, f) => sum + f.confidence_score, 0) /
            forecasts.length
        )
      : 0;

  return (
    <Card className={cn("w-full", className)}>
      {showHeader && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Enhanced Forecast</span>
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

        {/* Transparency Summary */}
        {transparencyVisible &&
          showTransparencySummary &&
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
            {/* Data Source Indicator */}
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

            {/* Expandable Transparency Details */}
            {expandableTransparency && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTransparencyExpanded(!transparencyExpanded)}
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

            {/* Fallback Messaging - check for the specific fallback forecast from mock data */}
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

        {/* Data Quality Chart */}
        {transparencyVisible && showQualityChart && forecasts.length > 0 && (
          <div
            data-testid="data-quality-chart"
            className="bg-gray-50 rounded-lg p-4"
          >
            <div className="flex items-center space-x-2 mb-3">
              <BarChart3 className="h-4 w-4" />
              <h4 className="font-medium">Forecast confidence over time</h4>
            </div>
            {/* Simple confidence visualization */}
            <div className="grid grid-cols-10 gap-1 h-8">
              {forecasts.slice(0, 10).map((forecast, index) => (
                <div
                  key={index}
                  className={cn("rounded", {
                    "bg-green-400": forecast.confidence_score >= 75,
                    "bg-yellow-400":
                      forecast.confidence_score >= 50 &&
                      forecast.confidence_score < 75,
                    "bg-red-400": forecast.confidence_score < 50,
                  })}
                  title={`${forecast.forecast_date} ${forecast.forecast_time}: ${forecast.confidence_score}%`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Low Confidence Highlights */}
        {transparencyVisible && highlightLowConfidence && (
          <div className="space-y-2">
            {forecasts
              .filter((f) => f.confidence_score < 50)
              .map((forecast, index) => (
                <div
                  key={forecast.id}
                  data-testid="low-confidence-highlight"
                  className="border-l-4 border-red-400 bg-red-50 p-3 rounded-r"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {forecast.forecast_date} {forecast.forecast_time}
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
