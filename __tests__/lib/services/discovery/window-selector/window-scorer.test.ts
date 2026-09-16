import {
  scoreWindowConditionDetails,
} from '@/lib/services/discovery/window-selector/window-scorer';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

function beach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: 'beach-1', name: 'Church', slug: 'church', shoaling_factors: {},
    wind_offshore_deg: 90, wind_offshore_tol_deg: 45,
    swell_window_center_deg: 218, swell_window_halfwidth_deg: 118,
    break_type: 'beach', aspect_deg: 270,
    ...overrides,
  } as Beach;
}

function forecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: 'forecast-1', beach_id: 'beach-1', forecast_at: '2026-05-01T18:00:00Z',
    wave_height: '2 ft', wave_period: '9s', swell_1_period: '9s',
    swell_1_direction: 'SSW', wind_speed: '8 mph', wind_direction: 'W',
    tide_height: '3 ft', tide_status: 'Rising', data_source: 'NOAA_NWS',
    ...overrides,
  } as EnhancedForecastEntity;
}

describe('direction scoring window scorer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DIRECTION_SCORING_ENABLED: 'true' };
    delete process.env.DIRECTION_SCORING_ALLOWED_SLUGS;
    delete process.env.DIRECTION_SCORING_EXCLUDED_SLUGS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('changes wind and swell direction scores while leaving excluded beaches unchanged', () => {
    const aligned = scoreWindowConditionDetails(
      forecast({ swell_1_direction: 'SSW', wind_direction: 'E' }), beach(), 'intermediate', null, [],
    );
    const poor = scoreWindowConditionDetails(
      forecast({ wave_height: '3 ft', swell_1_direction: 'WNW', wind_direction: 'W', wind_speed: '8 mph' }), beach(), 'intermediate', null, [],
    );
    const excluded = scoreWindowConditionDetails(
      forecast({ swell_1_direction: 'WNW', wind_direction: 'W' }), beach({ slug: 'avalanche' }), 'intermediate', null, [],
    );

    expect(aligned.score).toBeGreaterThan(poor.score);
    expect(poor.appliedEffects).toContain('wind_chop');
    expect(excluded.appliedEffects).not.toContain('wind_chop');
  });

  it('keeps missing directions neutral and flag-off output legacy', () => {
    const missing = scoreWindowConditionDetails(
      forecast({ swell_1_direction: null, wind_direction: null }), beach(), 'intermediate', null, [],
    );
    const enabled = scoreWindowConditionDetails(
      forecast({ wave_period: '13s', swell_1_period: '13s', swell_1_direction: 'SSW' }),
      beach(), 'intermediate', null, [],
    );
    process.env.DIRECTION_SCORING_ENABLED = 'false';
    const disabled = scoreWindowConditionDetails(forecast(), beach(), 'intermediate', null, [],);

    expect(missing.components.windQuality).toBe(missing.components.wind);
    expect(missing.components.swellAlignment).toBe(15);
    expect(disabled.components.windQuality).toBeUndefined();
    expect(disabled.components.swellAlignment).toBeUndefined();
    expect(enabled.components.windQuality).not.toBeUndefined();
  });
});
