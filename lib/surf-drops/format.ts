/**
 * Client-safe formatting helpers for Surf Drops UI.
 *
 * These are separated from lib/surf-drops/service.ts (Node-only) so both
 * server and client code can share the same window/date presentation.
 */

const DATE_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

const TIME_FMT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

function safeDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function relativeDay(target: Date, now: Date): string | null {
  if (isSameDay(target, now)) return "today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(target, tomorrow)) return "tomorrow";
  return null;
}

/**
 * "Starts 6:15 AM · Ends 7:15 AM · today"
 * "Starts Sat, Jul 5 · 6:15 AM – 7:15 AM"
 */
export function formatSurfDropWindow(
  startsAt: string | null,
  endsAt: string | null,
  now: Date = new Date(),
): string {
  const start = safeDate(startsAt);
  const end = safeDate(endsAt);
  if (!start || !end) return "";

  const relative = relativeDay(start, now);
  const startTime = start.toLocaleTimeString("en-US", TIME_FMT);
  const endTime = end.toLocaleTimeString("en-US", TIME_FMT);

  if (relative) {
    return `Starts ${startTime} · Ends ${endTime} · ${relative}`;
  }
  const dateLabel = start.toLocaleDateString("en-US", DATE_FMT);
  return `${dateLabel} · ${startTime} – ${endTime}`;
}
