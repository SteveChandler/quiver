/**
 * Timezone Utilities (client-safe)
 *
 * IMPORTANT: Do NOT import `geo-tz` here (it depends on Node `fs` and breaks
 * client bundling). Server-only callers should import from
 * `lib/utils/timezone-utils.server.ts`.
 */

import { DEFAULT_TIMEZONE } from "./timezone-constants";

export { DEFAULT_TIMEZONE } from "./timezone-constants";
export { getLocalHour, isNightHour } from "./timezone-utils.shared";

/**
 * Default timezone fallback for when timezone is unknown.
 */
export function resolveBeachTimezone(tz?: string | null): string {
  return tz || DEFAULT_TIMEZONE;
}

/**
 * Get a YYYY-MM-DD date string for a given Date in a specific timezone.
 *
 * This is used anywhere we need "today" semantics aligned to a beach's local
 * timezone (e.g., Surf Intel). This avoids UTC date rollovers causing false
 * "not available" states late afternoon local time.
 */
export function getLocalDateString(
  date: Date,
  timezone?: string | null
): string {
  const tz = timezone || DEFAULT_TIMEZONE;

  try {
    // Use formatToParts to avoid locale-dependent ordering.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (!year || !month || !day) {
      throw new Error("Missing date parts");
    }

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error(
      `❌ [getLocalDateString] Error converting to timezone ${tz}:`,
      error
    );
    // Fallback to local machine date.
    const d = date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}
