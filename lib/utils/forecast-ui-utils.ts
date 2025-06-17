/**
 * Format time string for display
 */
export function formatForecastTime(timeString: string): string {
  try {
    const time = new Date(`2000-01-01T${timeString}`);
    return time.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timeString;
  }
}

/**
 * Format date string for display with relative labels
 */
export function formatForecastDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  } catch {
    return dateString;
  }
}

/**
 * Get confidence score color class
 */
export function getConfidenceColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  if (score >= 40) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

/**
 * Get confidence score indicator color
 */
export function getConfidenceIndicatorColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

/**
 * Get tide status icon based on tide status string
 */
export function getTideStatusIcon(status: string): "up" | "down" | "activity" {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("rising")) return "up";
  if (statusLower.includes("falling")) return "down";
  return "activity";
}

/**
 * Format combined date and time for forecast display
 */
export function formatForecastDateTime(
  date: string,
  time: string,
  showDate: boolean = true
): string {
  if (showDate) {
    return `${formatForecastDate(date)} ${formatForecastTime(time)}`;
  }
  return formatForecastTime(time);
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Check if a date string is today
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayDateString();
}

/**
 * Check if a date string is tomorrow
 */
export function isTomorrow(dateString: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateString === tomorrow.toISOString().split("T")[0];
}

/**
 * Find the best forecast for a given date (closest to current time for today)
 */
export function findBestForecastForDate<T extends { forecast_time: string }>(
  forecasts: T[],
  isToday: boolean = false
): T | null {
  if (forecasts.length === 0) return null;
  if (forecasts.length === 1) return forecasts[0];

  if (!isToday) {
    // For non-today dates, return the first forecast
    return forecasts[0];
  }

  // For today, find forecast closest to current time
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  return forecasts.reduce((best, current) => {
    const [hours, minutes] = current.forecast_time.split(":").map(Number);
    const forecastTime = hours * 60 + minutes;

    const [bestHours, bestMinutes] = best.forecast_time.split(":").map(Number);
    const bestTime = bestHours * 60 + bestMinutes;

    const currentDiff = Math.abs(forecastTime - currentTime);
    const bestDiff = Math.abs(bestTime - currentTime);

    return currentDiff < bestDiff ? current : best;
  });
}

/**
 * Create loading state JSX structure (for consistency)
 */
export const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    <span className="ml-2">Loading enhanced forecasts...</span>
  </div>
);

/**
 * Create error state JSX structure (for consistency)
 */
export const ErrorDisplay = ({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) => (
  <div className="text-center py-8">
    <p className="text-red-600 mb-4">{error}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md"
      >
        Try Again
      </button>
    )}
  </div>
);
