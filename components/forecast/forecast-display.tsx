"use client";

import React from "react";
import { MultiDayForecastTable } from "@/components/forecast/forecast-table";
import ForecastDataTransparency from "@/components/ui/forecast-data-transparency";
import { ForecastDisplayWithTransparency } from "@/components/forecast/forecast-display-with-transparency";
import type { EnhancedForecastEntity } from "@/types/forecast";

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
  className,
}: ForecastDisplayProps) {
  // If transparency is requested, use the enhanced component
  if (showTransparency || showQualitySummary || allowToggleTransparency) {
    return (
      <ForecastDisplayWithTransparency
        forecasts={forecasts}
        beach={beach}
        loading={loading}
        error={error}
        showTransparency={showTransparency}
        showQualitySummary={showQualitySummary}
        showFallbackInfo={showFallbackInfo}
        allowToggleTransparency={allowToggleTransparency}
        className={className}
      />
    );
  }
  if (loading) {
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

  if (error) {
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

  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">{beach?.name}</h2>
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
