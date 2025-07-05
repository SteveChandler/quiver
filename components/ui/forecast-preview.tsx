"use client";

import { Waves, Wind, Thermometer, Loader2 } from "lucide-react";
import type { ForecastPreview } from "@/types/forecast";

interface ForecastPreviewProps {
  forecastPreview: ForecastPreview | null;
  loading: boolean;
  error?: string | null;
  showConfidenceScore?: boolean;
  className?: string;
  variant?: "grid" | "inline";
}

export function ForecastPreview({
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
        className={`flex items-center text-xs text-muted-foreground ${className}`}
      >
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Loading forecast...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        {error}
      </div>
    );
  }

  if (!forecastPreview) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        No forecast data available
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-center space-x-4 text-xs ${className}`}>
        <div className="flex items-center text-blue-600">
          <Waves className="h-3 w-3 mr-1" />
          <span>{forecastPreview.wave_height}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <Wind className="h-3 w-3 mr-1" />
          <span>{forecastPreview.wind_speed}</span>
        </div>
        <div className="flex items-center text-orange-600">
          <Thermometer className="h-3 w-3 mr-1" />
          <span>{forecastPreview.weather_condition.split(" ")[0]}</span>
        </div>
        {showConfidenceScore && forecastPreview.confidence_score && (
          <div className="text-xs text-muted-foreground">
            Confidence: {forecastPreview.confidence_score}%
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center text-blue-600">
          <Waves className="h-3 w-3 mr-1" />
          <span>{forecastPreview.wave_height}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <Wind className="h-3 w-3 mr-1" />
          <span>{forecastPreview.wind_speed}</span>
        </div>
        <div className="flex items-center text-orange-600">
          <Thermometer className="h-3 w-3 mr-1" />
          <span>{forecastPreview.weather_condition.split(" ")[0]}</span>
        </div>
      </div>
      {showConfidenceScore && forecastPreview.confidence_score && (
        <div className="text-xs text-muted-foreground">
          Confidence: {forecastPreview.confidence_score}%
        </div>
      )}
    </div>
  );
}
