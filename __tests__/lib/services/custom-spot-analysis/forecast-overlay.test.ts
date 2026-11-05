import {
  applyCustomSpotForecastGeometry,
  customSpotTerrainRatio,
} from '@/lib/services/custom-spot-analysis/forecast-overlay';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const forecast = {
  id: 'forecast', beach_id: 'nearest', forecast_at: '2026-08-28T12:00:00Z',
  forecast_date: '2026-08-28', forecast_time: '12:00:00', wave_height: '4.0 ft',
  wave_period: '14s', wave_direction: 'W', swell_1_height: '4 ft',
  swell_1_period: '14s', swell_1_direction: 'W', water_temp: null,
  confidence_score: 80, data_source: 'OPEN_METEO', created_at: '', updated_at: '',
} as EnhancedForecastEntity;

function beach(access: number, overrides: Partial<Beach> = {}): Beach {
  return {
    id: 'nearest', name: 'Beach', terrain_enabled: true, terrain_status: 'ok',
    swell_access_factors: Array(72).fill(access), wind_exposure_factors: Array(72).fill(1),
    swell_window_center_deg: 270, swell_window_halfwidth_deg: 45,
    ...overrides,
  } as Beach;
}

describe('custom spot forecast geometry', () => {
  it('is exactly neutral when the spot has the anchor terrain', () => {
    expect(customSpotTerrainRatio(forecast, beach(0.6), beach(0.6))).toBe(1);
    expect(applyCustomSpotForecastGeometry(forecast, beach(0.6), beach(0.6))).toBe(forecast);
  });

  it('scales the anchor height down when less swell reaches the spot, keeping its format', () => {
    const result = applyCustomSpotForecastGeometry(forecast, beach(0.1), beach(1));
    expect(result.wave_height).toMatch(/^\d+\.\d ft$/);
    expect(Number.parseFloat(result.wave_height ?? '')).toBeLessThan(4);
    expect(result.data_source).toBe(forecast.data_source);
  });

  it('reads compass directions from stored forecast rows', () => {
    expect(customSpotTerrainRatio(forecast, beach(0.1), beach(1))).toBeLessThan(1);
  });

  it('bounds the adjustment', () => {
    const ratio = customSpotTerrainRatio(forecast, beach(0.02), beach(1));
    expect(ratio).toBeGreaterThanOrEqual(0.5);
    expect(ratio).toBeLessThan(1);
  });

  it('leaves the forecast alone when the anchor has no terrain', () => {
    const anchor = beach(1, { terrain_enabled: false, swell_access_factors: null });
    expect(applyCustomSpotForecastGeometry(forecast, beach(0.1), anchor)).toBe(forecast);
  });

  it('leaves the forecast alone while analysis is unavailable', () => {
    const pending = beach(0.1, { terrain_status: 'queued' });
    expect(applyCustomSpotForecastGeometry(forecast, pending, beach(1))).toBe(forecast);
  });

  it('leaves the forecast alone when the global terrain kill switch is off', () => {
    const previous = process.env.TERRAIN_SCORING_ENABLED;
    process.env.TERRAIN_SCORING_ENABLED = 'false';
    try {
      expect(applyCustomSpotForecastGeometry(forecast, beach(0.1), beach(1))).toBe(forecast);
    } finally {
      if (previous === undefined) delete process.env.TERRAIN_SCORING_ENABLED;
      else process.env.TERRAIN_SCORING_ENABLED = previous;
    }
  });
});
