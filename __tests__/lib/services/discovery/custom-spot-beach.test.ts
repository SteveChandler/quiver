import {
  anchorForTerrainRatio,
  buildCustomSpotBeach,
  type CustomSpotDiscoveryRow,
} from '@/lib/services/discovery/surf-discovery-orchestrator';
import type { Beach } from '@/types/database';

const nearest = {
  id: 'nearest', name: 'Nearest Beach', lat: 32, lon: -117,
  swell_window_min_deg: 180, swell_window_max_deg: 270,
  swell_window_center_deg: 225, swell_window_halfwidth_deg: 45,
  aspect_deg: 225, wind_offshore_deg: 45,
  swell_access_factors: Array(72).fill(1), wind_exposure_factors: Array(72).fill(1),
  terrain_enabled: true, terrain_method: 'dem_horizon_v1', terrain_status: 'ok',
} as unknown as Beach;

function spot(overrides: Partial<CustomSpotDiscoveryRow> = {}): CustomSpotDiscoveryRow {
  return {
    id: 'custom', user_id: 'user', name: 'Private Peak', lat: 32.1, lon: -117.1,
    visibility: 'private', nearest_beach_id: 'nearest', nearest_beach_distance_mi: 1,
    break_type: 'reef', facing_direction_deg: 0, swell_window_min_deg: 350,
    swell_window_max_deg: 10, offshore_direction_deg: 180, exposure_level: 'sheltered',
    swell_access_factors: Array(72).fill(0.4), wind_exposure_factors: Array(72).fill(0.5),
    terrain_method: 'dem_horizon_v1', terrain_params: {}, terrain_params_hash: 'hash',
    terrain_analyzed_at: '2026-08-28T12:00:00.000Z', terrain_status: 'ok',
    fingerprint_model_version: 'custom_spot_terrain_v1', deleted_at: null,
    ...overrides,
  };
}

describe('buildCustomSpotBeach', () => {
  it('uses current modeled terrain and the spot geometry', () => {
    const beach = buildCustomSpotBeach(spot(), nearest);
    expect(beach.swell_access_factors).toEqual(Array(72).fill(0.4));
    expect(beach.wind_exposure_factors).toEqual(Array(72).fill(0.5));
    expect(beach.terrain_status).toBe('ok');
    expect(beach.aspect_deg).toBe(0);
    expect(beach.swell_window_center_deg).toBe(0);
    expect(beach.swell_window_halfwidth_deg).toBe(10);
  });

  it.each([
    { terrain_status: 'queued' },
    { fingerprint_model_version: 'custom_spot_terrain_v0' },
    { swell_access_factors: [0.4] },
    { wind_exposure_factors: null },
  ])('keeps the nearest beach terrain when the modeled result is not usable: %j', (overrides) => {
    const beach = buildCustomSpotBeach(spot(overrides), nearest);
    expect(beach.swell_access_factors).toBe(nearest.swell_access_factors);
    expect(beach.wind_exposure_factors).toBe(nearest.wind_exposure_factors);
    expect(beach.terrain_method).toBe(nearest.terrain_method);
  });

  it('falls back to the nearest beach orientation when the spot has none', () => {
    const beach = buildCustomSpotBeach(
      spot({ facing_direction_deg: null, offshore_direction_deg: null }),
      nearest,
    );
    expect(beach.aspect_deg).toBe(225);
    expect(beach.wind_offshore_deg).toBe(45);
  });
});

describe('anchorForTerrainRatio', () => {
  const reference = { swell_access_factors: Array(72).fill(0.6), wind_exposure_factors: Array(72).fill(0.7) };
  const bare = { ...nearest, terrain_enabled: false, swell_access_factors: null, wind_exposure_factors: null } as unknown as Beach;

  it('uses reference terrain for an anchor with none of its own', () => {
    const anchor = anchorForTerrainRatio(bare, reference);
    expect(anchor.terrain_enabled).toBe(true);
    expect(anchor.swell_access_factors).toBe(reference.swell_access_factors);
    expect(bare.terrain_enabled).toBe(false);
  });

  it("keeps an anchor's own terrain", () => {
    expect(anchorForTerrainRatio(nearest, reference)).toBe(nearest);
  });

  it('leaves an anchor without reference terrain unchanged', () => {
    expect(anchorForTerrainRatio(bare, undefined)).toBe(bare);
  });
});
