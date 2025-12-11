import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff, Info, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { BuoyStationLink } from "./buoy-station-link";
import type { ForecastDataState } from "@/types/forecast-states";

interface DataQuality {
  cdip?: number;
  noaa?: number;
  overall?: number;
}

interface ForecastDataSourceIndicatorProps {
  dataSource: string;
  confidenceScore: number;
  dataSources: string[];
  // Compact display flag used by some callers; noop here for compatibility
  compact?: boolean;
  fallbackLocation?: string;
  nearestBuoyDistance?: number;
  nearestBuoyName?: string;
  nearestBuoyStationId?: string;
  beachLocation?: {
    latitude: number;
    longitude: number;
  };
  dataQuality?: DataQuality;
  isRealTimeData?: boolean;
  isStaleData?: boolean;
  lastUpdated?: string;
  hasConnectionError?: boolean;
  showDetailedTooltip?: boolean;
  expandable?: boolean;
  onRetry?: () => void;
  className?: string;
  // New props for enhanced error state handling
  forecastState?: ForecastDataState;
  error?: Error | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
}

export function ForecastDataSourceIndicator({
  dataSource,
  confidenceScore,
  dataSources,
  fallbackLocation,
  nearestBuoyDistance,
  nearestBuoyName,
  nearestBuoyStationId,
  beachLocation,
  dataQuality,
  isRealTimeData = false,
  isStaleData = false,
  lastUpdated,
  hasConnectionError = false,
  showDetailedTooltip = false,
  expandable = false,
  onRetry,
  className,
  forecastState,
  error,
  isLoading = false,
  isRefreshing = false,
}: ForecastDataSourceIndicatorProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Determine confidence level and styling
  const getConfidenceLevel = (score: number) => {
    if (score >= 75) return { level: "high", color: "green" };
    if (score >= 50) return { level: "medium", color: "yellow" };
    return { level: "low", color: "red" };
  };

  const { level: confidenceLevel, color } = getConfidenceLevel(confidenceScore);

  // Get data source display info
  const getDataSourceInfo = (source: string) => {
    switch (source) {
      case "CDIP":
        return {
          name: "CDIP Buoy Data",
          description: "Real-time buoy measurements",
          icon: <Wifi className="h-4 w-4" />,
          quality: "high",
        };
      case "NOAA_NWS":
        return {
          name: "NOAA Forecast",
          description: "National Weather Service predictions",
          icon: <Wifi className="h-4 w-4" />,
          quality: "medium",
        };
      case "FALLBACK":
        return {
          name: "Fallback Data",
          description: `Using data from ${
            fallbackLocation || "nearby location"
          }`,
          icon: <WifiOff className="h-4 w-4" />,
          quality: "low",
        };
      default:
        return {
          name: "Data unavailable",
          description: "Unable to load forecast data",
          icon: <AlertTriangle className="h-4 w-4" />,
          quality: "none",
        };
    }
  };

  const sourceInfo = getDataSourceInfo(dataSource);

  // Determine if we have valid data to display metadata
  const hasValidData =
    dataSource === "CDIP" ||
    dataSource === "NOAA_NWS" ||
    dataSource === "FALLBACK";

  // Get state-specific messaging
  const getStateMessage = (state: ForecastDataState | undefined) => {
    if (!state) return null;

    switch (state) {
      case "loading":
        return {
          title: "Loading forecast",
          description: "Fetching latest surf conditions...",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: "blue",
        };

      case "refreshing":
        return {
          title: "Updating forecast",
          description: "Refreshing with latest data...",
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          color: "blue",
        };

      case "failed":
        return {
          title: "Unable to load forecast",
          description: error?.message || "Network error occurred",
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "red",
          action: "Tap to retry",
        };

      case "rate_limited":
        return {
          title: "Too many requests",
          description: "Please try again in a few minutes",
          icon: <Clock className="h-4 w-4" />,
          color: "yellow",
          action: "Auto-retry in 5 minutes",
        };

      case "no_coverage":
        return {
          title: "No forecast available",
          description: "This location is not currently covered",
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "gray",
        };

      case "stale":
        return {
          title: "Data may be outdated",
          description: `Last updated: ${formatLastUpdated(lastUpdated || "")}`,
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "amber",
          action: "Tap to refresh",
        };

      case "unavailable":
      default:
        return {
          title: "Data unavailable",
          description: "Unable to load forecast data",
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "yellow",
        };
    }
  };

  const stateMessage = getStateMessage(forecastState);

  // Format last updated time
  const formatLastUpdated = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  };

  // Handle state-specific display (if forecastState is provided)
  if (stateMessage && forecastState && ["loading", "refreshing", "failed", "rate_limited", "no_coverage"].includes(forecastState)) {
    const bgColorClass =
      stateMessage.color === "red" ? "bg-red-50 border-red-200" :
      stateMessage.color === "yellow" ? "bg-yellow-50 border-yellow-200" :
      stateMessage.color === "blue" ? "bg-blue-50 border-blue-200" :
      stateMessage.color === "gray" ? "bg-gray-50 border-gray-200" :
      "bg-amber-50 border-amber-200";

    return (
      <Alert className={bgColorClass}>
        {stateMessage.icon}
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong>{stateMessage.title}</strong>
            <br />
            <span className="text-sm">{stateMessage.description}</span>
            {stateMessage.action && (
              <div className="text-xs text-gray-500 mt-1">{stateMessage.action}</div>
            )}
          </div>
          {onRetry && forecastState !== "loading" && forecastState !== "refreshing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Handle connection errors (backward compatibility)
  if (hasConnectionError) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong>Connection Error</strong>
            <br />
            Unable to fetch latest data
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
      className={cn(
        "border rounded-lg p-3 transition-colors",
        {
          "bg-green-50 border-green-200": color === "green",
          "bg-yellow-50 border-yellow-200": color === "yellow",
          "bg-orange-50 border-orange-200":
            color === "red" && dataSource === "FALLBACK",
          "bg-red-50 border-red-200":
            color === "red" && dataSource !== "FALLBACK",
        },
        className
      )}
      data-testid="data-source-indicator"
      aria-label={`Forecast data source: ${sourceInfo.name} with ${confidenceScore}% confidence`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          {sourceInfo.icon}
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">{sourceInfo.name}</span>
              {isRealTimeData && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-100 text-green-700"
                >
                  Live Data
                </Badge>
              )}
              {dataQuality?.overall &&
                dataQuality.overall > 80 &&
                dataSources.length > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    High Quality Blend
                  </Badge>
                )}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {sourceInfo.description}
            </p>

            {/* Additional data sources */}
            {dataSources.length > 1 && (
              <p className="text-xs text-gray-500 mt-1">
                +{" "}
                {dataSources
                  .filter((s) => s !== dataSource)
                  .map((s) => {
                    if (s === "NOAA_NWS") return "NOAA Weather";
                    if (s === "NOAA_COOPS") return "Tide";
                    return s;
                  })
                  .join(" & ")}
              </p>
            )}

            {/* Nearest buoy info - only show with valid data */}
            {hasValidData &&
              nearestBuoyName &&
              nearestBuoyDistance &&
              nearestBuoyStationId && (
                <div className="mt-2">
                  <BuoyStationLink
                    stationId={nearestBuoyStationId}
                    stationName={nearestBuoyName}
                    distance={nearestBuoyDistance * 1.60934} // Convert miles to km
                    beachLocation={beachLocation}
                    variant="compact"
                  />
                </div>
              )}

          </div>
        </div>

        {/* Confidence badge and details - only show with valid data */}
        {hasValidData && (
          <div className="flex flex-col items-end space-y-1">
            <Badge
              variant={confidenceLevel === "high" ? "default" : "secondary"}
              className={cn("text-xs", {
                "bg-green-100 text-green-700": color === "green",
                "bg-yellow-100 text-yellow-700": color === "yellow",
                "bg-red-100 text-red-700": color === "red",
              })}
            >
              {confidenceScore}% confidence
            </Badge>

            {/* Expandable details */}
            {expandable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 px-2 text-xs"
                aria-label="Show confidence details"
              >
                <Info className="h-3 w-3 mr-1" />
                {isExpanded ? "Hide" : "Details"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Expanded details - only show with valid data */}
      {hasValidData && isExpanded && expandable && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium mb-2">
            Confidence Score Breakdown
          </h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Data freshness:</span>
              <span className={isStaleData ? "text-red-600" : "text-green-600"}>
                {isStaleData ? "Outdated" : "Good"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Source reliability:</span>
              <span className="text-gray-700">High</span>
            </div>
            {dataQuality && (
              <>
                {dataQuality.cdip && (
                  <div className="flex justify-between">
                    <span>CDIP:</span>
                    <span className="text-gray-700">{dataQuality.cdip}%</span>
                  </div>
                )}
                {dataQuality.noaa && (
                  <div className="flex justify-between">
                    <span>NOAA:</span>
                    <span className="text-gray-700">{dataQuality.noaa}%</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Detailed tooltip */}
      {showDetailedTooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                data-testid="data-source-trigger"
                className="absolute inset-0"
              />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs p-3">
              <div>
                <h4 className="font-medium mb-1">Data Sources Breakdown</h4>
                <div className="text-xs space-y-1">
                  {dataSources.includes("CDIP") && (
                    <p>• Wave data from CDIP buoy network</p>
                  )}
                  {dataSources.includes("NOAA_NWS") && (
                    <p>• Weather and tide from NOAA</p>
                  )}
                  {dataSources.includes("FALLBACK") && (
                    <p>• Using nearest available location data</p>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Accessibility labels */}
      {dataSource === "FALLBACK" && (
        <div className="sr-only" aria-label="Forecast reliability warning">
          Limited data available for this location. Using data from{" "}
          {fallbackLocation || "nearby area"}.
        </div>
      )}
    </div>
  );
}
