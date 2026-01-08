// Consolidated date and time formatting utilities
//
// IMPORTANT: All beach-related time displays should use these helpers with an
// explicit IANA timezone (e.g. "America/Los_Angeles"). Do NOT rely on the
// browser's local timezone for surf-related times; always use the beach's
// timezone passed from the server.

/**
 * Default timezone fallback when none is provided.
 */
const DEFAULT_TIMEZONE = "America/Los_Angeles";

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

export const dateUtils = {
  /**
   * Format a date string to short format (e.g., "Jan 15")
   */
  formatDate: (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },

  /**
   * Format forecast time with date and time
   */
  formatForecastTime: (
    forecast_date: string,
    forecast_time?: string
  ): string => {
    const date = new Date(forecast_date);
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
  },

  /**
   * Format forecast time with more detailed information
   */
  formatForecastTimeDetailed: (
    forecast_date: string,
    forecast_time?: string
  ): string => {
    const date = new Date(forecast_date);

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
  },

  /**
   * Format last update time to relative time (e.g., "5m ago", "2h ago")
   */
  formatLastUpdate: (date: Date | string): string => {
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
  },

  /**
   * Format tide time from timestamp
   */
  formatTideTime: (timestamp: number): string => {
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
  },

  /**
   * Check if a date is today
   */
  isToday: (dateString: string): boolean => {
    const today = new Date().toISOString().split("T")[0];
    return dateString === today;
  },

  /**
   * Get relative day name (Today, Tomorrow, Yesterday, or date)
   */
  getRelativeDayName: (dateString: string): string => {
    const today = new Date();
    const targetDate = new Date(dateString);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";

    return dateUtils.formatDate(dateString);
  },
};
