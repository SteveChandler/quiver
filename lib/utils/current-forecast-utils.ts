export interface ForecastTimeInfo {
  forecast_date: string;
  forecast_time: string;
}

/**
 * Gets the most appropriate forecast for the current time
 * Uses forward-looking logic: selects the next forecast at or after current time
 * If no future forecasts today, returns the first forecast of tomorrow
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
  // If today has no forecasts, return the first forecast of the next available day
  if (todaysForecasts.length > 0) {
    // Return the last forecast of today (most recent)
    const sortedTodaysForecasts = [...todaysForecasts].sort((a, b) => {
      return a.forecast_time.localeCompare(b.forecast_time);
    });
    console.log(`🕘 No future forecasts today, returning most recent: ${sortedTodaysForecasts[sortedTodaysForecasts.length - 1].forecast_time}`);
    return sortedTodaysForecasts[sortedTodaysForecasts.length - 1];
  }

  // If no today forecasts, return first forecast of next available day
  const allSorted = [...forecasts].sort((a, b) => {
    const dateCompare = a.forecast_date.localeCompare(b.forecast_date);
    if (dateCompare !== 0) return dateCompare; // Earliest date first
    return a.forecast_time.localeCompare(b.forecast_time); // Earliest time first
  });

  console.log(`🔄 Fallback to earliest available forecast: ${allSorted[0]?.forecast_date} ${allSorted[0]?.forecast_time}`);
  return allSorted[0];
}

/**
 * Gets the best forecast for a specific date
 * For today: uses forward-looking logic
 * For other dates: returns the first forecast of that date
 */
export function getBestForecastForDate<T extends ForecastTimeInfo>(
  forecasts: T[],
  targetDate: string
): T | null {
  if (!forecasts || forecasts.length === 0) {
    return null;
  }

  const dateForecasts = forecasts.filter((f) => f.forecast_date === targetDate);

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
    // For other dates, return the first forecast (typically earliest in the day)
    const sorted = [...dateForecasts].sort((a, b) => {
      return a.forecast_time.localeCompare(b.forecast_time);
    });
    return sorted[0];
  }
}

/**
 * Checks if a forecast time is in the future relative to current time
 */
export function isForecastInFuture(forecast: ForecastTimeInfo): boolean {
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
