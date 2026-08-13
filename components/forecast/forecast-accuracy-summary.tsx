"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Target,
  Calendar,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccuracySummaryData {
  totalSessions: number;
  avgAccuracy: number;
  topBeaches: Array<{
    beachName: string;
    accuracy: number;
    sessionCount: number;
  }>;
}

interface ForecastAccuracySummaryProps {
  data: AccuracySummaryData;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function ForecastAccuracySummary({
  data,
  isLoading = false,
  onRefresh,
  className,
}: ForecastAccuracySummaryProps) {
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 85) return "text-green-600";
    if (accuracy >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getAccuracyBadgeVariant = (accuracy: number) => {
    if (accuracy >= 85) return "default";
    if (accuracy >= 70) return "secondary";
    return "destructive";
  };

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Forecast Accuracy</span>
            </CardTitle>
            <div className="animate-spin">
              <RefreshCw className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-20 bg-gray-100 rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-100 rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.totalSessions === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Forecast Accuracy</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No calibration data available</p>
            <p className="text-sm text-gray-500">
              Complete some surf sessions to see forecast accuracy statistics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Forecast Accuracy</span>
          </CardTitle>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              aria-label="Refresh forecast accuracy"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">
                {data.avgAccuracy}%
              </span>
            </div>
            <p className="text-sm text-gray-600">Average Accuracy</p>
            <Progress value={data.avgAccuracy} className="mt-2 h-2" />
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <span className="text-2xl font-bold text-gray-700">
                {data.totalSessions}
              </span>
            </div>
            <p className="text-sm text-gray-600">Total Sessions</p>
          </div>
        </div>

        {/* Top Performing Beaches */}
        {data.topBeaches.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Top Performing Spots
            </h4>
            <div className="space-y-3">
              {data.topBeaches.map((beach, index) => (
                <div
                  key={beach.beachName}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                        index === 0
                          ? "bg-yellow-100 text-yellow-800"
                          : index === 1
                          ? "bg-gray-100 text-gray-800"
                          : index === 2
                          ? "bg-orange-100 text-orange-800"
                          : "bg-blue-100 text-blue-800"
                      )}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{beach.beachName}</p>
                      <p className="text-xs text-gray-500">
                        {beach.sessionCount} session
                        {beach.sessionCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getAccuracyBadgeVariant(beach.accuracy)}>
                    {beach.accuracy}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accuracy Guidelines */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Accuracy Guidelines
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600">85%+ Excellent</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-gray-500">Highly accurate forecasts</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-yellow-600">70-84% Good</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span className="text-gray-500">Generally reliable</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-600">&lt;70% Needs Improvement</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-gray-500">Use with caution</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
