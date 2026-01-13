/**
 * Time Formatting Utilities
 *
 * Reusable functions for formatting time values across the application.
 * Used by CoastPulse, session history, activity feeds, and other time-sensitive displays.
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
