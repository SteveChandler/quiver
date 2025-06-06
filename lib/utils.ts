import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility function to convert forecast date and time from UTC to local time
export function formatForecastTime(
  forecastDate: string,
  forecastTime: string
): string {
  // Create a proper UTC date string by combining date and time with 'Z' suffix
  const utcDateString = `${forecastDate}T${forecastTime}Z`;
  const date = new Date(utcDateString);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Utility function for more detailed time formatting
export function formatForecastTimeDetailed(
  forecastDate: string,
  forecastTime: string
): string {
  const utcDateString = `${forecastDate}T${forecastTime}Z`;
  const date = new Date(utcDateString);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
