"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BeachForecastAccuracy } from "@/types/database";

// Extended type for accuracy data with additional computed fields
interface ExtendedAccuracy extends BeachForecastAccuracy {
  wave_height_accuracy?: number | null;
  wind_accuracy?: number | null;
}

interface ForecastAccuracyCardProps {
  accuracy: ExtendedAccuracy;
  beachName?: string;
  className?: string;
  showTrend?: boolean;
}

export function ForecastAccuracyCard({
  accuracy,
  beachName,
  className,
  showTrend = true,
}: ForecastAccuracyCardProps) {
  const getAccuracyColor = (score: number | null | undefined) => {
    if (!score) return "text-gray-500";
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getAccuracyBadgeVariant = (score: number | null | undefined) => {
    if (!score) return "secondary";
    if (score >= 85) return "default"; // green
    if (score >= 70) return "secondary"; // yellow
    return "destructive"; // red
  };

  const formatDelta = (delta: number | null, unit: string = "") => {
    if (!delta) return "N/A";
    return `±${delta.toFixed(1)}${unit}`;
  };

  const getTrendIcon = (current: number | null, previous: number | null) => {
    if (!current || !previous)
      return <Minus className="h-3 w-3 text-gray-500" />;
    if (current > previous)
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (current < previous)
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-gray-500" />;
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {beachName ? `${beachName} Accuracy` : "Forecast Accuracy"}
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">
                  Based on {accuracy.total_sessions_count} user sessions
                  <br />
                  Last updated:{" "}
                  {accuracy.updated_at
                    ? new Date(accuracy.updated_at).toLocaleDateString()
                    : "N/A"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Accuracy Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall Accuracy</span>
          <div className="flex items-center space-x-2">
            <Badge
              variant={getAccuracyBadgeVariant(accuracy.overall_accuracy_score)}
            >
              {accuracy.overall_accuracy_score?.toFixed(0) || "N/A"}%
            </Badge>
            {showTrend && getTrendIcon(accuracy.overall_accuracy_score, 75)}{" "}
            {/* Mock previous */}
          </div>
        </div>

        {accuracy.overall_accuracy_score && (
          <Progress value={accuracy.overall_accuracy_score} className="h-2" />
        )}

        {/* Detailed Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Wave Height</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        getAccuracyColor(accuracy.wave_height_accuracy)
                      )}
                    >
                      {accuracy.wave_height_accuracy?.toFixed(0) || "N/A"}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">
                      Average error:{" "}
                      {formatDelta(accuracy.avg_wave_height_delta, "ft")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Wind Conditions</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        getAccuracyColor(accuracy.wind_accuracy)
                      )}
                    >
                      {accuracy.wind_accuracy?.toFixed(0) || "N/A"}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">
                      Average error:{" "}
                      {formatDelta(accuracy.avg_wind_speed_delta, "mph")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Total Sessions</span>
              <span className="text-sm font-medium">
                {accuracy.total_sessions_count}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Recent (30d)</span>
              <span className="text-sm font-medium">
                {accuracy.last_30_days_count}
              </span>
            </div>
          </div>
        </div>

        {/* Data Recency Badge */}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-xs text-gray-500">
            Updated {new Date(accuracy.calculation_date).toLocaleDateString()}
          </span>
          <Badge variant="outline" className="text-xs">
            {accuracy.last_7_days_count} sessions this week
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
