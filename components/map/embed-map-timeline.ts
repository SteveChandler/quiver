export const LEGACY_EMBED_TIMELINE_STEPS = [
  "Now",
  "+3h",
  "+6h",
  "+9h",
  "+12h",
  "+15h",
  "+18h",
  "+21h",
] as const;

export const HOURLY_EMBED_TIMELINE_STEPS = Array.from(
  { length: 43 },
  (_, hourOffset) => hourOffset,
) as number[];

export function formatEmbedMapTimelineLabel(
  hourOffset: number,
  now: Date,
): string {
  if (hourOffset === 0) return "Now";

  const date = new Date(now.getTime() + hourOffset * 60 * 60 * 1000);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(date);
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return time;

  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  return `${weekday} ${time}`;
}

export function hourlyEmbedTimelineLabels(now: Date): string[] {
  return HOURLY_EMBED_TIMELINE_STEPS.map((hourOffset) =>
    formatEmbedMapTimelineLabel(hourOffset, now),
  );
}
