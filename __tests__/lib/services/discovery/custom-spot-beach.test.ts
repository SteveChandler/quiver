import {
  buildCustomSpotBeach,
  type CustomSpotDiscoveryRow,
} from '@/lib/services/discovery/surf-discovery-orchestrator';
import type { Beach } from '@/types/database';

const nearest = {
  id: 'nearest',
  name: 'Nearest Beach',
  lat: 32,
  lon: -117,
  swell_window_min_deg: 180,
  swell_window_max_deg: 270,
  swell_window_center_deg: 225,
  swell_window_halfwidth_deg: 45,
  aspect_deg: 225,
  wind_offshore_deg: 45,
  exposure_level: 'exposed',
  skill_level: 'advanced',
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 4,
  preferred_tide_direction: 'rising',
  tide_direction_sensitivity: 'high',
  swell_access_factors: Array(72).fill(1),
  wind_exposure_factors: Array(72).fill(1),
  terrain_enabled: true,
  terrain_method: 'dem_horizon_v1',
  terrain_status: 'ok',
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
    terrain_analysis_debug: {}, preferred_tide_ft_min: null, preferred_tide_ft_max: null,
    preferred_tide_direction: null, tide_direction_sensitivity: null, skill_level: null,
    fingerprint_confidence: 'modeled', fingerprint_provenance_state: 'modeled',
    fingerprint_model_version: 'custom_spot_terrain_v1',
    fingerprint_provenance: { fields: {
      facing_direction_deg: 'modeled', swell_window_min_deg: 'modeled',
      swell_window_max_deg: 'modeled', offshore_direction_deg: 'modeled',
      exposure_level: 'modeled', swell_access_factors: 'modeled',
      wind_exposure_factors: 'modeled',
    } },
    deleted_at: null,
    ...overrides,
  };
}

describe('buildCustomSpotBeach', () => {
  it('overlays current modeled geometry and preserves a north-crossing window', () => {
    const result = buildCustomSpotBeach(spot(), nearest);

    expect(result).toMatchObject({
      id: 'nearest',
      name: 'Private Peak',
      aspect_deg: 0,
      wind_offshore_deg: 180,
      swell_window_min_deg: 350,
      swell_window_max_deg: 10,
      swell_window_center_deg: 0,
      swell_window_halfwidth_deg: 10,
      terrain_enabled: true,
    });
    expect(result.swell_access_factors).toEqual(Array(72).fill(0.4));
  });

  it('falls back field-by-field and does not use stale modeled terrain', () => {
    const result = buildCustomSpotBeach(spot({
      facing_direction_deg: null,
      terrain_status: 'queued',
      fingerprint_model_version: null,
    }), nearest);

    expect(result.aspect_deg).toBe(225);
    expect(result.swell_window_min_deg).toBe(180);
    expect(result.swell_access_factors).toBe(nearest.swell_access_factors);
  });

  it('keeps user corrections while modeled fields are awaiting reanalysis', () => {
    const result = buildCustomSpotBeach(spot({
      terrain_status: 'queued',
      fingerprint_model_version: null,
      fingerprint_confidence: 'user_set',
      fingerprint_provenance_state: 'user_corrected',
      fingerprint_provenance: { fields: { facing_direction_deg: 'user_corrected' } },
      swell_window_min_deg: null,
      swell_window_max_deg: null,
    }), nearest);

    expect(result.aspect_deg).toBe(0);
    expect(result.swell_window_min_deg).toBe(180);
  });

  it('keeps legacy modeled scalar fields compatible before reanalysis', () => {
    const result = buildCustomSpotBeach(spot({
      terrain_status: null,
      fingerprint_model_version: null,
      fingerprint_confidence: 'modeled',
      fingerprint_provenance_state: 'unset',
      fingerprint_provenance: { fields: {} },
    }), nearest);

    expect(result.aspect_deg).toBe(0);
    expect(result.wind_offshore_deg).toBe(180);
    expect(result.swell_access_factors).toBe(nearest.swell_access_factors);
  });
});
