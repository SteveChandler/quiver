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

const MAX_HOURLY_EMBED_TIMELINE_INDEX = HOURLY_EMBED_TIMELINE_STEPS.length - 1;
const HOUR_MS = 60 * 60 * 1000;

function validForecastAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && epoch % HOUR_MS === 0 && new Date(epoch).toISOString() === value;
}

export function embedMapTimelineTimezone(timezone: string | null | undefined): string | undefined {
  if (typeof timezone !== "string" || timezone.length === 0 || timezone.trim() !== timezone) {
    return undefined;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return undefined;
  }
}

export function hourlyEmbedTimelineTimestamps(timeline: unknown): Array<string | undefined> {
  if (!timeline || typeof timeline !== "object" || Array.isArray(timeline)) return [];

  const envelope = timeline as Record<string, unknown>;
  if (!Array.isArray(envelope.timestamps)) return [];
  const timestamps = envelope.timestamps;
  if (!envelope.partitionsByBeach || typeof envelope.partitionsByBeach !== "object") {
    return [];
  }

  const partitionsByBeach = envelope.partitionsByBeach as Record<string, unknown>;
  if (Object.values(partitionsByBeach).some(
    (partitions) => !Array.isArray(partitions) || partitions.length !== timestamps.length,
  )) {
    return [];
  }

  return Array.from(
    { length: Math.min(timestamps.length, MAX_HOURLY_EMBED_TIMELINE_INDEX + 1) },
    (_, index) => {
      const timestamp = timestamps[index];
      return validForecastAt(timestamp) ? timestamp : undefined;
    },
  );
}

export function forecastAtForEmbedTimelineIndex(
  timestamps: readonly (string | undefined)[],
  index: number,
): string | undefined {
  if (!Number.isInteger(index) || index < 0 || index > MAX_HOURLY_EMBED_TIMELINE_INDEX) {
    return undefined;
  }

  const timestamp = timestamps[index];
  return validForecastAt(timestamp) ? timestamp : undefined;
}

function formatAbsoluteHourlyEmbedTimelineLabel(
  timestamp: string,
  timezone: string | undefined,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  }).formatToParts(new Date(timestamp));
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value ?? "";

  return [weekday, hour, dayPeriod].filter(Boolean).join(" ");
}

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

export function hourlyEmbedTimelineLabels(
  now: Date,
  timestamps: readonly (string | undefined)[] = [],
  timezone?: string | null,
): string[] {
  const validTimezone = embedMapTimelineTimezone(timezone);

  return HOURLY_EMBED_TIMELINE_STEPS.map((hourOffset) => {
    const forecastAt = forecastAtForEmbedTimelineIndex(timestamps, hourOffset);
    return forecastAt
      ? formatAbsoluteHourlyEmbedTimelineLabel(forecastAt, validTimezone)
      : formatEmbedMapTimelineLabel(hourOffset, now);
  });
}
