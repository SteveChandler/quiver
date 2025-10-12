"use client";

import { RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ForecastFreshnessBadgeProps {
  updatedAt: string | null | undefined;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  showRefreshButton?: boolean;
}

function getTimeSinceUpdate(updatedAt: string): {
  label: string;
  minutes: number;
  status: "fresh" | "recent" | "stale";
} {
  const now = new Date();
  const updateTime = new Date(updatedAt);
  const diffMs = now.getTime() - updateTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  let label: string;
  let status: "fresh" | "recent" | "stale";

  if (diffMinutes < 1) {
    label = "Just now";
    status = "fresh";
  } else if (diffMinutes < 60) {
    label = `${diffMinutes}m ago`;
    status = "fresh";
  } else if (diffHours < 6) {
    label = `${diffHours}h ago`;
    status = "recent";
  } else if (diffHours < 24) {
    label = `${diffHours}h ago`;
    status = "stale";
  } else {
    const diffDays = Math.floor(diffHours / 24);
    label = `${diffDays}d ago`;
    status = "stale";
  }

  return { label, minutes: diffMinutes, status };
}

export function ForecastFreshnessBadge({
  updatedAt,
  onRefresh,
  isRefreshing = false,
  className,
  showRefreshButton = true,
}: ForecastFreshnessBadgeProps) {
  if (!updatedAt) {
    return null;
  }

  const { label, status, minutes } = getTimeSinceUpdate(updatedAt);

  const statusColors = {
    fresh: "bg-green-100 text-green-700 border-green-200",
    recent: "bg-yellow-100 text-yellow-700 border-yellow-200",
    stale: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const dotColors = {
    fresh: "bg-green-500",
    recent: "bg-yellow-500",
    stale: "bg-gray-400",
  };

  const tooltipText =
    status === "fresh"
      ? "Data is fresh (updated within the last hour)"
      : status === "recent"
      ? "Data is recent (updated within the last 6 hours)"
      : "Data may be outdated (older than 6 hours). Click refresh to update.";

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusColors[status]
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full animate-pulse",
                  dotColors[status]
                )}
              />
              <Clock className="h-3 w-3" />
              <span>{label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-medium">Forecast Freshness</div>
              <div>{tooltipText}</div>
              <div className="text-muted-foreground">
                Last updated: {new Date(updatedAt).toLocaleString()}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {showRefreshButton && onRefresh && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-7 w-7 p-0"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                />
                <span className="sr-only">Refresh forecast</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Refresh forecast data</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// Compact version for smaller displays
export function ForecastFreshnessBadgeCompact({
  updatedAt,
  className,
}: {
  updatedAt: string | null | undefined;
  className?: string;
}) {
  if (!updatedAt) {
    return null;
  }

  const { label, status } = getTimeSinceUpdate(updatedAt);

  const dotColors = {
    fresh: "bg-green-500",
    recent: "bg-yellow-500",
    stale: "bg-gray-400",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
              className
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", dotColors[status])}
            />
            <span>{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            Last updated: {new Date(updatedAt).toLocaleString()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
