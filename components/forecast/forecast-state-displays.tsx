/**
 * Forecast State Display Components
 *
 * Unified loading, error, and empty state components for forecast displays.
 * Extracted from forecast-display.tsx and forecast-display-with-transparency.tsx
 * to provide consistent, reusable state handling across all forecast components.
 *
 * @module components/forecast/forecast-state-displays
 */

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  RefreshCw,
  Waves,
  CloudOff,
  Loader2,
} from "lucide-react";

/**
 * Props for forecast loading state component
 */
export interface ForecastLoadingProps {
  /** Custom loading message. Defaults to "Loading forecasts..." */
  message?: string;
  /** Beach name to display in header */
  beachName?: string;
  /** Whether to show skeleton placeholders for transparency section */
  showTransparencySkeleton?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  "data-testid"?: string;
}

/**
 * Loading state component for forecast displays.
 *
 * Displays a centered loading message with optional beach header
 * and skeleton placeholders for transparency sections.
 *
 * @example
 * ```tsx
 * <ForecastLoading message="Fetching surf data..." beachName="Malibu" />
 * ```
 */
export function ForecastLoading({
  message = "Loading forecasts...",
  beachName,
  showTransparencySkeleton = false,
  className,
  "data-testid": testId = "forecast-loading",
}: ForecastLoadingProps): JSX.Element {
  return (
    <div
      className={cn("max-w-6xl mx-auto px-4 space-y-6", className)}
      data-testid={testId}
      role="status"
      aria-busy="true"
      aria-label="Loading forecast data"
    >
      {/* Header Section */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">
          {beachName || "Loading..."}
        </h2>
        <h3 className="text-lg text-muted-foreground">10-Day Surf Forecast</h3>
      </div>

      {/* Loading Indicator */}
      <div className="text-center py-8">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-gray-600">{message}</p>
        </div>
      </div>

      {/* Optional Transparency Section Skeleton */}
      {showTransparencySkeleton && (
        <div data-testid="transparency-loading-skeleton" className="space-y-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-16 bg-gray-200 rounded" />
          </div>
        </div>
      )}

      {/* Screen reader announcement */}
      <span className="sr-only">{message}</span>
    </div>
  );
}

/**
 * Props for forecast error state component
 */
export interface ForecastErrorProps {
  /** Error message to display */
  error: string;
  /** Callback function for retry button. If not provided, retry button is hidden */
  onRetry?: () => void;
  /** Beach name to display in header */
  beachName?: string;
  /** Whether to show transparency error state */
  showTransparencyError?: boolean;
  /** Custom title for the error. Defaults to "Error loading forecasts" */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  "data-testid"?: string;
}

/**
 * Error state component for forecast displays.
 *
 * Displays an error message with optional retry functionality
 * and transparency error indication.
 *
 * @example
 * ```tsx
 * <ForecastError
 *   error="Network timeout. Please try again."
 *   onRetry={() => refetch()}
 *   beachName="Pipeline"
 * />
 * ```
 */
export function ForecastError({
  error,
  onRetry,
  beachName,
  showTransparencyError = false,
  title = "Error loading forecasts",
  className,
  "data-testid": testId = "forecast-error",
}: ForecastErrorProps): JSX.Element {
  return (
    <div
      className={cn("max-w-6xl mx-auto px-4 space-y-6", className)}
      data-testid={testId}
      role="alert"
      aria-live="assertive"
    >
      {/* Header Section */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">
          {beachName || "Forecast Error"}
        </h2>
        <h3 className="text-lg text-muted-foreground">10-Day Surf Forecast</h3>
      </div>

      {/* Error Display */}
      <div className="text-center py-8 space-y-3">
        <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
        <p className="text-red-500 font-semibold">{title}</p>
        <p className="text-gray-600">{error}</p>

        {/* Retry Button */}
        {onRetry && (
          <Button
            variant="outline"
            onClick={onRetry}
            className="mt-4"
            aria-label="Retry loading forecast"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>

      {/* Optional Transparency Error State */}
      {showTransparencyError && (
        <div data-testid="transparency-error-state" className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">
              Transparency data unavailable due to forecast error
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Props for forecast empty state component
 */
export interface ForecastEmptyProps {
  /** Custom message for empty state. Defaults to "No forecast data available" */
  message?: string;
  /** Beach name to display in header */
  beachName?: string;
  /** Optional action callback (e.g., to request forecast refresh) */
  onAction?: () => void;
  /** Label for the action button. Required if onAction is provided */
  actionLabel?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  "data-testid"?: string;
}

/**
 * Empty state component for forecast displays.
 *
 * Displays when no forecast data is available, with optional
 * action button for user recovery.
 *
 * @example
 * ```tsx
 * <ForecastEmpty
 *   message="Forecast data will be available soon"
 *   beachName="Huntington Beach"
 *   onAction={() => requestForecast()}
 *   actionLabel="Request Forecast"
 * />
 * ```
 */
export function ForecastEmpty({
  message = "No forecast data available",
  beachName,
  onAction,
  actionLabel = "Refresh",
  className,
  "data-testid": testId = "forecast-empty",
}: ForecastEmptyProps): JSX.Element {
  return (
    <div
      className={cn("max-w-6xl mx-auto px-4 space-y-6", className)}
      data-testid={testId}
    >
      {/* Header Section */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">
          {beachName || "No Data"}
        </h2>
        <h3 className="text-lg text-muted-foreground">10-Day Surf Forecast</h3>
      </div>

      {/* Empty State Display */}
      <div className="text-center py-8 space-y-4">
        <Waves className="h-12 w-12 text-gray-400 mx-auto" />
        <p className="text-gray-600">{message}</p>

        {/* Optional Action Button */}
        {onAction && (
          <Button variant="outline" onClick={onAction} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Props for forecast offline state component
 */
export interface ForecastOfflineProps {
  /** Custom message for offline state */
  message?: string;
  /** Beach name to display in header */
  beachName?: string;
  /** Callback when connection is restored (for manual retry) */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  "data-testid"?: string;
}

/**
 * Offline state component for forecast displays.
 *
 * Displays when the user appears to be offline or the forecast
 * service is unavailable.
 *
 * @example
 * ```tsx
 * <ForecastOffline
 *   message="Check your internet connection"
 *   onRetry={() => checkConnection()}
 * />
 * ```
 */
export function ForecastOffline({
  message = "Unable to load forecast data. Please check your connection.",
  beachName,
  onRetry,
  className,
  "data-testid": testId = "forecast-offline",
}: ForecastOfflineProps): JSX.Element {
  return (
    <div
      className={cn("max-w-6xl mx-auto px-4 space-y-6", className)}
      data-testid={testId}
    >
      {/* Header Section */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">
          {beachName || "Offline"}
        </h2>
        <h3 className="text-lg text-muted-foreground">10-Day Surf Forecast</h3>
      </div>

      {/* Offline State Display */}
      <div className="text-center py-8 space-y-4">
        <CloudOff className="h-12 w-12 text-gray-400 mx-auto" />
        <p className="text-gray-600">{message}</p>

        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Props for the forecast skeleton loading component
 */
export interface ForecastSkeletonProps {
  /** Beach name to display in header */
  beachName?: string;
  /** Number of forecast day rows to show in skeleton */
  rows?: number;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  "data-testid"?: string;
}

/**
 * Skeleton loading component for forecast table.
 *
 * Shows a more detailed skeleton that mimics the structure
 * of the actual forecast table for smoother perceived loading.
 *
 * @example
 * ```tsx
 * <ForecastSkeleton beachName="Trestles" rows={5} />
 * ```
 */
export function ForecastSkeleton({
  beachName,
  rows = 5,
  className,
  "data-testid": testId = "forecast-skeleton",
}: ForecastSkeletonProps): JSX.Element {
  return (
    <div
      className={cn("max-w-6xl mx-auto px-4 space-y-6", className)}
      data-testid={testId}
      role="status"
      aria-busy="true"
      aria-label="Loading forecast data"
    >
      {/* Header Section */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          {beachName || <Skeleton className="h-8 w-48 mx-auto" />}
        </h2>
        <h3 className="text-lg text-muted-foreground">10-Day Surf Forecast</h3>
      </div>

      {/* Table Header Skeleton */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted p-3 flex space-x-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>

        {/* Table Rows Skeleton */}
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "p-3 flex space-x-4 items-center",
              index % 2 === 0 ? "bg-background" : "bg-muted/30"
            )}
          >
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>

      {/* Screen reader announcement */}
      <span className="sr-only">Loading forecast table...</span>
    </div>
  );
}

/**
 * Utility type for forecast display state
 */
export type ForecastDisplayState = "loading" | "error" | "empty" | "success";

/**
 * Determines the current display state based on props
 *
 * @param loading - Whether data is loading
 * @param error - Error message if any
 * @param hasData - Whether there is data to display
 * @returns The current forecast display state
 */
export function getForecastDisplayState(
  loading: boolean,
  error: string | null | undefined,
  hasData: boolean
): ForecastDisplayState {
  if (loading) return "loading";
  if (error) return "error";
  if (!hasData) return "empty";
  return "success";
}

/**
 * Props for the unified forecast state wrapper component
 */
export interface ForecastStateWrapperProps {
  /** Whether data is loading */
  loading: boolean;
  /** Error message if any */
  error: string | null | undefined;
  /** Whether there is data to display */
  hasData: boolean;
  /** Children to render when data is available */
  children: React.ReactNode;
  /** Beach name for headers */
  beachName?: string;
  /** Callback for retry on error */
  onRetry?: () => void;
  /** Custom loading message */
  loadingMessage?: string;
  /** Custom empty message */
  emptyMessage?: string;
  /** Show transparency skeleton during loading */
  showTransparencySkeleton?: boolean;
  /** Show transparency error state */
  showTransparencyError?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Unified wrapper component that handles all forecast display states.
 *
 * Automatically renders the appropriate state component based on
 * loading, error, and data availability.
 *
 * @example
 * ```tsx
 * <ForecastStateWrapper
 *   loading={isLoading}
 *   error={error}
 *   hasData={forecasts.length > 0}
 *   beachName={beach?.name}
 *   onRetry={() => refetch()}
 * >
 *   <ForecastTable forecasts={forecasts} />
 * </ForecastStateWrapper>
 * ```
 */
export function ForecastStateWrapper({
  loading,
  error,
  hasData,
  children,
  beachName,
  onRetry,
  loadingMessage,
  emptyMessage,
  showTransparencySkeleton,
  showTransparencyError,
  className,
}: ForecastStateWrapperProps): JSX.Element {
  const state = getForecastDisplayState(loading, error, hasData);

  switch (state) {
    case "loading":
      return (
        <ForecastLoading
          message={loadingMessage}
          beachName={beachName}
          showTransparencySkeleton={showTransparencySkeleton}
          className={className}
        />
      );
    case "error":
      return (
        <ForecastError
          error={error || "An unknown error occurred"}
          beachName={beachName}
          onRetry={onRetry}
          showTransparencyError={showTransparencyError}
          className={className}
        />
      );
    case "empty":
      return (
        <ForecastEmpty
          message={emptyMessage}
          beachName={beachName}
          onAction={onRetry}
          actionLabel="Refresh"
          className={className}
        />
      );
    case "success":
    default:
      return <>{children}</>;
  }
}
