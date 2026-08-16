import {
  getValueAtTime,
  metersToFeet,
  parseNOAAValidTime,
} from '@/lib/services/noaa-wavewatch/wave-analysis';
import type { NOAAValueSeries } from '@/lib/services/noaa-wavewatch/types';

describe('NOAA WaveWatch interval utilities', () => {
  it('parses hour and day-hour validTime intervals', () => {
    expect(parseNOAAValidTime('2026-05-27T11:00:00+00:00/PT3H')).toEqual({
      startMs: Date.parse('2026-05-27T11:00:00+00:00'),
      endMs: Date.parse('2026-05-27T14:00:00+00:00'),
    });

    expect(parseNOAAValidTime('2026-05-27T11:00:00+00:00/PT13H')).toEqual({
      startMs: Date.parse('2026-05-27T11:00:00+00:00'),
      endMs: Date.parse('2026-05-28T00:00:00+00:00'),
    });

    expect(parseNOAAValidTime('2026-05-27T11:00:00+00:00/P1DT19H')).toEqual({
      startMs: Date.parse('2026-05-27T11:00:00+00:00'),
      endMs: Date.parse('2026-05-29T06:00:00+00:00'),
    });

    expect(parseNOAAValidTime('2026-05-27T20:00:00+00:00/P7DT4H')).toEqual({
      startMs: Date.parse('2026-05-27T20:00:00+00:00'),
      endMs: Date.parse('2026-06-04T00:00:00+00:00'),
    });
  });

  it('returns null for invalid intervals', () => {
    expect(parseNOAAValidTime('')).toBeNull();
    expect(parseNOAAValidTime('not-an-interval')).toBeNull();
    expect(parseNOAAValidTime('2026-05-27T11:00:00+00:00')).toBeNull();
    expect(parseNOAAValidTime('2026-05-27T11:00:00+00:00/P1M')).toBeNull();
  });

  it('samples values by interval coverage with an end-exclusive boundary', () => {
    const series: NOAAValueSeries = {
      uom: 'wmoUnit:m',
      values: [
        {
          validTime: '2026-05-27T11:00:00+00:00/PT13H',
          value: 1.5,
        },
        {
          validTime: '2026-05-28T00:00:00+00:00/PT6H',
          value: 0.9,
        },
      ],
    };

    expect(getValueAtTime(series, Date.parse('2026-05-27T12:00:00Z'))).toBe(1.5);
    expect(getValueAtTime(series, Date.parse('2026-05-27T23:59:59Z'))).toBe(1.5);
    expect(getValueAtTime(series, Date.parse('2026-05-28T00:00:00Z'))).toBe(0.9);
    expect(getValueAtTime(series, Date.parse('2026-05-28T06:00:00Z'))).toBeNull();
  });

  it('returns null when no interval covers the target time', () => {
    const series: NOAAValueSeries = {
      values: [
        {
          validTime: '2026-05-27T11:00:00+00:00/PT3H',
          value: 1.5,
        },
      ],
    };

    expect(getValueAtTime(series, Date.parse('2026-05-27T14:00:00Z'))).toBeNull();
    expect(getValueAtTime(undefined, Date.parse('2026-05-27T12:00:00Z'))).toBeNull();
  });

  it('returns null when the covering interval has a null value', () => {
    const series: NOAAValueSeries = {
      values: [
        {
          validTime: '2026-05-27T11:00:00+00:00/PT3H',
          value: null,
        },
      ],
    };

    expect(getValueAtTime(series, Date.parse('2026-05-27T12:00:00Z'))).toBeNull();
  });
});

describe('NOAA WaveWatch metersToFeet characterization', () => {
  it('preserves raw conversion precision for representative model heights', () => {
    expect(metersToFeet(1.83)).toBe(6.0039372);
    expect(metersToFeet(0.2)).toBe(0.6561680000000001);
  });
});
