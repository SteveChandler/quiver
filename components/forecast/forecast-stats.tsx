"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface DataSourceInfo {
  name: string;
  type: "wave" | "tide" | "weather" | "buoy";
  status: "active" | "fallback" | "unavailable";
  confidence: number;
  lastUpdated?: string;
}

interface ForecastStatsProps {
  forecasts: EnhancedForecastEntity[];
  availableDates: string[];
  dataSources?: DataSourceInfo[];
}

export function ForecastStats({
  forecasts,
  availableDates,
  dataSources = [],
}: ForecastStatsProps) {
  if (forecasts.length === 0) {
    return null;
  }

  const averageConfidence = Math.round(
    forecasts.reduce(
      (sum: number, f: EnhancedForecastEntity) =>
        sum + (f.confidence_score || 0),
      0
    ) / forecasts.length
  );

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-4 bg-blue-50 rounded-lg space-y-4">
      {/* Main Stats Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {availableDates.length}
            </p>
            <p className="text-sm text-gray-600">Days</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {forecasts.length}
            </p>
            <p className="text-sm text-gray-600">Forecasts</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {averageConfidence}%
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm text-gray-600 flex items-center gap-1 justify-center cursor-help">
                    Avg Confidence
                    <HelpCircle className="h-3 w-3" />
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    How reliable the forecast data is based on data freshness,
                    source quality, and forecast timeframe. Higher scores mean
                    more reliable predictions.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-800 border-blue-200"
        >
          Enhanced Data
        </Badge>
      </div>

      {/* Data Quality Section */}
      <div className="flex items-center justify-between pt-2 border-t border-blue-200">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            Data Quality
          </span>
          <div className="flex items-center gap-1">
            <div
              className={`h-3 w-3 rounded-full ${getConfidenceColor(
                averageConfidence
              )}`}
            />
            <span className="text-sm font-medium text-blue-900">
              {averageConfidence}%
            </span>
          </div>
        </div>

        {/* Data Sources */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-blue-700 font-medium">Sources:</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-blue-700">NOAA WaveWatch III</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-blue-700">NOAA CO-OPS</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-blue-700">NOAA Weather</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-blue-700">NDBC Buoys</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
