/**
 * Utility functions for session creation
 */

/**
 * Format a date for sharing (e.g., "January 15, 2026")
 */
export function formatShareDate(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Combine date and time strings into PostgreSQL timestamp format
 */
export function combineDateAndTime(
  date?: string,
  time?: string
): string | undefined {
  if (!date) return undefined;

  if (date && time) {
    // Create a Date object from the selected date and time
    const dateTimeString = `${date}T${time}:00`;
    const dateTime = new Date(dateTimeString);

    // Format as PostgreSQL timestamp with timezone
    return dateTime
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "+00");
  } else {
    // If only date is provided, use start of day
    const dateTime = new Date(`${date}T00:00:00`);
    return dateTime
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "+00");
  }
}

/**
 * Parse duration string (e.g., "2h30m") into minutes
 */
export function parseDuration(duration: string): number | undefined {
  if (!duration) return undefined;

  const hourMatch = duration.match(/(\d+)h/);
  const minuteMatch = duration.match(/(\d+)m/);
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;

  return hours * 60 + minutes;
}
