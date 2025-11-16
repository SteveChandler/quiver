/**
 * Forecast data state types for comprehensive error handling
 * Distinguishes between different unavailable states to provide better UX
 */

export type ForecastDataState =
  | "loading" // Initial fetch in progress
  | "available" // Valid, fresh data
  | "stale" // Data exists but outdated
  | "refreshing" // Stale data being updated
  | "unavailable" // No data, may be permanent
  | "failed" // Fetch failed (network/API error)
  | "rate_limited" // API rate limit hit
  | "no_coverage"; // Location has no forecast coverage

export interface ForecastStateInfo {
  state: ForecastDataState;
  message: string;
  description?: string;
  action?: string; // User guidance
  canRetry: boolean;
  retryAfter?: number; // Seconds until retry allowed
  icon?: string; // Icon identifier
}

/**
 * Determine the current forecast state based on data availability and error conditions
 */
export function getForecastStateInfo(
  forecast: any | null,
  isStale: boolean,
  error?: Error | null,
  isLoading?: boolean,
  isRefreshing?: boolean
): ForecastStateInfo {
  // Loading state - initial fetch
  if (isLoading && !forecast) {
    return {
      state: "loading",
      message: "Loading forecast",
      description: "Fetching latest surf conditions...",
      canRetry: false,
      icon: "loader",
    };
  }

  // Refreshing state - updating stale data
  if (isRefreshing && forecast) {
    return {
      state: "refreshing",
      message: "Updating forecast",
      description: "Refreshing with latest data...",
      canRetry: false,
      icon: "refresh",
    };
  }

  // Error handling
  if (error) {
    const errorMessage = error.message?.toLowerCase() || "";

    // Rate limiting
    if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("429") ||
      (error as any).status === 429
    ) {
      return {
        state: "rate_limited",
        message: "Too many requests",
        description: "Please wait a few minutes before trying again",
        action: "Auto-retry in 5 minutes",
        canRetry: true,
        retryAfter: 300, // 5 minutes
        icon: "clock",
      };
    }

    // Network/fetch failures
    if (
      errorMessage.includes("fetch") ||
      errorMessage.includes("network") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("abort")
    ) {
      return {
        state: "failed",
        message: "Unable to load forecast",
        description: "Network error - check your connection",
        action: "Tap to retry",
        canRetry: true,
        retryAfter: 5,
        icon: "alert-triangle",
      };
    }

    // API errors
    if (
      errorMessage.includes("http") ||
      errorMessage.includes("500") ||
      errorMessage.includes("503")
    ) {
      return {
        state: "failed",
        message: "Service temporarily unavailable",
        description: "The forecast service is experiencing issues",
        action: "Tap to retry",
        canRetry: true,
        retryAfter: 30,
        icon: "alert-triangle",
      };
    }

    // Generic error
    return {
      state: "failed",
      message: "Unable to load forecast",
      description: error.message || "An unexpected error occurred",
      action: "Tap to retry",
      canRetry: true,
      retryAfter: 10,
      icon: "alert-triangle",
    };
  }

  // No data - check if it's a coverage issue
  if (!forecast) {
    return {
      state: "no_coverage",
      message: "No forecast available",
      description: "This location is not currently covered by our forecast service",
      canRetry: false,
      icon: "map-pin",
    };
  }

  // Stale data
  if (isStale) {
    return {
      state: "stale",
      message: "Forecast data is outdated",
      description: "This data may not reflect current conditions",
      action: "Tap to refresh",
      canRetry: true,
      retryAfter: 0,
      icon: "alert-triangle",
    };
  }

  // Available and fresh
  return {
    state: "available",
    message: "Forecast available",
    description: "Latest forecast data",
    canRetry: false,
    icon: "check-circle",
  };
}

/**
 * Get user-friendly error message for a given state
 */
export function getStateDisplayMessage(state: ForecastDataState): {
  title: string;
  description: string;
} {
  switch (state) {
    case "loading":
      return {
        title: "Loading forecast",
        description: "Fetching latest surf conditions...",
      };

    case "refreshing":
      return {
        title: "Updating forecast",
        description: "Refreshing with latest data...",
      };

    case "failed":
      return {
        title: "Unable to load forecast",
        description: "A network or service error occurred",
      };

    case "rate_limited":
      return {
        title: "Too many requests",
        description: "Please wait a few minutes before trying again",
      };

    case "no_coverage":
      return {
        title: "No forecast available",
        description: "This location is not currently covered",
      };

    case "stale":
      return {
        title: "Forecast data is outdated",
        description: "This data may not reflect current conditions",
      };

    case "unavailable":
      return {
        title: "Data unavailable",
        description: "Unable to load forecast data at this time",
      };

    case "available":
    default:
      return {
        title: "Forecast available",
        description: "Latest forecast data",
      };
  }
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: Error | null | undefined): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || "";

  // Network errors are retryable
  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout")
  ) {
    return true;
  }

  // HTTP errors that are retryable
  const status = (error as any).status;
  if (status) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(status);
  }

  return false;
}

/**
 * Get retry delay based on error type
 */
export function getRetryDelay(error: Error | null | undefined): number {
  if (!error) return 5000;

  const message = error.message?.toLowerCase() || "";

  // Rate limiting - longer delay
  if (message.includes("rate limit") || message.includes("429")) {
    return 300000; // 5 minutes
  }

  // Server errors - moderate delay
  const status = (error as any).status;
  if (status && [500, 502, 503, 504].includes(status)) {
    return 30000; // 30 seconds
  }

  // Network errors - short delay
  return 5000; // 5 seconds
}
