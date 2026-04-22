/**
 * Partition parsing tests — guards against regression to the fabricated
 * `swell_2 = swell_1 * magic` synthesis that preceded the real-partition
 * pipeline.
 *
 * NOAA NWS gridpoints over the ocean return real `primarySwellHeight`,
 * `secondarySwellHeight`, and `wavePeriod2` partitions; coastal-land grids
 * don't. The processor must:
 * 1. Parse real primary/secondary partitions when present.
 * 2. Fall back to generic `swellHeight`/`swellDirection` for swell_1 when
 *    the primary-partition fields are absent.
 * 3. Null out swell_2 whenever the secondary partition is absent or 0 —
 *    never synthesize it from swell_1.
 * 4. Null out swell_2 unconditionally on the OM branch (OM has one partition).
 */

import {
  processNOAAGridData,
  processOpenMeteoData,
} from '@/lib/services/noaa-wavewatch/data-processors';
import type {
  NOAAGridData,
  NOAAValueSeries,
  OpenMeteoMarineResponse,
} from '@/lib/services/noaa-wavewatch/types';

function series(values: number[], uom = 'wmoUnit:m'): NOAAValueSeries {
  return {
    uom,
    values: values.map((v, i) => ({
      validTime: `2026-04-21T${String(i * 3).padStart(2, '0')}:00:00Z/PT3H`,
      value: v,
    })),
  };
}

const LAT = 33.2;
const LON = -117.4;

describe('processNOAAGridData — real partition parsing', () => {
  it('parses primary + secondary partitions when NOAA returns real values', () => {
    const gridData: NOAAGridData = {
      properties: {
        waveHeight: series([1.5, 1.6]),
        wavePeriod: series([14, 13]),
        waveDirection: series([270, 275]),
        primarySwellHeight: series([1.2, 1.3]),
        primarySwellDirection: series([265, 268]),
        secondarySwellHeight: series([0.4, 0.5]),
        secondarySwellDirection: series([195, 200]),
        wavePeriod2: series([8, 9]),
      },
    };

    const result = processNOAAGridData(gridData, 1, LAT, LON);
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Slot 0: real primary + real secondary
    expect(result[0].swell_1_height).toBeCloseTo(1.2, 2);
    expect(result[0].swell_1_direction).toBe(265);
    expect(result[0].swell_2_height).toBeCloseTo(0.4, 2);
    expect(result[0].swell_2_period).toBeCloseTo(8, 1);
    expect(result[0].swell_2_direction).toBe(195);

    // Slot 1: real primary + real secondary
    expect(result[1].swell_1_height).toBeCloseTo(1.3, 2);
    expect(result[1].swell_1_direction).toBe(268);
    expect(result[1].swell_2_height).toBeCloseTo(0.5, 2);
    expect(result[1].swell_2_period).toBeCloseTo(9, 1);
    expect(result[1].swell_2_direction).toBe(200);
  });

  it('falls back to generic swellHeight for swell_1 when primary partition is absent', () => {
    const gridData: NOAAGridData = {
      properties: {
        waveHeight: series([1.5]),
        wavePeriod: series([14]),
        waveDirection: series([270]),
        // No primary/secondary partitions (coastal-land grid)
        swellHeight: series([1.1]),
        swellDirection: series([260]),
        swellPeriod: series([13]),
      },
    };

    const result = processNOAAGridData(gridData, 1, LAT, LON);
    expect(result[0].swell_1_height).toBeCloseTo(1.1, 2);
    expect(result[0].swell_1_direction).toBe(260);
    // Secondary MUST be the zero sentinel — no synthesis from swell_1.
    // Downstream consumers read `swell_2_height > 0 && swell_2_period > 0`
    // as "has second swell train," so 0 means "no second swell."
    expect(result[0].swell_2_height).toBe(0);
    expect(result[0].swell_2_period).toBe(0);
    expect(result[0].swell_2_direction).toBe(0);
  });

  it('zeros swell_2 when only primary partition is populated (no secondary)', () => {
    const gridData: NOAAGridData = {
      properties: {
        waveHeight: series([1.5]),
        wavePeriod: series([14]),
        waveDirection: series([270]),
        primarySwellHeight: series([1.2]),
        primarySwellDirection: series([265]),
        // secondarySwellHeight, secondarySwellDirection, wavePeriod2 absent
      },
    };

    const result = processNOAAGridData(gridData, 1, LAT, LON);
    expect(result[0].swell_1_height).toBeCloseTo(1.2, 2);
    expect(result[0].swell_2_height).toBe(0);
    expect(result[0].swell_2_period).toBe(0);
    expect(result[0].swell_2_direction).toBe(0);
  });

  it('treats secondarySwellHeight=0 as "no secondary partition" (zeros all three fields)', () => {
    const gridData: NOAAGridData = {
      properties: {
        waveHeight: series([1.5]),
        wavePeriod: series([14]),
        waveDirection: series([270]),
        primarySwellHeight: series([1.2]),
        primarySwellDirection: series([265]),
        secondarySwellHeight: series([0]), // NOAA returns 0 for missing partitions
        secondarySwellDirection: series([0]),
        wavePeriod2: series([0]),
      },
    };

    const result = processNOAAGridData(gridData, 1, LAT, LON);
    expect(result[0].swell_2_height).toBe(0);
    expect(result[0].swell_2_period).toBe(0);
    expect(result[0].swell_2_direction).toBe(0);
  });

  it('reorders partitions by period descending (long-period groundswell wins swell_1 slot)', () => {
    // Real-world live NOAA capture for offshore Oceanside (2026-04-22T13:00Z):
    // NOAA primary = 2 ft 5s WSW (wind-sea), secondary = 2 ft 13s SSW (groundswell).
    // NOAA ranks by height, ties are arbitrary — the long-period groundswell
    // must land in swell_1 so downstream UI shows it as "the one that matters."
    const gridData: NOAAGridData = {
      properties: {
        waveHeight: series([0.8]),
        wavePeriod: series([5]),
        waveDirection: series([240]),
        primarySwellHeight: series([0.61]),
        primarySwellDirection: series([240]),
        swellPeriod: series([5]),
        secondarySwellHeight: series([0.61]),
        secondarySwellDirection: series([200]),
        wavePeriod2: series([13]),
      },
    };

    const result = processNOAAGridData(gridData, 1, LAT, LON);
    // Long-period 13s SSW should land in swell_1
    expect(result[0].swell_1_period).toBeCloseTo(13, 1);
    expect(result[0].swell_1_direction).toBe(200);
    expect(result[0].swell_1_height).toBeCloseTo(0.61, 2);
    // Short-period 5s WSW wind-sea demoted to swell_2
    expect(result[0].swell_2_period).toBeCloseTo(5, 1);
    expect(result[0].swell_2_direction).toBe(240);
    expect(result[0].swell_2_height).toBeCloseTo(0.61, 2);
  });

  it('preserves order when primary period >= secondary period', () => {
    // Primary is already the longer-period train — no swap needed.
    const gridData: NOAAGridData = {
      properties: {
        waveHeight: series([1.5]),
        wavePeriod: series([15]),
        waveDirection: series([270]),
        primarySwellHeight: series([0.61]),
        primarySwellDirection: series([270]),
        swellPeriod: series([15]),
        secondarySwellHeight: series([0.3]),
        secondarySwellDirection: series([200]),
        wavePeriod2: series([10]),
      },
    };

    const result = processNOAAGridData(gridData, 1, LAT, LON);
    expect(result[0].swell_1_period).toBeCloseTo(15, 1);
    expect(result[0].swell_1_direction).toBe(270);
    expect(result[0].swell_1_height).toBeCloseTo(0.61, 2);
    expect(result[0].swell_2_period).toBeCloseTo(10, 1);
    expect(result[0].swell_2_direction).toBe(200);
    expect(result[0].swell_2_height).toBeCloseTo(0.3, 2);
  });

  it('handles null secondary correctly after sort (no swap, swell_2 stays 0 sentinel)', () => {
    // Primary populated, secondary absent — behavior unchanged from pre-sort.
    const gridData: NOAAGridData = {
      properties: {
        waveHeight: series([1.5]),
        wavePeriod: series([14]),
        waveDirection: series([270]),
        primarySwellHeight: series([1.2]),
        primarySwellDirection: series([265]),
        // secondarySwellHeight, secondarySwellDirection, wavePeriod2 absent
      },
    };

    const result = processNOAAGridData(gridData, 1, LAT, LON);
    expect(result[0].swell_1_height).toBeCloseTo(1.2, 2);
    expect(result[0].swell_1_direction).toBe(265);
    expect(result[0].swell_2_height).toBe(0);
    expect(result[0].swell_2_period).toBe(0);
    expect(result[0].swell_2_direction).toBe(0);
  });

  it('never synthesizes swell_2 from swell_1 * magic (regression guard)', () => {
    // Historical bug: swell_2_height = significantWaveHeight * 0.4
    // and swell_2_period = swell_1_period * 1.1. Neither should ever appear
    // again when the real secondary partition is absent.
    const gridData: NOAAGridData = {
      properties: {
        waveHeight: series([2.0]),
        wavePeriod: series([14]),
        waveDirection: series([270]),
        primarySwellHeight: series([1.8]),
        primarySwellDirection: series([265]),
      },
    };

    const result = processNOAAGridData(gridData, 1, LAT, LON);
    expect(result[0].swell_2_height).not.toBe(0.8); // 2.0 * 0.4
    expect(result[0].swell_2_period).not.toBe(15.4); // 14 * 1.1
    expect(result[0].swell_2_height).toBe(0);
  });
});

describe('processOpenMeteoData — swell_2 is always zero sentinel', () => {
  it('zeros swell_2 unconditionally even when swell_wave_height is populated', () => {
    const data: OpenMeteoMarineResponse = {
      hourly: {
        time: [
          '2026-02-16T00:00',
          '2026-02-16T01:00',
          '2026-02-16T02:00',
          '2026-02-16T03:00',
          '2026-02-16T04:00',
          '2026-02-16T05:00',
        ],
        wave_height: [1.5, 1.5, 1.5, 1.6, 1.6, 1.6],
        wave_period: [12, 12, 12, 13, 13, 13],
        wave_direction: [270, 270, 270, 275, 275, 275],
        swell_wave_height: [1.1, 1.1, 1.1, 1.2, 1.2, 1.2],
        swell_wave_period: [14, 14, 14, 15, 15, 15],
        swell_wave_direction: [265, 265, 265, 268, 268, 268],
      },
    };

    const result = processOpenMeteoData(data, 1);
    expect(result.length).toBeGreaterThan(0);
    for (const slot of result) {
      expect(slot.swell_2_height).toBe(0);
      expect(slot.swell_2_period).toBe(0);
      expect(slot.swell_2_direction).toBe(0);
    }
  });

  it('never synthesizes swell_2 = swell_1 * 0.6 (regression guard)', () => {
    const data: OpenMeteoMarineResponse = {
      hourly: {
        time: [
          '2026-02-16T00:00',
          '2026-02-16T01:00',
          '2026-02-16T02:00',
          '2026-02-16T03:00',
        ],
        wave_height: [2.0, 2.0, 2.0, 2.0],
        wave_period: [14, 14, 14, 14],
        wave_direction: [270, 270, 270, 270],
        swell_wave_height: [1.5, 1.5, 1.5, 1.5],
        swell_wave_period: [14, 14, 14, 14],
        swell_wave_direction: [270, 270, 270, 270],
      },
    };

    const result = processOpenMeteoData(data, 1);
    for (const slot of result) {
      expect(slot.swell_2_height).not.toBe(0.9); // 1.5 * 0.6
      expect(slot.swell_2_height).toBe(0);
    }
  });

  it('preserves swell_1 from OM swell_wave_height', () => {
    const data: OpenMeteoMarineResponse = {
      hourly: {
        time: [
          '2026-02-16T00:00',
          '2026-02-16T01:00',
          '2026-02-16T02:00',
          '2026-02-16T03:00',
        ],
        wave_height: [1.5, 1.5, 1.5, 1.5],
        wave_period: [12, 12, 12, 12],
        wave_direction: [270, 270, 270, 270],
        swell_wave_height: [1.1, 1.1, 1.1, 1.1],
        swell_wave_period: [14, 14, 14, 14],
        swell_wave_direction: [265, 265, 265, 265],
      },
    };

    const result = processOpenMeteoData(data, 1);
    expect(result[0].swell_1_height).toBeCloseTo(1.1, 2);
    expect(result[0].swell_1_period).toBeCloseTo(14, 1);
    expect(result[0].swell_1_direction).toBe(265);
  });
});
