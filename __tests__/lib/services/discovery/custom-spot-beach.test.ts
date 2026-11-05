import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import {
  anchorForTerrainRatio,
  fetchAnchorReferenceTerrain,
  buildCustomSpotBeach,
  customSpotForecastAdjuster,
  loadCustomSpotForecastAdjusters,
  type CustomSpotDiscoveryRow,
} from '@/lib/services/discovery/surf-discovery-orchestrator';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Beach } from '@/types/database';
import { getTerrainParamsHash } from '@/lib/services/custom-spot-analysis/core';
import { applyCustomSpotForecastGeometry } from '@/lib/services/custom-spot-analysis/forecast-overlay';
import type { EnhancedForecastEntity } from '@/types/forecast';

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

describe('fetchAnchorReferenceTerrain', () => {
  const bareAnchor = { ...nearest, id: 'bare', lat: 33, lon: -118, terrain_enabled: false, swell_access_factors: null, wind_exposure_factors: null } as unknown as Beach;
  const row = (overrides: Record<string, unknown> = {}) => ({
    beach_id: 'bare', lat: 33, lon: -118,
    swell_access_factors: Array(72).fill(0.5), wind_exposure_factors: Array(72).fill(0.5),
    model_version: 'custom_spot_terrain_v1', terrain_params_hash: getTerrainParamsHash(),
    ...overrides,
  });
  const clientReturning = (data: unknown[], error: unknown = null) => {
    const query = { select: () => query, in: async () => ({ data, error }) };
    return { from: jest.fn(() => query) } as unknown as SupabaseClient & { from: jest.Mock };
  };

  it('returns current reference terrain for anchors without their own', async () => {
    const result = await fetchAnchorReferenceTerrain([{ spot: spot(), nearestBeach: bareAnchor }], clientReturning([row()]));
    expect(result.get('bare')?.swell_access_factors).toEqual(Array(72).fill(0.5));
  });

  it.each([
    { model_version: 'custom_spot_terrain_v0' },
    { terrain_params_hash: 'old' },
    { lat: 33.01 },
  ])('ignores a stale reference row: %j', async (overrides) => {
    const result = await fetchAnchorReferenceTerrain([{ spot: spot(), nearestBeach: bareAnchor }], clientReturning([row(overrides)]));
    expect(result.size).toBe(0);
  });

  it('does not query when every anchor has its own terrain or no spot is modeled', async () => {
    const client = clientReturning([row()]);
    await fetchAnchorReferenceTerrain([
      { spot: spot(), nearestBeach: nearest },
      { spot: spot({ terrain_status: 'queued' }), nearestBeach: bareAnchor },
    ], client);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns nothing when the read fails', async () => {
    const result = await fetchAnchorReferenceTerrain([{ spot: spot(), nearestBeach: bareAnchor }], clientReturning([], { message: 'relation does not exist' }));
    expect(result.size).toBe(0);
    expectConsoleWarnings([/Anchor reference terrain unavailable/]);
  });
});

describe('customSpotForecastAdjuster', () => {
  const row = {
    beach_id: 'nearest', forecast_at: '2026-11-05T15:00:00.000Z',
    wave_height: '4.0 ft', wave_period: '14', wave_direction: 'W',
    swell_1_height: '4', swell_1_period: '14', swell_1_direction: 'W',
  } as unknown as EnhancedForecastEntity;

  it("applies Home's terrain overlay for a spot with modeled terrain", () => {
    const adjust = customSpotForecastAdjuster(spot(), nearest, undefined);
    expect(adjust).not.toBeNull();
    const adjusted = adjust!(row);
    expect(adjusted).toEqual(applyCustomSpotForecastGeometry(row, buildCustomSpotBeach(spot(), nearest), nearest));
    expect(adjusted.wave_height).not.toBe(row.wave_height);
  });

  it('is null when the spot has no current modeled terrain', () => {
    expect(customSpotForecastAdjuster(spot({ terrain_status: 'queued' }), nearest, undefined)).toBeNull();
    expect(customSpotForecastAdjuster(spot({ fingerprint_model_version: 'old' }), nearest, undefined)).toBeNull();
  });

  it('loads adjusters only for modeled spots', async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;
    const adjusters = await loadCustomSpotForecastAdjusters([
      { spot: spot(), nearestBeach: nearest },
      { spot: spot({ id: 'unanalyzed', terrain_status: 'queued' }), nearestBeach: nearest },
    ], client);
    expect([...adjusters.keys()]).toEqual(['custom']);
  });
});
