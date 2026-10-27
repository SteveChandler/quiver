/**
 * @jest-environment node
 */

import { beachToSpotProfile, getDiscoveryScoringEngine } from '@/lib/domains/scoring';
import { runWithScoringMemo } from '@/lib/domains/scoring/scoring-memo-scope';
import { scoreWindowWithComposite } from '@/lib/services/discovery/window-selector/window-scorer';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const beach = {
  id: 'beach-memo',
  name: 'Memo Point',
  lat: 32.8,
  lon: -117.27,
  timezone: 'America/Los_Angeles',
  break_type: 'reef',
  aspect_deg: 270,
  wind_offshore_deg: 90,
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 4,
} as unknown as Beach;

const forecast = {
  id: 'row-1',
  beach_id: 'beach-memo',
  forecast_at: '2026-10-27T15:00:00.000Z',
  wave_height: '3.0 ft',
  wave_period: '13s',
  swell_1_height: '2.8 ft',
  swell_1_period: '13s',
  swell_1_direction: 'WNW',
  wind_speed: '4 mph',
  wind_direction: 'E',
  wind_direction_deg: 90,
  tide_height: '2.5 ft',
  tide_status: 'Rising',
  confidence_score: 80,
} as unknown as EnhancedForecastEntity;

describe('request-scoped scoring memo', () => {
  let scoreSpy: jest.SpyInstance;

  beforeEach(() => {
    const engine = getDiscoveryScoringEngine();
    scoreSpy = jest.spyOn(engine, 'score');
  });

  afterEach(() => scoreSpy.mockRestore());

  it('scores every call outside a scope', () => {
    const first = scoreWindowWithComposite(forecast, beach);
    const second = scoreWindowWithComposite(forecast, beach);

    expect(scoreSpy).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
    expect(beachToSpotProfile(beach)).not.toBe(beachToSpotProfile(beach));
  });

  it('scores a (row, beach) pair once inside a scope, with the same result', async () => {
    const unscoped = scoreWindowWithComposite(forecast, beach);
    scoreSpy.mockClear();

    await runWithScoringMemo(async () => {
      const first = scoreWindowWithComposite(forecast, beach);
      await Promise.resolve();
      const second = scoreWindowWithComposite(forecast, beach);
      expect(second).toBe(first);
      expect(first).toEqual(unscoped);
      expect(beachToSpotProfile(beach)).toBe(beachToSpotProfile(beach));
    });

    expect(scoreSpy).toHaveBeenCalledTimes(1);
  });

  it('keys on objects, so a copied beach or row is scored on its own', async () => {
    await runWithScoringMemo(async () => {
      scoreWindowWithComposite(forecast, beach);
      scoreWindowWithComposite(forecast, { ...beach, preferred_tide_ft_max: 2 } as Beach);
      scoreWindowWithComposite({ ...forecast, tide_height: '6.0 ft' }, beach);
    });

    expect(scoreSpy).toHaveBeenCalledTimes(3);
  });

  it('rescores in a new scope, so nothing carries over between requests', async () => {
    const results = [];
    for (const flag of [undefined, 'true']) {
      if (flag) process.env.TIDE_SWING_ENABLED = flag;
      results.push(await runWithScoringMemo(async () => scoreWindowWithComposite(forecast, beach)));
    }
    delete process.env.TIDE_SWING_ENABLED;

    expect(scoreSpy).toHaveBeenCalledTimes(2);
    expect(results[1]).not.toBe(results[0]);
  });

  it('shares the outer scope with a nested one', async () => {
    await runWithScoringMemo(async () => {
      const outer = scoreWindowWithComposite(forecast, beach);
      const inner = await runWithScoringMemo(async () => scoreWindowWithComposite(forecast, beach));
      expect(inner).toBe(outer);
    });

    expect(scoreSpy).toHaveBeenCalledTimes(1);
  });
});
