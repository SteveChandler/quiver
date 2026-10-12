/** @jest-environment node */
jest.mock('@/lib/services/discovery/window-selector', () => {
  const actual = jest.requireActual('@/lib/services/discovery/window-selector');
  return { ...actual, selectBestWindows: jest.fn(actual.selectBestWindows) };
});
import { findTideAwareWindow } from '@/lib/alerts/surf-window/tide-aware-window';
import { getDaylightWindow } from '@/lib/alerts/sunrise';
import { capToBestWindow, refineWindow } from '@/lib/alerts/window-refiner';
import * as windowSelector from '@/lib/services/discovery/window-selector';
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

const wednesday = '2026-10-14';
const shores = { ...beach, lat: 32.857, lon: -117.257, preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 5, preferred_tide_direction: 'rising' };
const heightsByDay = [
  { date: '2026-10-13', heights: [1, 2.2, 4.4, 5.7, 3.1, 0.3, 1, 2] },
  { date: wednesday, heights: [1, 2.5, 4, 5.4, 3.7, 1, 0.5, 1] },
];
const smoothTides = heightsByDay.flatMap(({ date: day, heights }) => Array.from({ length: 211 }, (_, index) => {
  const segment = Math.min(Math.floor(index / 30), heights.length - 2);
  const ratio = (index - segment * 30) / 30;
  return { at: new Date(Date.parse(at(2, day)) + index * 6 * 60_000).toISOString(),
    heightFt: heights[segment] + (heights[segment + 1] - heights[segment]) * (1 - Math.cos(Math.PI * ratio)) / 2 };
}));
function shoresInput(spacingHours: number): typeof input {
  const rows = heightsByDay.flatMap(({ date: day }) => Array.from({ length: 21 / spacingHours + 1 }, (_, index) => {
    const hour = 2 + index * spacingHours;
    const tide = smoothTides.find((sample) => sample.at === at(hour, day))!;
    return { ...snapshot.forecast, id: `${day}-${hour}`, forecast_at: at(hour, day), wave_height: day === wednesday ? '3.4 ft' : '3.8 ft',
      wind_speed: hour >= 14 ? '10 mph' : '5 mph', wind_direction: hour <= 8 ? 'NE' : 'NW',
      wind_direction_deg: hour <= 8 ? 45 : 315, tide_height: String(tide.heightFt), tide_status: hour <= 11 ? 'Rising' : 'Falling' } as EnhancedForecastEntity;
  }));
  return { ...input, beach: shores, forecasts: rows, tideSamples: smoothTides, arrivalAt: at(5, '2026-10-13'),
    peakAt: at(8, '2026-10-13'), fadeAt: at(20, wednesday), now: new Date('2026-10-09T16:52:00Z'),
    verdictFor: (row) => {
      const hour = Number(row.id.split('-').at(-1));
      const wed = row.id.startsWith(wednesday);
      return { forecast: row, verdict: (wed && hour >= 5 && hour <= 17) || (!wed && hour === 17) ? 'go' : 'maybe',
        score: wed ? (hour <= 8 ? 86 : hour <= 11 ? 79 : hour <= 14 ? 75 : 72) : hour === 17 ? 73 : 65 } as ForecastVerdict;
    } };
}

it('refines and caps the three-hourly Wednesday go run without whole-hour truncation', () => {
  const args = shoresInput(3);
  const dayRows = args.forecasts.filter((row) => row.id.startsWith(wednesday));
  const goRows = dayRows.filter((row) => args.verdictFor(row).verdict === 'go');
  const daylight = getDaylightWindow(shores.lat, shores.lon, new Date(at(5, wednesday)));
  const refined = refineWindow({ coarse: { start: at(5, wednesday), end: at(20, wednesday) }, forecasts: dayRows,
    beach: shores, tideSamples: smoothTides, daylight: { sunrise: daylight.sunrise.toISOString(), sunset: daylight.sunset.toISOString() },
    verdictAt: (row) => args.verdictFor(row).verdict });
  expect(refined).not.toBeNull();
  const best = windowSelector.selectBestWindows({ forecasts: goRows, beach: shores, userPrefs: null, now: args.now,
    maxWindows: 1, userSkillLevel: args.skillLevel })[0];
  const expected = capToBestWindow(refined!, best);
  const result = findTideAwareWindow(args);
  expect(result).toMatchObject({ state: 'recommended', window: { localDate: wednesday, start: expected.start, end: expected.end } });
  expect(Date.parse(result.window!.start)).toBeGreaterThanOrEqual(daylight.sunrise.getTime());
  expect(Date.parse(result.window!.end) - Date.parse(result.window!.start)).toBeGreaterThan(2 * 3_600_000);
  expect(result.window).not.toMatchObject({ start: at(8, wednesday), end: at(9, wednesday) });
});

it('gives an equivalent refined window with hourly and three-hourly forecasts', () => {
  const sparse = findTideAwareWindow(shoresInput(3));
  const select = jest.mocked(windowSelector.selectBestWindows);
  // Hold the selected stretch fixed: the shared selector rescores denser grids.
  const best = select.mock.results.at(-1)!.value;
  select.mockReturnValueOnce([]).mockReturnValueOnce(best);
  const hourly = findTideAwareWindow(shoresInput(1));
  expect(sparse.state).toBe('recommended');
  expect(hourly.state).toBe('recommended');
  expect(sparse.window).toEqual(hourly.window);
  expect(Date.parse(sparse.window!.end) - Date.parse(sparse.window!.start)).toBeGreaterThan(2 * 3_600_000);
});

it('keeps the exact late-morning tide edge when it ends a three-hourly go run', () => {
  const args = shoresInput(3);
  const verdict = args.verdictFor;
  args.verdictFor = (row) => ({ ...verdict(row), verdict: row.id.startsWith(wednesday)
    && (row.id.endsWith('-5') || row.id.endsWith('-8')) ? 'go' : 'maybe' });
  const dayRows = args.forecasts.filter((row) => row.id.startsWith(wednesday));
  const daylight = getDaylightWindow(shores.lat, shores.lon, new Date(at(5, wednesday)));
  const expected = refineWindow({ coarse: { start: at(5, wednesday), end: at(11, wednesday) }, forecasts: dayRows,
    beach: shores, tideSamples: smoothTides, daylight: { sunrise: daylight.sunrise.toISOString(), sunset: daylight.sunset.toISOString() },
    verdictAt: (row) => args.verdictFor(row).verdict });
  expect(expected?.drivers).toContainEqual(expect.objectContaining({ kind: 'tide', edge: 'end' }));
  expect(Date.parse(expected!.end)).toBeLessThan(Date.parse(at(11, wednesday)));
  jest.mocked(windowSelector.selectBestWindows).mockReturnValueOnce([]);
  const result = findTideAwareWindow(args);
  expect(result).toMatchObject({ state: 'recommended', window: { start: expected!.start, end: expected!.end } });
});

it('separates three-hourly go rows around a maybe and keeps each single-row span', () => {
  const rows = [5, 8, 11, 14, 17].map((hour) => ({ ...forecasts[hour], id: `isolated-${hour}`, tide_height: '2' }));
  rows.splice(2, 0, { ...forecasts[9], id: 'maybe-between', forecast_at: new Date(Date.parse(at(9)) + 30 * 60_000).toISOString(), tide_height: '2' });
  const select = jest.mocked(windowSelector.selectBestWindows);
  select.mockClear();
  select.mockReturnValueOnce([]).mockReturnValueOnce([]);
  const result = findTideAwareWindow({ ...input, forecasts: rows, tideSamples: tideSamples.map((sample) => ({ ...sample, heightFt: 2 })),
    verdictFor: (row) => ({ forecast: row, score: row.id === 'isolated-8' ? 90 : 80,
      verdict: row.id === 'isolated-8' || row.id === 'isolated-11' ? 'go' : 'maybe' } as ForecastVerdict) });
  expect(select).toHaveBeenCalledTimes(2);
  expect(select).toHaveBeenNthCalledWith(1, expect.objectContaining({ forecasts: [expect.objectContaining({ id: 'isolated-8' })] }));
  expect(select).toHaveBeenNthCalledWith(2, expect.objectContaining({ forecasts: [expect.objectContaining({ id: 'isolated-11' })] }));
  expect(result.window).toMatchObject({ start: at(8), end: at(11) });
});

it('clips to the usable swell and includes both partially overlapping rows in face height', () => {
  const rows = [5, 8, 11, 14].map((hour) => ({ ...forecasts[hour], tide_height: '2', wave_height: hour === 8 ? '2-3 ft' : '4-5 ft' }));
  const start = new Date(Date.parse(at(8)) + 30 * 60_000).toISOString();
  const end = new Date(Date.parse(at(11)) + 30 * 60_000).toISOString();
  jest.mocked(windowSelector.selectBestWindows).mockReturnValueOnce([]);
  const result = findTideAwareWindow({ ...input, forecasts: rows, arrivalAt: start, fadeAt: end,
    tideSamples: tideSamples.map((sample) => ({ ...sample, heightFt: 2 })),
    verdictFor: (row) => ({ forecast: row, score: 80, verdict: 'go' } as ForecastVerdict) });
  expect(result.window).toMatchObject({ start, end, faceHeightFt: { min: 2, max: 5 } });
});

it('defaults a day with a single forecast row to one hour', () => {
  jest.mocked(windowSelector.selectBestWindows).mockReturnValueOnce([]);
  const result = findTideAwareWindow({ ...input, forecasts: [forecasts[10]] });
  expect(result.window).toMatchObject({ start: at(10), end: at(11) });
});

it('reports a tide shift when the three-hourly row starts outside the band but the window stays inside', () => {
  const rows = [2, 5, 8, 11, 14, 17, 20, 23].map((hour) => ({ ...forecasts[hour], wave_height: '3-4 ft' }));
  const samples = Array.from({ length: 241 }, (_, index) => {
    const hour = index / 10;
    return { at: new Date(Date.parse(at(0)) + index * 6 * 60_000).toISOString(),
      heightFt: hour <= 5 ? 5 : hour < 6 ? 5 - (hour - 5) * 3 : 2 };
  });
  jest.mocked(windowSelector.selectBestWindows).mockReturnValueOnce([]);
  const result = findTideAwareWindow({ ...input, forecasts: rows, tideSamples: samples, peakAt: at(5),
    verdictFor: (row) => ({ forecast: row, score: 85, verdict: row.id === 'hour-5' || row.id === 'hour-8' ? 'go' : 'no' } as ForecastVerdict) });
  const daylight = getDaylightWindow(beach.lat, beach.lon, new Date(at(5)));
  expect(result).toMatchObject({ state: 'recommended', window: { start: daylight.sunrise.toISOString() },
    reasons: ['high_tide_outside_preference', 'better_tide_after_peak'] });
  expect(Date.parse(result.window!.start)).toBeLessThan(Date.parse(at(8)));
  expect(Date.parse(result.window!.end)).toBeLessThanOrEqual(Date.parse(at(11)));
});

it.each(['interior', 'end'])('withholds a tide-shift reason when the window tide is out of band at its %s', (position) => {
  const rows = [2, 5, 8, 11, 14, 17, 20, 23].map((hour) => ({ ...forecasts[hour], wave_height: '3-4 ft' }));
  const start = at(8);
  const end = new Date(Date.parse(at(10)) + 15 * 60_000).toISOString();
  const excursion = position === 'interior' ? new Date(Date.parse(start) + 30 * 60_000).toISOString() : end;
  const samples = Array.from({ length: 49 }, (_, index) => ({ at: new Date(Date.parse(at(0)) + index * 30 * 60_000).toISOString(),
    heightFt: index === 10 ? 5 : 2 }));
  samples.push({ at: excursion, heightFt: 5 });
  // Replace an existing sample at the excursion rather than adding a duplicate timestamp.
  const curve = samples.filter((sample, index) => sample.at !== excursion || index === samples.length - 1);
  jest.mocked(windowSelector.selectBestWindows).mockReturnValueOnce([]);
  const result = findTideAwareWindow({ ...input, forecasts: rows, tideSamples: curve, arrivalAt: start, fadeAt: end, peakAt: at(5),
    verdictFor: (row) => ({ forecast: row, score: 85, verdict: row.id === 'hour-8' ? 'go' : 'no' } as ForecastVerdict) });
  expect(result).toMatchObject({ state: 'recommended', window: { start, end }, reasons: [] });
});

it('ranks a strong go run above a weaker run despite a low-scoring no row at the refined edge', () => {
  const rows = [2, 5, 8, 11, 14, 17, 20, 23].map((hour) => ({ ...forecasts[hour],
    wave_height: hour === 5 ? '6-7 ft' : '3-4 ft', tide_height: hour === 5 ? '4' : '2' }));
  const samples = Array.from({ length: 241 }, (_, index) => {
    const hour = index / 10;
    return { at: new Date(Date.parse(at(0)) + index * 6 * 60_000).toISOString(),
      heightFt: hour < 2 || hour > 8 ? 2 : hour <= 5 ? 2 + (hour - 2) * 2 / 3 : 4 - (hour - 5) * 2 / 3 };
  });
  jest.mocked(windowSelector.selectBestWindows).mockReturnValueOnce([]).mockReturnValueOnce([]);
  const result = findTideAwareWindow({ ...input, forecasts: rows, tideSamples: samples,
    verdictFor: (row) => ({ forecast: row, score: row.id === 'hour-17' ? 70 : row.id === 'hour-8' || row.id === 'hour-11' ? 90 : 0,
      verdict: ['hour-8', 'hour-11', 'hour-17'].includes(row.id) ? 'go' : 'no' } as ForecastVerdict) });
  expect(result.state).toBe('recommended');
  expect(Date.parse(result.window!.start)).toBeLessThan(Date.parse(at(8)));
  expect(Date.parse(result.window!.end)).toBeLessThan(Date.parse(at(12)));
  expect(result.window!.faceHeightFt).toEqual({ min: 3, max: 7 });
});

it('weights go scores by their overlap duration rather than their row count', () => {
  const rows = [5, 8, 11, 14, 17, 20].map((hour) => ({ ...forecasts[hour], wave_height: '3-4 ft', tide_height: '2' }));
  const scores = new Map([['hour-8', 60], ['hour-11', 100], ['hour-17', 75]]);
  jest.mocked(windowSelector.selectBestWindows).mockReturnValueOnce([]).mockReturnValueOnce([]);
  const result = findTideAwareWindow({ ...input, forecasts: rows, tideSamples: tideSamples.map((sample) => ({ ...sample, heightFt: 2 })),
    verdictFor: (row) => ({ forecast: row, score: scores.get(row.id) ?? 0, verdict: scores.has(row.id) ? 'go' : 'no' } as ForecastVerdict) });
  expect(result.window).toMatchObject({ start: at(17), faceHeightFt: { min: 3, max: 4 } });
});

it('waits for the tide after the peak and reports the face height during that window', () => {
  const result = findTideAwareWindow(input);
  expect(result.state).toBe('recommended');
  expect(result.window).toMatchObject({ start: at(10), end: at(12), localDate: date, timezone, faceHeightFt: { min: 3, max: 4 } });
  expect(result.window?.start).not.toBe(input.peakAt);
  expect(result.reasons).toEqual([]);
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
  expect(result.reasons).toEqual([]);
});

it('uses the injected eligibility predicate consistently for evidence and tide reasons', () => {
  const result = findTideAwareWindow({ ...input, tideSamples: null, isTideReasonEligible: () => false,
    verdictFor: (row) => ({ forecast: row, score: 80, verdict: 'go' } as ForecastVerdict) });
  expect(result.state).toBe('recommended');
  expect(result.reasons).toEqual([]);
});

it('uses verdicts without tide claims at an uncurated beach', () => {
  const uncurated = { ...beach, preferred_tide_ft_min: null, preferred_tide_ft_max: null };
  const result = findTideAwareWindow({ ...input, beach: uncurated, tideSamples: null,
    verdictFor: (row) => ({ forecast: row, score: 80, verdict: 'go' } as ForecastVerdict) });
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
  const result = findTideAwareWindow({ ...input, peakAt: at(15), fadeAt: at(11), forecasts: rows,
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
  const rows = forecasts.filter((_, hour) => hour !== 11).map((row) => ({ ...row, tide_height: '2',
    wave_height: row.id === 'hour-10' || row.id === 'hour-12' ? '3-4 ft' : '0 ft' }));
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

it('leaves within-hour tide tolerance to the canonical verdict', () => {
  const verdict = jest.fn((row: EnhancedForecastEntity) => ({ forecast: row, score: 80, verdict: row.id === 'hour-10' ? 'go' : 'no' } as ForecastVerdict));
  const result = findTideAwareWindow({ ...input, tideSamples: [...tideSamples, { at: '2026-10-08T17:30:00.000Z', heightFt: 5 }], verdictFor: verdict });
  expect(verdict.mock.calls.some(([row]) => row.id === 'hour-10' && row.tide_height === '2')).toBe(true);
  expect(result.window?.start).toBe(at(10));
});


it('uses the rest of the peak day when fadeAt is missing', () => {
  const result = findTideAwareWindow({ ...input, fadeAt: null });
  expect(result.window).toMatchObject({ start: at(10), end: at(12), localDate: date });
  expect(result.reasons).toEqual([]);
});

it('starts its four-date budget from the later of arrival and now', () => {
  const dates = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
  const rows = dates.flatMap((day) => forecasts.map((row, hour) => ({ ...row, id: `${day}-${hour}`, forecast_at: at(hour, day) })));
  const samples = dates.flatMap((day) => Array.from({ length: 25 }, (_, hour) => ({ at: at(hour, day), heightFt: hour >= 10 && hour < 12 ? 2 : 5 })));
  const result = findTideAwareWindow({ ...input, arrivalAt: at(7, '2026-10-06'), peakAt: at(7, '2026-10-09'), fadeAt: at(20, '2026-10-12'),
    now: new Date(at(0, '2026-10-08')), forecasts: rows, tideSamples: samples,
    verdictFor: (row) => ({ ...verdictFor(row), score: row.id.startsWith('2026-10-11') ? 95 : 60 }) });
  expect(result.window?.localDate).toBe('2026-10-11');
});

it('skips uncovered dates when another candidate date has full tide coverage', () => {
  const nextDate = '2026-10-09';
  const nextRows = forecasts.map((row, hour) => ({ ...row, id: `covered-${hour}`, forecast_at: at(hour, nextDate) }));
  const coveredSamples = Array.from({ length: 16 }, (_, index) => ({ at: at(index + 5, nextDate), heightFt: index >= 5 && index < 7 ? 2 : 5 }));
  const result = findTideAwareWindow({ ...input, fadeAt: at(20, nextDate), forecasts: [...forecasts, ...nextRows], tideSamples: coveredSamples });
  expect(result).toMatchObject({ state: 'recommended', window: { localDate: nextDate }, reasons: expect.any(Array) });
});

it('ranks by mean window score before duration and peak closeness', () => {
  const scores = new Map<string, number>([['hour-7', 82], ['hour-8', 68],
    ['hour-12', 82], ['hour-13', 80], ['hour-14', 80], ['hour-15', 78]]);
  const rows = forecasts.map((row, hour) => ({ ...row, tide_height: '2',
    wave_height: (scores.get(`hour-${hour}`) ?? 0) > 0 ? '3-4 ft' : '0 ft' }));
  jest.mocked(windowSelector.selectBestWindows).mockReturnValueOnce([]);
  const result = findTideAwareWindow({ ...input, forecasts: rows, tideSamples: tideSamples.map((sample) => ({ ...sample, heightFt: 2 })),
    verdictFor: (row) => ({ forecast: row, score: scores.get(row.id) ?? 0, verdict: scores.has(row.id) ? 'go' : 'no' } as ForecastVerdict) });
  expect(result.window).toMatchObject({ start: at(12), end: at(16) });
});
