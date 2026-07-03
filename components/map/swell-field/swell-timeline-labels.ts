const HOUR_MS = 60 * 60 * 1000;
const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export const MAP_SWELL_TIMELINE_STEP_HOURS = [
  0, 3, 6, 12, 18, 24, 36, 48,
] as const;

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimelineHour(date: Date, includeWeekday: boolean): string {
  const hour = date.getHours();
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const timeLabel = `${displayHour} ${suffix}`;

  if (!includeWeekday) {
    return timeLabel;
  }

  return `${WEEKDAY_LABELS[date.getDay()]} ${timeLabel}`;
}

export function buildSwellTimelineSteps(
  stepHours: readonly number[] = MAP_SWELL_TIMELINE_STEP_HOURS,
  now: Date = new Date(),
): string[] {
  const base = new Date(now);
  base.setMinutes(0, 0, 0);

  return stepHours.map((offsetHours, index) => {
    if (index === 0) {
      return "Now";
    }

    const stepDate = new Date(base.getTime() + offsetHours * HOUR_MS);
    return formatTimelineHour(stepDate, !isSameLocalDay(base, stepDate));
  });
}
