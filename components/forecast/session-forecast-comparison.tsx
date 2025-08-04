"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronUp,
  Waves,
  Wind,
  Thermometer,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionForecastSnapshot } from "@/types/database";

interface SessionForecastComparisonProps {
  snapshots: SessionForecastSnapshot[];
  className?: string;
  maxItems?: number;
}

interface ComparisonMetric {
  forecast: string | number;
  actual: string | number;
  accuracy: "good" | "fair" | "poor";
  delta?: number;
}

export function SessionForecastComparison({
  snapshots,
  className,
  maxItems = 10,
}: SessionForecastComparisonProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (snapshotId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(snapshotId)) {
      newExpanded.delete(snapshotId);
    } else {
      newExpanded.add(snapshotId);
    }
    setExpandedItems(newExpanded);
  };

  const calculateAccuracy = (
    forecast: number,
    actual: number,
    threshold: number = 1.0
  ) => {
    const delta = Math.abs(forecast - actual);
    if (delta <= threshold * 0.5) return "good";
    if (delta <= threshold) return "fair";
    return "poor";
  };

  const getMetrics = (
    snapshot: SessionForecastSnapshot
  ): ComparisonMetric[] => {
    const forecast = snapshot.forecast_snapshot;
    const actual = snapshot.actual_conditions;

    const metrics: ComparisonMetric[] = [];

    // Wave Height Comparison
    if (forecast?.wave_height && actual?.wave_height) {
      const forecastHeight = parseFloat(forecast.wave_height.toString());
      const actualHeight = parseFloat(actual.wave_height.toString());
      const delta = actualHeight - forecastHeight;

      metrics.push({
        forecast: `${forecastHeight}ft`,
        actual: `${actualHeight}ft`,
        delta,
        accuracy: calculateAccuracy(forecastHeight, actualHeight, 1.0),
      });
    }

    // Wind Speed Comparison
    if (forecast?.wind_speed && actual?.wind_speed) {
      const forecastWind = parseFloat(
        forecast.wind_speed.toString().replace(/[^\d.]/g, "")
      );
      const actualWind = parseFloat(
        actual.wind_speed.toString().replace(/[^\d.]/g, "")
      );
      const delta = actualWind - forecastWind;

      metrics.push({
        forecast: forecast.wind_speed,
        actual: actual.wind_speed,
        delta,
        accuracy: calculateAccuracy(forecastWind, actualWind, 5.0),
      });
    }

    // Water Temperature Comparison
    if (forecast?.water_temp && actual?.water_temp) {
      metrics.push({
        forecast: forecast.water_temp,
        actual: actual.water_temp,
        accuracy: "good", // Simplified for water temp
      });
    }

    return metrics;
  };

  const getAccuracyIcon = (accuracy: "good" | "fair" | "poor") => {
    switch (accuracy) {
      case "good":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "fair":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "poor":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getAccuracyColor = (accuracy: "good" | "fair" | "poor") => {
    switch (accuracy) {
      case "good":
        return "text-green-600";
      case "fair":
        return "text-yellow-600";
      case "poor":
        return "text-red-600";
    }
  };

  const displaySnapshots = snapshots.slice(0, maxItems);

  if (snapshots.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Waves className="h-5 w-5" />
            <span>Session Comparisons</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Waves className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              No session comparisons available
            </p>
            <p className="text-sm text-gray-500">
              Complete some surf sessions to see forecast vs actual comparisons
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Waves className="h-5 w-5" />
          <span>Session Comparisons</span>
          <Badge variant="secondary">{snapshots.length}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {displaySnapshots.map((snapshot) => {
          const metrics = getMetrics(snapshot);
          const isExpanded = expandedItems.has(snapshot.id);
          const sessionDate = new Date(
            snapshot.session_date
          ).toLocaleDateString();

          // Calculate overall accuracy for this session
          const overallAccuracy =
            metrics.length > 0
              ? metrics.filter((m) => m.accuracy === "good").length /
                metrics.length
              : 0;

          return (
            <Collapsible key={snapshot.id} open={isExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full p-4 h-auto"
                  onClick={() => toggleExpanded(snapshot.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">
                          {sessionDate}
                        </span>
                      </div>

                      {/* Quick accuracy indicator */}
                      <div className="flex items-center space-x-1">
                        {metrics.slice(0, 3).map((metric, index) => (
                          <TooltipProvider key={index}>
                            <Tooltip>
                              <TooltipTrigger>
                                {getAccuracyIcon(metric.accuracy)}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm">
                                  Forecast: {metric.forecast} | Actual:{" "}
                                  {metric.actual}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          overallAccuracy >= 0.7
                            ? "default"
                            : overallAccuracy >= 0.4
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {Math.round(overallAccuracy * 100)}% accurate
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="px-4 pb-4">
                <div className="space-y-4 pt-4">
                  {/* Session Info */}
                  <div className="flex items-center space-x-4 text-sm text-gray-600 border-b pb-3">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {(snapshot as any).session?.beach_name ||
                          "Unknown Beach"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Badge variant="outline" className="text-xs">
                        Confidence:{" "}
                        {snapshot.forecast_confidence_score || "N/A"}%
                      </Badge>
                    </div>
                    {snapshot.data_source && (
                      <Badge variant="outline" className="text-xs">
                        {snapshot.data_source}
                      </Badge>
                    )}
                  </div>

                  {/* Detailed Metrics */}
                  <div className="grid gap-3">
                    {metrics.map((metric, index) => {
                      const metricType =
                        index === 0
                          ? "Wave Height"
                          : index === 1
                          ? "Wind Speed"
                          : "Water Temp";
                      const icon =
                        index === 0 ? (
                          <Waves className="h-4 w-4" />
                        ) : index === 1 ? (
                          <Wind className="h-4 w-4" />
                        ) : (
                          <Thermometer className="h-4 w-4" />
                        );

                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-2">
                            {icon}
                            <span className="text-sm font-medium">
                              {metricType}
                            </span>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Forecast</p>
                              <p className="text-sm font-medium">
                                {metric.forecast}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-xs text-gray-500">Actual</p>
                              <p className="text-sm font-medium">
                                {metric.actual}
                              </p>
                            </div>

                            <div className="flex items-center space-x-1">
                              {getAccuracyIcon(metric.accuracy)}
                              {metric.delta !== undefined && (
                                <span
                                  className={cn(
                                    "text-xs",
                                    getAccuracyColor(metric.accuracy)
                                  )}
                                >
                                  {metric.delta > 0 ? "+" : ""}
                                  {metric.delta.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Session Rating if available */}
                  {(snapshot as any).session?.rating && (
                    <div className="flex items-center justify-between text-sm border-t pt-3">
                      <span className="text-gray-600">Session Rating</span>
                      <div className="flex items-center space-x-1">
                        {"★".repeat((snapshot as any).session.rating)}
                        <span className="text-gray-500">
                          ({(snapshot as any).session.rating}/5)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {snapshots.length > maxItems && (
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {maxItems} of {snapshots.length} sessions
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
