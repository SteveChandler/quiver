/**
 * @jest-environment node
 *
 * Missing wind is unknown, not calm. Forecast rows now store null wind when
 * the source has none (e.g. no NWS point for Mexican beaches), so every
 * consumer must score a null speed at its neutral midpoint, never as glassy,
 * and must never fabricate a direction. A real calm (0 mph, no direction,
 * which is how NWS reports calm) still scores as calm on speed alone.
 */

jest.mock('date-fns/format', () => (date: Date) => date.toISOString().slice(0, 10));

import { scoreForecastSlots } from '@/app/api/forecasts/scored/[beachId]/route';
import { forecastToSnapshot } from '@/lib/domains/scoring/discovery-adapter';
import { calculateRideableWaves } from '@/lib/domains/wave-frequency/calculator';
import { windAt, analyzeWindConditions } from '@/lib/analyzers/wind-analyzer';
import { getConditionCharacter } from '@/lib/domains/scoring/condition-character';
import { windQualityScorer } from '@/lib/domains/scoring/scorers/wind-quality-scorer';
import type { CompositeScore } from '@/lib/domains/scoring';
import { comparisonLine, windPhrase } from '@/lib/notifications/copy/daily-call-copy';
import { findNextBestWindow } from '@/lib/scorers/session-window-scorer';
import { fitConditions, pickReasonText } from '@/lib/scoring/conditions-board-fit';
import {
  nativeScoreInputsFromForecast,
  scoreNativeConditionBreakdown,
} from '@/lib/scoring/native-condition-score';
import { toForecastForScoring } from '@/lib/scoring/types';
import { calculateOptimalWindow } from '@/lib/scoring/window-calculator';
import {
  calculateWindScore,
  findMagicHour,
  type BeachMetadata,
} from '@/lib/services/magic-hour';
import { generateConditionBadges } from '@/lib/services/discovery/surf-discovery-orchestrator';
import { scoreForecastWindow } from '@/lib/services/discovery/window-selector/window-scorer';
import { enrichDaySummaries } from '@/lib/utils/enriched-day-summary';
import type { DaySummary } from '@/lib/utils/horizon-strip-utils';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { createBeach, createForecast, createProfile, createSnapshot, createSwell } from '../domains/__fixtures__';

const noWind = { wind_speed: null, wind_direction: null, wind_direction_deg: null };
const calm = { wind_speed: '0 mph', wind_direction: null, wind_direction_deg: null };

const forecast = (overrides: Partial<EnhancedForecastEntity>): EnhancedForecastEntity =>
  createForecast(overrides) as unknown as EnhancedForecastEntity;

describe('enriched day summary', () => {
  const day: DaySummary = {
    date: 'Jan 14', dayName: 'Wed', minHeight: 3, maxHeight: 4,
    tier: 'good', score: 65, fullDate: '2026-01-14', isToday: false,
    bestTime: '12:00', period: 12,
  };
  const summary = (overrides: Partial<EnhancedForecastEntity>) =>
    enrichDaySummaries([day], [forecast({
      forecast_at: '2026-01-14T12:00:00Z', forecast_date: '2026-01-14',
      forecast_time: '12:00', ...overrides,
    })])[0];

  it('labels missing wind unknown even when a direction is present', () => {
    expect(summary({ wind_speed: null, wind_direction: 'E' }).windConditions).toBe('unknown');
    expect(summary({ wind_speed: null, wind_direction: 'E' }).windSpeed).toBeNull();
  });

  it('keeps a real 0 mph wind light without a direction', () => {
    expect(summary(calm).windConditions).toBe('light');
    expect(summary(calm).windSpeed).toBe('0 mph');
  });
});

describe('wind analyzer', () => {
  const row = (speed: number | null, direction: number | null) => [{
    forecast_at: '2026-01-14T12:00:00Z', forecast_date: '2026-01-14',
    forecast_time: '12:00', wind_speed: speed, wind_direction: direction,
  }];

  it('keeps missing or non-finite wind unknown and does not infer north', () => {
    for (const speed of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const wind = windAt('12:00', row(speed, null), 'UTC');
      expect(wind).toMatchObject({ cardinal: 'N/A', offshore: false, description: 'N/A' });
      expect(analyzeWindConditions(wind, { name: 'Test Beach', windOffshoreDeg: 270 }).message)
        .toBe('Wind unknown');
    }
    const directionless = windAt('12:00', row(8, null), 'UTC');
    expect(directionless).toMatchObject({
      cardinal: 'N/A', offshore: false, description: '8 mph wind',
    });
    expect(analyzeWindConditions(directionless, { name: 'Test Beach', windOffshoreDeg: 270 }).message)
      .toBe('Moderate winds (8 mph)');
  });

  it('keeps a real calm with no direction calm', () => {
    expect(windAt('12:00', row(0, null), 'UTC')).toMatchObject({
      speed: 0, cardinal: 'N/A', offshore: false, description: 'calm',
    });
  });
});

describe('wave frequency wind penalty', () => {
  const beach = createBeach({ aspect_deg: 270, break_type: 'beach' }) as unknown as Beach;
  const rideable = (speed: string | null) => calculateRideableWaves(
    forecast({ wind_speed: speed, wind_direction: 'W', wind_direction_deg: 270 }), beach,
  ).rideableWavesPerHour;

  it('applies no wind penalty when speed is unknown', () => {
    expect(rideable(null)).toBe(rideable('0 mph'));
    expect(rideable(null)).toBeGreaterThan(rideable('25 mph'));
  });

  it('keeps a real 0 mph wind unpenalized', () => {
    expect(rideable('0 mph')).toBeGreaterThan(rideable('25 mph'));
  });
});

describe('board pick / window calculator (toForecastForScoring)', () => {
  const beach = createBeach() as unknown as Beach;
  const peakScore = (windSpeed: string | null): number | undefined => {
    const rows = [6, 7, 8, 9].map((hour) =>
      toForecastForScoring(forecast({
        forecast_at: `2026-01-14T${String(hour).padStart(2, '0')}:00:00Z`,
        wave_height: '3.5 ft',
        wave_period: '12s',
        wind_speed: windSpeed,
        wind_direction: null,
        wind_direction_deg: null,
      })),
    );
    return calculateOptimalWindow(rows, beach, { minScoreThreshold: 1 })?.peakScore;
  };

  it('keeps a missing speed unknown and scores it between calm and blown out', () => {
    expect(toForecastForScoring(forecast(noWind)).windSpeed).toBeNull();

    const unknown = peakScore(null)!;
    expect(unknown).toBeLessThan(peakScore('0 mph')!);
    expect(unknown).toBeGreaterThan(peakScore('30 mph')!);
  });

  it('keeps calm as 0 mph with no direction', () => {
    const row = toForecastForScoring(forecast(calm));
    expect(row.windSpeed).toBe(0);
    expect(row.windDirection).toBeNull();
  });
});

describe('native condition score', () => {
  const inputs = (windSpeedMph: number | null) => ({
    waveHeightFt: 3,
    windSpeedMph,
    periodSec: 12,
    tideHeightFt: 3,
    tideStatus: 'rising',
  });
  const onshore = {
    windDirectionDeg: 270,
    swellDirectionDeg: null,
    offshoreDeg: 90,
    offshoreToleranceDeg: 45,
    windowCenterDeg: null,
    windowHalfwidthDeg: null,
  };

  it('scores a missing speed at the midpoint of the 0-25 wind points', () => {
    expect(nativeScoreInputsFromForecast(forecast(noWind)).windSpeedMph).toBeNull();
    expect(scoreNativeConditionBreakdown(inputs(null)).components.wind).toBe(12.5);
    // Direction cannot judge a wind whose strength is unknown.
    expect(scoreNativeConditionBreakdown(inputs(null), null, null, onshore).components.windQuality).toBe(12.5);
  });

  it('scores calm with no direction as full wind points', () => {
    expect(nativeScoreInputsFromForecast(forecast(calm)).windSpeedMph).toBe(0);
    expect(scoreNativeConditionBreakdown(inputs(0)).components.wind).toBe(25);
  });
});

describe('discovery adapter -> wind quality scorer', () => {
  const score = (overrides: Partial<EnhancedForecastEntity>) =>
    windQualityScorer.score({
      snapshot: forecastToSnapshot(forecast(overrides)),
      profile: createProfile(),
      window: null,
      preferences: null,
    });

  it('scores a missing speed at 50 with no glassy reason', () => {
    expect(forecastToSnapshot(forecast(noWind)).wind.speedMph).toBeNull();
    const result = score(noWind);
    expect(result.score).toBe(50);
    expect(result.skip).toBe(false);
    expect(result.reasons).not.toContain('Glassy conditions');

    // Known onshore direction, unknown speed: still unknown, no onshore penalty.
    expect(score({ wind_speed: null, wind_direction: 'W', wind_direction_deg: 270 }).score).toBe(50);
  });

  it('scores calm with no direction as glassy', () => {
    const result = score(calm);
    expect(result.score).toBe(100);
    expect(result.reasons).toContain('Glassy conditions');
  });
});

describe('condition character', () => {
  const composite: CompositeScore = {
    total: 0,
    subscores: new Map([['windQuality', 50], ['tideFit', 80]]),
    matchQuality: 'fair',
    reasons: [],
    warnings: [],
    skipReason: null,
    confidence: 80,
  };
  const smallDay = (speedMph: number | null) =>
    getConditionCharacter(
      createSnapshot({
        waveHeight: 1.5,
        wavePeriod: 9,
        waveDirection: 270,
        primarySwell: createSwell(1.5, 9, 270),
        wind: { speedMph, directionDeg: null },
      }),
      createProfile(),
      composite,
    );

  it('does not call a small day glassy when the wind is unknown', () => {
    const character = smallDay(null);
    expect(character.category).not.toBe('small-clean');
    expect(character.label).not.toMatch(/glassy/i);
  });

  it('still calls a calm small day clean', () => {
    expect(smallDay(0).category).toBe('small-clean');
  });
});

describe('window selector (scoreForecastWindow)', () => {
  // Wave 20 + period 20 + tide 15 are fixed; wind is 0-20 points.
  const beach = createBeach({ wind_offshore_deg: 90, wind_offshore_tol_deg: 30 }) as unknown as Beach;

  it('gives a missing speed the 10-point midpoint, even with an offshore direction', () => {
    expect(scoreForecastWindow(forecast(noWind), beach, null)).toBe(65);
    expect(
      scoreForecastWindow(forecast({ wind_speed: null, wind_direction: 'E', wind_direction_deg: 90 }), beach, null),
    ).toBe(65);
  });

  it('scores calm with no direction on speed alone', () => {
    expect(scoreForecastWindow(forecast(calm), beach, null)).toBe(70);
  });
});

describe('discovery condition badges', () => {
  const beach = createBeach({ wind_offshore_deg: 90 }) as unknown as Beach;
  const subscores = { waveHeightFit: 20, periodEnergyScore: 15, windAlignment: 18, tideFit: 10 };
  const labels = (overrides: Partial<EnhancedForecastEntity>) =>
    generateConditionBadges(forecast(overrides), beach, subscores).map((badge) => badge.label);

  it('shows no wind badge when the speed is unknown', () => {
    expect(labels(noWind)).not.toContain('Glass');
    expect(labels({ wind_speed: null, wind_direction: 'E', wind_direction_deg: 90 })).not.toContain('Light Offshore');
  });

  it('still shows Glass for calm', () => {
    expect(labels(calm)).toContain('Glass');
  });
});

describe('scored forecast route', () => {
  // South-facing beach: a fabricated 0 deg (N) wind would read as offshore.
  const beach = createBeach({ aspect_deg: 180 } as Partial<Beach>) as unknown as Beach;

  it('returns unknown wind as null, not 0 mph / 0 deg / offshore', () => {
    const [slot] = scoreForecastSlots([forecast(noWind)], beach, 'intermediate');
    expect(slot.windSpeed).toBeNull();
    expect(slot.windDirectionDeg).toBeNull();
    expect(slot.isOffshore).toBe(false);
    expect(slot.scoreComponents?.wind).toBe(12.5);
  });

  it('returns calm as 0 mph with no direction', () => {
    const [slot] = scoreForecastSlots([forecast(calm)], beach, 'intermediate');
    expect(slot.windSpeed).toBe(0);
    expect(slot.windDirectionDeg).toBeNull();
    expect(slot.isOffshore).toBe(false);
    expect(slot.scoreComponents?.wind).toBe(25);
  });
});

describe('magic hour', () => {
  const beach: BeachMetadata = {
    id: 'b',
    name: 'B',
    slug: 'b',
    skill_level: null,
    swell_window_center_deg: null,
    swell_window_halfwidth_deg: null,
    wind_offshore_deg: 0,
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: null,
    preferred_tide_ft_max: null,
    timezone: 'UTC',
  };

  it('scores a missing direction at the 0.55 midpoint with no wind quality label', () => {
    expect(calculateWindScore(null, 0, 30)).toBe(0.55);

    const result = findMagicHour(
      [{
        id: 'f', beach_id: 'b', forecast_at: '2026-01-14T12:00:00Z', forecast_date: '2026-01-14',
        forecast_time: '12:00', wave_height: '3 ft', wave_period: '12s', wave_direction: 'W',
        wind_speed: null, wind_direction_deg: null, tide_height: '3 ft',
        created_at: '2026-01-14T00:00:00Z', updated_at: '2026-01-14T00:00:00Z',
      }],
      beach,
      { targetDate: new Date('2026-01-14T10:00:00Z') },
    );
    expect(result.found).toBe(true);
    expect(result.windQuality).toBeNull();
    // tide 1 * 0.4 + wind 0.55 * 0.35 + swell 1 * 0.25
    expect(result.confidence).toBeCloseTo(0.8425, 6);
  });
});

describe('morning intel session window', () => {
  const now = new Date('2026-01-14T08:00:00Z');
  const slot = (time: string, windSpeed: number | null, windDirection: number | null) => ({
    forecast_at: `2026-01-14T${time}:00Z`,
    forecast_time: time,
    forecast_date: '2026-01-14',
    wind_speed: windSpeed,
    wind_direction: windDirection,
    wave_period: null,
    swell_1_period: null,
    tide_height: null,
  });

  it('scores a missing speed at the midpoint without claiming light or offshore wind', () => {
    // Wind is the only scored factor here: neutral 20 meets the 20-point floor.
    const window = findNextBestWindow([slot('12:00', null, null)], now, 270);
    expect(window?.startTime).toBe('12:00');
    expect(window?.conditions).toBe('Wind unknown');
  });

  it('does not rank an unknown wind above light offshore', () => {
    const window = findNextBestWindow([slot('12:00', null, null), slot('13:00', 3, 270)], now, 270);
    expect(window?.startTime).toBe('13:00');
  });

  it('scores a real calm with no direction as light wind', () => {
    const window = findNextBestWindow([slot('12:00', 0, null)], now, 270);
    expect(window?.startTime).toBe('12:00');
    expect(window?.conditions).toMatch(/^Light winds/);
  });
});

describe('daily call copy', () => {
  it('never claims light wind or less wind from a missing speed', () => {
    expect(windPhrase({ wind_speed: null })).toBe('wind unknown');
    expect(windPhrase({ wind_speed: '0 mph' })).toBe('light wind');

    const home = { name: 'OB Pier', forecast: { wave_height: '2.8', wave_period: '11', wind_speed: '12' }, minutes: 180 };
    expect(comparisonLine({ forecast: { wave_height: '2.8', wave_period: '11', wind_speed: null }, minutes: 180 }, home))
      .toBe('Rated higher than OB Pier today');
  });
});

describe('board fit reason (recommendBoard)', () => {
  const beach = { wind_offshore_deg: 90, preferred_tide_ft_min: 1, preferred_tide_ft_max: 4, break_type: 'beach' };
  const reason = (overrides: Record<string, unknown>) =>
    pickReasonText(
      fitConditions({ wave_height: '3 ft', wave_period: '12s', tide_height: null, ...overrides }, beach, null)!,
      'intermediate',
      'Twin pin',
      'fish',
      false,
    );

  it('makes no wind claim when the speed is unknown', () => {
    expect(reason(noWind)).not.toMatch(/glassy|clean offshore|choppy/);
  });

  it('still calls calm glassy', () => {
    expect(reason(calm)).toMatch(/glassy faces/);
  });
});
