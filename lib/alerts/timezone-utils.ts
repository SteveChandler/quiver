import { fromZonedTime } from "date-fns-tz";
import { getLocalDateFormatter, getLocalHourFormatter } from "@/lib/services/discovery/window-selector/time-slot-utils";

export function getUpcomingSurfDate(now: Date, timezone: string): string {
  const localDate = getLocalDateFormatter(timezone).format(now);
  const localHour = Number(getLocalHourFormatter(timezone).format(now)) % 24;
  if (localHour < 16) return localDate;

  // Advance the calendar date, so DST cannot shift the chosen surf day.
  const tomorrow = new Date(`${localDate}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

/**
 * UTC timestamps for the start and end of a local calendar date in a timezone.
 * E.g. "2026-04-01" in "America/Los_Angeles" -> 2026-04-01T07:00:00Z to 2026-04-02T06:59:59Z (PDT).
 * The end is the last second before the next local midnight, so a DST day is 23 or 25 hours.
 */
export function getUtcDayBounds(
  localDate: string,
  timezone: string
): { start: string; end: string } {
  const start = fromZonedTime(`${localDate}T00:00:00`, timezone);
  const nextDay = new Date(`${localDate}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const end = fromZonedTime(`${nextDay.toISOString().slice(0, 10)}T00:00:00`, timezone);
  return { start: start.toISOString(), end: new Date(end.getTime() - 1000).toISOString() };
}
