import { processOpenMeteoData } from '@/lib/services/noaa-wavewatch/data-processors';
import { getValueAtIndex, hasValidWaveData } from '@/lib/services/noaa-wavewatch/wave-analysis';
import type { OpenMeteoMarineResponse } from '@/lib/services/noaa-wavewatch/types';

describe('nullish safety: getValueAtIndex', () => {
  it('returns 0 when value is 0 (not null)', () => {
    const values = [
      { validTime: '2026-02-16T00:00:00Z/PT3H', value: 0 },
    ];
    expect(getValueAtIndex(values, 0)).toBe(0);
  });

  it('returns null when values array is undefined', () => {
    expect(getValueAtIndex(undefined, 0)).toBeNull();
  });

  it('returns null when index is out of bounds', () => {
    const values = [
      { validTime: '2026-02-16T00:00:00Z/PT3H', value: 1.5 },
    ];
    expect(getValueAtIndex(values, 5)).toBeNull();
  });

  it('returns positive value correctly', () => {
    const values = [
      { validTime: '2026-02-16T00:00:00Z/PT3H', value: 2.5 },
    ];
    expect(getValueAtIndex(values, 0)).toBe(2.5);
  });
});

describe('nullish safety: hasValidWaveData', () => {
  it('returns true when value is 0 (calm conditions)', () => {
    const values = [{ validTime: '2026-02-16T00:00:00Z/PT3H', value: 0 }];
    expect(hasValidWaveData(values)).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(hasValidWaveData([])).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasValidWaveData(undefined)).toBe(false);
  });

  it('returns true for positive values', () => {
    const values = [
      { validTime: '2026-02-16T00:00:00Z/PT3H', value: 1.2 },
      { validTime: '2026-02-16T03:00:00Z/PT3H', value: 0.8 },
    ];
    expect(hasValidWaveData(values)).toBe(true);
  });
});

describe('nullish safety: processOpenMeteoData with zero values', () => {
  it('preserves wave_height of 0 (does NOT substitute 0.8m default)', () => {
    const data: OpenMeteoMarineResponse = {
      hourly: {
        time: [
          '2026-02-16T00:00', '2026-02-16T01:00', '2026-02-16T02:00',
          '2026-02-16T03:00', '2026-02-16T04:00', '2026-02-16T05:00',
        ],
        wave_height: [0, 0, 0, 0, 0, 0],
        wave_period: [5, 5, 5, 5, 5, 5],
        wave_direction: [180, 180, 180, 180, 180, 180],
      },
    };

    const result = processOpenMeteoData(data, 1);
    expect(result.length).toBeGreaterThan(0);
    // The first slot (index 0) should have wave_height = 0, not 0.8
    expect(result[0].significant_wave_height).toBe(0);
  });

  it('uses 0.8m default when wave_height is null/undefined', () => {
    const data: OpenMeteoMarineResponse = {
      hourly: {
        time: [
          '2026-02-16T00:00', '2026-02-16T01:00', '2026-02-16T02:00',
          '2026-02-16T03:00', '2026-02-16T04:00', '2026-02-16T05:00',
        ],
        // wave_height intentionally omitted
        wave_period: [5, 5, 5, 5, 5, 5],
        wave_direction: [180, 180, 180, 180, 180, 180],
      },
    };

    const result = processOpenMeteoData(data, 1);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].significant_wave_height).toBe(0.8);
  });
});
