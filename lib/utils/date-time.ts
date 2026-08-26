/**
 * Date & Time Formatting Utilities (canonical)
 *
 * Single source of truth for all date/time formatting across the application.
 * Absorbs: date-formatting.ts, date-utils.ts, time-formatting.ts, time-formatters.ts
 *
 * IMPORTANT: All beach-related time displays should use these helpers with an
 * explicit IANA timezone (e.g. "America/Los_Angeles"). Do NOT rely on the
 * browser's local timezone for surf-related times; always use the beach's
 * timezone passed from the server.
 *
 * @module lib/utils/date-time
 */

import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";

// =============================================================================
// Timezone-aware hour/minute extraction (client-safe)
// =============================================================================

/**
 * Get the hour (0-23) of a Date in a specific IANA timezone.
 * Client-safe alternative to getLocalHour() from timezone-utils.server.ts.
 */
export function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(date);
    const hour = parseInt(hourStr, 10);
    return hour === 24 ? 0 : hour;
  } catch {
    return date.getUTCHours();
  }
}

/**
 * Get the minute (0-59) of a Date in a specific IANA timezone.
 */
export function getMinuteInTimezone(date: Date, timezone: string): number {
  try {
    const minuteStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      minute: "numeric",
    }).format(date);
    return parseInt(minuteStr, 10);
  } catch {
    return date.getUTCMinutes();
  }
}

// =============================================================================
// Beach-timezone helpers (from date-utils.ts)
// =============================================================================

/**
 * Format an ISO timestamp or Date in a specific timezone (client-safe).
 *
 * IMPORTANT: Do not attempt to derive timezone from lat/lon in client code.
 * If you need coordinate->timezone lookup, compute it server-side (e.g. using
 * `lib/utils/timezone-utils.server.ts`) and pass the timezone down.
 *
 * @param isoTimestamp - ISO 8601 UTC timestamp (e.g., "2025-01-06T17:48:00.000Z")
 * @param timezone - IANA timezone identifier (e.g. "America/Los_Angeles")
 * @returns Formatted time string (e.g., "5:48 PM")
 *
 * @example
 * // UTC time 01:48 AM displayed as 5:48 PM in San Diego (PST)
 * formatTimeInBeachTimezone("2026-01-07T01:48:00.000Z", "America/Los_Angeles")
 * // → "5:48 PM"
 */
export function formatTimeInBeachTimezone(
  isoTimestamp: string | Date,
  timezone?: string | null
): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const date = typeof isoTimestamp === "string" ? new Date(isoTimestamp) : isoTimestamp;
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).format(date);
  } catch (error) {
    console.error("[formatTimeInBeachTimezone] Error formatting time:", error);
    // Fallback to basic time formatting without timezone
    const date = typeof isoTimestamp === "string" ? new Date(isoTimestamp) : isoTimestamp;
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
}

/**
 * Format a date+time in beach timezone with a custom pattern.
 *
 * Common patterns:
 * - "EEE"              → "Thu" (short weekday)
 * - "EEE h:mm a"       → "Thu 10:00 AM"
 * - "EEE, MMM d"       → "Thu, Jan 8"
 * - "h:mm a"           → "10:00 AM"
 * - "ha"               → "10AM" (lowercase via .toLowerCase())
 * - "H"                → "10" or "22" (24-hour hour)
 * - "m"                → "0" or "30" (minutes)
 *
 * Uses Intl.DateTimeFormat for cross-browser/edge compatibility.
 *
 * @param dateOrIso - Date object or ISO string
 * @param timezone  - IANA timezone (required for beach times)
 * @param pattern   - One of the supported pattern strings
 * @returns Formatted string in beach local time
 */
export function formatBeachDateTime(
  dateOrIso: Date | string,
  timezone: string,
  pattern: "EEE" | "EEE h:mm a" | "EEE, MMM d" | "h:mm a" | "ha" | "H" | "m"
): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;

  try {
    switch (pattern) {
      case "EEE": {
        // "Thu" - short weekday only
        return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
      }
      case "EEE h:mm a": {
        // "Thu 10:00 AM"
        const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
        const time = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: tz,
        }).format(date);
        return `${weekday} ${time}`;
      }
      case "EEE, MMM d": {
        // "Thu, Jan 8"
        return new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: tz,
        }).format(date);
      }
      case "h:mm a": {
        // "10:00 AM"
        return new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: tz,
        }).format(date);
      }
      case "ha": {
        // "10AM" (no space, lowercase am/pm via caller if desired)
        const parts = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: true,
          timeZone: tz,
        }).formatToParts(date);
        const hour = parts.find((p) => p.type === "hour")?.value ?? "";
        const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
        return `${hour}${dayPeriod}`;
      }
      case "H": {
        // 24-hour hour as string, e.g. "10" or "22"
        const parts = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: tz,
        }).formatToParts(date);
        return parts.find((p) => p.type === "hour")?.value ?? "0";
      }
      case "m": {
        // Minutes as string, e.g. "0" or "30"
        const parts = new Intl.DateTimeFormat("en-US", {
          minute: "numeric",
          timeZone: tz,
        }).formatToParts(date);
        return parts.find((p) => p.type === "minute")?.value ?? "0";
      }
      default:
        return date.toISOString();
    }
  } catch (error) {
    console.error("[formatBeachDateTime] Error:", error);
    return date.toISOString();
  }
}

/**
 * Format a time range in beach timezone (e.g., "Thu 10:00 AM - 1:00 PM").
 *
 * If start and end are on the same day, the end only shows time (no weekday).
 * If they span different days, both show the weekday.
 *
 * @param start    - Start Date or ISO string
 * @param end      - End Date or ISO string
 * @param timezone - IANA timezone
 * @returns Formatted range string
 */
export function formatBeachTimeRange(
  start: Date | string,
  end: Date | string,
  timezone: string
): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;

  try {
    // Check if same calendar day in the given timezone
    const startDay = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).format(startDate);
    const endDay = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).format(endDate);

    const startFormatted = formatBeachDateTime(startDate, tz, "EEE h:mm a");

    if (startDay === endDay) {
      // Same day: "Thu 10:00 AM - 1:00 PM"
      const endFormatted = formatBeachDateTime(endDate, tz, "h:mm a");
      return `${startFormatted} - ${endFormatted}`;
    } else {
      // Different days: "Thu 10:00 AM - Fri 1:00 PM"
      const endFormatted = formatBeachDateTime(endDate, tz, "EEE h:mm a");
      return `${startFormatted} - ${endFormatted}`;
    }
  } catch (error) {
    console.error("[formatBeachTimeRange] Error:", error);
    return `${startDate.toISOString()} - ${endDate.toISOString()}`;
  }
}

/**
 * Build a "Best at" label for a time window.
 *
 * @param start    - Window start Date or ISO string
 * @param end      - Window end Date or ISO string
 * @param timezone - IANA timezone
 * @returns e.g., "Best Thu 10am-1pm" or "Best Thu 10:30am-1pm"
 */
export function formatBestAtLabel(
  start: Date | string,
  end: Date | string,
  timezone: string
): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;

  try {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(startDate);

    // Get start time parts
    const startParts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).formatToParts(startDate);
    const startHour = startParts.find((p) => p.type === "hour")?.value ?? "";
    const startMinute = startParts.find((p) => p.type === "minute")?.value ?? "00";
    const startPeriod = (startParts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase();

    // Get end time parts
    const endParts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).formatToParts(endDate);
    const endHour = endParts.find((p) => p.type === "hour")?.value ?? "";
    const endMinute = endParts.find((p) => p.type === "minute")?.value ?? "00";
    const endPeriod = (endParts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase();

    // Format times based on whether AM/PM is shared
    let startTimeStr: string;
    let endTimeStr: string;

    if (startPeriod === endPeriod) {
      // Same period: omit am/pm from start, include on end (e.g., "7-10am")
      startTimeStr = startMinute === "00" ? startHour : `${startHour}:${startMinute}`;
      endTimeStr = endMinute === "00" ? `${endHour}${endPeriod}` : `${endHour}:${endMinute}${endPeriod}`;
    } else {
      // Different periods: include am/pm on both (e.g., "10am-1pm")
      startTimeStr = startMinute === "00" ? `${startHour}${startPeriod}` : `${startHour}:${startMinute}${startPeriod}`;
      endTimeStr = endMinute === "00" ? `${endHour}${endPeriod}` : `${endHour}:${endMinute}${endPeriod}`;
    }

    return `Best ${weekday} ${startTimeStr}-${endTimeStr}`;
  } catch (error) {
    console.error("[formatBestAtLabel] Error:", error);
    return `Best at ${startDate.toISOString()}`;
  }
}

// =============================================================================
// Month range (from date-utils.ts)
// =============================================================================

/**
 * Month names in order (1-indexed: January = 1, December = 12)
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Convert month number (1-12) to month name.
 *
 * @param month - Month number (1 = January, 12 = December)
 * @returns Month name or fallback if invalid
 *
 * @example
 * monthNumberToName(1) // "January"
 * monthNumberToName(12) // "December"
 * monthNumberToName(99) // "Month 99"
 */
function monthNumberToName(month: number): string {
  return MONTH_NAMES[month - 1] ?? `Month ${month}`;
}

/**
 * Format an array of month numbers into a human-readable range.
 *
 * Handles contiguous ranges ("January through March") and
 * non-contiguous lists ("January, February, and March").
 * Also handles wrap-around ranges (e.g., [11, 12, 1, 2] = "November through February").
 *
 * @param months - Array of month numbers (1-12)
 * @returns Formatted month range string
 *
 * @example
 * formatMonthRange([1, 2, 3]) // "January through March"
 * formatMonthRange([1, 3, 5]) // "January, March, and May"
 * formatMonthRange([11, 12, 1, 2]) // "November through February"
 * formatMonthRange([6]) // "June"
 */
export function formatMonthRange(months: number[]): string {
  if (months.length === 0) return '';
  if (months.length === 1) return monthNumberToName(months[0]);

  const sorted = [...months].sort((a, b) => a - b);

  // Check if months are contiguous (non-wrapping)
  const isContiguous = sorted.every((m, i) => {
    if (i === 0) return true;
    const prev = sorted[i - 1];
    return m === prev + 1 || (prev === 12 && m === 1);
  });

  // Check if range wraps around year boundary (e.g., Nov, Dec, Jan, Feb)
  const wrapsAround =
    sorted.length > 1 &&
    sorted[0] === 1 &&
    sorted[sorted.length - 1] === 12 &&
    sorted.every((m, i) => {
      if (i === 0) return true;
      return m === sorted[i - 1] + 1;
    });

  if (isContiguous || wrapsAround) {
    if (wrapsAround) {
      // Find where the sequence breaks to determine start/end
      let startIdx = 0;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) {
          startIdx = i;
          break;
        }
      }
      return `${monthNumberToName(sorted[startIdx])} through ${monthNumberToName(sorted[startIdx === 0 ? sorted.length - 1 : startIdx - 1])}`;
    }
    return `${monthNumberToName(sorted[0])} through ${monthNumberToName(sorted[sorted.length - 1])}`;
  }

  // Non-contiguous: list them with Oxford comma
  const names = sorted.map(monthNumberToName);
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// =============================================================================
// dateUtils object methods — flattened to named exports (from date-utils.ts)
// =============================================================================

/**
 * Format a date string to short format (e.g., "Jan 15")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format forecast time with date and time.
 * Accepts either a single forecast_at ISO string or legacy forecast_date + forecast_time.
 */
export function formatForecastTime(
  forecastDateOrAt: string,
  forecast_time?: string
): string {
  // Single-arg: forecast_at ISO 8601 timestamp
  if (!forecast_time && forecastDateOrAt.includes('T')) {
    const date = new Date(forecastDateOrAt);
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${dateStr} at ${timeStr}`;
  }

  // Legacy two-arg: forecast_date + forecast_time
  const date = new Date(forecastDateOrAt);
  let timeStr = "";

  if (forecast_time) {
    // Parse time if provided (assuming format like "06:00" or "18:00")
    const [hours, minutes] = forecast_time.split(":").map(Number);
    date.setHours(hours, minutes || 0);
    timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return timeStr ? `${dateStr} at ${timeStr}` : dateStr;
}

/**
 * Format forecast time with more detailed information.
 * Accepts either a single forecast_at ISO string or legacy forecast_date + forecast_time.
 */
export function formatForecastTimeDetailed(
  forecastDateOrAt: string,
  forecast_time?: string
): string {
  // Single-arg: forecast_at ISO 8601 timestamp
  if (!forecast_time && forecastDateOrAt.includes('T')) {
    const date = new Date(forecastDateOrAt);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Legacy two-arg: forecast_date + forecast_time
  const date = new Date(forecastDateOrAt);

  if (forecast_time) {
    const [hours, minutes] = forecast_time.split(":").map(Number);
    date.setHours(hours, minutes || 0);
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: forecast_time ? "numeric" : undefined,
    minute: forecast_time ? "2-digit" : undefined,
    hour12: forecast_time ? true : undefined,
  });
}

/**
 * Format last update time to relative time (e.g., "5m ago", "2h ago")
 */
export function formatLastUpdate(date: Date | string): string {
  const now = new Date();
  const updateTime = new Date(date);
  const diffMs = now.getTime() - updateTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return updateTime.toLocaleDateString();
  }
}

/**
 * Format tide time from unix seconds timestamp
 */
export function formatTideTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";

  if (hours > 12) {
    hours -= 12;
  } else if (hours === 0) {
    hours = 12;
  }

  const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateString === today;
}

/**
 * Get relative day name (Today, Tomorrow, Yesterday, or date)
 */
export function getRelativeDayName(dateString: string): string {
  const today = new Date();
  const targetDate = new Date(dateString);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return formatDate(dateString);
}

/**
 * Backward-compatible dateUtils object (deprecated — use named exports).
 * @deprecated Import named functions directly from `@/lib/utils/date-time`.
 */
export const dateUtils = {
  formatDate,
  formatForecastTime,
  formatForecastTimeDetailed,
  formatLastUpdate,
  formatTideTime,
  isToday,
  getRelativeDayName,
};

// =============================================================================
// Date string formatting (from date-formatting.ts)
// =============================================================================

/**
 * Format a date string in YYYY-MM-DD format for a specific timezone.
 *
 * @param date - Date object to format
 * @param timezone - IANA timezone identifier
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  const dateInTz = date.toLocaleString('en-US', { timeZone: timezone });
  const localDate = new Date(dateInTz);

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// =============================================================================
// Time formatting (from time-formatting.ts)
// =============================================================================

/**
 * Format an ISO string or Date to a readable time in the given timezone.
 * Returns empty string on invalid input.
 */
export function formatTimeInTimezone(
  dateOrIso: Date | string | null,
  timezone?: string | null
): string {
  if (!dateOrIso) return "";
  try {
    const date =
      typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone || DEFAULT_TIMEZONE,
    }).format(date);
  } catch {
    return "";
  }
}

export function formatTimeRangeInTimezone(
  start: Date | string | null,
  end: Date | string | null,
  timezone?: string | null,
  separator = "–",
): string | null {
  const startLabel = formatTimeInTimezone(start, timezone);
  const endLabel = formatTimeInTimezone(end, timezone);
  return startLabel && endLabel ? `${startLabel}${separator}${endLabel}` : null;
}

/**
 * Format time in casual style: "10am", "2:30pm"
 * Omits minutes if on the hour, uses lowercase am/pm for brevity.
 */
export function formatTimeCasual(
  dateOrIso: Date | string | null,
  timezone?: string | null
): string {
  if (!dateOrIso) return "";
  try {
    const date =
      typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone || DEFAULT_TIMEZONE,
    }).formatToParts(date);

    const hour = parts.find((p) => p.type === "hour")?.value || "";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const dayPeriod = (parts.find((p) => p.type === "dayPeriod")?.value || "").toLowerCase();

    // Omit minutes if on the hour (e.g., "10am" not "10:00am")
    if (minute === "00") {
      return `${hour}${dayPeriod}`;
    }
    return `${hour}:${minute}${dayPeriod}`;
  } catch {
    return "";
  }
}

// =============================================================================
// Time formatters (from time-formatters.ts)
// =============================================================================

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
    timeZone: "UTC",
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
    timeZone: "UTC",
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
    timeZone: "UTC",
  });
}
