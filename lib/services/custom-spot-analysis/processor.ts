import {
  analyzeCustomSpot,
  CUSTOM_SPOT_FINGERPRINT_MODEL_VERSION,
  getCustomSpotCoordinateHash,
  type CustomSpotAnalysisDependencies,
  type CustomSpotAnalysisResult,
} from './core';

const MAX_ATTEMPTS = 3;

export type FingerprintFieldState =
  | 'unset'
  | 'modeled'
  | 'independently_reviewed'
  | 'user_corrected'
  | 'failed';

export interface ClaimedCustomSpotAnalysisJob {
  jobId: number;
  customSpotId: string;
  requestedModelVersion: string;
  attempts: number;
  claimedAt: string;
}

export interface CustomSpotForAnalysis {
  id: string;
  lat: number;
  lon: number;
  breakType: string | null;
  updatedAt: string;
  fingerprintProvenanceState: FingerprintFieldState;
  fingerprintProvenance: unknown;
  fingerprintModelVersion: string | null;
  fingerprintCoordinateHash: string | null;
  terrainStatus: string | null;
  fingerprintConfidence: string | null;
}

export interface CustomSpotModeledUpdate {
  facingDirectionDeg?: number;
  offshoreDirectionDeg?: number;
  swellWindowMinDeg?: number;
  swellWindowMaxDeg?: number;
  exposureLevel?: 'sheltered' | 'mixed' | 'exposed';
  swellAccessFactors?: number[];
  windExposureFactors?: number[];
  terrainMethod: string;
  terrainParams: CustomSpotAnalysisResult['terrainParams'];
  terrainParamsHash: string;
  terrainAnalyzedAt: string;
  terrainStatus: 'ok';
  terrainAnalysisDebug: CustomSpotAnalysisResult['terrainAnalysisDebug'];
  fingerprintModelVersion: string;
  fingerprintCoordinateHash: string;
  fingerprintProvenanceState: FingerprintFieldState;
  fingerprintProvenance: Record<string, unknown>;
  fingerprintConfidence: string;
  fingerprintUpdatedAt: string;
}

export interface CustomSpotAnalysisStore {
  claimJobs(batchSize: number): Promise<ClaimedCustomSpotAnalysisJob[]>;
  getSpot(customSpotId: string): Promise<CustomSpotForAnalysis | null>;
  writeModeledResult(
    job: ClaimedCustomSpotAnalysisJob,
    spot: CustomSpotForAnalysis,
    update: CustomSpotModeledUpdate
  ): Promise<boolean>;
  markAnalysisFailed(
    job: ClaimedCustomSpotAnalysisJob,
    spot: CustomSpotForAnalysis,
    errorCode: string
  ): Promise<boolean>;
  markJobComplete(jobId: number, claimedAt: string): Promise<void>;
  markJobRetry(
    jobId: number,
    claimedAt: string,
    delaySeconds: number,
    errorCode: string
  ): Promise<void>;
  markJobFailed(jobId: number, claimedAt: string, errorCode: string): Promise<void>;
}

export interface CustomSpotAnalysisBatchSummary {
  claimed: number;
  completed: number;
  cached: number;
  retried: number;
  failed: number;
  stale: number;
}

const MODELED_FIELDS = [
  'facing_direction_deg',
  'offshore_direction_deg',
  'swell_window_min_deg',
  'swell_window_max_deg',
  'exposure_level',
  'swell_access_factors',
  'wind_exposure_factors',
] as const;

type ModeledField = typeof MODELED_FIELDS[number];

function getFieldStates(provenance: unknown): Record<string, FingerprintFieldState> {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) return {};
  const fields = (provenance as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  return fields as Record<string, FingerprintFieldState>;
}

function mayModelField(state: FingerprintFieldState | undefined): boolean {
  return state !== 'user_corrected' && state !== 'independently_reviewed';
}

function buildModeledUpdate(
  spot: CustomSpotForAnalysis,
  result: CustomSpotAnalysisResult
): CustomSpotModeledUpdate {
  const currentFields = getFieldStates(spot.fingerprintProvenance);
  const hasFieldProvenance = Object.keys(currentFields).length > 0;
  const fieldStates: Record<string, FingerprintFieldState> = { ...currentFields };
  const update: CustomSpotModeledUpdate = {
    terrainMethod: result.terrainMethod,
    terrainParams: result.terrainParams,
    terrainParamsHash: result.terrainParamsHash,
    terrainAnalyzedAt: result.analyzedAt,
    terrainStatus: 'ok',
    terrainAnalysisDebug: result.terrainAnalysisDebug,
    fingerprintModelVersion: result.modelVersion,
    fingerprintCoordinateHash: result.coordinateHash,
    fingerprintProvenanceState:
      spot.fingerprintConfidence === 'user_set'
        ? 'user_corrected'
        : spot.fingerprintProvenanceState === 'user_corrected'
        || spot.fingerprintProvenanceState === 'independently_reviewed'
        ? spot.fingerprintProvenanceState
        : 'modeled',
    fingerprintProvenance: {},
    fingerprintConfidence: spot.fingerprintConfidence === 'user_set' ? 'user_set' : 'modeled',
    fingerprintUpdatedAt: result.analyzedAt,
  };

  const values: Record<ModeledField, number | number[] | string> = {
    facing_direction_deg: result.facingDirectionDeg,
    offshore_direction_deg: result.offshoreDirectionDeg,
    swell_window_min_deg: result.swellWindowMinDeg,
    swell_window_max_deg: result.swellWindowMaxDeg,
    exposure_level: result.exposureLevel,
    swell_access_factors: result.swellAccessFactors,
    wind_exposure_factors: result.windExposureFactors,
  };

  const updateKeys: Record<ModeledField, keyof CustomSpotModeledUpdate> = {
    facing_direction_deg: 'facingDirectionDeg',
    offshore_direction_deg: 'offshoreDirectionDeg',
    swell_window_min_deg: 'swellWindowMinDeg',
    swell_window_max_deg: 'swellWindowMaxDeg',
    exposure_level: 'exposureLevel',
    swell_access_factors: 'swellAccessFactors',
    wind_exposure_factors: 'windExposureFactors',
  };

  for (const field of MODELED_FIELDS) {
    if (!mayModelField(currentFields[field])) continue;
    if (spot.fingerprintProvenanceState === 'independently_reviewed' && !currentFields[field]) {
      continue;
    }
    if (
      spot.fingerprintConfidence === 'user_set'
      && !hasFieldProvenance
      && !currentFields[field]
      && field !== 'swell_access_factors'
      && field !== 'wind_exposure_factors'
    ) {
      continue;
    }
    Object.assign(update, { [updateKeys[field]]: values[field] });
    fieldStates[field] = 'modeled';
  }

  update.fingerprintProvenance = {
    schema_version: 1,
    model_version: result.modelVersion,
    method: result.terrainMethod,
    params_hash: result.terrainParamsHash,
    analyzed_at: result.analyzedAt,
    fields: fieldStates,
  };
  return update;
}

function sanitizeErrorCode(error: unknown): string {
  if (error instanceof Error && error.message === 'invalid_coordinate') return 'invalid_coordinate';
  if (error instanceof Error && error.message === 'invalid_directional_factors') {
    return 'invalid_directional_factors';
  }
  if (error instanceof Error && error.message === 'indeterminate_shoreline_orientation') {
    return 'indeterminate_shoreline_orientation';
  }
  return 'terrain_analysis_failed';
}

async function processJob(
  store: CustomSpotAnalysisStore,
  job: ClaimedCustomSpotAnalysisJob,
  dependencies?: CustomSpotAnalysisDependencies
): Promise<keyof Omit<CustomSpotAnalysisBatchSummary, 'claimed'>> {
  const spot = await store.getSpot(job.customSpotId);
  if (!spot) {
    await store.markJobComplete(job.jobId, job.claimedAt);
    return 'stale';
  }

  const input = {
    customSpotId: spot.id,
    lat: spot.lat,
    lon: spot.lon,
    breakType: spot.breakType,
  };
  const coordinateHash = getCustomSpotCoordinateHash(input);
  if (
    spot.terrainStatus === 'ok'
    && spot.fingerprintModelVersion === job.requestedModelVersion
    && spot.fingerprintCoordinateHash === coordinateHash
  ) {
    await store.markJobComplete(job.jobId, job.claimedAt);
    return 'cached';
  }

  try {
    const result = await analyzeCustomSpot(input, dependencies);
    const wrote = await store.writeModeledResult(job, spot, buildModeledUpdate(spot, result));
    if (!wrote) {
      await store.markJobRetry(job.jobId, job.claimedAt, 0, 'coordinate_changed');
      return 'retried';
    }
    return 'completed';
  } catch (error) {
    const errorCode = sanitizeErrorCode(error);
    if (job.attempts < MAX_ATTEMPTS) {
      const delaySeconds = 60 * 5 * 2 ** Math.max(0, job.attempts - 1);
      await store.markJobRetry(job.jobId, job.claimedAt, delaySeconds, errorCode);
      return 'retried';
    }
    const marked = await store.markAnalysisFailed(job, spot, errorCode);
    return marked ? 'failed' : 'stale';
  }
}

export async function processCustomSpotAnalysisBatch(
  store: CustomSpotAnalysisStore,
  batchSize: number,
  dependencies?: CustomSpotAnalysisDependencies
): Promise<CustomSpotAnalysisBatchSummary> {
  const boundedBatchSize = Math.max(1, Math.min(25, Math.trunc(batchSize)));
  const jobs = await store.claimJobs(boundedBatchSize);
  const summary: CustomSpotAnalysisBatchSummary = {
    claimed: jobs.length,
    completed: 0,
    cached: 0,
    retried: 0,
    failed: 0,
    stale: 0,
  };

  for (const job of jobs) {
    if (job.requestedModelVersion !== CUSTOM_SPOT_FINGERPRINT_MODEL_VERSION) {
      await store.markJobFailed(job.jobId, job.claimedAt, 'model_version_changed');
      summary.failed += 1;
      continue;
    }
    const outcome = await processJob(store, job, dependencies);
    summary[outcome] += 1;
  }

  return summary;
}
