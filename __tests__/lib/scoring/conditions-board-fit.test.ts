/**
 * @jest-environment node
 *
 * Unknown wind is neutral for board fit: it must not shrink the effective
 * size, move the class score, or add a wind word to the pick reason.
 */
import { classFitScore, fitConditions, pickReasonText } from '@/lib/scoring/conditions-board-fit';

const beach = { wind_offshore_deg: 90, preferred_tide_ft_min: 1, preferred_tide_ft_max: 4, break_type: 'beach' };
const base = { wave_height: '3 ft', wave_period: '12s', tide_height: null };

const fit = (overrides: Record<string, unknown>, b: Record<string, unknown> = beach) =>
  fitConditions({ ...base, ...overrides }, b, null)!;
const reason = (overrides: Record<string, unknown>, b: Record<string, unknown> = beach) =>
  pickReasonText(fit(overrides, b), 'intermediate', 'Twin pin', 'fish', false);
const score = (overrides: Record<string, unknown>, b: Record<string, unknown> = beach) =>
  classFitScore(fit(overrides, b), 'intermediate', 'mid-length')!;

const WIND_WORDS = /choppy|glassy|clean|offshore|onshore|wind/i;

// The same row with its wind inputs removed: the "wind factor removed" baseline.
const unknownCases: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
  ['missing speed', { wind_speed: null, wind_direction_deg: 90 }, beach],
  ['missing speed and direction', { wind_speed: null, wind_direction_deg: null }, beach],
  ['missing direction', { wind_speed: '20 mph', wind_direction_deg: null }, beach],
  ['missing orientation', { wind_speed: '20 mph', wind_direction_deg: 90 }, { ...beach, wind_offshore_deg: null }],
];

describe.each(unknownCases)('unknown wind (%s)', (_label, wind, b) => {
  it('adds no wind words to the pick reason', () => {
    expect(reason(wind, b)).not.toMatch(WIND_WORDS);
  });

  it('scores exactly like the same row with no wind inputs at all', () => {
    const none = { wind_speed: null, wind_direction_deg: null };
    expect(score(wind, b)).toBe(score(none, b));
  });
});

describe('unknown wind versus known wind', () => {
  it('scores above a known onshore wind of the same speed', () => {
    const unknown = score({ wind_speed: '15 mph', wind_direction_deg: null });
    expect(unknown).toBeGreaterThan(score({ wind_speed: '15 mph', wind_direction_deg: 270 }));
  });

  it('leaves the effective size alone: a centred fit stays exactly centred', () => {
    // 4.8 ft is the advanced shortboard centre; a 10 s period and no tide add no shift.
    const centred = { wave_height: '4.8 ft', wave_period: '10s', wind_speed: null };
    expect(classFitScore(fit(centred), 'advanced', 'shortboard')).toBeCloseTo(100, 10);
  });
});

describe('known wind behaviour is unchanged', () => {
  it('calls calm glassy', () => {
    expect(reason({ wind_speed: '0 mph', wind_direction_deg: null })).toMatch(/glassy faces/);
  });

  it('calls a light offshore clean', () => {
    expect(reason({ wind_speed: '6 mph', wind_direction_deg: 90 })).toMatch(/clean offshore faces/);
  });

  it('calls a strong onshore choppy', () => {
    expect(reason({ wind_speed: '20 mph', wind_direction_deg: 270 })).toMatch(/choppy wind/);
  });

  it('resolves offshore from aspect when the stored bearing is missing', () => {
    const aspectOnly = { ...beach, wind_offshore_deg: null, aspect_deg: 270 };
    expect(reason({ wind_speed: '6 mph', wind_direction_deg: 90 }, aspectOnly)).toMatch(/clean offshore faces/);
    expect(reason({ wind_speed: '20 mph', wind_direction_deg: 270 }, aspectOnly)).toMatch(/choppy wind/);
  });
});
