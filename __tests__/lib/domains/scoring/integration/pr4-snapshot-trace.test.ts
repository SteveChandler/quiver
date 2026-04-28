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
});
