/**
 * Server-side chart windows and axis labels for the trend chart. Labels are
 * formatted here so the client never formats dates during hydration.
 */

import type { WaveStationObservationRow } from "@/lib/services/wave-stations/types";
import { buildTrendSeries, type TrendPoint } from "./series";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type ChartRange = "24h" | "5d" | "30d";

export interface ChartRangeData {
  points: TrendPoint[];
  start: number;
  end: number;
  ticks: Array<{ t: number; label: string }>;
  arrowEveryHours: number;
}

function localHour(timeZone: string): (t: number) => number {
  const format = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" });
  return (t) => Number(format.formatToParts(new Date(t)).find((part) => part.type === "hour")?.value ?? NaN);
}

/** Whole hours in [start, end] where the local clock reads one of `hours`. */
function hourTicks(start: number, end: number, timeZone: string, hours: number[]): number[] {
  const hourOf = localHour(timeZone);
  const ticks: number[] = [];
  for (let t = Math.ceil(start / HOUR_MS) * HOUR_MS; t <= end; t += HOUR_MS) {
    if (hours.includes(hourOf(t))) ticks.push(t);
  }
  return ticks;
}

export function buildChartRanges(
  history: WaveStationObservationRow[],
  timeZone: string,
): Partial<Record<ChartRange, ChartRangeData>> {
  const hourly = buildTrendSeries(history, HOUR_MS);
  const newest = hourly[hourly.length - 1];
  if (!newest) return {};
  const end = newest.t;
  const oldest = hourly[0].t;
  const ranges: Partial<Record<ChartRange, ChartRangeData>> = {};

  const timeLabel = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric" });
  const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", day: "numeric" });
  const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" });

  const dayStart = end - DAY_MS;
  const day = hourly.filter((point) => point.t >= dayStart);
  if (day.length >= 2) {
    ranges["24h"] = {
      points: day,
      start: dayStart,
      end,
      ticks: hourTicks(dayStart, end, timeZone, [0, 6, 12, 18]).map((t) => ({ t, label: timeLabel.format(new Date(t)) })),
      arrowEveryHours: 2,
    };
  }

  const fiveStart = end - 5 * DAY_MS;
  const five = hourly.filter((point) => point.t >= fiveStart);
  if (five.length >= 2) {
    ranges["5d"] = {
      points: five,
      start: fiveStart,
      end,
      ticks: hourTicks(fiveStart, end, timeZone, [0]).map((t) => ({ t, label: dayLabel.format(new Date(t)) })),
      arrowEveryHours: 6,
    };
  }

  if (end - oldest > 5 * DAY_MS) {
    const monthStart = end - 30 * DAY_MS;
    const month = buildTrendSeries(history, 3 * HOUR_MS).filter((point) => point.t >= monthStart);
    const midnights = hourTicks(monthStart, end, timeZone, [0]);
    ranges["30d"] = {
      points: month,
      start: monthStart,
      end,
      // Every fifth midnight, counted back from the newest so labels stay put as days pass.
      ticks: midnights
        .filter((_, index) => (midnights.length - 1 - index) % 5 === 0)
        .map((t) => ({ t, label: dateLabel.format(new Date(t)) })),
      arrowEveryHours: 24,
    };
  }
  return ranges;
}
