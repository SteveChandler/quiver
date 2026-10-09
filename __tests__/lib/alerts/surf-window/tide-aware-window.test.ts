/** @jest-environment node */
import { findTideAwareWindow } from '@/lib/alerts/surf-window/tide-aware-window';
import { evaluateForecastVerdict, type ForecastVerdict } from '@/lib/alerts/canonical-forecast-verdict';
import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import snapshot from '@/__tests__/fixtures/grandview-crossing-swells-20260911.json';

const timezone = 'America/Los_Angeles';
const date = '2026-10-08';
const at = (hour: number, localDate: string = date): string => localDateTimeToUTC(localDate, `${String(hour).padStart(2, '0')}:00:00`, timezone).toISOString();
const beach = { ...snapshot.beach, timezone, preferred_tide_ft_min: 0, preferred_tide_ft_max: 3 } as unknown as Beach;
const forecasts: EnhancedForecastEntity[] = Array.from({ length: 24 }, (_, hour) => ({
  ...snapshot.forecast, id: `hour-${hour}`, forecast_at: at(hour), wave_height: hour < 10 ? '5-6 ft' : '3-4 ft',
  tide_height: hour >= 10 && hour < 12 ? '2' : '5', wind_speed: '3 mph',
} as EnhancedForecastEntity));
const tideSamples = [...forecasts.map((row) => ({ at: row.forecast_at, heightFt: Number(row.tide_height) })), { at: at(0, '2026-10-09'), heightFt: 5 }];
const verdictFor = (row: EnhancedForecastEntity, spot: Beach = beach): ForecastVerdict => ({
  forecast: row, score: row.wave_height === '5-6 ft' ? 95 : 85,
  verdict: Number(row.wind_speed?.split(' ')[0]) > 15 || row.wave_height === '0 ft'
    || (spot.preferred_tide_ft_min != null && spot.preferred_tide_ft_max != null
      && (Number(row.tide_height) < spot.preferred_tide_ft_min || Number(row.tide_height) > spot.preferred_tide_ft_max)) ? 'no' : 'go',
} as ForecastVerdict);
const input = { beach, forecasts, tideSamples, arrivalAt: at(5), peakAt: at(7), fadeAt: at(20), timezone,
  now: new Date(at(0)), skillLevel: 'advanced', verdictFor: (row: EnhancedForecastEntity): ForecastVerdict => verdictFor(row) };

it('waits for the tide after the peak and reports the face height during that window', () => {
  const result = findTideAwareWindow(input);
  expect(result.state).toBe('recommended');
  expect(result.window).toMatchObject({ start: at(10), end: at(12), localDate: date, timezone, faceHeightFt: { min: 3, max: 4 } });
  expect(result.window?.start).not.toBe(input.peakAt);
  expect(result.reasons).toEqual(['high_tide_outside_preference', 'better_tide_after_peak']);
});

it('uses the same curve differently for a mid/high tide beach', () => {
  const midHigh = { ...beach, preferred_tide_ft_min: 3, preferred_tide_ft_max: 6 };
  const result = findTideAwareWindow({ ...input, beach: midHigh, verdictFor: (row) => verdictFor(row, midHigh) });
  expect(result.state).toBe('recommended');
  expect(Date.parse(result.window!.start)).toBeLessThan(Date.parse(at(10)));
  expect(result.reasons).toEqual([]);
});

it.each(['dark', 'faded', 'wind'])('rejects better tide when usable conditions do not overlap: %s', (cause) => {
  const rows = forecasts.map((row, hour) => ({ ...row, tide_height: cause === 'dark' ? (hour >= 21 ? '2' : '5') : row.tide_height,
    wind_speed: cause === 'wind' && hour >= 10 && hour < 12 ? '25 mph' : '3 mph' }));
  const result = findTideAwareWindow({ ...input, forecasts: rows, fadeAt: cause === 'faded' ? at(9) : input.fadeAt,
    tideSamples: [...rows.map((row) => ({ at: row.forecast_at, heightFt: Number(row.tide_height) })), tideSamples[tideSamples.length - 1]] });
  expect(result).toMatchObject({ state: 'no_suitable_window', window: null, reasons: ['no_overlap_with_usable_swell'] });
});

it('selects a stronger run on the next beach-local day', () => {
  const nextDate = '2026-10-09';
  const rows = forecasts.map((row, hour) => ({ ...row, id: `next-${hour}`, forecast_at: at(hour, nextDate) }));
  const result = findTideAwareWindow({ ...input, arrivalAt: at(17), peakAt: at(18), fadeAt: at(15, nextDate),
    forecasts: [...forecasts, ...rows], tideSamples: [...tideSamples, ...rows.map((row) => ({ at: row.forecast_at, heightFt: Number(row.tide_height) })),
      { at: at(0, '2026-10-10'), heightFt: 5 }] });
  expect(result.window).toMatchObject({ start: at(10, nextDate), end: at(12, nextDate), localDate: nextDate });
  expect(result.reasons).toContain('better_tide_after_peak');
});

it('uses verdicts at an uncurated beach without making tide claims, even with missing samples', () => {
  const uncurated = { ...beach, preferred_tide_ft_min: null, preferred_tide_ft_max: null };
  const result = findTideAwareWindow({ ...input, beach: uncurated, tideSamples: null, verdictFor: (row) => verdictFor(row, uncurated) });
  expect(result.state).toBe('recommended');
  expect(result.reasons).toEqual([]);
});

it.each([null, tideSamples.filter((sample) => sample.at < at(10)), tideSamples.filter((sample) => sample.at < at(10) || sample.at > at(18))])(
  'withholds advice when a curated beach lacks full tide evidence', (samples) => {
    expect(findTideAwareWindow({ ...input, tideSamples: samples })).toEqual({ state: 'insufficient_tide_evidence', window: null, reasons: ['tide_data_unavailable'] });
  },
);

it('allows the tide-reason predicate to exclude a curated band', () => {
  const result = findTideAwareWindow({ ...input, isTideReasonEligible: () => false });
  expect(result.state).toBe('recommended');
  expect(result.reasons).toEqual([]);
});

it('emits a before-peak reason for an unsuitable low tide', () => {
  const rows = forecasts.map((row, hour) => ({ ...row, tide_height: hour >= 10 && hour < 12 ? '2' : '-1' }));
  const result = findTideAwareWindow({ ...input, peakAt: at(15), forecasts: rows,
    tideSamples: [...rows.map((row) => ({ at: row.forecast_at, heightFt: Number(row.tide_height) })), { at: at(0, '2026-10-09'), heightFt: -1 }] });
  expect(result.reasons).toEqual(['low_tide_outside_preference', 'better_tide_before_peak']);
});

it('never extends a refined run into bad wind or beyond fade', () => {
  const rows = forecasts.map((row, hour) => ({ ...row, wind_speed: hour >= 12 ? '25 mph' : '3 mph' }));
  const result = findTideAwareWindow({ ...input, forecasts: rows, fadeAt: at(12) });
  expect(result.window).toMatchObject({ start: at(10), end: at(12) });
});

it('breaks equally scored run ties by closeness to the peak', () => {
  const rows = forecasts.map((row, hour) => ({ ...row, wave_height: '3-4 ft', tide_height: (hour >= 7 && hour < 9) || (hour >= 15 && hour < 17) ? '2' : '5' }));
  const result = findTideAwareWindow({ ...input, peakAt: at(14), forecasts: rows,
    tideSamples: [...rows.map((row) => ({ at: row.forecast_at, heightFt: Number(row.tide_height) })), tideSamples[tideSamples.length - 1]] });
  expect(result.window?.start).toBe(at(15));
});

it('uses the canonical verdict to enforce skill eligibility', () => {
  const result = findTideAwareWindow({ ...input, beach: { ...beach, skill_level: 'advanced' }, skillLevel: 'beginner',
    verdictFor: (forecast) => evaluateForecastVerdict({ forecast, beach: { ...beach, skill_level: 'advanced' }, experienceLevel: 'beginner', timezone, now: input.now, candidateIdPrefix: 'test' }) });
  expect(result.state).toBe('no_suitable_window');
});

it('does not join missing forecast hours into a session', () => {
  const rows = forecasts.filter((_, hour) => hour === 10 || hour === 12).map((row) => ({ ...row, tide_height: '2' }));
  const samples = tideSamples.map((sample) => ({ ...sample, heightFt: 2 }));
  const result = findTideAwareWindow({ ...input, forecasts: rows, tideSamples: samples });
  expect(Date.parse(result.window!.end) - Date.parse(result.window!.start)).toBe(3_600_000);
});

it('never searches past four beach-local dates or the ten-day lookahead', () => {
  const farDate = '2026-10-12';
  const rows = forecasts.map((row, hour) => ({ ...row, forecast_at: at(hour, farDate) }));
  expect(findTideAwareWindow({ ...input, tideSamples: null, isTideReasonEligible: () => false,
    forecasts: rows, fadeAt: at(20, farDate) }).state).toBe('no_suitable_window');
  expect(findTideAwareWindow({ ...input, now: new Date('2026-09-01T00:00:00.000Z') }).state).toBe('no_suitable_window');
});

it('does not claim a tide-safe hour when denser samples show an out-of-band tide within it', () => {
  const result = findTideAwareWindow({ ...input, tideSamples: [...tideSamples, { at: '2026-10-08T17:30:00.000Z', heightFt: 5 }] });
  expect(result.window).toMatchObject({ start: at(11), end: at(12) });
});
