import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type {
  ClaimedCustomSpotAnalysisJob,
  CustomSpotAnalysisStore,
  CustomSpotForAnalysis,
  CustomSpotModeledUpdate,
  FingerprintFieldState,
} from './processor';

interface ClaimedJobRow {
  job_id: number;
  custom_spot_id: string;
  requested_model_version: string;
  attempts: number;
  claimed_at: string;
}

interface CustomSpotRow {
  id: string;
  lat: number;
  lon: number;
  break_type: string | null;
  updated_at: string;
  fingerprint_provenance_state: FingerprintFieldState;
  fingerprint_provenance: unknown;
  fingerprint_model_version: string | null;
  fingerprint_coordinate_hash: string | null;
  terrain_status: string | null;
  fingerprint_confidence: string | null;
}

export class SupabaseCustomSpotAnalysisStore implements CustomSpotAnalysisStore {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient = createSupabaseServiceRoleClient() as unknown as SupabaseClient) {
    this.client = client;
  }

  async claimJobs(batchSize: number): Promise<ClaimedCustomSpotAnalysisJob[]> {
    const { data, error } = await this.client.rpc('claim_custom_spot_analysis_jobs', {
      p_batch_size: batchSize,
    });
    if (error) throw error;
    return ((data ?? []) as ClaimedJobRow[]).map((row) => ({
      jobId: row.job_id,
      customSpotId: row.custom_spot_id,
      requestedModelVersion: row.requested_model_version,
      attempts: row.attempts,
      claimedAt: row.claimed_at,
    }));
  }

  async getSpot(customSpotId: string): Promise<CustomSpotForAnalysis | null> {
    const { data, error } = await this.client
      .from('custom_spots')
      .select([
        'id', 'lat', 'lon', 'break_type', 'updated_at', 'fingerprint_provenance_state',
        'fingerprint_provenance', 'fingerprint_model_version', 'fingerprint_coordinate_hash',
        'terrain_status', 'fingerprint_confidence',
      ].join(', '))
      .eq('id', customSpotId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as CustomSpotRow;
    return {
      id: row.id,
      lat: row.lat,
      lon: row.lon,
      breakType: row.break_type,
      updatedAt: row.updated_at,
      fingerprintProvenanceState: row.fingerprint_provenance_state,
      fingerprintProvenance: row.fingerprint_provenance,
      fingerprintModelVersion: row.fingerprint_model_version,
      fingerprintCoordinateHash: row.fingerprint_coordinate_hash,
      terrainStatus: row.terrain_status,
      fingerprintConfidence: row.fingerprint_confidence,
    };
  }

  async writeModeledResult(
    job: ClaimedCustomSpotAnalysisJob,
    spot: CustomSpotForAnalysis,
    update: CustomSpotModeledUpdate
  ): Promise<boolean> {
    const modeledFields = {
      ...(update.facingDirectionDeg === undefined ? {} : { facing_direction_deg: update.facingDirectionDeg }),
      ...(update.offshoreDirectionDeg === undefined ? {} : { offshore_direction_deg: update.offshoreDirectionDeg }),
      ...(update.swellWindowMinDeg === undefined ? {} : { swell_window_min_deg: update.swellWindowMinDeg }),
      ...(update.swellWindowMaxDeg === undefined ? {} : { swell_window_max_deg: update.swellWindowMaxDeg }),
      ...(update.exposureLevel === undefined ? {} : { exposure_level: update.exposureLevel }),
      ...(update.swellAccessFactors === undefined ? {} : { swell_access_factors: update.swellAccessFactors }),
      ...(update.windExposureFactors === undefined ? {} : { wind_exposure_factors: update.windExposureFactors }),
    };
    const { data, error } = await this.client.rpc('complete_custom_spot_analysis_job', {
      p_job_id: job.jobId,
      p_claimed_at: job.claimedAt,
      p_spot_updated_at: spot.updatedAt,
      p_update: {
        ...modeledFields,
        terrain_method: update.terrainMethod,
        terrain_params: update.terrainParams,
        terrain_params_hash: update.terrainParamsHash,
        terrain_analyzed_at: update.terrainAnalyzedAt,
        terrain_status: update.terrainStatus,
        terrain_analysis_debug: update.terrainAnalysisDebug,
        fingerprint_model_version: update.fingerprintModelVersion,
        fingerprint_coordinate_hash: update.fingerprintCoordinateHash,
        fingerprint_provenance_state: update.fingerprintProvenanceState,
        fingerprint_provenance: update.fingerprintProvenance,
        fingerprint_confidence: update.fingerprintConfidence,
        fingerprint_updated_at: update.fingerprintUpdatedAt,
      },
    });
    if (error) throw error;
    return data === true;
  }

  async markAnalysisFailed(
    job: ClaimedCustomSpotAnalysisJob,
    spot: CustomSpotForAnalysis,
    errorCode: string
  ): Promise<boolean> {
    const state = spot.fingerprintConfidence === 'user_set'
      ? 'user_corrected'
      : spot.fingerprintProvenanceState === 'user_corrected'
      || spot.fingerprintProvenanceState === 'independently_reviewed'
      ? spot.fingerprintProvenanceState
      : 'failed';
    const { data, error } = await this.client.rpc('fail_custom_spot_analysis_job', {
      p_job_id: job.jobId,
      p_claimed_at: job.claimedAt,
      p_spot_updated_at: spot.updatedAt,
      p_provenance_state: state,
      p_error_code: errorCode,
    });
    if (error) throw error;
    return data === true;
  }

  async markJobComplete(jobId: number, claimedAt: string): Promise<void> {
    await this.updateJob(jobId, claimedAt, {
      status: 'complete', locked_at: null, last_error_code: null, updated_at: new Date().toISOString(),
    });
  }

  async markJobRetry(
    jobId: number,
    claimedAt: string,
    delaySeconds: number,
    errorCode: string
  ): Promise<void> {
    await this.updateJob(jobId, claimedAt, {
      status: 'retry',
      locked_at: null,
      last_error_code: errorCode,
      next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  async markJobFailed(jobId: number, claimedAt: string, errorCode: string): Promise<void> {
    await this.updateJob(jobId, claimedAt, {
      status: 'failed', locked_at: null, last_error_code: errorCode, updated_at: new Date().toISOString(),
    });
  }

  private async updateJob(
    jobId: number,
    claimedAt: string,
    update: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.client
      .from('custom_spot_analysis_jobs')
      .update(update)
      .eq('id', jobId)
      .eq('status', 'processing')
      .eq('locked_at', claimedAt);
    if (error) throw error;
  }
}
