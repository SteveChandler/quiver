/**
 * @jest-environment node
 */

import {
  toForecastForScoring,
  type ForecastForScoring,
  type ConditionScore,
  type OptimalWindow,
  type MatchQuality,
  type RecommendationLabel,
  type ConditionSubscores,
  type WindowBoundaryReason,
  type WindowCalculatorOptions,
  type BeachWithThresholds,
} from '@/lib/scoring/types';
import type { EnhancedForecastEntity } from '@/types/forecast';

describe('toForecastForScoring', () => {
  it('converts EnhancedForecastEntity to ForecastForScoring', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: '3.5',
      wave_period: '12s',
      wind_speed: '8',
      wind_direction_deg: 90,
      wind_direction: 'E',
      tide_height: '2.5',
      tide_status: 'Rising',
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);

    expect(result.waveHeight).toBe(3.5);
    expect(result.wavePeriod).toBe(12);
    expect(result.windSpeed).toBe(8);
    expect(result.windDirection).toBe(90);
    expect(result.tideHeight).toBe(2.5);
    expect(result.tideStatus).toBe('rising');
  });

  it('parses cardinal wind direction when degrees missing', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: '3.5',
      wave_period: '12s',
      wind_speed: '8',
      wind_direction_deg: null,
      wind_direction: 'SW',
      tide_height: '2.5',
      tide_status: 'Falling',
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);

    expect(result.windDirection).toBe(225);
  });

  it('returns null for missing wind direction', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: '3.5',
      wave_period: '12s',
      wind_speed: '8',
      wind_direction_deg: null,
      wind_direction: null,
      tide_height: '2.5',
      tide_status: null,
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);

    expect(result.windDirection).toBeNull();
  });

  it('handles all 16 cardinal directions', () => {
    const cardinalExpected: Record<string, number> = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
      E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
      W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    };

    for (const [cardinal, expectedDeg] of Object.entries(cardinalExpected)) {
      const forecast: Partial<EnhancedForecastEntity> = {
        forecast_at: '2026-01-14T08:00:00Z',
        forecast_date: '2026-01-14',
        forecast_time: '08:00:00',
        wave_height: '3',
        wind_direction_deg: null,
        wind_direction: cardinal,
      };

      const result = toForecastForScoring(forecast as EnhancedForecastEntity);
      expect(result.windDirection).toBe(expectedDeg);
    }
  });

  it('normalizes wind direction degrees to 0-360 range', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: '3',
      wind_direction_deg: 450, // Should normalize to 90
      wind_direction: 'E',
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);
    expect(result.windDirection).toBe(90);
  });

  it('handles negative wind direction degrees', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: '3',
      wind_direction_deg: -90, // Should normalize to 270
      wind_direction: null,
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);
    expect(result.windDirection).toBe(270);
  });

  it('handles null/missing values with defaults', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: null,
      wave_period: null,
      wind_speed: null,
      tide_height: null,
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);

    expect(result.waveHeight).toBe(0);
    expect(result.wavePeriod).toBe(0);
    expect(result.windSpeed).toBe(0);
    expect(result.tideHeight).toBe(0);
  });

  it('parses wave_period with or without "s" suffix', () => {
    const withSuffix: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: '3',
      wave_period: '14s',
    };

    const withoutSuffix: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: '3',
      wave_period: '14',
    };

    expect(toForecastForScoring(withSuffix as EnhancedForecastEntity).wavePeriod).toBe(14);
    expect(toForecastForScoring(withoutSuffix as EnhancedForecastEntity).wavePeriod).toBe(14);
  });

  it('carries South OC/SanO guardrail confirmation for downstream board picks', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-06-02T18:00:00Z',
      forecast_date: '2026-06-02',
      forecast_time: '18:00:00',
      wave_height: '5ft',
      wave_period: '8s',
      swell_1_direction: 'W',
      raw_forecast: {
        data_sources: ['NOAA_NWS'],
        wave_height_provenance: {
          source: 'nowcast_anchor',
          provenance: 'measured',
          raw_value_ft: 3.08,
          station_id: '46285',
          transform_path: 'scalar_calibrated',
          components_used: false,
          calibrated_shoaling_fired: true,
          south_oc_sano_guardrail: {
            zone: 'south_oc_sano_shadow_zone',
            branch: 'trestles_calibrated_anchor',
            height_floor_applied: true,
            station_ids_used: ['46285'],
            station_ages_minutes: { '46285': 30 },
            confirmed_nearshore_hs_m: 1.0,
            confirmed_nearshore_hs_ft: 3.28,
            confirmed_period_s: 17,
            confirmed_direction_deg: 203,
            offshore_context_station_id: '46277',
            offshore_context_hs_m: 0.9,
            offshore_context_age_minutes: 25,
          },
        },
      },
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);

    expect(result.wavePeriod).toBe(8);
    expect(result.swellDirection).toBe(270);
    expect(result.southOcSanoGuardrail).toEqual({
      branch: 'trestles_calibrated_anchor',
      confirmedPeriodS: 17,
      confirmedDirectionDeg: 203,
    });
  });

  it('creates valid Date from forecast_date and forecast_time', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T15:30:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '15:30:00',
      wave_height: '3',
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);

    expect(result.forecastTime).toBeInstanceOf(Date);
    expect(result.forecastTime.toISOString()).toBe('2026-01-14T15:30:00.000Z');
  });

  it('returns null for unrecognized cardinal direction', () => {
    const forecast: Partial<EnhancedForecastEntity> = {
      forecast_at: '2026-01-14T08:00:00Z',
      forecast_date: '2026-01-14',
      forecast_time: '08:00:00',
      wave_height: '3',
      wind_direction_deg: null,
      wind_direction: 'INVALID',
    };

    const result = toForecastForScoring(forecast as EnhancedForecastEntity);
    expect(result.windDirection).toBeNull();
  });
});

describe('Type definitions', () => {
  it('MatchQuality has correct values', () => {
    const values: MatchQuality[] = ['perfect', 'excellent', 'good', 'fair', 'minimal', 'skip'];
    expect(values).toHaveLength(6);
  });

  it('RecommendationLabel has correct values', () => {
    const values: RecommendationLabel[] = ['Worth it', 'Maybe', 'Skip'];
    expect(values).toHaveLength(3);
  });

  it('ConditionScore interface is correctly shaped', () => {
    const score: ConditionScore = {
      total: 85,
      subscores: {
        waveHeightFit: 20,
        periodEnergy: 25,
        windAlignment: 25,
        tideFit: 15,
      },
      matchQuality: 'excellent',
      recommendationLabel: 'Worth it',
      reasons: ['Good swell direction', 'Clean wind'],
      warnings: ['Watch for afternoon wind'],
      message: 'Great morning conditions expected',
      character: { category: 'medium-clean', label: 'Dialed — everything\'s lining up' },
      swellQualityBoost: 0,
    };

    expect(score.total).toBe(85);
    expect(score.subscores.waveHeightFit).toBe(20);
    expect(score.matchQuality).toBe('excellent');
    expect(score.character.category).toBe('medium-clean');
    expect(score.swellQualityBoost).toBe(0);
  });

  it('OptimalWindow interface is correctly shaped', () => {
    const now = new Date();
    const later = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const window: OptimalWindow = {
      start: now,
      end: later,
      startReason: {
        time: now,
        factor: 'tide',
        description: 'Rising tide improves conditions',
      },
      endReason: {
        time: later,
        factor: 'wind',
        description: 'Onshore wind picks up',
      },
      message: 'Best window is 6am to 10am',
      peakTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    };

    expect(window.start).toBeInstanceOf(Date);
    expect(window.end).toBeInstanceOf(Date);
    expect(window.startReason.factor).toBe('tide');
    expect(window.endReason.factor).toBe('wind');
  });

  it('WindowCalculatorOptions interface is correctly shaped', () => {
    const options: WindowCalculatorOptions = {
      horizonHours: 12,
      sunsetTime: new Date('2026-01-14T17:30:00Z'),
      minScoreThreshold: 60,
      minSessionHours: 1.5,
    };

    expect(options.horizonHours).toBe(12);
    expect(options.minScoreThreshold).toBe(60);
  });
});
