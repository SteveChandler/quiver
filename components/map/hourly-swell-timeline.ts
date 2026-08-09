import type { HourlySwellTimeline, SwellPartition } from "@/app/api/forecasts/bulk/route";

export interface TimelineDaySegment {
  key: string;
  label: string;
  startIndex: number;
  endIndex: number;
}

const dateTimeFormatterByTimezone = new Map<string, Intl.DateTimeFormat>();
const HOUR_MS = 60 * 60 * 1000;
const MAX_CALENDAR_HORIZON_HOURS = 14 * 24;

function getDateTimeFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatterByTimezone.get(timezone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour: "numeric",
    hour12: true,
    timeZoneName: "short",
    timeZone: timezone,
  });
  dateTimeFormatterByTimezone.set(timezone, formatter);
  return formatter;
}

function dateTimeParts(timestamp: string, timezone: string): Intl.DateTimeFormatPart[] {
  const date = new Date(timestamp);
  return getDateTimeFormatter(timezone).formatToParts(date);
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

function timelineDateIdentity(timestamp: string, timezone: string): {
  key: string;
  label: string;
} {
  const parts = dateTimeParts(timestamp, timezone);
  const weekday = part(parts, "weekday");
  const day = part(parts, "day");
  const year = part(parts, "year");
  const month = part(parts, "month");

  return {
    key: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    label: `${weekday} ${day}`,
  };
}

export function formatTimelineBubble(timestamp: string, timezone: string): string {
  const parts = dateTimeParts(timestamp, timezone);
  const weekday = part(parts, "weekday");
  const day = part(parts, "day");
  const hour = part(parts, "hour");
  const dayPeriod = part(parts, "dayPeriod");
  const timezoneName = part(parts, "timeZoneName");

  return `${weekday} ${day} — ${hour} ${dayPeriod} ${timezoneName}`.trim();
}

export function segmentTimelineDays(
  timestamps: string[],
  timezone: string,
): TimelineDaySegment[] {
  const segments: TimelineDaySegment[] = [];

  timestamps.forEach((timestamp, index) => {
    const { key, label } = timelineDateIdentity(timestamp, timezone);
    const previous = segments.at(-1);

    if (previous?.key === key) {
      previous.endIndex = index;
      return;
    }

    segments.push({
      key,
      label,
      startIndex: index,
      endIndex: index,
    });
  });

  return segments;
}

export function calendarDayTimelineHours(
  startTimestamp: string | undefined,
  timezone: string,
  dayCount: number,
): number {
  const startMs = Date.parse(startTimestamp ?? "");
  if (!Number.isFinite(startMs) || dayCount <= 0) return 0;

  const requestedDayCount = Math.floor(dayCount);
  const localDates = new Set<string>();

  for (let offsetHours = 0; offsetHours < MAX_CALENDAR_HORIZON_HOURS; offsetHours += 1) {
    const timestamp = new Date(startMs + offsetHours * HOUR_MS).toISOString();
    localDates.add(timelineDateIdentity(timestamp, timezone).key);
    if (localDates.size > requestedDayCount) return offsetHours;
  }

  return MAX_CALENDAR_HORIZON_HOURS;
}

type PartitionsByTimestamp = Map<string, Map<string, SwellPartition | null>>;

function furthestCursor(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function addTimelineToTimestampMap(
  target: PartitionsByTimestamp,
  timeline: HourlySwellTimeline,
  overwriteWithIncoming: boolean,
): void {
  for (const timestamp of timeline.timestamps) {
    if (!target.has(timestamp)) {
      target.set(timestamp, new Map<string, SwellPartition | null>());
    }
  }

  for (const [beachId, partitions] of Object.entries(timeline.partitionsByBeach)) {
    timeline.timestamps.forEach((timestamp, index) => {
      const partition = partitions[index] ?? null;
      const byBeach = target.get(timestamp) ?? new Map<string, SwellPartition | null>();
      const existing = byBeach.get(beachId) ?? null;

      if (overwriteWithIncoming ? partition !== null : existing === null) {
        byBeach.set(beachId, partition);
      } else if (!byBeach.has(beachId)) {
        byBeach.set(beachId, null);
      }

      target.set(timestamp, byBeach);
    });
  }
}

export function mergeHourlyTimeline(
  current: HourlySwellTimeline,
  incoming: HourlySwellTimeline,
): HourlySwellTimeline {
  const partitionsByTimestamp: PartitionsByTimestamp = new Map();
  addTimelineToTimestampMap(partitionsByTimestamp, current, false);
  addTimelineToTimestampMap(partitionsByTimestamp, incoming, true);

  const timestamps = Array.from(partitionsByTimestamp.keys()).sort();
  const beachIds = new Set([
    ...Object.keys(current.partitionsByBeach),
    ...Object.keys(incoming.partitionsByBeach),
  ]);
  const partitionsByBeach = Object.fromEntries(
    Array.from(beachIds).map((beachId) => [
      beachId,
      timestamps.map((timestamp) => partitionsByTimestamp.get(timestamp)?.get(beachId) ?? null),
    ]),
  ) as Record<string, Array<SwellPartition | null>>;
  const hasMore = current.hasMore && incoming.hasMore;

  return {
    timestamps,
    partitionsByBeach,
    hasMore,
    nextStart: hasMore ? furthestCursor(current.nextStart, incoming.nextStart) : null,
  };
}
