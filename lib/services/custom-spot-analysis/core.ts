import { createHash } from 'crypto';

import { computeSwellAccess } from '@/scripts/terrain/swell-access';
import { loadLandmask } from '@/scripts/terrain/landmask-loader';
import { computeWindExposure } from '@/scripts/terrain/wind-exposure';
import { loadDEMTile } from '@/scripts/terrain/dem-loader';
import {
  DEFAULT_TERRAIN_PARAMS,
  type TerrainAnalysisDebug,
  type TerrainAnalysisParams,
} from '@/types/terrain';

export const CUSTOM_SPOT_FINGERPRINT_MODEL_VERSION = 'custom_spot_terrain_v1';
export const CUSTOM_SPOT_TERRAIN_METHOD = 'dem_horizon_v1';
export const DIRECTIONAL_FACTOR_COUNT = 72;

const CUSTOM_SPOT_TERRAIN_PARAMS: TerrainAnalysisParams = {
  ...DEFAULT_TERRAIN_PARAMS,
  dem_source: 'aws_terrarium_z12',
};

const ACCESS_THRESHOLD = 0.55;

export interface CustomSpotAnalysisInput {
  customSpotId: string;
  lat: number;
  lon: number;
  breakType: string | null;
}

export interface TerrainFactors {
  swellAccessFactors: number[];
  windExposureFactors: number[];
  debug: TerrainAnalysisDebug;
}

export interface CustomSpotAnalysisDependencies {
  analyzeTerrain(input: CustomSpotAnalysisInput): Promise<TerrainFactors>;
  now(): Date;
}

export interface CustomSpotAnalysisResult {
  facingDirectionDeg: number;
  offshoreDirectionDeg: number;
  swellWindowMinDeg: number;
  swellWindowMaxDeg: number;
  exposureLevel: 'sheltered' | 'mixed' | 'exposed';
  swellAccessFactors: number[];
  windExposureFactors: number[];
  terrainMethod: string;
  terrainParams: TerrainAnalysisParams;
  terrainParamsHash: string;
  terrainAnalysisDebug: TerrainAnalysisDebug;
  coordinateHash: string;
  modelVersion: string;
  analyzedAt: string;
}

export function normalizeDirection(direction: number): number {
  return ((direction % 360) + 360) % 360;
}

export function isValidDirectionalFactors(values: unknown): values is number[] {
  return Array.isArray(values)
    && values.length === DIRECTIONAL_FACTOR_COUNT
    && values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1);
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function getCustomSpotCoordinateHash(input: CustomSpotAnalysisInput): string {
  return canonicalHash({
    lat: input.lat.toFixed(6),
    lon: input.lon.toFixed(6),
    break_type: input.breakType ?? null,
    model_version: CUSTOM_SPOT_FINGERPRINT_MODEL_VERSION,
  });
}

export function getTerrainParamsHash(): string {
  const sortedParams = Object.fromEntries(
    Object.entries(CUSTOM_SPOT_TERRAIN_PARAMS).sort(([left], [right]) => left.localeCompare(right))
  );
  return canonicalHash(sortedParams);
}

interface DirectionalWindow {
  minDeg: number;
  maxDeg: number;
  centerDeg: number;
}

export function deriveSwellWindow(factors: number[]): DirectionalWindow {
  if (!isValidDirectionalFactors(factors)) {
    throw new Error('invalid_directional_factors');
  }

  const accessible = factors.map((factor) => factor >= ACCESS_THRESHOLD);
  if (accessible.every(Boolean)) {
    throw new Error('indeterminate_shoreline_orientation');
  }

  let bestStart = 0;
  let bestLength = 0;
  let currentStart = 0;
  let currentLength = 0;

  for (let index = 0; index < DIRECTIONAL_FACTOR_COUNT * 2; index += 1) {
    if (accessible[index % DIRECTIONAL_FACTOR_COUNT]) {
      if (currentLength === 0) currentStart = index;
      currentLength += 1;
      if (currentLength > bestLength && currentLength <= DIRECTIONAL_FACTOR_COUNT) {
        bestStart = currentStart;
        bestLength = currentLength;
      }
    } else {
      currentLength = 0;
    }
  }

  if (bestLength === 0) {
    throw new Error('indeterminate_shoreline_orientation');
  }

  const startBin = bestStart % DIRECTIONAL_FACTOR_COUNT;
  const endBin = (startBin + bestLength - 1) % DIRECTIONAL_FACTOR_COUNT;
  return {
    minDeg: startBin * 5,
    maxDeg: endBin * 5,
    centerDeg: normalizeDirection((startBin + (bestLength - 1) / 2) * 5),
  };
}

export function deriveExposureLevel(
  windExposureFactors: number[]
): 'sheltered' | 'mixed' | 'exposed' {
  if (!isValidDirectionalFactors(windExposureFactors)) {
    throw new Error('invalid_directional_factors');
  }

  const average = windExposureFactors.reduce((sum, value) => sum + value, 0)
    / DIRECTIONAL_FACTOR_COUNT;
  if (average < 0.4) return 'sheltered';
  if (average > 0.7) return 'exposed';
  return 'mixed';
}

async function analyzeTerrain(input: CustomSpotAnalysisInput): Promise<TerrainFactors> {
  const demTile = await loadDEMTile(input.lat, input.lon, CUSTOM_SPOT_TERRAIN_PARAMS, { log: false });
  if (!demTile._elevationGrid) throw new Error('terrain_data_unavailable');
  const wind = computeWindExposure(input.lat, input.lon, CUSTOM_SPOT_TERRAIN_PARAMS, demTile);
  const landmask = await loadLandmask(input.lat, input.lon, CUSTOM_SPOT_TERRAIN_PARAMS, { log: false });
  if (!landmask._demTile?._elevationGrid) throw new Error('terrain_data_unavailable');
  const swell = computeSwellAccess(input.lat, input.lon, CUSTOM_SPOT_TERRAIN_PARAMS, landmask);

  return {
    swellAccessFactors: swell.factors,
    windExposureFactors: wind.factors,
    debug: {
      wind_horizon_angles: wind.horizon_angles,
      swell_direct_access: swell.direct_access,
      swell_wrap_access: swell.wrap_access,
      analysis_metadata: {
        beach_elevation_m: wind.beach_elevation,
        utm_zone: wind.utm_zone,
        processing_time_ms: 0,
        dem_coverage_pct: demTile._elevationGrid.coveragePct,
      },
    },
  };
}

const DEFAULT_DEPENDENCIES: CustomSpotAnalysisDependencies = {
  analyzeTerrain,
  now: () => new Date(),
};

export async function analyzeCustomSpot(
  input: CustomSpotAnalysisInput,
  dependencies: CustomSpotAnalysisDependencies = DEFAULT_DEPENDENCIES
): Promise<CustomSpotAnalysisResult> {
  if (!input.customSpotId) throw new Error('invalid_custom_spot_id');
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
    throw new Error('invalid_coordinate');
  }
  if (!Number.isFinite(input.lon) || input.lon < -180 || input.lon > 180) {
    throw new Error('invalid_coordinate');
  }

  const startedAt = Date.now();
  const terrain = await dependencies.analyzeTerrain(input);
  if (!isValidDirectionalFactors(terrain.swellAccessFactors)
    || !isValidDirectionalFactors(terrain.windExposureFactors)) {
    throw new Error('invalid_directional_factors');
  }

  const window = deriveSwellWindow(terrain.swellAccessFactors);
  const debug: TerrainAnalysisDebug = {
    ...terrain.debug,
    analysis_metadata: terrain.debug.analysis_metadata
      ? {
          ...terrain.debug.analysis_metadata,
          processing_time_ms: Date.now() - startedAt,
        }
      : undefined,
  };

  return {
    facingDirectionDeg: window.centerDeg,
    offshoreDirectionDeg: normalizeDirection(window.centerDeg + 180),
    swellWindowMinDeg: window.minDeg,
    swellWindowMaxDeg: window.maxDeg,
    exposureLevel: deriveExposureLevel(terrain.windExposureFactors),
    swellAccessFactors: terrain.swellAccessFactors,
    windExposureFactors: terrain.windExposureFactors,
    terrainMethod: CUSTOM_SPOT_TERRAIN_METHOD,
    terrainParams: CUSTOM_SPOT_TERRAIN_PARAMS,
    terrainParamsHash: getTerrainParamsHash(),
    terrainAnalysisDebug: debug,
    coordinateHash: getCustomSpotCoordinateHash(input),
    modelVersion: CUSTOM_SPOT_FINGERPRINT_MODEL_VERSION,
    analyzedAt: dependencies.now().toISOString(),
  };
}
