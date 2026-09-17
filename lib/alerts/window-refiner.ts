import { isWithinArc, resolveWindDirection } from "@/lib/alerts/degree-utils";
import { parseSwellDirectionToDegrees } from "@/lib/alerts/forecast-parsers";
import { getDaylightWindow } from "@/lib/alerts/sunrise";
import { extractTideSchedule } from "@/lib/services/discovery/window-selector/tide-boundary-calculator";
import { TideExtremaDetector } from "@/lib/services/noaa-coops/tide-extrema-detector";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

export type DriverKind = "tide" | "wind" | "swell" | "daylight";

export interface WindowDriver {
  kind: DriverKind;
  edge: "start" | "end";
  at: string;
  approximate: boolean;
  label: string;
}

export interface CoarseWindow {
  start: string;
  end: string;
}

export interface RefineWindowArgs {
  coarse: CoarseWindow;
  forecasts: EnhancedForecastEntity[];
  beach: Beach;
  tideSamples: { at: string; heightFt: number }[] | null;
  daylight: { sunrise: string; sunset: string };
  verdictAt: (forecast: EnhancedForecastEntity) => "go" | "maybe" | "no";
}

export interface RefinedWindow {
  start: string;
  end: string;
  drivers: WindowDriver[];
  minutes: number;
}

interface BoundaryPair {
  before: EnhancedForecastEntity;
  after: EnhancedForecastEntity;
}

export function roundToFiveMinutes(iso: string): string {
  const intervalMs = 5 * 60 * 1000;
  return new Date(Math.round(new Date(iso).getTime() / intervalMs) * intervalMs).toISOString();
}

export function refineWindow(args: RefineWindowArgs): RefinedWindow | null {
  const coarseStart = new Date(args.coarse.start);
  const coarseEnd = new Date(args.coarse.end);
  const daylight = resolveDaylight(args, coarseStart);
  const startCandidates: WindowDriver[] = [];
  const endCandidates: WindowDriver[] = [];

  const startPair = findBoundaryPair(args, "start");
  if (startPair) startCandidates.push(...changedDrivers(args, startPair, "start"));
  const endPair = findBoundaryPair(args, "end");
  if (endPair) endCandidates.push(...changedDrivers(args, endPair, "end"));

  if (daylight.sunrise > coarseStart || startCandidates.length > 0) {
    startCandidates.push(driver("daylight", "start", daylight.sunrise, false, "sunrise"));
  }
  if (daylight.sunset < coarseEnd || endCandidates.length > 0) {
    endCandidates.push(driver("daylight", "end", daylight.sunset, false, "sunset"));
  }

  const startDriver = latest(startCandidates);
  const endDriver = earliest(endCandidates);
  const start = startDriver ? new Date(startDriver.at) : coarseStart;
  const end = endDriver ? new Date(endDriver.at) : coarseEnd;
  const minutes = (end.getTime() - start.getTime()) / 60_000;

  if (!Number.isFinite(minutes) || minutes < 60) return null;

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    drivers: [startDriver, endDriver].filter((value): value is WindowDriver => value != null),
    minutes,
  };
}

function resolveDaylight(args: RefineWindowArgs, date: Date): { sunrise: Date; sunset: Date } {
  const sunrise = new Date(args.daylight.sunrise);
  const sunset = new Date(args.daylight.sunset);
  if (!Number.isNaN(sunrise.getTime()) && !Number.isNaN(sunset.getTime())) {
    return { sunrise, sunset };
  }
  return getDaylightWindow(args.beach.lat, args.beach.lon, date);
}

function findBoundaryPair(
  args: RefineWindowArgs,
  edge: "start" | "end",
): BoundaryPair | null {
  const pairs = args.forecasts.slice(1).map((after, index) => ({
    before: args.forecasts[index],
    after,
  }));
  const transitions = pairs.filter(({ before, after }) => edge === "start"
    ? args.verdictAt(before) !== "go" && args.verdictAt(after) === "go"
    : args.verdictAt(before) === "go" && args.verdictAt(after) !== "go");
  const edgeTime = new Date(args.coarse[edge]).getTime();

  return transitions.find(({ before, after }) => {
    const beforeTime = new Date(before.forecast_at).getTime();
    const afterTime = new Date(after.forecast_at).getTime();
    return beforeTime < edgeTime && edgeTime <= afterTime;
  }) ?? null;
}

function changedDrivers(
  args: RefineWindowArgs,
  pair: BoundaryPair,
  edge: "start" | "end",
): WindowDriver[] {
  return [
    tideDriver(args, pair, edge),
    windDriver(args.beach, pair, edge),
    swellDriver(args.beach, pair, edge),
  ].filter((value): value is WindowDriver => value != null);
}

function tideDriver(
  args: RefineWindowArgs,
  pair: BoundaryPair,
  edge: "start" | "end",
): WindowDriver | null {
  const beforeHeight = numberValue(pair.before.tide_height);
  const afterHeight = numberValue(pair.after.tide_height);
  const threshold = crossedTideThreshold(args.beach, beforeHeight, afterHeight);
  const preferredStatus = normalizeTideStatus(args.beach.preferred_tide_direction);
  const statusChanged = preferredStatus != null
    && preferredStatus !== "either"
    && (normalizeTideStatus(pair.before.tide_status) === preferredStatus)
      !== (normalizeTideStatus(pair.after.tide_status) === preferredStatus);
  if (threshold == null && !statusChanged) return null;

  const exactSample = threshold == null
    ? null
    : findTideCrossingSample(args.tideSamples, pair, threshold);
  const at = exactSample
    ? new Date(exactSample.at)
    : threshold != null && beforeHeight != null && afterHeight != null
      ? interpolateTime(pair, beforeHeight, afterHeight, threshold)
      : new Date(pair.after.forecast_at);

  return driver(
    "tide",
    edge,
    at,
    exactSample == null,
    tideLabel(args, at, beforeHeight, afterHeight),
  );
}

function crossedTideThreshold(
  beach: Beach,
  before: number | null,
  after: number | null,
): number | null {
  if (before == null || after == null) return null;
  const min = beach.preferred_tide_ft_min;
  const max = beach.preferred_tide_ft_max;
  const beforeInRange = (min == null || before >= min) && (max == null || before <= max);
  const afterInRange = (min == null || after >= min) && (max == null || after <= max);
  if (beforeInRange === afterInRange) return null;
  if (min != null && crosses(min, before, after)) return min;
  if (max != null && crosses(max, before, after)) return max;
  return null;
}

function findTideCrossingSample(
  samples: RefineWindowArgs["tideSamples"],
  pair: BoundaryPair,
  threshold: number,
): { at: string; heightFt: number } | null {
  if (!samples) return null;
  const start = new Date(pair.before.forecast_at).getTime();
  const end = new Date(pair.after.forecast_at).getTime();
  const relevant = samples.filter((sample) => {
    const at = new Date(sample.at).getTime();
    return at >= start && at <= end;
  });
  const rising = (numberValue(pair.after.tide_height) ?? 0)
    >= (numberValue(pair.before.tide_height) ?? 0);
  const crossed = relevant.find((sample) => rising
    ? sample.heightFt >= threshold
    : sample.heightFt <= threshold);
  return crossed ?? null;
}

function tideLabel(
  args: RefineWindowArgs,
  at: Date,
  beforeHeight: number | null,
  afterHeight: number | null,
): string {
  const sampleExtrema = args.tideSamples
    ? new TideExtremaDetector().detectExtrema(args.tideSamples.map((sample) => ({
        ts: sample.at,
        tide_height_m: sample.heightFt / METERS_TO_FEET,
      })))
    : [];
  const schedule = extractTideSchedule(args.forecasts)?.map((entry) => ({
    time: entry.time,
    height: entry.height,
    type: entry.type,
  })) ?? [];
  const next = [...sampleExtrema, ...schedule]
    .filter((entry) => entry.time * 1000 >= at.getTime())
    .sort((a, b) => a.time - b.time)[0];
  const direction = (afterHeight ?? 0) >= (beforeHeight ?? 0) ? "rising" : "falling";
  return next
    ? `${direction} to a ${next.height}ft ${next.type}`
    : `${direction} tide crosses the beach range`;
}

function windDriver(
  beach: Beach,
  pair: BoundaryPair,
  edge: "start" | "end",
): WindowDriver | null {
  const beforeSpeed = numberValue(pair.before.wind_speed);
  const afterSpeed = numberValue(pair.after.wind_speed);
  const beforeClass = windClass(beach, pair.before);
  const afterClass = windClass(beach, pair.after);
  const onshoreLimit = beach.max_wind_onshore_mph
    ?? (beach.wind_onshore_bad_kt == null ? null : beach.wind_onshore_bad_kt * 1.15078);
  const limit = beforeClass === "onshore" || afterClass === "onshore"
    ? onshoreLimit ?? beach.max_wind_any_mph
    : beach.max_wind_any_mph;

  if (
    limit != null
    && beforeSpeed != null
    && afterSpeed != null
    && crosses(limit, beforeSpeed, afterSpeed)
  ) {
    const at = interpolateTime(pair, beforeSpeed, afterSpeed, limit);
    return driver("wind", edge, roundDate(at), true, `wind reaches ${limit}mph`);
  }

  if (beforeClass === afterClass || (beforeClass !== "onshore" && afterClass !== "onshore")) {
    return null;
  }
  const crossing = directionCrossingRatio(
    pair.before.wind_direction_deg ?? null,
    pair.after.wind_direction_deg ?? null,
    beach.aspect_deg,
    beach.wind_offshore_tol_deg ?? 45,
  );
  const at = interpolateTime(pair, 0, 1, crossing ?? 0.5);
  return driver("wind", edge, roundDate(at), true, "offshore till the wind turns");
}

function windClass(
  beach: Beach,
  forecast: EnhancedForecastEntity,
): ReturnType<typeof resolveWindDirection> {
  return forecast.wind_direction_deg == null
    ? null
    : resolveWindDirection(
        forecast.wind_direction_deg,
        beach.wind_offshore_deg,
        beach.wind_offshore_tol_deg,
        beach.aspect_deg,
      );
}

function swellDriver(
  beach: Beach,
  pair: BoundaryPair,
  edge: "start" | "end",
): WindowDriver | null {
  const before = parseSwellDirectionToDegrees(pair.before.swell_1_direction)
    ?? parseSwellDirectionToDegrees(pair.before.wave_direction);
  const after = parseSwellDirectionToDegrees(pair.after.swell_1_direction)
    ?? parseSwellDirectionToDegrees(pair.after.wave_direction);
  if (before == null || after == null) return null;
  const window = swellWindow(beach);
  if (!window || isWithinArc(before, window.min, window.max) === isWithinArc(after, window.min, window.max)) {
    return null;
  }
  const ratio = directionCrossingRatio(before, after, window.center, window.halfwidth) ?? 0.5;
  const at = interpolateTime(pair, 0, 1, ratio);
  return driver("swell", edge, roundDate(at), true, "swell direction leaves the beach window");
}

function swellWindow(beach: Beach): {
  min: number;
  max: number;
  center: number;
  halfwidth: number;
} | null {
  if (beach.swell_window_center_deg != null && beach.swell_window_halfwidth_deg != null) {
    return {
      min: beach.swell_window_center_deg - beach.swell_window_halfwidth_deg,
      max: beach.swell_window_center_deg + beach.swell_window_halfwidth_deg,
      center: beach.swell_window_center_deg,
      halfwidth: beach.swell_window_halfwidth_deg,
    };
  }
  if (beach.swell_window_min_deg == null || beach.swell_window_max_deg == null) return null;
  const span = (beach.swell_window_max_deg - beach.swell_window_min_deg + 360) % 360;
  return {
    min: beach.swell_window_min_deg,
    max: beach.swell_window_max_deg,
    center: (beach.swell_window_min_deg + span / 2) % 360,
    halfwidth: span / 2,
  };
}

function directionCrossingRatio(
  before: number | null,
  after: number | null,
  center: number | null,
  halfwidth: number,
): number | null {
  if (before == null || after == null || center == null) return null;
  const delta = ((after - before + 540) % 360) - 180;
  if (delta === 0) return null;
  const boundaries = [center - halfwidth, center + halfwidth];
  const ratios = boundaries.flatMap((boundary) => [-360, 0, 360].map((turn) =>
    (boundary + turn - before) / delta)).filter((ratio) => ratio >= 0 && ratio <= 1);
  return ratios.sort((a, b) => a - b)[0] ?? null;
}

function interpolateTime(
  pair: BoundaryPair,
  before: number,
  after: number,
  target: number,
): Date {
  const start = new Date(pair.before.forecast_at).getTime();
  const end = new Date(pair.after.forecast_at).getTime();
  const ratio = before === after ? 1 : (target - before) / (after - before);
  return new Date(start + Math.max(0, Math.min(1, ratio)) * (end - start));
}

function driver(
  kind: DriverKind,
  edge: "start" | "end",
  at: Date,
  approximate: boolean,
  label: string,
): WindowDriver {
  return { kind, edge, at: at.toISOString(), approximate, label };
}

function earliest(drivers: WindowDriver[]): WindowDriver | null {
  return drivers.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())[0] ?? null;
}

function latest(drivers: WindowDriver[]): WindowDriver | null {
  return drivers.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0] ?? null;
}

function numberValue(value: string | null | undefined): number | null {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTideStatus(value: string | null | undefined): string | null {
  return value?.trim().toLowerCase() || null;
}

function between(value: number, a: number, b: number): boolean {
  return value >= Math.min(a, b) && value <= Math.max(a, b);
}

function crosses(value: number, a: number, b: number): boolean {
  return a !== b && between(value, a, b);
}

function roundDate(date: Date): Date {
  return new Date(roundToFiveMinutes(date.toISOString()));
}
