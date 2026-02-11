/**
 * Forecast error state display component
 * Shows user-friendly error messages with retry actions
 */

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  Clock,
  MapPin,
  Info,
} from "lucide-react";
import type { ForecastDataState, ForecastStateInfo } from "@/types/forecast-states";

interface ForecastErrorStateProps {
  state: ForecastDataState;
  stateInfo: ForecastStateInfo;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Get icon component for a given state
 */
function getStateIcon(state: ForecastDataState, className?: string) {
  const iconClass = className || "h-12 w-12";

  switch (state) {
    case "loading":
      return <Loader2 className={`${iconClass} animate-spin text-info`} />;

    case "refreshing":
      return <RefreshCw className={`${iconClass} animate-spin text-info`} />;

    case "failed":
      return <AlertTriangle className={`${iconClass} text-destructive`} />;

    case "rate_limited":
      return <Clock className={`${iconClass} text-warning`} />;

    case "no_coverage":
      return <MapPin className={`${iconClass} text-muted-foreground`} />;

    case "stale":
      return <AlertTriangle className={`${iconClass} text-warning`} />;

    case "unavailable":
    default:
      return <Info className={`${iconClass} text-warning`} />;
  }
}

/**
 * Get background color class for state
 */
function getStateBgClass(state: ForecastDataState): string {
  switch (state) {
    case "loading":
    case "refreshing":
      return "bg-info/10 border-info/20";

    case "failed":
      return "bg-destructive/10 border-destructive/20";

    case "rate_limited":
      return "bg-warning/10 border-warning/20";

    case "no_coverage":
      return "bg-muted border-border";

    case "stale":
      return "bg-warning/10 border-warning/20";

    case "unavailable":
    default:
      return "bg-warning/10 border-warning/20";
  }
}

/**
 * Compact inline error state (for use in existing cards)
 */
export function ForecastErrorStateInline({
  state,
  stateInfo,
  onRetry,
  className = "",
}: ForecastErrorStateProps) {
  return (
    <Alert className={`${getStateBgClass(state)} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStateIcon(state, "h-5 w-5")}
          <div>
            <div className="font-medium text-sm">{stateInfo.message}</div>
            {stateInfo.description && (
              <div className="text-xs text-muted-foreground mt-1">
                {stateInfo.description}
              </div>
            )}
          </div>
        </div>
        {stateInfo.canRetry && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-2 shrink-0"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
      {stateInfo.action && (
        <div className="text-xs text-muted-foreground mt-2">{stateInfo.action}</div>
      )}
    </Alert>
  );
}

/**
 * Full card error state (standalone display)
 */
export function ForecastErrorStateCard({
  state,
  stateInfo,
  onRetry,
  className = "",
}: ForecastErrorStateProps) {
  return (
    <Card className={`${className}`} data-testid="forecast-error-state">
      <CardContent className="p-6 text-center">
        <div className="flex flex-col items-center space-y-4">
          {getStateIcon(state)}

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {stateInfo.message}
            </h3>

            {stateInfo.description && (
              <p className="text-sm text-muted-foreground max-w-md">
                {stateInfo.description}
              </p>
            )}

            {stateInfo.action && (
              <p className="text-xs text-muted-foreground mt-2">{stateInfo.action}</p>
            )}
          </div>

          {stateInfo.canRetry && onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="default"
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for forecast data
 */
export function ForecastLoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-4 ${className}`} data-testid="forecast-loading-skeleton">
      <Skeleton className="h-4 w-1/4" />
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}

/**
 * Refreshing overlay (shows over existing content)
 */
export function ForecastRefreshingOverlay({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10 ${className}`}
      data-testid="forecast-refreshing-overlay"
    >
      <div className="flex items-center space-x-3 text-info">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="font-medium">Updating forecast...</span>
      </div>
    </div>
  );
}
