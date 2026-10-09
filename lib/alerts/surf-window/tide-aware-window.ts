import { parseWaveHeightRangeFt } from '@/lib/alerts/forecast-parsers';
import { getDaylightWindow } from '@/lib/alerts/sunrise';
import { capToBestWindow, refineWindow } from '@/lib/alerts/window-refiner';
import { groupGoForecasts } from '@/lib/cron/daily-call-runner';
import { createSpotProfile } from '@/lib/domains/spot-profile/spot-profile';
import { selectBestWindows } from '@/lib/services/discovery/window-selector';
import { MIN_SESSION_HOURS } from '@/lib/services/discovery/window-selector/constants';
import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import { getLocalDateString } from '@/lib/utils/timezone-utils';
import { interpolateTideHeight } from '@/lib/utils/tide-interpolation';
import type { ForecastVerdict } from '@/lib/alerts/canonical-forecast-verdict';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

export interface TideAwareWindowResult {
  state: 'recommended' | 'no_suitable_window' | 'insufficient_tide_evidence';
  window: {
    start: string;
    end: string;
    localDate: string;
    timezone: string;
    faceHeightFt: { min: number; max: number };
  } | null;
  reasons: string[];
}

interface TideAwareWindowArgs {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  tideSamples: Array<{ at: string; heightFt: number }> | null;
  arrivalAt: string | null;
  peakAt: string;
  fadeAt: string | null;
  timezone: string;
  now: Date;
  verdictFor: (forecast: EnhancedForecastEntity) => ForecastVerdict;
  skillLevel: string | null;
  isTideReasonEligible?: (beach: Beach) => boolean;
}

// shortcut: forecast rows represent one-hour intervals, revisit if ingest changes resolution.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function findTideAwareWindow(args: TideAwareWindowArgs): TideAwareWindowResult {
  const arrival = Date.parse(args.arrivalAt ?? args.peakAt);
  const peak = Date.parse(args.peakAt);
  const fade = Date.parse(args.fadeAt ?? args.peakAt);
  // Match the swell runner's existing ten-day forecast lookahead.
  const horizon = args.now.getTime() + 10 * DAY_MS;
  const usableStart = Math.max(arrival, args.now.getTime());
  const usableEnd = Math.min(fade, horizon);
  const noWindow: TideAwareWindowResult = { state: 'no_suitable_window', window: null, reasons: ['no_overlap_with_usable_swell'] };
  if (![usableStart, usableEnd, peak].every(Number.isFinite) || usableEnd <= usableStart) return noWindow;

  const preferences = createSpotProfile(args.beach).tidePreferences;
  const tideMatters = args.isTideReasonEligible?.(args.beach) ?? preferences.explicitRange;
  const samples = (args.tideSamples ?? [])
    .filter((sample) => Number.isFinite(Date.parse(sample.at)) && Number.isFinite(sample.heightFt))
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const tidePoints = samples.map((sample) => ({ time: sample.at, height: sample.heightFt }));
  const tideAt = (time: number): number | null => {
    const before = [...samples].reverse().find((sample) => Date.parse(sample.at) <= time);
    const after = samples.find((sample) => Date.parse(sample.at) >= time);
    if (!before || !after || Date.parse(after.at) - Date.parse(before.at) > 3 * HOUR_MS) return null;
    return interpolateTideHeight(tidePoints, time);
  };
  const inBand = (height: number): boolean => height >= preferences.minHeightFt && height <= preferences.maxHeightFt;
  const dates: Array<{ localDate: string; start: number; end: number }> = [];
  const firstDate = getLocalDateString(new Date(arrival), args.timezone);
  const lastDate = getLocalDateString(new Date(usableEnd), args.timezone);
  for (let offset = 0; offset < 4; offset += 1) {
    const localDate = new Date(Date.parse(`${firstDate}T12:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
    if (localDate > lastDate) break;
    const start = Math.max(usableStart, localDateTimeToUTC(localDate, '05:00:00', args.timezone).getTime());
    const end = Math.min(usableEnd, localDateTimeToUTC(localDate, '20:00:00', args.timezone).getTime());
    if (end > start) dates.push({ localDate, start, end });
  }
  if (tideMatters && (samples.length === 0 || dates.some(({ start, end }) =>
    tideAt(start) === null || tideAt(end) === null || samples.some((sample, index) => {
      const next = samples[index + 1];
      return next && Date.parse(sample.at) < end && Date.parse(next.at) > start
        && Date.parse(next.at) - Date.parse(sample.at) > 3 * HOUR_MS;
    })))) {
    return { state: 'insufficient_tide_evidence', window: null, reasons: ['tide_data_unavailable'] };
  }

  const candidates: Array<{ window: NonNullable<TideAwareWindowResult['window']>; score: number; tideInside: boolean }> = [];
  for (const { localDate, start: dayStart, end: dayEnd } of dates) {
    const dayRows = args.forecasts
      .filter((row) => getLocalDateString(new Date(row.forecast_at), args.timezone) === localDate)
      .sort((left, right) => Date.parse(left.forecast_at) - Date.parse(right.forecast_at))
      .map((row) => {
        const height = tideAt(Date.parse(row.forecast_at));
        return height === null ? row : { ...row, tide_height: String(height) };
      });
    const verdicts = dayRows.map((row) => {
      const evaluation = args.verdictFor(row);
      const at = Date.parse(row.forecast_at);
      const badTideWithinHour = preferences.explicitRange && samples.some((sample) =>
        Date.parse(sample.at) >= at && Date.parse(sample.at) < at + HOUR_MS && !inBand(sample.heightFt));
      return badTideWithinHour ? { ...evaluation, verdict: 'no' as const } : evaluation;
    });
    const verdictById = new Map(verdicts.map(({ forecast, verdict }) => [forecast.id, verdict]));
    const groups = groupGoForecasts(verdicts).flatMap((run) => {
      const contiguous: ForecastVerdict[][] = [];
      for (const evaluation of run) {
        const previous = contiguous[contiguous.length - 1]?.at(-1);
        if (!previous || Date.parse(evaluation.forecast.forecast_at) - Date.parse(previous.forecast.forecast_at) > HOUR_MS) {
          contiguous.push([]);
        }
        contiguous[contiguous.length - 1].push(evaluation);
      }
      return contiguous;
    });
    for (const group of groups) {
      const coarse = {
        start: new Date(Math.max(dayStart, Date.parse(group[0].forecast.forecast_at))).toISOString(),
        end: new Date(Math.min(dayEnd, Date.parse(group[group.length - 1].forecast.forecast_at) + HOUR_MS)).toISOString(),
      };
      if (Date.parse(coarse.end) <= Date.parse(coarse.start)) continue;
      const daylight = getDaylightWindow(args.beach.lat, args.beach.lon, new Date(coarse.start));
      const refined = refineWindow({ coarse, forecasts: dayRows, beach: args.beach, tideSamples: args.tideSamples,
        daylight: { sunrise: daylight.sunrise.toISOString(), sunset: daylight.sunset.toISOString() },
        verdictAt: (row) => verdictById.get(row.id) ?? 'no' });
      if (!refined) continue;
      const best = selectBestWindows({ forecasts: group.map(({ forecast }) => forecast),
        beach: { ...args.beach, timezone: args.timezone }, userPrefs: null, now: args.now, maxWindows: 1, userSkillLevel: args.skillLevel })[0];
      const capped = capToBestWindow(refined, best);
      // Keep only complete qualifying forecast hours; interpolation must not extend into a no row.
      const rows = group.filter(({ forecast }) => Date.parse(forecast.forecast_at) >= Math.max(Date.parse(coarse.start), Date.parse(capped.start))
        && Date.parse(forecast.forecast_at) + HOUR_MS <= Math.min(Date.parse(coarse.end), Date.parse(capped.end)));
      if (rows.length === 0) continue;
      const start = rows[0].forecast.forecast_at;
      const end = new Date(Date.parse(rows[rows.length - 1].forecast.forecast_at) + HOUR_MS).toISOString();
      if (Date.parse(end) - Date.parse(start) < MIN_SESSION_HOURS * HOUR_MS) continue;
      const heights = rows.map(({ forecast }) => parseWaveHeightRangeFt(forecast.wave_height));
      if (heights.some((height) => height === null)) continue;
      candidates.push({ window: { start: new Date(start).toISOString(), end, localDate, timezone: args.timezone,
        faceHeightFt: { min: Math.min(...heights.map((height) => height!.min)), max: Math.max(...heights.map((height) => height!.max)) } },
        score: Math.max(...rows.map(({ score }) => score)),
        tideInside: rows.every(({ forecast }) => { const height = tideAt(Date.parse(forecast.forecast_at)); return height !== null && inBand(height); }) });
    }
  }
  const distanceToPeak = (window: NonNullable<TideAwareWindowResult['window']>): number =>
    Math.max(Date.parse(window.start) - peak, peak - Date.parse(window.end), 0);
  const chosen = candidates.sort((left, right) => right.score - left.score
    || distanceToPeak(left.window) - distanceToPeak(right.window)
    || Date.parse(left.window.start) - Date.parse(right.window.start))[0];
  if (!chosen) return noWindow;
  const reasons: string[] = [];
  const peakTide = tideAt(peak);
  if (tideMatters && peakTide !== null && !inBand(peakTide) && chosen.tideInside) {
    reasons.push(peakTide > preferences.maxHeightFt ? 'high_tide_outside_preference' : 'low_tide_outside_preference');
    if (Date.parse(chosen.window.end) <= peak) reasons.push('better_tide_before_peak');
    else if (Date.parse(chosen.window.start) > peak) reasons.push('better_tide_after_peak');
  }
  return { state: 'recommended', window: chosen.window, reasons };
}
