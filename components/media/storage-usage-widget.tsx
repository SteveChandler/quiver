"use client";

import React, { useState, useEffect } from "react";
import { HardDrive, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getStorageStatsAction } from "@/actions/session-media-actions";

interface StorageStats {
  total_bytes: number;
  image_count: number;
  remaining_bytes: number;
  usage_percentage: number;
}

interface StorageUsageWidgetProps {
  className?: string;
  showDetails?: boolean;
  refreshTrigger?: number; // Increment this to trigger a refresh
}

export default function StorageUsageWidget({
  className,
  showDetails = true,
  refreshTrigger = 0,
}: StorageUsageWidgetProps) {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-yellow-600";
    return "text-green-600";
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getStorageStatsAction();

      if (result.success) {
        setStats(result.data ?? null);
      } else {
        setError(result.error || "Failed to load storage stats");
      }
    } catch (error) {
      setError("Failed to load storage stats");
      console.error("Storage stats error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="h-2 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!stats) return null;

  const isNearLimit = stats.usage_percentage >= 75;
  const isAtLimit = stats.usage_percentage >= 90;

  return (
    <Card className={className}>
      {showDetails && (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <HardDrive className="h-4 w-4 mr-2" />
            Storage Usage
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 ml-2 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Free tier includes 100MB of storage per user. Images are
                    automatically compressed to optimize storage.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className={showDetails ? "pt-0" : "p-4"}>
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatFileSize(stats.total_bytes)} used
              </span>
              <span className={getUsageColor(stats.usage_percentage)}>
                {stats.usage_percentage}%
              </span>
            </div>

            <div className="relative">
              <Progress value={stats.usage_percentage} className="h-2" />
              <div
                className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressColor(
                  stats.usage_percentage
                )}`}
                style={{ width: `${Math.min(stats.usage_percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats Details */}
          {showDetails && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Images</p>
                <p className="font-medium">{stats.image_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Remaining</p>
                <p className="font-medium">
                  {formatFileSize(stats.remaining_bytes)}
                </p>
              </div>
            </div>
          )}

          {/* Warning Messages */}
          {isAtLimit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Storage limit reached. Delete some images to upload new ones.
              </AlertDescription>
            </Alert>
          )}

          {isNearLimit && !isAtLimit && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Storage is nearly full. Consider deleting unused images.
              </AlertDescription>
            </Alert>
          )}

          {/* Storage Tips */}
          {showDetails && !isNearLimit && (
            <div className="pt-2 border-t">
              <div className="flex items-start space-x-2">
                <Info className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Images are compressed to 80% quality and resized to save
                  space.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
