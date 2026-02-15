import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility function to convert forecast date and time from UTC to local time.
// Accepts either a single forecast_at ISO string or legacy forecast_date + forecast_time.
export function formatForecastTime(
  forecastDateOrAt: string,
  forecastTime?: string
): string {
  // Single-arg: forecast_at ISO 8601 timestamp
  const date = forecastTime
    ? new Date(`${forecastDateOrAt}T${forecastTime}Z`)
    : new Date(forecastDateOrAt);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
