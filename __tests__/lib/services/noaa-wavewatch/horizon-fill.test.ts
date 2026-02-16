import { generateFallbackSlotsFrom } from '@/lib/services/noaa-wavewatch/fallback-generator';
import { FORECAST_CONFIG } from '@/lib/services/noaa-wavewatch/constants';

describe('generateFallbackSlotsFrom', () => {
  const LAT = 32.87; // San Diego
  const LON = -117.25;

  it('generates the requested number of 3h-cadence slots', () => {
    const start = new Date('2026-02-16T12:00:00Z');
    const slots = generateFallbackSlotsFrom(LAT, LON, start, 10);
    expect(slots).toHaveLength(10);

    // First slot should be startAfter + 3h
    const firstTs = new Date(slots[0].timestamp).getTime();
    expect(firstTs).toBe(start.getTime() + 3 * 3600000);

    // Each subsequent slot should be 3h apart
    for (let i = 1; i < slots.length; i++) {
      const prev = new Date(slots[i - 1].timestamp).getTime();
      const curr = new Date(slots[i].timestamp).getTime();
      expect(curr - prev).toBe(3 * 3600000);
    }
  });

  it('marks all slots as FALLBACK data source', () => {
    const start = new Date('2026-02-16T00:00:00Z');
    const slots = generateFallbackSlotsFrom(LAT, LON, start, 5);
    for (const slot of slots) {
      expect(slot.data_source).toBe('FALLBACK');
    }
  });

  it('produces non-null wave values in every slot', () => {
    const start = new Date('2026-02-16T00:00:00Z');
    const slots = generateFallbackSlotsFrom(LAT, LON, start, 8);
    for (const slot of slots) {
      expect(slot.significant_wave_height).toBeGreaterThan(0);
      expect(slot.peak_wave_period).toBeGreaterThan(0);
      expect(slot.peak_wave_direction).toBeGreaterThanOrEqual(0);
      expect(slot.swell_1_height).toBeGreaterThan(0);
      expect(slot.wind_wave_height).toBeGreaterThan(0);
    }
  });

  it('returns empty array when count is 0', () => {
    const start = new Date('2026-02-16T00:00:00Z');
    const slots = generateFallbackSlotsFrom(LAT, LON, start, 0);
    expect(slots).toHaveLength(0);
  });
});

describe('FORECAST_CONFIG', () => {
  it('OPEN_METEO_MAX_DAYS is set to 12', () => {
    expect(FORECAST_CONFIG.OPEN_METEO_MAX_DAYS).toBe(12);
  });
});
