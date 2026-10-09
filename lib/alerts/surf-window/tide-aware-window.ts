import { parseWaveHeightRangeFt } from '@/lib/alerts/forecast-parsers';
import { getDaylightWindow } from '@/lib/alerts/sunrise';
import { capToBestWindow, refineWindow } from '@/lib/alerts/window-refiner';
import { createSpotProfile } from '@/lib/domains/spot-profile/spot-profile';
import { selectBestWindows } from '@/lib/services/discovery/window-selector';
import { MIN_SESSION_HOURS } from '@/lib/services/discovery/window-selector/constants';
import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import { getLocalDateString } from '@/lib/utils/timezone-utils';
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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function findTideAwareWindow(args: TideAwareWindowArgs): TideAwareWindowResult {
  const arrival = Date.parse(args.arrivalAt ?? args.peakAt);
  const peak = Date.parse(args.peakAt);
  const fade = args.fadeAt ? Date.parse(args.fadeAt)
    : localDateTimeToUTC(getLocalDateString(new Date(peak), args.timezone), '20:00:00', args.timezone).getTime();
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
  const sampleTimes = samples.map((sample) => Date.parse(sample.at));
  const tideAt = (time: number): number | null => {
    let low = 0;
    let high = sampleTimes.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (sampleTimes[middle] < time) low = middle + 1;
      else high = middle;
    }
    if (sampleTimes[low] === time) return samples[low].heightFt;
    const before = low - 1;
    if (before < 0 || low >= samples.length || sampleTimes[low] - sampleTimes[before] > 3 * HOUR_MS) return null;
    const ratio = (time - sampleTimes[before]) / (sampleTimes[low] - sampleTimes[before]);
    return samples[before].heightFt + ratio * (samples[low].heightFt - samples[before].heightFt);
  };
  const inBand = (height: number): boolean => height >= preferences.minHeightFt && height <= preferences.maxHeightFt;
  const dates: Array<{ localDate: string; start: number; end: number }> = [];
  const firstDate = getLocalDateString(new Date(usableStart), args.timezone);
  const lastDate = getLocalDateString(new Date(usableEnd), args.timezone);
  for (let offset = 0; offset < 4; offset += 1) {
    const localDate = new Date(Date.parse(`${firstDate}T12:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
    if (localDate > lastDate) break;
    const start = Math.max(usableStart, localDateTimeToUTC(localDate, '05:00:00', args.timezone).getTime());
    const end = Math.min(usableEnd, localDateTimeToUTC(localDate, '20:00:00', args.timezone).getTime());
    if (end > start) dates.push({ localDate, start, end });
  }
  const tideCoveredDates = (date: { localDate: string; start: number; end: number }): boolean =>
    tideAt(date.start) !== null && tideAt(date.end) !== null && !samples.some((sample, index) => {
      const next = samples[index + 1];
      return next && sampleTimes[index] < date.end && sampleTimes[index + 1] > date.start
        && sampleTimes[index + 1] - sampleTimes[index] > 3 * HOUR_MS;
    });
  const coveredDates = tideMatters ? dates.filter(tideCoveredDates) : dates;
  if (tideMatters && dates.length > 0 && coveredDates.length === 0) {
    return { state: 'insufficient_tide_evidence', window: null, reasons: ['tide_data_unavailable'] };
  }

  const candidates: Array<{ window: NonNullable<TideAwareWindowResult['window']>; score: number; duration: number; tideInside: boolean }> = [];
  for (const { localDate, start: dayStart, end: dayEnd } of coveredDates) {
    const dayRows = args.forecasts
      .filter((row) => getLocalDateString(new Date(row.forecast_at), args.timezone) === localDate)
      .sort((left, right) => Date.parse(left.forecast_at) - Date.parse(right.forecast_at))
      .map((row) => {
        const height = tideAt(Date.parse(row.forecast_at));
        return height === null ? row : { ...row, tide_height: String(height) };
      });
    const gaps = dayRows.slice(1).map((row, index) => Date.parse(row.forecast_at) - Date.parse(dayRows[index].forecast_at))
      .filter((gap) => gap > 0).sort((left, right) => left - right);
    const middle = Math.floor(gaps.length / 2);
    const spacing = gaps.length === 0 ? HOUR_MS : (gaps[middle] + gaps[Math.floor((gaps.length - 1) / 2)]) / 2;
    const verdicts = dayRows.map(args.verdictFor);
    const verdictById = new Map(verdicts.map(({ forecast, verdict }) => [forecast.id, verdict]));
    const groups: ForecastVerdict[][] = [];
    for (const [index, evaluation] of verdicts.entries()) {
      if (evaluation.verdict !== 'go') continue;
      const previous = verdicts[index - 1];
      if (previous?.verdict !== 'go'
        || Date.parse(evaluation.forecast.forecast_at) - Date.parse(previous.forecast.forecast_at) > spacing) groups.push([]);
      groups[groups.length - 1].push(evaluation);
    }
    for (const group of groups) {
      const coarse = {
        start: new Date(Math.max(dayStart, Date.parse(group[0].forecast.forecast_at))).toISOString(),
        end: new Date(Math.min(dayEnd, Date.parse(group[group.length - 1].forecast.forecast_at) + spacing)).toISOString(),
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
      const start = new Date(Math.max(dayStart, daylight.sunrise.getTime(), Date.parse(capped.start))).toISOString();
      const end = new Date(Math.min(dayEnd, daylight.sunset.getTime(), Date.parse(capped.end))).toISOString();
      const rows = verdicts.filter(({ forecast }) => Date.parse(forecast.forecast_at) < Date.parse(end)
        && Date.parse(forecast.forecast_at) + spacing > Date.parse(start));
      if (rows.length === 0) continue;
      if (Date.parse(end) - Date.parse(start) < MIN_SESSION_HOURS * HOUR_MS) continue;
      const heights = rows.map(({ forecast }) => parseWaveHeightRangeFt(forecast.wave_height));
      if (heights.some((height) => height === null)) continue;
      candidates.push({ window: { start: new Date(start).toISOString(), end, localDate, timezone: args.timezone,
        faceHeightFt: { min: Math.min(...heights.map((height) => height!.min)), max: Math.max(...heights.map((height) => height!.max)) } },
        score: rows.reduce((sum, { score }) => sum + score, 0) / rows.length,
        duration: Date.parse(end) - Date.parse(start),
        tideInside: rows.every(({ forecast }) => { const height = tideAt(Date.parse(forecast.forecast_at)); return height !== null && inBand(height); }) });
    }
  }
  const distanceToPeak = (window: NonNullable<TideAwareWindowResult['window']>): number =>
    Math.max(Date.parse(window.start) - peak, peak - Date.parse(window.end), 0);
  const chosen = candidates.sort((left, right) => right.score - left.score
    || right.duration - left.duration
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
