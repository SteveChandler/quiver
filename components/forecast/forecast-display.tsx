"use client";

import React from "react";
import { MultiDayForecastTable } from "@/components/forecast/multi-day-forecast-table";
import { ForecastDataTransparency } from "@/components/ui/forecast-data-transparency";
import type { EnhancedForecast } from "@/types/database";

interface ForecastDisplayProps {
  forecasts: EnhancedForecast[];
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
}

export function ForecastDisplay({
  forecasts,
  beach,
  loading,
  error,
}: ForecastDisplayProps) {
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{beach?.name}</h2>
          <h3 className="text-lg text-gray-600">10-Day Surf Forecast</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">Loading forecasts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{beach?.name}</h2>
          <h3 className="text-lg text-gray-600">10-Day Surf Forecast</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 font-semibold">Error loading forecasts</p>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{beach?.name}</h2>
          <h3 className="text-lg text-gray-600">10-Day Surf Forecast</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No forecast data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{beach?.name}</h2>
        <h3 className="text-lg text-gray-600">10-Day Surf Forecast</h3>
      </div>

      <MultiDayForecastTable forecasts={forecasts} />

      <ForecastDataTransparency forecasts={forecasts} />
    </div>
  );
}
