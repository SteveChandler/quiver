"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface ForecastStatsProps {
  forecasts: EnhancedForecastEntity[];
  availableDates: string[];
}

export function ForecastStats({
  forecasts,
  availableDates,
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

  return (
    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
      <div className="flex items-center space-x-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">
            {availableDates.length}
          </p>
          <p className="text-sm text-muted-foreground">Days</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{forecasts.length}</p>
          <p className="text-sm text-muted-foreground">Forecasts</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">
            {averageConfidence}%
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center cursor-help">
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
  );
}
