// lib/notifications/quiet-hours.ts
//
// Shared quiet-hours primitives. Extracted from lib/notifications/worker.ts so
// the email delivery branch in app/api/cron/condition-alert-deliver can reuse
// the exact same window math the push worker uses — instead of reinventing it.
//
// Pure functions, no DB/IO. Safe to import from cron routes and the worker.

import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";
import { localDateTimeToUTC } from "@/lib/utils/forecast-time-resolver";

/** Default 10pm–4am local quiet window (defer mode), mirroring the registry. */
export const DEFAULT_QUIET = { windowStart: 22, windowEnd: 4 } as const;

/**
 * True when `hour` (0-23, local) falls inside the [start, end) quiet window.
 * Handles midnight-wrapping windows (e.g. 22→4 means 22,23,0,1,2,3 are quiet).
 */
export function isInQuietWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/** Resolve a stored timezone, falling back to DEFAULT_TIMEZONE when null/invalid. */
export function resolveNotificationTimezone(timezone: string | null): string {
  if (!timezone) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getLocalDateStringForTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Could not resolve local date for timezone ${timezone}`);
  }
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/**
 * UTC instant at which the recipient leaves their current quiet window — i.e.
 * the next occurrence of local `end` o'clock. Used by the push worker to set
 * `next_attempt_at`; the email branch only needs the boolean check above, but
 * this is exported for parity.
 */
export function getQuietWindowEnd(
  now: Date,
  timezone: string,
  localHour: number,
  start: number,
  end: number
): Date {
  const localDate = getLocalDateStringForTimezone(now, timezone);
  const targetDate =
    start > end && localHour >= start
      ? addDaysToDateString(localDate, 1)
      : localDate;
  const endHour = String(end).padStart(2, "0");
  return localDateTimeToUTC(targetDate, `${endHour}:00:00`, timezone);
}
