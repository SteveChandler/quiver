import React from "react";

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
 * Helper function to get normalized date string (YYYY-MM-DD) in user's timezone
 */
function getNormalizedDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper function to get current date in user's timezone
 */
function getCurrentDate(): string {
  return getNormalizedDateString(new Date());
}

/**
 * Helper function to get tomorrow's date in user's timezone
 */
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getNormalizedDateString(tomorrow);
}

/**
 * Helper function to check if a date string is today
 */
function isDateToday(dateString: string): boolean {
  return dateString === getCurrentDate();
}

/**
 * Helper function to check if a date string is tomorrow
 */
function isDateTomorrow(dateString: string): boolean {
  return dateString === getTomorrowDate();
}

/**
 * Helper function to format date string into proper Date object
 */
function createDateFromString(dateString: string): Date {
  // Handle both YYYY-MM-DD and ISO date formats
  if (dateString.includes("T")) {
    return new Date(dateString);
  }

  // For YYYY-MM-DD format, create date at local midnight
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format date string for display with relative labels
 */
export function formatForecastDate(dateString: string): string {
  try {
    if (isDateToday(dateString)) {
      return "Today";
    } else if (isDateTomorrow(dateString)) {
      return "Tomorrow";
    } else {
      const date = createDateFromString(dateString);
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
  return getCurrentDate();
}

/**
 * Check if a date string is today
 */
export function isToday(dateString: string): boolean {
  return isDateToday(dateString);
}

/**
 * Check if a date string is tomorrow
 */
export function isTomorrow(dateString: string): boolean {
  return isDateTomorrow(dateString);
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

/**
 * Group forecasts by wind direction for better display (legacy function)
 */
export function groupForecastsByWindDirection<
  T extends {
    wind_direction: string;
    forecast_time: string;
    [key: string]: any;
  }
>(
  forecasts: T[]
): Array<{
  direction: string;
  forecasts: T[];
  representative: T;
  timeRange: string;
  count: number;
}> {
  if (forecasts.length === 0) return [];

  // Group by wind direction
  const groups = forecasts.reduce((acc, forecast) => {
    const direction = forecast.wind_direction || "Variable";
    if (!acc[direction]) {
      acc[direction] = [];
    }
    acc[direction].push(forecast);
    return acc;
  }, {} as Record<string, T[]>);

  // Convert to array with representative data
  return Object.entries(groups)
    .map(([direction, groupForecasts]) => {
      // Sort by time to get proper time range
      const sortedForecasts = groupForecasts.sort((a, b) =>
        a.forecast_time.localeCompare(b.forecast_time)
      );

      // Get time range
      const firstTime = sortedForecasts[0].forecast_time;
      const lastTime =
        sortedForecasts[sortedForecasts.length - 1].forecast_time;

      // Format time range
      let timeRange = "";
      if (sortedForecasts.length === 1) {
        const [hours, minutes] = firstTime.split(":").map(Number);
        const timeString = new Date(
          2024,
          0,
          1,
          hours,
          minutes
        ).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        timeRange = timeString;
      } else {
        const firstHours = parseInt(firstTime.split(":")[0]);
        const lastHours = parseInt(lastTime.split(":")[0]);
        const firstTimeString = new Date(
          2024,
          0,
          1,
          firstHours,
          0
        ).toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        });
        const lastTimeString = new Date(
          2024,
          0,
          1,
          lastHours,
          0
        ).toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        });
        timeRange = `${firstTimeString} - ${lastTimeString}`;
      }

      // Use the middle forecast as representative, or first if only one
      const representativeIndex = Math.floor(sortedForecasts.length / 2);
      const representative = sortedForecasts[representativeIndex];

      return {
        direction,
        forecasts: sortedForecasts,
        representative,
        timeRange,
        count: sortedForecasts.length,
      };
    })
    .sort((a, b) => {
      // Sort by direction for consistent display
      const directionOrder = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
        "Variable",
      ];
      const aIndex = directionOrder.indexOf(a.direction);
      const bIndex = directionOrder.indexOf(b.direction);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
}

/**
 * Group forecasts by swell direction for better surf-focused display
 */
export function groupForecastsBySwellDirection<
  T extends {
    swell_1_direction: string | null;
    swell_1_height: string | null;
    swell_2_direction: string | null;
    swell_2_height: string | null;
    wave_direction: string | null;
    forecast_time: string;
    [key: string]: any;
  }
>(
  forecasts: T[]
): Array<{
  direction: string;
  forecasts: T[];
  representative: T;
  timeRange: string;
  count: number;
  swellType: "primary" | "secondary" | "mixed";
}> {
  if (forecasts.length === 0) return [];

  // Simple grouping by primary wave direction
  const groups = forecasts.reduce((acc, forecast) => {
    // Use primary swell direction, fallback to wave direction
    let direction =
      forecast.swell_1_direction || forecast.wave_direction || "Variable";

    if (!acc[direction]) {
      acc[direction] = [];
    }
    acc[direction].push(forecast);
    return acc;
  }, {} as Record<string, T[]>);

  // Convert to array with representative data
  return Object.entries(groups)
    .map(([direction, groupForecasts]) => {
      // Sort by time to get proper time range
      const sortedForecasts = groupForecasts.sort((a, b) =>
        a.forecast_time.localeCompare(b.forecast_time)
      );

      // Get time range
      const firstTime = sortedForecasts[0].forecast_time;
      const lastTime =
        sortedForecasts[sortedForecasts.length - 1].forecast_time;

      // Format time range
      let timeRange = "";
      if (sortedForecasts.length === 1) {
        const [hours, minutes] = firstTime.split(":").map(Number);
        const timeString = new Date(
          2024,
          0,
          1,
          hours,
          minutes
        ).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        timeRange = timeString;
      } else {
        const firstHours = parseInt(firstTime.split(":")[0]);
        const lastHours = parseInt(lastTime.split(":")[0]);
        const firstTimeString = new Date(
          2024,
          0,
          1,
          firstHours,
          0
        ).toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        });
        const lastTimeString = new Date(
          2024,
          0,
          1,
          lastHours,
          0
        ).toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        });
        timeRange = `${firstTimeString} - ${lastTimeString}`;
      }

      // Use the middle forecast as representative, or first if only one
      const representativeIndex = Math.floor(sortedForecasts.length / 2);
      const representative = sortedForecasts[representativeIndex];

      // Determine swell type based on what data is available
      let swellType: "primary" | "secondary" | "mixed" = "mixed";
      if (representative.swell_1_height) {
        swellType = "primary";
      } else if (representative.swell_2_height) {
        swellType = "secondary";
      }

      return {
        direction,
        forecasts: sortedForecasts,
        representative,
        timeRange,
        count: sortedForecasts.length,
        swellType,
      };
    })
    .sort((a, b) => {
      // Sort by direction for consistent display
      const directionOrder = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
        "Variable",
      ];
      const aIndex = directionOrder.indexOf(a.direction);
      const bIndex = directionOrder.indexOf(b.direction);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
}
