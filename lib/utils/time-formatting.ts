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
