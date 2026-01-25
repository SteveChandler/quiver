import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";

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
