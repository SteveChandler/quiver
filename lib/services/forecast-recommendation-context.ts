import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { PersonalizedForecastWindow } from "@/types/personalization";
import { getLocalDateString, resolveBeachTimezone } from "@/lib/utils/timezone-utils";

export type ForecastRecommendationType =
  | "best_window"
  | "now"
  | "next_rideable"
  | "marginal";

export interface ForecastRecommendationContext {
  beachId: string;
  localDate: string;
  recommendationType: ForecastRecommendationType;
  startTime: string | null;
  endTime: string | null;
  displayTimeLabel: string;
  selectedRowTime: string | null;
  waveHeight: string | null;
  swellPeriod: string | null;
  swellDirection: string | null;
  windSpeed: string | null;
  windDirection: string | null;
  score: number | null;
  confidence: number | null;
  resolverUsed: "surf-call";
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

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/-?\d+(?:\.\d+)?/g);
  if (!match) return null;
  const values = match.map(Number).filter(Number.isFinite);
  if (values.length === 0) return null;
  return Math.max(...values);
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

function pickSwellPeriod(row: EnhancedForecastEntity | null, window?: PersonalizedForecastWindow | null): string | null {
  return normalizePeriod(row?.swell_1_period ?? row?.wave_period ?? window?.wavePeriod ?? null);
}

function pickSwellDirection(row: EnhancedForecastEntity | null): string | null {
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

function contextFromRow(args: {
  beach: Beach;
  row: EnhancedForecastEntity;
  timezone: string;
  type: ForecastRecommendationType;
  score: number | null;
}): ForecastRecommendationContext {
  const rowTime = new Date(args.row.forecast_at);
  const startTime = toIso(rowTime);
  return {
    beachId: String(args.beach.id),
    localDate: getLocalDateString(rowTime, args.timezone),
    recommendationType: args.type,
    startTime,
    endTime: null,
    displayTimeLabel: args.type === "now" ? "Now" : `Later: ${formatClock(rowTime, args.timezone)}`,
    selectedRowTime: startTime,
    waveHeight: args.row.wave_height ?? null,
    swellPeriod: pickSwellPeriod(args.row),
    swellDirection: pickSwellDirection(args.row),
    windSpeed: args.row.wind_speed ?? null,
    windDirection: args.row.wind_direction ?? null,
    score: args.score,
    confidence: args.row.confidence_score ?? null,
    resolverUsed: "surf-call",
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
    const selectedRowTime = sourceForecast?.forecast_at
      ? toIso(sourceForecast.forecast_at)
      : toIso(window.peakTime ?? window.start);
    return {
      beachId: String(beach.id),
      localDate: getLocalDateString(start, resolvedTimezone),
      recommendationType: "best_window",
      startTime: toIso(start),
      endTime: toIso(end),
      displayTimeLabel: `Best window: ${formatRange(start, end, resolvedTimezone)}`,
      selectedRowTime,
      waveHeight: window.waveHeight !== "Unknown" ? window.waveHeight : sourceForecast?.wave_height ?? null,
      swellPeriod: pickSwellPeriod(sourceForecast, window),
      swellDirection: pickSwellDirection(sourceForecast),
      windSpeed: sourceForecast?.wind_speed ?? null,
      windDirection: sourceForecast?.wind_direction ?? null,
      score: window.score ?? null,
      confidence: window.confidence ?? sourceForecast?.confidence_score ?? null,
      resolverUsed: "surf-call",
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
