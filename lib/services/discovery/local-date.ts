import { getLocalDateFormatter } from "./window-selector/time-slot-utils";

/** The calendar day at a timezone, as YYYY-MM-DD. */
export function localDate(at: Date, timezone: string): string {
  return getLocalDateFormatter(timezone).format(at);
}

/**
 * The UTC offset of a timezone at an instant, in milliseconds.
 */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return asUtc - at.getTime();
}

/**
 * A wall-clock time in a timezone, as a UTC instant.
 *
 * `new Date('2026-10-26T23:59:59Z')` is the end of the day in UTC, which in
 * California is the afternoon of the same day - an edition built that way
 * expires about seven hours early. The offset is resolved twice because it can
 * itself change across a DST boundary.
 */
export function zonedWallClockToUtc(date: string, time: string, timeZone: string): string {
  const guess = new Date(`${date}T${time}Z`);
  const firstPass = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(firstPass, timeZone)).toISOString();
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}
