/**
 * Time Formatting Utilities
 *
 * Reusable functions for formatting time and date values across the application.
 * Used by CoastPulse, session history, activity feeds, forecast components,
 * and other time-sensitive displays.
 */

/**
 * Format a timestamp as relative time (e.g., "5 min ago", "1 hr ago")
 *
 * @param timestamp - Date to format
 * @returns Human-readable relative time string
 *
 * @example
 * formatTimeAgo(new Date(Date.now() - 5 * 60 * 1000)) // "5 min ago"
 * formatTimeAgo(new Date(Date.now() - 2 * 60 * 60 * 1000)) // "2 hr ago"
 */
export function formatTimeAgo(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins} min ago`;
  } else {
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hr ago`;
  }
}

/**
 * Format a timestamp as relative time with more granularity
 * Includes days and weeks for older timestamps
 *
 * @param timestamp - Date to format
 * @returns Human-readable relative time string with extended range
 *
 * @example
 * formatTimeAgoExtended(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) // "3 days ago"
 */
export function formatTimeAgoExtended(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hr ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else {
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
  }
}

/**
 * Format a duration in minutes to a human-readable string
 *
 * @param minutes - Duration in minutes
 * @returns Formatted duration string (e.g., "1h 30m", "45m")
 *
 * @example
 * formatDuration(90) // "1h 30m"
 * formatDuration(45) // "45m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (remainingMins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMins}m`;
}

/**
 * Determine whether a window start time is "today" or "tomorrow" in the given timezone
 *
 * @param start - Window start date
 * @param timezone - IANA timezone identifier (e.g., "America/Los_Angeles")
 * @returns 'today' or 'tomorrow'
 */
export function getWindowDayLabel(start: Date, timezone: string): 'today' | 'tomorrow' {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });
  const todayStr = dateFormatter.format(now);
  const startDayStr = dateFormatter.format(start);

  if (todayStr === startDayStr) return 'today';
  return 'tomorrow';
}

/**
 * Format a time window with minute precision for compact display
 *
 * Produces strings like "10:45am–1:45pm" or "7–10am" (when on the hour and same period).
 * Uses the beach's timezone for accurate local time display.
 *
 * @param start - Window start date
 * @param end - Window end date
 * @param timezone - IANA timezone identifier
 * @returns Compact formatted time window string
 *
 * @example
 * formatTimeWindowCompact(start, end, "America/Los_Angeles") // "10:45am–1:45pm"
 * formatTimeWindowCompact(start, end, "America/Los_Angeles") // "7–10am"
 */
export function formatTimeWindowCompact(start: Date, end: Date, timezone: string): string {
  const getTimeParts = (date: Date) => {
    const hourParts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(date);
    const hour24 = parseInt(hourParts.find((p) => p.type === "hour")?.value ?? "0", 10);

    const minuteParts = new Intl.DateTimeFormat("en-US", {
      minute: "numeric",
      timeZone: timezone,
    }).formatToParts(date);
    const minutes = parseInt(minuteParts.find((p) => p.type === "minute")?.value ?? "0", 10);

    const hour12 = hour24 % 12 || 12;
    const period = hour24 >= 12 ? "pm" : "am";

    return { hour24, hour12, minutes, period };
  };

  const startParts = getTimeParts(start);
  const endParts = getTimeParts(end);

  const formatTime = (parts: { hour12: number; minutes: number; period: string }, includePeriod: boolean) => {
    const timeStr = parts.minutes === 0
      ? `${parts.hour12}`
      : `${parts.hour12}:${String(parts.minutes).padStart(2, "0")}`;
    return includePeriod ? `${timeStr}${parts.period}` : timeStr;
  };

  // Same AM/PM period: share the suffix (e.g., "7–10am" or "10:45–1:45pm")
  if (startParts.period === endParts.period) {
    return `${formatTime(startParts, false)}\u2013${formatTime(endParts, true)}`;
  }

  // Different periods: show both (e.g., "10:45am–1:45pm")
  return `${formatTime(startParts, true)}\u2013${formatTime(endParts, true)}`;
}

/**
 * Format a time window for display (e.g., "7-10am", "2-5pm")
 *
 * @param start - Start date
 * @param end - End date
 * @returns Formatted time window string
 *
 * @example
 * formatTimeWindow(new Date("2024-01-01T07:00"), new Date("2024-01-01T10:00")) // "7-10am"
 */
export function formatTimeWindow(start: Date, end: Date): string {
  const formatHour = (date: Date): string => {
    const hour = date.getHours();
    const period = hour >= 12 ? "pm" : "am";
    const displayHour = hour % 12 || 12;
    return `${displayHour}${period}`;
  };

  const startHour = start.getHours();
  const endHour = end.getHours();
  const samePeriod =
    (startHour < 12 && endHour < 12) || (startHour >= 12 && endHour >= 12);

  if (samePeriod) {
    // Same period: "7-10am" or "2-5pm"
    const startDisplay = start.getHours() % 12 || 12;
    return `${startDisplay}-${formatHour(end)}`;
  }

  // Different periods: "11am-2pm"
  return `${formatHour(start)}-${formatHour(end)}`;
}

// =============================================================================
// Date Formatters
// =============================================================================

/**
 * Format a date with full details (e.g., "Saturday, Feb 8")
 *
 * @param date - Date to format
 * @returns Formatted date string with weekday, month, and day
 *
 * @example
 * formatFullDate(new Date("2025-02-08")) // "Saturday, Feb 8"
 */
export function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date for compact display (e.g., "Sat, Feb 8")
 *
 * @param date - Date to format
 * @returns Formatted date string with short weekday, month, and day
 *
 * @example
 * formatCompactDate(new Date("2025-02-08")) // "Sat, Feb 8"
 */
export function formatCompactDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date with just day and abbreviated weekday (e.g., "Sat 8")
 *
 * @param date - Date to format
 * @returns Formatted date string with short weekday and day number
 *
 * @example
 * formatShortDate(new Date("2025-02-08")) // "Sat 8"
 */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
  });
}

/**
 * Format a date with full details including year (e.g., "Saturday, February 8, 2025")
 *
 * @param date - Date to format
 * @returns Formatted date string with weekday, full month, day, and year
 *
 * @example
 * formatFullDateWithYear(new Date("2025-02-08")) // "Saturday, February 8, 2025"
 */
export function formatFullDateWithYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
