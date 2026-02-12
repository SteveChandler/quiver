"use client";

import { memo } from "react";
import { Waves, Wind, Thermometer, Loader2 } from "lucide-react";
import type { ForecastPreview as ForecastPreviewType } from "@/types/forecast";

interface ForecastPreviewProps {
  forecastPreview: ForecastPreviewType | null;
  loading: boolean;
  error?: string | null;
  showConfidenceScore?: boolean;
  className?: string;
  variant?: "grid" | "inline";
}

function ForecastPreviewComponent({
  forecastPreview,
  loading,
  error,
  showConfidenceScore = false,
  className = "",
  variant = "grid",
}: ForecastPreviewProps) {
  if (loading) {
    return (
      <div
        className={`flex items-center text-sm text-muted-foreground ${className}`}
      >
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Loading forecast...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        {error}
      </div>
    );
  }

  if (!forecastPreview) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No forecast data available
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-center justify-between text-sm ${className}`}>
        <div className="flex items-center text-blue-600">
          <Waves className="h-4 w-4 mr-1" />
          <span>{forecastPreview.wave_height}</span>
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
          <span>{forecastPreview.wave_height}</span>
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
