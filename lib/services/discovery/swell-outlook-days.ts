import type { SupabaseClient } from '@supabase/supabase-js';

import { EXCLUDE_SYNTHETIC_ROWS_FILTER } from '@/lib/alerts/swell-events/forecast-rows';
import type { BoardClass } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import { DAYLIGHT_END_HOUR, DAYLIGHT_START_HOUR } from '@/lib/services/magic-hour/constants';
import { getLocalDateStr, getLocalHour } from '@/lib/services/discovery/window-selector/time-slot-utils';
import { scoreWindowConditionScore } from '@/lib/services/discovery/window-selector/window-scorer';
import { getDirectionDegrees, parseWaveHeightRange, parseWavePeriod } from '@/lib/utils/number-parsing';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import type { Beach, Database } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

import type { OutlookDay, OutlookDaySwell } from './swell-outlook-types';

const DAY_MS = 24 * 60 * 60 * 1000;
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
    .order('forecast_at', { ascending: true });
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

/**
 * One entry per local day for the outlook beach: the daylight surf range, the best daylight hour's
 * score (same scorer as Week Scout windows) and that hour's swell mix. A day without daylight rows is null-sized.
 */
export function buildOutlookDays(input: {
  rows: readonly EnhancedForecastEntity[];
  beach: Beach;
  now: Date;
  horizonDays: number;
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
}): OutlookDay[] {
  const timezone = resolveBeachTimezone(input.beach.timezone);
  const byDate = new Map<string, EnhancedForecastEntity[]>();
  for (const row of input.rows) {
    const at = new Date(row.forecast_at);
    const hour = getLocalHour(at, timezone);
    if (hour == null || hour < DAYLIGHT_START_HOUR || hour >= DAYLIGHT_END_HOUR) continue;
    const date = getLocalDateStr(at, timezone);
    byDate.set(date, [...(byDate.get(date) ?? []), row]);
  }

  const today = getLocalDateStr(input.now, timezone);
  return Array.from({ length: input.horizonDays }, (_, offset) => {
    // Calendar arithmetic on the local date, so a DST change can't skip or repeat a day.
    const date = new Date(Date.parse(`${today}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
    const rows = byDate.get(date) ?? [];
    const heights = rows.map((row) => parseWaveHeightRange(row.wave_height)).filter((h): h is { min: number; max: number } => h !== null);
    if (heights.length === 0) return { date, surfFt: null, score: null, swells: [] };
    let best: { row: EnhancedForecastEntity; score: number } | null = null;
    for (const row of rows) {
      const score = scoreWindowConditionScore(row, input.beach, input.skillLevel, null, input.boardClasses);
      if (!best || score > best.score) best = { row, score };
    }
    return {
      date,
      surfFt: { min: Math.min(...heights.map((h) => h.min)), max: Math.max(...heights.map((h) => h.max)) },
      score: best ? Math.round(best.score) : null,
      swells: best ? swellsOf(best.row) : [],
    };
  });
}

export function outlookDayRowsWindow(now: Date): { from: Date; to: Date } {
  // Rows from a day back cover the start of the local day in any US zone.
  return { from: new Date(now.getTime() - DAY_MS), to: new Date(now.getTime() + 10 * DAY_MS) };
}
