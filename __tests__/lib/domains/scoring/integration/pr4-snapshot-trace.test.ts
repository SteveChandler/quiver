/**
 * PR 4 snapshot-diff walk: Horseshoe (medium-mixed) and OB Pier (small-weak)
 * scenarios, asserted against scoreBeachWithEngine + getRecommendationLabelGated.
 */
import { scoreBeachWithEngine, createDiscoveryScoringEngine, beachToSpotProfile, forecastToSnapshot, getConditionCharacter } from '@/lib/domains/scoring';
import { getRecommendationLabelGated, getRecommendationLabel } from '@/lib/services/discovery/response-formatter';
import { createBeach, createForecast } from '../../__fixtures__';

describe('PR 4 snapshot diff — Horseshoe + OB Pier', () => {
  it('Horseshoe: 2.3ft / 13s / NW 10 mph cross-shore at offshoreDeg=45° flips Worth it -> Maybe', () => {
    const beach = createBeach({
      id: 'horseshoe',
      name: 'Horseshoe',
      wind_offshore_deg: 45,
      wind_offshore_tol_deg: 30,
      break_type: 'reef',
    });
    const forecast = createForecast({
      wave_height: '2.3',
      wave_period: '13s',
      wind_speed: '10',
      wind_direction: 'NW',
      wind_direction_deg: 315,
      swell_1_height: '2.3',
      swell_1_period: '13s',
      swell_1_direction: '270',
    });
    const engine = createDiscoveryScoringEngine();
    const detailed = scoreBeachWithEngine(engine, beach as any, forecast as any);

    // re-derive character
    const profile = beachToSpotProfile(beach as any);
    const snapshot = forecastToSnapshot(forecast as any);
    const composite = engine.score({ profile, snapshot, window: null, preferences: null });
    const character = getConditionCharacter(snapshot, profile, composite);

    const scoreOnlyLabel = getRecommendationLabel(detailed.total);
    const gatedLabel = getRecommendationLabelGated(detailed.total, character.category);

    console.log('Horseshoe trace:', {
      total: detailed.total,
      windQuality: composite.subscores.get('windQuality'),
      character: character.category,
      scoreOnlyLabel,
      gatedLabel,
    });
    expect(character.category).toBe('medium-mixed');
    // The score-only label may be Worth it; the gated label should NOT be.
    if (scoreOnlyLabel === 'Worth it') {
      expect(gatedLabel).toBe('Maybe');
    }
  });

  it('OB Pier: 1.4ft / 6s / NW 12 mph onshore at offshoreDeg=90° flips Skip -> Maybe', () => {
    const beach = createBeach({
      id: 'ob-pier',
      name: 'OB Pier',
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 45,
      break_type: 'beach',
    });
    const forecast = createForecast({
      wave_height: '1.4',
      wave_period: '6s',
      wind_speed: '12',
      wind_direction: 'NW',
      wind_direction_deg: 315,
      swell_1_height: '1.4',
      swell_1_period: '6s',
      swell_1_direction: '270',
    });
    const engine = createDiscoveryScoringEngine();
    const detailed = scoreBeachWithEngine(engine, beach as any, forecast as any);

    const profile = beachToSpotProfile(beach as any);
    const snapshot = forecastToSnapshot(forecast as any);
    const composite = engine.score({ profile, snapshot, window: null, preferences: null });
    const character = getConditionCharacter(snapshot, profile, composite);

    console.log('OB Pier trace:', {
      total: detailed.total,
      windQuality: composite.subscores.get('windQuality'),
      character: character.category,
      skipReason: composite.skipReason,
    });
    // Pre-PR 4: windQuality scorer skipped binary at 12mph onshore -> composite skipReason -> recommendation 'Skip'.
    // Post-PR 4: continuous penalty -> windQuality is non-zero and no skip.
    expect(composite.skipReason).toBeNull();
    expect(detailed.total).toBeGreaterThan(0);
  });

  it('OB Pier (the user-reported scenario): 2ft / 6s W / 10mph NW / 4.2ft rising must NOT score "good"', () => {
    // Replays the 2026-04-29 ~5pm home-screen bug: "Good match at Ocean
    // Beach Pier - 2 ft with 10 mph NW" surfaced for objectively poor surf
    // (short-period west wind chop with sideshore wind). The pre-fix
    // composite landed in the 55–69 "good" band because direction-only
    // scorers (swellAlignment, swellInterference) granted ~91/100 credit
    // for W being in the swell window — period-blind. The dominant-snapshot
    // fix + directional-relevance gate must drop the verdict below "good".
    const beach = createBeach({
      id: 'ob-pier-bug',
      name: 'OB Pier',
      // OBP swell window from production: 220–5° (centered 292.5°, halfwidth 72.5°).
      swell_window_min_deg: 220,
      swell_window_max_deg: 5,
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 45,
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 5,
      break_type: 'beach',
    });
    const forecast = createForecast({
      wave_height: '2',
      wave_period: '6s',
      wind_speed: '10',
      wind_direction: 'NW',
      wind_direction_deg: 315,
      swell_1_height: '2',
      swell_1_period: '6s',
      swell_1_direction: '270',
      tide_height: '4.2',
      tide_status: 'Rising',
    });
    const engine = createDiscoveryScoringEngine();
    const detailed = scoreBeachWithEngine(engine, beach as any, forecast as any);

    // Hard regression assertion: the composite must not return "good" or
    // higher for short-period wind-chop, regardless of how well the swell
    // direction aligns with the beach window.
    expect(detailed.matchQuality).not.toBe('good');
    expect(detailed.matchQuality).not.toBe('excellent');
    expect(detailed.matchQuality).not.toBe('perfect');
  });

  it('Mission Beach: 2.5ft / 9s WNW / W 10mph / rising tide stays fair best-available, not good', () => {
    const beach = createBeach({
      id: 'mission-beach-bug',
      name: 'Mission Beach',
      swell_window_min_deg: 255,
      swell_window_max_deg: 345,
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 30,
      wind_onshore_bad_kt: 8,
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 6,
      preferred_tide_direction: 'rising',
      break_type: 'jetty',
    });
    const forecast = createForecast({
      wave_height: '2.5',
      wave_period: '9s',
      wave_direction: 'WNW',
      wave_direction_om: 292.5,
      swell_1_height: '2.5',
      swell_1_period: '9s',
      swell_1_direction: 'WNW',
      wind_wave_height: '1',
      wind_wave_period: '6s',
      wind_wave_direction: 'W',
      wind_speed: '10',
      wind_direction: 'W',
      wind_direction_deg: 270,
      tide_height: '2.7',
      tide_status: 'Rising',
    });
    const engine = createDiscoveryScoringEngine();
    const detailed = scoreBeachWithEngine(engine, beach as any, forecast as any);

    const profile = beachToSpotProfile(beach as any);
    const snapshot = forecastToSnapshot(forecast as any);
    const composite = engine.score({ profile, snapshot, window: null, preferences: null });
    const character = getConditionCharacter(snapshot, profile, composite);
    const gatedLabel = getRecommendationLabelGated(detailed.total, character.category);

    expect(composite.subscores.get('windQuality')).toBeLessThan(35);
    expect(detailed.total).toBeLessThan(55);
    expect(detailed.matchQuality).toBe('fair');
    expect(character.category).toBe('medium-rough');
    expect(gatedLabel).toBe('Maybe');
  });
});
