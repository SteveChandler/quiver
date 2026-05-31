import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { PersonalizedForecastWindow } from "@/types/personalization";
import { getLocalDateString, resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import { localDateTimeToUTC } from "@/lib/utils/forecast-time-resolver";
import { cardinalToDegrees } from "@/lib/services/forecast/forecast-transformer";
import { degreeToCardinal } from "@/lib/utils/geo-utils";

export type ForecastRecommendationType =
  | "best_window"
  | "now"
  | "next_rideable"
  | "marginal";

export type ForecastDisplayContextType =
  | ForecastRecommendationType
  | "forecast_bucket";

export type ForecastDisplayContextSource =
  | "hourly_forecast"
  | "daily_bucket"
  | "current_conditions"
  | "looking_ahead";

export interface ForecastRecommendationContext {
  beachId: string;
  localDate: string;
  recommendationType: ForecastRecommendationType;
  contextType: ForecastDisplayContextType;
  startTime: string | null;
  endTime: string | null;
  selectedWindowStart: string | null;
  selectedWindowEnd: string | null;
  displayWindowStart?: string | null;
  displayWindowEnd?: string | null;
  displayTimeLabel: string;
  selectedRowTime: string | null;
  waveHeight: string | null;
  waveHeightFt: number | null;
  waveHeightRangeLabel: string | null;
  swellPeriod: string | null;
  periodSec: number | null;
  swellDirection: string | null;
  windSpeed: string | null;
  windDirection: string | null;
  score: number | null;
  confidence: number | null;
  resolverUsed: "surf-call";
  source: ForecastDisplayContextSource;
  timezone?: string | null;
  conditionDrivers?: ForecastConditionDrivers | null;
}

export interface ForecastConditionDrivers {
  wave: string | null;
  energy: string | null;
  wind: string | null;
  tide: string | null;
}

export type ForecastContextSource =
  | "notification"
  | "home"
  | "beach-detail"
  | "match-card"
  | "surf-call";

interface BuildForecastRecommendationContextArgs {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  window: PersonalizedForecastWindow | null;
  now?: Date;
  timezone?: string | null;
}

const DEFAULT_RIDEABLE = {
  minWaveFt: 1,
  maxWaveFt: 8,
  maxWindMph: 18,
};

function parseNumbers(value: unknown): number[] {
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (typeof value !== "string") return [];
  const normalized = value.replace(/(\d)\s*-\s*(\d)/g, "$1 $2");
  const match = normalized.match(/-?\d+(?:\.\d+)?/g);
  if (!match) return [];
  const values = match.map(Number).filter(Number.isFinite);
  return values;
}

function parseNumber(value: unknown): number | null {
  const values = parseNumbers(value);
  if (values.length === 0) return null;
  return Math.max(...values);
}

function parseAverageNumber(value: unknown): number | null {
  const values = parseNumbers(value);
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function formatForecastDisplayWaveHeightRange(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const low = Math.floor(value);
  const high = Math.ceil(value);
  if (low === high) {
    return low === 0 ? "0-1 ft" : `${low - 1}-${low} ft`;
  }
  return `${low}-${high} ft`;
}

function isRideable(row: EnhancedForecastEntity | null): boolean {
  if (!row) return false;
  const waveFt = parseNumber(row.wave_height);
  const windMph = parseNumber(row.wind_speed);
  if (waveFt == null || windMph == null) return false;
  return (
    waveFt >= DEFAULT_RIDEABLE.minWaveFt &&
    waveFt <= DEFAULT_RIDEABLE.maxWaveFt &&
    windMph <= DEFAULT_RIDEABLE.maxWindMph
  );
}

function normalizePeriod(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().endsWith("s") ? trimmed : `${trimmed}s`;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function formatPeriodSeconds(value: number | null): string | null {
  if (value == null || value <= 0) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}s`;
}

function directionInBeachWindow(directionDeg: number | null, beach: Beach): boolean | null {
  const center = toFiniteNumber(
    (beach as { swell_window_center_deg?: number | null }).swell_window_center_deg,
  );
  const halfwidth = toFiniteNumber(
    (beach as { swell_window_halfwidth_deg?: number | null }).swell_window_halfwidth_deg,
  );
  if (directionDeg == null || center == null || halfwidth == null || halfwidth <= 0) return null;
  const delta = ((directionDeg - center) % 360 + 540) % 360 - 180;
  return Math.abs(delta) <= halfwidth;
}

function shouldUseOmSwellContext(row: EnhancedForecastEntity | null, beach?: Beach): boolean {
  if (!row || !beach) return false;
  const omDirectionDeg = toFiniteNumber(row.swell_direction_om);
  const omPeriod = toFiniteNumber(row.swell_period_om);
  if (omDirectionDeg == null || omPeriod == null) return false;

  const namedDirectionDeg = cardinalToDegrees(row.swell_1_direction ?? row.wave_direction ?? null);
  const omInWindow = directionInBeachWindow(omDirectionDeg, beach);
  const namedInWindow = directionInBeachWindow(namedDirectionDeg, beach);
  return omInWindow === true && namedInWindow !== true;
}

function pickSwellPeriod(
  row: EnhancedForecastEntity | null,
  window?: PersonalizedForecastWindow | null,
  beach?: Beach,
): string | null {
  if (shouldUseOmSwellContext(row, beach)) {
    return formatPeriodSeconds(toFiniteNumber(row?.swell_period_om));
  }
  return normalizePeriod(row?.swell_1_period ?? row?.wave_period ?? window?.wavePeriod ?? null);
}

function pickSwellDirection(row: EnhancedForecastEntity | null, beach?: Beach): string | null {
  if (shouldUseOmSwellContext(row, beach)) {
    const omDirectionDeg = toFiniteNumber(row?.swell_direction_om);
    return omDirectionDeg == null ? null : degreeToCardinal(omDirectionDeg);
  }
  return row?.swell_1_direction ?? row?.wave_direction ?? null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatClock(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatRange(start: Date, end: Date, timezone: string): string {
  const startLabel = formatClock(start, timezone);
  const endLabel = formatClock(end, timezone);
  const startSuffix = startLabel.match(/\b(AM|PM)$/i)?.[1];
  const endSuffix = endLabel.match(/\b(AM|PM)$/i)?.[1];
  if (startSuffix && endSuffix && startSuffix.toUpperCase() === endSuffix.toUpperCase()) {
    return `${startLabel.replace(/\s?(AM|PM)$/i, "")}-${endLabel}`;
  }
  return `${startLabel}-${endLabel}`;
}

const TIGHT_DISPLAY_WINDOW_MINUTES = 150;
const DISPLAY_WINDOW_HALF_MINUTES = TIGHT_DISPLAY_WINDOW_MINUTES / 2;

function containsTime(start: Date, end: Date, time: Date): boolean {
  return start.getTime() <= time.getTime() && time.getTime() <= end.getTime();
}

function displayWindowAroundPeak(peak: Date, timezone: string): { start: Date; end: Date } {
  let start = new Date(peak.getTime() - DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000);
  let end = new Date(peak.getTime() + DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000);

  const localDate = getLocalDateString(peak, timezone);
  const daylightStart = localDateTimeToUTC(localDate, "06:00:00", timezone);
  const daylightEnd = localDateTimeToUTC(localDate, "19:00:00", timezone);

  if (containsTime(daylightStart, daylightEnd, peak)) {
    if (start < daylightStart) {
      start = daylightStart;
      end = new Date(start.getTime() + TIGHT_DISPLAY_WINDOW_MINUTES * 60 * 1000);
    }
    if (end > daylightEnd) {
      end = daylightEnd;
      start = new Date(end.getTime() - TIGHT_DISPLAY_WINDOW_MINUTES * 60 * 1000);
    }
  }

  if (!containsTime(start, end, peak)) {
    return {
      start: new Date(peak.getTime() - DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000),
      end: new Date(peak.getTime() + DISPLAY_WINDOW_HALF_MINUTES * 60 * 1000),
    };
  }

  return { start, end };
}

function deriveDisplayWindow({
  rawStart,
  rawEnd,
  peak,
  timezone,
}: {
  rawStart: Date;
  rawEnd: Date;
  peak: Date;
  timezone: string;
}): { start: Date; end: Date } {
  const rawDurationMinutes = (rawEnd.getTime() - rawStart.getTime()) / (60 * 1000);
  const rawContainsPeak = rawDurationMinutes > 0 && containsTime(rawStart, rawEnd, peak);

  if (rawContainsPeak && rawDurationMinutes <= TIGHT_DISPLAY_WINDOW_MINUTES) {
    return { start: rawStart, end: rawEnd };
  }

  let display = displayWindowAroundPeak(peak, timezone);

  if (rawContainsPeak) {
    if (display.start < rawStart) {
      const shiftMs = rawStart.getTime() - display.start.getTime();
      display = {
        start: rawStart,
        end: new Date(display.end.getTime() + shiftMs),
      };
    }

    if (display.end > rawEnd) {
      const shiftMs = display.end.getTime() - rawEnd.getTime();
      display = {
        start: new Date(display.start.getTime() - shiftMs),
        end: rawEnd,
      };
    }
  }

  if (!containsTime(display.start, display.end, peak)) {
    return displayWindowAroundPeak(peak, timezone);
  }

  return display;
}

function describeWind(windSpeed: string | null | undefined): string | null {
  const mph = parseNumber(windSpeed);
  if (mph == null) return null;
  if (mph <= 6) return "clean";
  if (mph <= 12) return "manageable";
  if (mph <= 18) return "textured";
  return "blown out";
}

function buildConditionDrivers({
  wave,
  waveRange,
  swellPeriod,
  swellDirection,
  sourceForecast,
}: {
  wave: string | null;
  waveRange: string | null;
  swellPeriod: string | null;
  swellDirection: string | null;
  sourceForecast: EnhancedForecastEntity | null;
}): ForecastConditionDrivers {
  const wind = [sourceForecast?.wind_speed, sourceForecast?.wind_direction, describeWind(sourceForecast?.wind_speed)]
    .filter(Boolean)
    .join(" ") || null;
  const tide = [sourceForecast?.tide_height, sourceForecast?.tide_status?.toLowerCase()]
    .filter(Boolean)
    .join(" ") || null;
  const energy = [swellPeriod, swellDirection, "energy"]
    .filter(Boolean)
    .join(" ") || null;

  return {
    wave: waveRange ?? wave,
    energy,
    wind,
    tide,
  };
}

function pickCurrentRow(
  forecasts: EnhancedForecastEntity[],
  nowMs: number,
): EnhancedForecastEntity | null {
  const sorted = [...forecasts].sort(
    (a, b) => Date.parse(a.forecast_at) - Date.parse(b.forecast_at),
  );
  let current: EnhancedForecastEntity | null = null;
  for (const row of sorted) {
    const rowMs = Date.parse(row.forecast_at);
    if (Number.isNaN(rowMs)) continue;
    if (rowMs <= nowMs) current = row;
    else break;
  }
  return current;
}

function pickNextRideableRow(
  forecasts: EnhancedForecastEntity[],
  nowMs: number,
  timezone: string,
): EnhancedForecastEntity | null {
  const today = getLocalDateString(new Date(nowMs), timezone);
  return [...forecasts]
    .sort((a, b) => Date.parse(a.forecast_at) - Date.parse(b.forecast_at))
    .find((row) => {
      const rowMs = Date.parse(row.forecast_at);
      if (Number.isNaN(rowMs) || rowMs <= nowMs) return false;
      if (getLocalDateString(new Date(rowMs), timezone) !== today) return false;
      return isRideable(row);
    }) ?? null;
}

function nearestForecastToTime(
  forecasts: EnhancedForecastEntity[],
  target: Date,
): EnhancedForecastEntity | null {
  if (Number.isNaN(target.getTime())) return null;
  return forecasts.reduce<EnhancedForecastEntity | null>((nearest, forecast) => {
    const forecastMs = Date.parse(forecast.forecast_at);
    if (Number.isNaN(forecastMs)) return nearest;
    if (!nearest) return forecast;
    const nearestMs = Date.parse(nearest.forecast_at);
    return Math.abs(forecastMs - target.getTime()) < Math.abs(nearestMs - target.getTime())
      ? forecast
      : nearest;
  }, null);
}

function contextFromRow(args: {
  beach: Beach;
  row: EnhancedForecastEntity;
  timezone: string;
  type: ForecastRecommendationType;
  score: number | null;
  source: ForecastDisplayContextSource;
}): ForecastRecommendationContext {
  const rowTime = new Date(args.row.forecast_at);
  const startTime = toIso(rowTime);
  const waveHeightFt = parseAverageNumber(args.row.wave_height);
  const periodSec = parseAverageNumber(pickSwellPeriod(args.row, null, args.beach));
  return {
    beachId: String(args.beach.id),
    localDate: getLocalDateString(rowTime, args.timezone),
    recommendationType: args.type,
    contextType: args.type,
    startTime,
    endTime: null,
    selectedWindowStart: null,
    selectedWindowEnd: null,
    displayTimeLabel: args.type === "now" ? "Now" : `Later: ${formatClock(rowTime, args.timezone)}`,
    selectedRowTime: startTime,
    waveHeight: args.row.wave_height ?? null,
    waveHeightFt,
    waveHeightRangeLabel: formatForecastDisplayWaveHeightRange(waveHeightFt),
    swellPeriod: pickSwellPeriod(args.row, null, args.beach),
    periodSec,
    swellDirection: pickSwellDirection(args.row, args.beach),
    windSpeed: args.row.wind_speed ?? null,
    windDirection: args.row.wind_direction ?? null,
    score: args.score,
    confidence: args.row.confidence_score ?? null,
    resolverUsed: "surf-call",
    source: args.source,
    timezone: args.timezone,
  };
}

export function buildForecastRecommendationContext({
  beach,
  forecasts,
  window,
  now = new Date(),
  timezone,
}: BuildForecastRecommendationContextArgs): ForecastRecommendationContext | null {
  const resolvedTimezone = resolveBeachTimezone(timezone ?? window?.timezone ?? (beach as { timezone?: string | null }).timezone);
  const nowMs = now.getTime();

  if (window) {
    const sourceForecast = window.sourceForecast ?? null;
    const start = new Date(window.start);
    const end = new Date(window.end);
    const peak = new Date(window.peakTime ?? window.start);
    const selectedForecast = nearestForecastToTime(forecasts, peak) ?? sourceForecast;
    const displayWindow =
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      !Number.isNaN(peak.getTime())
        ? deriveDisplayWindow({
          rawStart: start,
          rawEnd: end,
          peak,
          timezone: resolvedTimezone,
        })
        : { start, end };
    const startTime = toIso(start);
    const endTime = toIso(end);
    const displayWindowStart = toIso(displayWindow.start);
    const displayWindowEnd = toIso(displayWindow.end);
    const selectedRowTime = selectedForecast?.forecast_at
      ? toIso(selectedForecast.forecast_at)
      : toIso(window.peakTime ?? window.start);
    const waveHeight = selectedForecast?.wave_height
      ?? (window.waveHeight !== "Unknown" ? window.waveHeight : sourceForecast?.wave_height ?? null);
    const waveHeightFt = parseAverageNumber(waveHeight);
    const swellPeriod = pickSwellPeriod(selectedForecast, window, beach);
    const periodSec = parseAverageNumber(swellPeriod);
    const waveHeightRangeLabel = formatForecastDisplayWaveHeightRange(waveHeightFt);
    const swellDirection = pickSwellDirection(selectedForecast, beach);
    return {
      beachId: String(beach.id),
      localDate: getLocalDateString(start, resolvedTimezone),
      recommendationType: "best_window",
      contextType: "best_window",
      startTime,
      endTime,
      selectedWindowStart: startTime,
      selectedWindowEnd: endTime,
      displayWindowStart,
      displayWindowEnd,
      displayTimeLabel: displayWindowStart && displayWindowEnd
        ? `Best window: ${formatRange(displayWindow.start, displayWindow.end, resolvedTimezone)}`
        : `Best window: ${formatRange(start, end, resolvedTimezone)}`,
      selectedRowTime,
      waveHeight,
      waveHeightFt,
      waveHeightRangeLabel,
      swellPeriod,
      periodSec,
      swellDirection,
      windSpeed: selectedForecast?.wind_speed ?? sourceForecast?.wind_speed ?? null,
      windDirection: selectedForecast?.wind_direction ?? sourceForecast?.wind_direction ?? null,
      score: window.score ?? null,
      confidence: window.confidence ?? selectedForecast?.confidence_score ?? sourceForecast?.confidence_score ?? null,
      resolverUsed: "surf-call",
      source: "looking_ahead",
      timezone: resolvedTimezone,
      conditionDrivers: buildConditionDrivers({
        wave: waveHeight,
        waveRange: waveHeightRangeLabel,
        swellPeriod,
        swellDirection,
        sourceForecast: selectedForecast ?? sourceForecast,
      }),
    };
  }

  const current = pickCurrentRow(forecasts, nowMs);
  if (isRideable(current)) {
    return contextFromRow({
      beach,
      row: current!,
      timezone: resolvedTimezone,
      type: "now",
      score: null,
      source: "current_conditions",
    });
  }

  const later = pickNextRideableRow(forecasts, nowMs, resolvedTimezone);
  if (later) {
    return contextFromRow({
      beach,
      row: later,
      timezone: resolvedTimezone,
      type: "next_rideable",
      score: null,
      source: "hourly_forecast",
    });
  }

  if (current) {
    return {
      ...contextFromRow({
        beach,
        row: current,
        timezone: resolvedTimezone,
        type: "marginal",
        score: null,
        source: "current_conditions",
      }),
      displayTimeLabel: "Now: marginal",
    };
  }

  return null;
}

export function logForecastRecommendationContext(args: {
  source: ForecastContextSource;
  beachId?: string | null;
  beachName?: string | null;
  context: ForecastRecommendationContext | null | undefined;
  enabled?: boolean;
}): void {
  const isOceanBeachPier = args.beachName?.toLowerCase() === "ocean beach pier";
  if (!args.enabled && !isOceanBeachPier) return;
  if (!args.context) return;

  console.log("[forecast-context]", {
    beachId: args.beachId ?? args.context.beachId,
    beachName: args.beachName ?? null,
    localDate: args.context.localDate,
    source: args.source,
    selectedRowTime: args.context.selectedRowTime,
    selectedWindowStart: args.context.startTime,
    selectedWindowEnd: args.context.endTime,
    waveHeight: args.context.waveHeight,
    period: args.context.swellPeriod,
    windSpeed: args.context.windSpeed,
    windDirection: args.context.windDirection,
    score: args.context.score,
    resolverUsed: args.context.resolverUsed,
  });
}

export function logForecastDisplayContext(args: {
  component: ForecastContextSource;
  beachId?: string | null;
  beachName?: string | null;
  context: ForecastRecommendationContext | null | undefined;
  enabled?: boolean;
}): void {
  const isOceanBeachPier = args.beachName?.toLowerCase() === "ocean beach pier";
  if (!args.enabled && !isOceanBeachPier) return;
  if (!args.context) return;

  console.log("[forecast-display-context]", {
    beachId: args.beachId ?? args.context.beachId,
    beachName: args.beachName ?? null,
    localDate: args.context.localDate,
    component: args.component,
    contextType: args.context.contextType,
    selectedTime: args.context.selectedRowTime,
    selectedWindowStart: args.context.selectedWindowStart,
    selectedWindowEnd: args.context.selectedWindowEnd,
    waveHeightFt: args.context.waveHeightFt,
    waveHeightRangeLabel: args.context.waveHeightRangeLabel,
    periodSec: args.context.periodSec,
    swellDirection: args.context.swellDirection,
    windSpeedMph: parseAverageNumber(args.context.windSpeed),
    windDirection: args.context.windDirection,
    source: args.context.source,
  });
}
