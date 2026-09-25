import { getLocalHour } from '@/lib/utils/timezone-utils.shared';

export const SESSION_TIMES = ['dawn_patrol', 'morning', 'lunch', 'afternoon', 'evening', 'any'] as const;
export type SessionTime = (typeof SESSION_TIMES)[number];

/**
 * Local hours [start, end) each profiles.preferred_session_time covers. Mirrors
 * quiver-native src/lib/session-time-preference.ts. Morning includes dawn
 * patrol; dawn patrol stays first light only.
 */
export const SESSION_TIME_HOURS: Readonly<Record<Exclude<SessionTime, 'any'>, readonly [number, number]>> = {
  dawn_patrol: [4, 7],
  morning: [4, 10],
  lunch: [10, 13],
  afternoon: [13, 17],
  evening: [17, 24],
};

export function parseSessionTime(value: unknown): SessionTime | null {
  return typeof value === 'string' && (SESSION_TIMES as readonly string[]).includes(value)
    ? (value as SessionTime)
    : null;
}

export function isInSessionTime(date: Date, timezone: string, preference: SessionTime | null | undefined): boolean {
  if (!preference || preference === 'any') return true;
  const [start, end] = SESSION_TIME_HOURS[preference];
  const hour = getLocalHour(date, timezone);
  return hour >= start && hour < end;
}

/** Whether a window [start, end) on one local day overlaps the preferred hours. */
export function overlapsSessionTime(
  start: Date,
  end: Date,
  timezone: string,
  preference: SessionTime | null | undefined,
): boolean {
  if (!preference || preference === 'any') return true;
  const [prefStart, prefEnd] = SESSION_TIME_HOURS[preference];
  const startHour = getLocalHour(start, timezone) + start.getUTCMinutes() / 60;
  const rawEnd = getLocalHour(end, timezone) + end.getUTCMinutes() / 60;
  // A window ending at local midnight reads as hour 0; it ends at 24.
  const endHour = rawEnd <= startHour ? rawEnd + 24 : rawEnd;
  return startHour < prefEnd && endHour > prefStart;
}
