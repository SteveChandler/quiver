export interface ForecastTimeInfo {
  forecast_at?: string;
  /** @deprecated Use forecast_at */
  forecast_date: string;
  /** @deprecated Use forecast_at */
  forecast_time: string;
}

/**
 * Get timestamp (ms since epoch) for comparison.
 * Prefers forecast_at (timestamptz) over legacy forecast_date + forecast_time.
 */
function getForecastTimestamp(forecast: ForecastTimeInfo): number {
  if (forecast.forecast_at) {
    return new Date(forecast.forecast_at).getTime();
  }
  // Legacy fallback: construct from date + time (treated as local time, no Z suffix)
  if (forecast.forecast_date && forecast.forecast_time) {
    const ts = new Date(
      `${forecast.forecast_date}T${forecast.forecast_time}`
    ).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }
  return 0;
}

/**
 * Check whether ANY forecast in the array uses the new forecast_at field.
 */
function hasForecastAtField(forecasts: ForecastTimeInfo[]): boolean {
  return forecasts.some((f) => !!f.forecast_at);
}

/**
 * Gets the most appropriate forecast for the current time.
 *
 * When forecast_at is present, uses unified timestamp comparison:
 *   - Sort by timestamp ascending
 *   - Return the first forecast whose timestamp is >= now
 *   - If none are future, return the most recent past forecast
 *
 * When only legacy fields are present, uses the original date-grouping logic
 * for full backward compatibility.
 */
export function getCurrentForecast<T extends ForecastTimeInfo>(
  forecasts: T[]
): T | null {
  if (!forecasts || forecasts.length === 0) {
    return null;
  }

  // If only one forecast, return it
  if (forecasts.length === 1) {
    return forecasts[0];
  }

  // --- New path: use forecast_at when available ---
  if (hasForecastAtField(forecasts)) {
    const nowMs = Date.now();

    // Sort ascending by timestamp
    const sorted = [...forecasts].sort(
      (a, b) => getForecastTimestamp(a) - getForecastTimestamp(b)
    );

    // Find the first future forecast (timestamp >= now)
    const firstFuture = sorted.find(
      (f) => getForecastTimestamp(f) >= nowMs
    );
    if (firstFuture) {
      return firstFuture;
    }

    // All past — return the most recent (last in ascending sort)
    return sorted[sorted.length - 1];
  }

  // --- Legacy path: date-grouping with local-time comparison ---
  return getCurrentForecastLegacy(forecasts);
}

/**
 * Legacy implementation of getCurrentForecast using forecast_date + forecast_time.
 * Preserved for backward compatibility when forecast_at is not present.
 */
function getCurrentForecastLegacy<T extends ForecastTimeInfo>(
  forecasts: T[]
): T | null {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const today = now.toISOString().split("T")[0];

  // Group forecasts by date
  const forecastsByDate: Record<string, T[]> = {};
  forecasts.forEach((forecast) => {
    const date = forecast.forecast_date;
    if (!forecastsByDate[date]) {
      forecastsByDate[date] = [];
    }
    forecastsByDate[date].push(forecast);
  });

  // Sort dates
  const sortedDates = Object.keys(forecastsByDate).sort();

  // First, try to find a future forecast today
  const todaysForecasts = forecastsByDate[today] || [];
  if (todaysForecasts.length > 0) {
    // Sort today's forecasts by time
    const sortedTodaysForecasts = [...todaysForecasts].sort((a, b) => {
      return a.forecast_time.localeCompare(b.forecast_time);
    });

    // Find the next forecast at or after current time
    for (const forecast of sortedTodaysForecasts) {
      const [hours, minutes] = forecast.forecast_time.split(":").map(Number);
      const forecastTime = hours * 60 + minutes;

      // Forward-looking: if forecast time is at or after current time
      if (forecastTime >= currentTime) {
        return forecast;
      }
    }
  }

  // If no future forecasts today, get the first forecast of the next available day
  for (const date of sortedDates) {
    if (date > today) {
      const nextDayForecasts = forecastsByDate[date] || [];
      if (nextDayForecasts.length > 0) {
        // Sort by time and return the first (earliest) forecast of the next day
        const sortedNextDayForecasts = [...nextDayForecasts].sort((a, b) => {
          return a.forecast_time.localeCompare(b.forecast_time);
        });
        return sortedNextDayForecasts[0];
      }
    }
  }

  // Fallback: if we only have past forecasts, return the most recent one from today
  if (todaysForecasts.length > 0) {
    const sortedTodaysForecasts = [...todaysForecasts].sort((a, b) => {
      return a.forecast_time.localeCompare(b.forecast_time);
    });
    return sortedTodaysForecasts[sortedTodaysForecasts.length - 1];
  }

  // If no today forecasts, return first forecast of next available day
  const allSorted = [...forecasts].sort((a, b) => {
    const dateCompare = a.forecast_date.localeCompare(b.forecast_date);
    if (dateCompare !== 0) return dateCompare;
    return a.forecast_time.localeCompare(b.forecast_time);
  });

  return allSorted[0];
}

/**
 * Gets the best forecast for a specific date.
 * For today: uses forward-looking logic.
 * For other dates: returns the first forecast of that date.
 */
export function getBestForecastForDate<T extends ForecastTimeInfo>(
  forecasts: T[],
  targetDate: string
): T | null {
  if (!forecasts || forecasts.length === 0) {
    return null;
  }

  const dateForecasts = forecasts.filter((f) => {
    // When forecast_at is present, extract the date portion
    if (f.forecast_at) {
      const atDate = f.forecast_at.split("T")[0];
      return atDate === targetDate;
    }
    return f.forecast_date === targetDate;
  });

  if (dateForecasts.length === 0) {
    return null;
  }

  if (dateForecasts.length === 1) {
    return dateForecasts[0];
  }

  const today = new Date().toISOString().split("T")[0];
  const isToday = targetDate === today;

  if (isToday) {
    // For today, use forward-looking logic
    return getCurrentForecast(dateForecasts);
  } else {
    // For other dates, return the earliest forecast
    const sorted = [...dateForecasts].sort(
      (a, b) => getForecastTimestamp(a) - getForecastTimestamp(b)
    );
    return sorted[0];
  }
}

/**
 * Checks if a forecast time is in the future relative to current time.
 * Prefers forecast_at when available.
 */
export function isForecastInFuture(forecast: ForecastTimeInfo): boolean {
  if (forecast.forecast_at) {
    return getForecastTimestamp(forecast) > Date.now();
  }

  // Legacy path: local-time comparison
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const today = now.toISOString().split("T")[0];

  // If forecast is for a future date, it's always in the future
  if (forecast.forecast_date > today) {
    return true;
  }

  // If forecast is for a past date, it's always in the past
  if (forecast.forecast_date < today) {
    return false;
  }

  // If forecast is for today, check the time
  const [hours, minutes] = forecast.forecast_time.split(":").map(Number);
  const forecastTime = hours * 60 + minutes;

  return forecastTime >= currentTime;
}

/**
 * Utility to format time for debugging
 */
export function formatCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
}
