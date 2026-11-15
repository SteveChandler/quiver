import { synthesizeFromExtrema, type InternalPoint } from "@/components/forecast/tide-chart/tide-chart-helpers";
import { formatStationDay, formatStationTime } from "@/lib/tide-stations/format";
import { localDateKey } from "@/lib/tide-stations/series";
import { interpolateTideHeight } from "@/lib/utils/tide-interpolation";
import type { TideScheduleEntry } from "@/types/forecast";
import { isTideHeightInRange, type TideHeightContext, type TideRangeFt } from "./tide-direction";

const MINUTE_MS = 60_000;
const STEP_MS = 10 * MINUTE_MS;
const HORIZON_MS = 24 * 60 * MINUTE_MS;
/** useDynamicTide calls the tide slack this close to an extreme. */
const SLACK_MS = 30 * MINUTE_MS;

type Direction = "rising" | "falling" | "slack";

interface TideCurve {
  points: Array<{ time: number; height: number }>;
  extremes: Array<{ ms: number; type: "high" | "low" }>;
  startMs: number;
  endMs: number;
}

/** The curve the tide chart draws from the same highs and lows, so "Now · X ft" and the alert agree. */
function buildCurve(schedule: TideScheduleEntry[] | null | undefined): TideCurve | null {
  if (!schedule || schedule.length < 2) return null;
  const extrema: InternalPoint[] = schedule
    .filter((e) => Number.isFinite(e.time) && Number.isFinite(e.height))
    .map((e) => ({
      t: e.time * 1000,
      timestamp: e.time * 1000,
      h: e.height,
      isHigh: e.type === "high",
      isLow: e.type === "low",
    }));
  if (extrema.length < 2) return null;
  const points = synthesizeFromExtrema(extrema).map((p) => ({ time: p.timestamp, height: p.h }));
  const extremes = extrema.map((e) => ({ ms: e.timestamp, type: e.isHigh ? ("high" as const) : ("low" as const) })).sort((a, b) => a.ms - b.ms);
  return { points, extremes, startMs: extremes[0].ms, endMs: extremes[extremes.length - 1].ms };
}

function heightOnCurve(curve: TideCurve, atMs: number): number | null {
  if (atMs < curve.startMs || atMs > curve.endMs) return null;
  return interpolateTideHeight(curve.points, atMs);
}

/** Same rule as useDynamicTide: the next extreme sets the direction, and the last 30 minutes before it are slack. */
function directionOnCurve(curve: TideCurve, atMs: number): Direction | null {
  const next = curve.extremes.find((e) => e.ms > atMs);
  if (!next) return null;
  if (next.ms - atMs <= SLACK_MS) return "slack";
  return next.type === "high" ? "rising" : "falling";
}

/** Tide height in feet at a time, on the chart's curve. Null outside the schedule. */
export function tideHeightAt(schedule: TideScheduleEntry[] | null | undefined, atMs: number): number | null {
  const curve = buildCurve(schedule);
  return curve ? heightOnCurve(curve, atMs) : null;
}

/**
 * The first time on a 10-minute grid, within 24 h after `fromMs`, when the height is in range
 * and the direction matches. "either" (or no direction) checks the height only.
 */
export function nextGoodTideMs(
  schedule: TideScheduleEntry[] | null | undefined,
  range: TideRangeFt,
  preferredDirection: string | null | undefined,
  fromMs: number
): number | null {
  const curve = buildCurve(schedule);
  if (!curve) return null;
  const wantDirection = preferredDirection && preferredDirection !== "either" ? preferredDirection : null;
  const endMs = Math.min(fromMs + HORIZON_MS, curve.endMs);
  for (let t = Math.floor(fromMs / STEP_MS) * STEP_MS + STEP_MS; t <= endMs; t += STEP_MS) {
    const height = heightOnCurve(curve, t);
    if (height === null || !isTideHeightInRange(height, range)) continue;
    if (wantDirection && directionOnCurve(curve, t) !== wantDirection) continue;
    return t;
  }
  return null;
}

interface TideAlertHeightInput {
  schedule: TideScheduleEntry[] | null | undefined;
  minFt: number | null | undefined;
  maxFt: number | null | undefined;
  preferredDirection: string | null | undefined;
  nowMs: number | null | undefined;
  timeZone: string;
}

/** The height half of the tide alert: the spot's range, the height now, and when it next turns good. */
export function tideAlertHeightContext(input: TideAlertHeightInput): TideHeightContext {
  const { minFt, maxFt, nowMs, timeZone } = input;
  const range = minFt != null && maxFt != null && Number.isFinite(minFt) && Number.isFinite(maxFt) && minFt <= maxFt
    ? { minFt, maxFt }
    : null;
  if (!range || nowMs == null) return { range, heightFt: null, nextGoodLabel: null };

  const heightFt = tideHeightAt(input.schedule, nowMs);
  const goodMs = nextGoodTideMs(input.schedule, range, input.preferredDirection, nowMs);
  if (goodMs === null) return { range, heightFt, nextGoodLabel: null };

  const time = formatStationTime(goodMs, timeZone);
  const sameDay = localDateKey(goodMs, timeZone) === localDateKey(nowMs, timeZone);
  const day = sameDay ? "" : `${formatStationDay(goodMs, timeZone).split(",")[0]} `;
  return { range, heightFt, nextGoodLabel: `${day}${time}` };
}
