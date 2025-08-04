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
import {
  TrendingUp,
  TrendingDown,
  Waves,
  Wind,
  Thermometer,
  Users,
  Info,
  Star,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Forecast, BeachForecastAccuracy } from "@/types/database";

interface AdjustedForecastDisplayProps {
  rawForecast: Forecast;
  beachAccuracy?: BeachForecastAccuracy | null;
  className?: string;
  showComparison?: boolean;
  compact?: boolean;
}

export function AdjustedForecastDisplay({
  rawForecast,
  beachAccuracy,
  className,
  showComparison = true,
  compact = false,
}: AdjustedForecastDisplayProps) {
  // Calculate adjusted values based on historical accuracy
  const getAdjustedWaveHeight = () => {
    const rawHeight = parseFloat(rawForecast.wave_height?.toString() || "0");
    if (!beachAccuracy?.avg_wave_height_delta || rawHeight === 0) {
      return rawHeight;
    }

    // Apply historical delta but keep within reasonable bounds
    const adjustment = beachAccuracy.avg_wave_height_delta * 0.7; // Moderate the adjustment
    const adjusted = Math.max(0, rawHeight - adjustment);
    return Math.round(adjusted * 2) / 2; // Round to nearest 0.5
  };

  const getAdjustedWindSpeed = () => {
    const rawWind = parseFloat(
      rawForecast.wind_speed?.toString().replace(/[^\d.]/g, "") || "0"
    );
    if (!beachAccuracy?.avg_wind_speed_delta || rawWind === 0) {
      return rawWind;
    }

    // Apply historical delta
    const adjustment = beachAccuracy.avg_wind_speed_delta * 0.5; // More conservative wind adjustment
    const adjusted = Math.max(0, rawWind - adjustment);
    return Math.round(adjusted);
  };

  const getConfidenceLevel = (score?: number | null) => {
    if (!score)
      return {
        level: "Unknown",
        color: "text-gray-500",
        bg: "bg-gray-100",
        icon: Info,
      };

    if (score >= 85) {
      return {
        level: "High Trust",
        color: "text-green-600",
        bg: "bg-green-50",
        icon: CheckCircle,
      };
    } else if (score >= 70) {
      return {
        level: "Medium Trust",
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: AlertTriangle,
      };
    } else {
      return {
        level: "Low Trust",
        color: "text-red-600",
        bg: "bg-red-50",
        icon: XCircle,
      };
    }
  };

  const rawWaveHeight = parseFloat(rawForecast.wave_height?.toString() || "0");
  const adjustedWaveHeight = getAdjustedWaveHeight();
  const rawWindSpeed = parseFloat(
    rawForecast.wind_speed?.toString().replace(/[^\d.]/g, "") || "0"
  );
  const adjustedWindSpeed = getAdjustedWindSpeed();

  const confidence = getConfidenceLevel(beachAccuracy?.overall_accuracy_score);
  const hasAdjustments =
    beachAccuracy &&
    (Math.abs(rawWaveHeight - adjustedWaveHeight) > 0.1 ||
      Math.abs(rawWindSpeed - adjustedWindSpeed) > 1);

  const waveHeightDelta = rawWaveHeight - adjustedWaveHeight;
  const windSpeedDelta = rawWindSpeed - adjustedWindSpeed;

  if (compact) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Confidence Indicator */}
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg",
            confidence.bg
          )}
        >
          <confidence.icon className={cn("h-4 w-4", confidence.color)} />
          <span className={cn("text-sm font-medium", confidence.color)}>
            {confidence.level}
          </span>
          {beachAccuracy && (
            <Badge variant="outline" className="text-xs">
              {beachAccuracy.total_sessions_count} sessions
            </Badge>
          )}
        </div>

        {hasAdjustments && showComparison && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Waves className="h-3 w-3 text-blue-500" />
                <span className="text-muted-foreground">Waves</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground line-through">
                  {rawWaveHeight}ft
                </span>
                <span className="font-medium text-blue-600">
                  {adjustedWaveHeight}ft
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Wind className="h-3 w-3 text-green-500" />
                <span className="text-muted-foreground">Wind</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground line-through">
                  {rawWindSpeed}
                </span>
                <span className="font-medium text-green-600">
                  {adjustedWindSpeed} mph
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-yellow-500" />
            <span>Community-Adjusted Forecast</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  Forecast adjusted based on{" "}
                  {beachAccuracy?.total_sessions_count || 0} previous sessions
                  at this beach.
                  {hasAdjustments &&
                    " Shows both raw and adjusted predictions."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Confidence Level */}
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-lg",
            confidence.bg
          )}
        >
          <div className="flex items-center space-x-2">
            <confidence.icon className={cn("h-5 w-5", confidence.color)} />
            <div>
              <div className={cn("font-medium", confidence.color)}>
                {confidence.level}
              </div>
              {beachAccuracy && (
                <div className="text-xs text-muted-foreground">
                  Based on {beachAccuracy.total_sessions_count} sessions
                </div>
              )}
            </div>
          </div>

          {beachAccuracy?.overall_accuracy_score && (
            <div className="text-right">
              <div className={cn("text-lg font-bold", confidence.color)}>
                {Math.round(beachAccuracy.overall_accuracy_score)}%
              </div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
          )}
        </div>

        {/* Forecast Comparison */}
        {showComparison && (
          <div className="space-y-4">
            {/* Wave Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Waves className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Wave Height</span>
                </div>
                {hasAdjustments && waveHeightDelta !== 0 && (
                  <Badge
                    variant={
                      Math.abs(waveHeightDelta) > 1
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {waveHeightDelta > 0 ? "↓" : "↑"}{" "}
                    {Math.abs(waveHeightDelta).toFixed(1)}ft
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-sm text-muted-foreground">
                    Raw Forecast
                  </div>
                  <div
                    className={cn(
                      "text-lg font-bold",
                      hasAdjustments
                        ? "line-through text-muted-foreground"
                        : "text-blue-600"
                    )}
                  >
                    {rawWaveHeight} ft
                  </div>
                </div>

                {hasAdjustments ? (
                  <div className="text-center p-2 bg-blue-50 rounded border-2 border-blue-200">
                    <div className="text-sm text-blue-600 font-medium">
                      Community Adjusted
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      {adjustedWaveHeight} ft
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="text-sm text-blue-600">Confirmed</div>
                    <div className="text-lg font-bold text-blue-600">
                      {adjustedWaveHeight} ft
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Wind Speed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wind className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Wind Speed</span>
                </div>
                {hasAdjustments && windSpeedDelta !== 0 && (
                  <Badge
                    variant={
                      Math.abs(windSpeedDelta) > 3 ? "destructive" : "secondary"
                    }
                  >
                    {windSpeedDelta > 0 ? "↓" : "↑"} {Math.abs(windSpeedDelta)}
                    mph
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-sm text-muted-foreground">
                    Raw Forecast
                  </div>
                  <div
                    className={cn(
                      "text-lg font-bold",
                      hasAdjustments
                        ? "line-through text-muted-foreground"
                        : "text-green-600"
                    )}
                  >
                    {rawWindSpeed} mph
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {rawForecast.wind_direction}
                  </div>
                </div>

                {hasAdjustments ? (
                  <div className="text-center p-2 bg-green-50 rounded border-2 border-green-200">
                    <div className="text-sm text-green-600 font-medium">
                      Community Adjusted
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {adjustedWindSpeed} mph
                    </div>
                    <div className="text-xs text-green-600">
                      {rawForecast.wind_direction}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="text-sm text-green-600">Confirmed</div>
                    <div className="text-lg font-bold text-green-600">
                      {adjustedWindSpeed} mph
                    </div>
                    <div className="text-xs text-green-600">
                      {rawForecast.wind_direction}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Sessions Info */}
        {beachAccuracy && (
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3" />
                <span className="text-muted-foreground">Recent Activity</span>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">
                  {beachAccuracy.last_7_days_count} sessions last 7 days
                </div>
                <div className="text-xs text-muted-foreground">
                  {beachAccuracy.last_30_days_count} sessions last 30 days
                </div>
              </div>
            </div>
          </div>
        )}

        {!beachAccuracy && (
          <div className="text-center py-4 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              No community data available yet for this beach.
            </p>
            <p className="text-xs">
              Log a session and provide feedback to help build the community
              forecast!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
