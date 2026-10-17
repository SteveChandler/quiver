import type { SupabaseClient } from '@supabase/supabase-js';

import { EXCLUDE_SYNTHETIC_ROWS_FILTER } from '@/lib/alerts/swell-events/forecast-rows';
import type { BoardClass } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import { forecastRowIntervalEnd, isDaylightInterval, type BeachSunTimes } from '@/lib/services/discovery/daylight-eligibility';
import { getLocalDateStr } from '@/lib/services/discovery/window-selector/time-slot-utils';
import { scoreWindowConditionScore } from '@/lib/services/discovery/window-selector/window-scorer';
import { getDirectionDegrees, parseWaveHeightRange, parseWavePeriod } from '@/lib/utils/number-parsing';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import type { Beach, Database } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

import type { OutlookDay, OutlookDaySwell } from './swell-outlook-types';

const DAY_MS = 24 * 60 * 60 * 1000;
const READ_TIMEOUT_MS = 3000;
const SWELL_SLOTS = [
  ['swell_1_height', 'swell_1_period', 'swell_1_direction'],
  ['swell_2_height', 'swell_2_period', 'swell_2_direction'],
] as const;

/** The outlook beach's forecast rows from the start of today through the horizon. */
export async function loadOutlookDayRows(
  client: SupabaseClient<Database>,
  beachId: string,
  from: Date,
  to: Date,
): Promise<EnhancedForecastEntity[]> {
  const { data, error } = await client
    .from('enhanced_forecasts')
    .select('*')
    .eq('beach_id', beachId)
    .or(EXCLUDE_SYNTHETIC_ROWS_FILTER)
    .gte('forecast_at', from.toISOString())
    .lt('forecast_at', to.toISOString())
    .order('forecast_at', { ascending: true })
    // A slow read must not hold up the outlook; the bars fall back to the swell events.
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));
  if (error) throw new Error(`Failed to load outlook day rows: ${error.message}`);
  return (data ?? []) as unknown as EnhancedForecastEntity[];
}

function swellsOf(row: EnhancedForecastEntity): OutlookDaySwell[] {
  return SWELL_SLOTS.flatMap(([heightKey, periodKey, directionKey]) => {
    const height = parseWaveHeightRange(row[heightKey]);
    const label = row[directionKey]?.trim() || null;
    const directionDeg = getDirectionDegrees(null, label);
    if (!height || height.max <= 0 || !label || directionDeg == null) return [];
    const period = parseWavePeriod(row[periodKey], 0);
    return [{ heightFt: height.max, periodS: period > 0 ? period : null, directionDeg, directionLabel: label }];
  });
}

type ScoredRow = { row: EnhancedForecastEntity; end: Date; height: { min: number; max: number } };

/**
 * One entry per local day for the outlook beach: the surf range over the day's usable light, the best lit hour's
 * score (the Week Scout window scorer) and that hour's swell mix. Today's score only weighs hours not yet over,
 * like Week Scout. Undefined when no day has data, so the app falls back to the swell events.
 */
export function buildOutlookDays(input: {
  rows: readonly EnhancedForecastEntity[];
  beach: Beach;
  now: Date;
  horizonDays: number;
  /** Null when the surfer's preferences could not be read: days then carry no score. */
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[] | null;
  sunTimes?: BeachSunTimes;
}): OutlookDay[] | undefined {
  const timezone = resolveBeachTimezone(input.beach.timezone);
  const sorted = [...input.rows].sort((left, right) => Date.parse(left.forecast_at) - Date.parse(right.forecast_at));
  const byDate = new Map<string, ScoredRow[]>();
  sorted.forEach((row, index) => {
    const start = new Date(row.forecast_at);
    const next = sorted[index + 1] ? new Date(sorted[index + 1].forecast_at) : undefined;
    const end = forecastRowIntervalEnd(start, next);
    const height = parseWaveHeightRange(row.wave_height);
    if (!height || !isDaylightInterval(start, end, timezone, input.sunTimes)) return;
    const date = getLocalDateStr(start, timezone);
    byDate.set(date, [...(byDate.get(date) ?? []), { row, end, height }]);
  });

  const today = getLocalDateStr(input.now, timezone);
  const days = Array.from({ length: input.horizonDays }, (_, offset): OutlookDay => {
    // Calendar arithmetic on the local date, so a DST change can't skip or repeat a day.
    const date = new Date(Date.parse(`${today}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
    const rows = byDate.get(date) ?? [];
    if (rows.length === 0) return { date, surfFt: null, score: null, swells: [] };
    const live = offset === 0 ? rows.filter(({ end }) => end > input.now) : rows;
    let best: { row: EnhancedForecastEntity; score: number } | null = null;
    for (const { row } of live.length > 0 ? live : rows) {
      const score = scoreWindowConditionScore(row, input.beach, input.skillLevel, null, input.boardClasses ?? []);
      if (!best || score > best.score) best = { row, score };
    }
    return {
      date,
      surfFt: { min: Math.min(...rows.map(({ height }) => height.min)), max: Math.max(...rows.map(({ height }) => height.max)) },
      score: best && input.boardClasses !== null ? Math.round(best.score) : null,
      swells: best ? swellsOf(best.row) : [],
    };
  });
  return days.some((day) => day.surfFt) ? days : undefined;
}

export function outlookDayRowsWindow(now: Date): { from: Date; to: Date } {
  // Rows from a day back cover the start of the local day in any US zone.
  return { from: new Date(now.getTime() - DAY_MS), to: new Date(now.getTime() + 10 * DAY_MS) };
}
