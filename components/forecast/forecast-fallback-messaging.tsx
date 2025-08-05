import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Navigation,
  AlertTriangle,
  RefreshCw,
  Info,
  ChevronRight,
} from "lucide-react";

interface AlternativeLocation {
  name: string;
  distance: number;
}

interface FallbackChainItem {
  location: string;
  status: "failed" | "active";
  reason: string;
}

interface ForecastFallbackMessagingProps {
  fallbackType:
    | "nearest_beach"
    | "nearest_buoy"
    | "regional"
    | "out_of_area"
    | "unknown";
  originalLocation: string;
  fallbackLocation: string;
  distance?: number;
  reason: string;
  accuracyImpact?: "low" | "medium" | "high";
  confidenceReduction?: number;
  isOutOfArea?: boolean;
  isTemporary?: boolean;
  showRequestDataOption?: boolean;
  alternatives?: AlternativeLocation[];
  fallbackChain?: FallbackChainItem[];
  onRefresh?: () => void;
  onRequestData?: (location: string) => void;
  className?: string;
}

export function ForecastFallbackMessaging({
  fallbackType,
  originalLocation,
  fallbackLocation,
  distance,
  reason,
  accuracyImpact = "medium",
  confidenceReduction,
  isOutOfArea = false,
  isTemporary = false,
  showRequestDataOption = false,
  alternatives = [],
  fallbackChain = [],
  onRefresh,
  onRequestData,
  className,
}: ForecastFallbackMessagingProps) {
  // Determine styling based on impact level
  const getImpactStyling = (impact: string) => {
    switch (impact) {
      case "low":
        return {
          containerClass: "border-blue-200 bg-blue-50",
          iconColor: "text-blue-600",
          textColor: "text-blue-800",
        };
      case "medium":
        return {
          containerClass: "border-yellow-200 bg-yellow-50",
          iconColor: "text-yellow-600",
          textColor: "text-yellow-800",
        };
      case "high":
        return {
          containerClass: "border-red-200 bg-red-50",
          iconColor: "text-red-600",
          textColor: "text-red-800",
        };
      default:
        return {
          containerClass: "border-gray-200 bg-gray-50",
          iconColor: "text-gray-600",
          textColor: "text-gray-800",
        };
    }
  };

  const styling = getImpactStyling(accuracyImpact);

  // Get title and description based on fallback type
  const getFallbackInfo = (type: string) => {
    switch (type) {
      case "nearest_beach":
        return {
          title: `Using forecast from ${fallbackLocation}`,
          icon: <MapPin className="h-4 w-4" />,
          description: distance ? `${distance} miles away` : "",
        };
      case "nearest_buoy":
        return {
          title: `Using buoy data from ${fallbackLocation}`,
          icon: <Navigation className="h-4 w-4" />,
          description: distance ? `${distance} miles away` : "",
        };
      case "regional":
        return {
          title: "Using regional forecast",
          icon: <MapPin className="h-4 w-4" />,
          description: fallbackLocation,
        };
      case "out_of_area":
        return {
          title: "Outside forecast coverage",
          icon: <AlertTriangle className="h-4 w-4" />,
          description: `${originalLocation} is outside our supported area`,
        };
      default:
        return {
          title: "Using alternative forecast",
          icon: <Info className="h-4 w-4" />,
          description: fallbackLocation,
        };
    }
  };

  const fallbackInfo = getFallbackInfo(fallbackType);

  // Get accuracy impact message
  const getAccuracyMessage = (impact: string, reduction?: number) => {
    switch (impact) {
      case "low":
        return {
          title: "Minimal impact on accuracy",
          description: "Very close data source",
          detail: reduction ? `~${reduction}% confidence reduction` : "",
        };
      case "medium":
        return {
          title: "Forecast accuracy may be reduced",
          description: distance
            ? `${distance} miles difference`
            : "Moderate distance",
          detail: reduction ? `~${reduction}% less confident` : "",
        };
      case "high":
        return {
          title: "Significant accuracy reduction",
          description: "Far from original location",
          detail: reduction ? `~${reduction}% less confident` : "",
        };
      default:
        return {
          title: "Accuracy impact unknown",
          description: "",
          detail: "",
        };
    }
  };

  const accuracyMessage = getAccuracyMessage(
    accuracyImpact,
    confidenceReduction
  );

  return (
    <Alert
      className={cn(styling.containerClass, className)}
      data-testid="fallback-message"
      role="alert"
      aria-label="Using alternative forecast data"
    >
      <div className={styling.iconColor}>{fallbackInfo.icon}</div>

      <AlertDescription className="space-y-3">
        {/* Main fallback message */}
        <div>
          <div className="flex items-center justify-between">
            <h4 className={cn("font-medium", styling.textColor)}>
              {fallbackInfo.title}
            </h4>
            {accuracyImpact === "high" && (
              <Badge
                variant="destructive"
                className="text-xs"
                data-testid="high-impact-warning"
              >
                High Impact
              </Badge>
            )}
          </div>

          {fallbackInfo.description && (
            <p className="text-sm text-gray-600 mt-1">
              {fallbackInfo.description}
            </p>
          )}

          <p className="text-sm text-gray-600 mt-1">{reason}</p>
        </div>

        {/* Out of area specific messaging */}
        {isOutOfArea && (
          <div className="text-sm">
            <p>Showing {fallbackLocation} as reference</p>
          </div>
        )}

        {/* Accuracy impact information */}
        <div className="bg-white/50 rounded-md p-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{accuracyMessage.title}</span>
            {accuracyMessage.detail && (
              <span className="text-xs text-gray-500">
                {accuracyMessage.detail}
              </span>
            )}
          </div>
          {accuracyMessage.description && (
            <p className="text-xs text-gray-600 mt-1">
              {accuracyMessage.description}
            </p>
          )}
        </div>

        {/* Fallback chain display */}
        {fallbackChain.length > 0 && (
          <div className="bg-white/50 rounded-md p-2">
            <h5 className="text-sm font-medium mb-2">
              Tried multiple sources:
            </h5>
            <div className="space-y-1 text-xs">
              {fallbackChain.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span
                    className={
                      item.status === "failed"
                        ? "text-red-600"
                        : "text-green-600"
                    }
                  >
                    {item.location}
                  </span>
                  <span className="text-gray-500">{item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alternative locations */}
        {alternatives.length > 0 && (
          <div className="bg-white/50 rounded-md p-2">
            <h5 className="text-sm font-medium mb-2">
              Try nearby supported locations:
            </h5>
            <div className="space-y-1">
              {alternatives.map((alt, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {alt.name} ({alt.distance} mi)
                  </span>
                  <ChevronRight className="h-3 w-3 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center space-x-2 pt-2">
          {isTemporary && onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Try again
            </Button>
          )}

          {showRequestDataOption && onRequestData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequestData(originalLocation)}
              className="text-xs"
            >
              <MapPin className="h-3 w-3 mr-1" />
              Request forecast for {originalLocation}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
