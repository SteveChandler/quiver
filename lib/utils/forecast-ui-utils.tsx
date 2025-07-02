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

  // Helper function to get all possible swell directions for a forecast
  const getSwellDirections = (forecast: any) => {
    const directions = [];

    const swell1Height = parseFloat(
      forecast.swell_1_height?.replace(/[^0-9.]/g, "") || "0"
    );
    const swell2Height = parseFloat(
      forecast.swell_2_height?.replace(/[^0-9.]/g, "") || "0"
    );

    if (forecast.swell_1_direction && swell1Height > 0) {
      directions.push({
        direction: forecast.swell_1_direction,
        height: swell1Height,
        type: "primary",
        period: forecast.swell_1_period,
      });
    }

    if (forecast.swell_2_direction && swell2Height > 0) {
      directions.push({
        direction: forecast.swell_2_direction,
        height: swell2Height,
        type: "secondary",
        period: forecast.swell_2_period,
      });
    }

    // Fallback to wave direction if no swell data
    if (directions.length === 0 && forecast.wave_direction) {
      const waveHeight = parseFloat(
        forecast.wave_height?.replace(/[^0-9.]/g, "") || "0"
      );
      directions.push({
        direction: forecast.wave_direction,
        height: waveHeight,
        type: "mixed",
        period: forecast.wave_period,
      });
    }

    // Return dominant direction (highest wave)
    if (directions.length === 0) {
      return { direction: "Variable", height: 0, type: "mixed", period: null };
    }

    return directions.reduce((prev, current) =>
      current.height > prev.height ? current : prev
    );
  };

  // Group by dominant swell direction
  const groups = forecasts.reduce(
    (acc, forecast) => {
      const dominant = getSwellDirections(forecast);
      const direction = dominant.direction;

      if (!acc[direction]) {
        acc[direction] = [];
      }
      acc[direction].push({
        ...forecast,
        dominantSwellType: dominant.type,
        dominantHeight: dominant.height,
        dominantPeriod: dominant.period,
      });
      return acc;
    },
    {} as Record<
      string,
      (T & {
        dominantSwellType: "primary" | "secondary" | "mixed";
        dominantHeight: number;
        dominantPeriod: string | null;
      })[]
    >
  );

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

      // Determine the most common swell type in this group
      const swellTypeCounts = sortedForecasts.reduce((acc, f) => {
        acc[f.dominantSwellType] = (acc[f.dominantSwellType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dominantSwellType = Object.entries(swellTypeCounts).reduce((a, b) =>
        swellTypeCounts[a[0]] > swellTypeCounts[b[0]] ? a : b
      )[0] as "primary" | "secondary" | "mixed";

      return {
        direction,
        forecasts: sortedForecasts,
        representative,
        timeRange,
        count: sortedForecasts.length,
        swellType: dominantSwellType,
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
