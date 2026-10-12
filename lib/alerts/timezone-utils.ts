import { fromZonedTime } from "date-fns-tz";
import { getLocalDateFormatter, getLocalHourFormatter } from "@/lib/services/discovery/window-selector/time-slot-utils";

/** The calendar date after `localDate` (YYYY-MM-DD), advanced in UTC so DST cannot shift it. */
function nextCalendarDate(localDate: string): string {
  const next = new Date(`${localDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function getUpcomingSurfDate(now: Date, timezone: string): string {
  const localDate = getLocalDateFormatter(timezone).format(now);
  const localHour = Number(getLocalHourFormatter(timezone).format(now)) % 24;
  return localHour < 16 ? localDate : nextCalendarDate(localDate);
}

/**
 * UTC timestamps for the start and end of a local calendar date in a timezone.
 * E.g. "2026-04-01" in "America/Los_Angeles" -> 2026-04-01T07:00:00Z to 2026-04-02T06:59:59Z (PDT).
 * The end is the last second before the next local midnight, so a DST day is 23 or 25 hours.
 * A local midnight that does not exist (zones that spring forward at 00:00) resolves to the
 * pre-transition offset, as date-fns-tz does.
 */
export function getUtcDayBounds(
  localDate: string,
  timezone: string
): { start: string; end: string } {
  const start = fromZonedTime(`${localDate}T00:00:00`, timezone);
  const end = fromZonedTime(`${nextCalendarDate(localDate)}T00:00:00`, timezone);
  return { start: start.toISOString(), end: new Date(end.getTime() - 1000).toISOString() };
}
