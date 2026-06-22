/**
 * Script-specific types for terrain analysis
 *
 * These types are used by the terrain analysis script and its modules.
 * Core terrain types are defined in types/terrain.ts.
 */

import type { TerrainAnalysisParams, TerrainAnalysisDebug } from '../../types/terrain'

/**
 * CLI arguments for terrain analysis script
 */
export interface TerrainAnalysisArgs {
  /** Validate an existing proposed terrain JSON and exit without DB access */
  validateOutputJsonPath?: string
  /** Maximum proposed terrain artifact age in hours */
  maxArtifactAgeHours?: number
  /** Specific beach ID to analyze */
  beachId?: string
  /** Specific beach IDs to analyze */
  beachIds?: string[]
  /** Region filter (e.g., 'california', 'hawaii') */
  region?: string
  /** Maximum number of beaches to process */
  limit?: number
  /** Number of beaches to skip */
  offset?: number
  /** Number of concurrent operations */
  concurrency?: number
  /** Write successful terrain factors to a Phase 0 harness proposed-json file */
  outputJsonPath?: string
  /** Approved Phase 0 harness report proving the exact write scope */
  approvalReportJsonPath?: string
  /** Proposed terrain JSON used by the approved harness report */
  approvalProposedJsonPath?: string
  /** Maximum approved harness report age in hours */
  maxApprovalReportAgeHours?: number
  /** Required aggregate 0-72h sample floor for approved terrain writes */
  minApprovalGateSamples?: number
  /** Required per-beach 0-72h sample floor for approved terrain writes */
  minApprovalSliceSamples?: number
  /** Explicit human approval token required for non-dry-run terrain writes */
  humanApprovalToken?: string
  /** Only analyze active beaches missing terrain status or factor arrays */
  missingOnly?: boolean
  /** Compute without writing to database */
  dryRun: boolean
  /** Force recomputation even if already analyzed */
  force: boolean
}

/**
 * Result of analyzing a single beach
 */
export interface BeachAnalysisResult {
  beach_id: string
  beach_name: string
  success: boolean
  error?: string
  wind_exposure_factors?: number[]
  swell_access_factors?: number[]
  terrain_params?: TerrainAnalysisParams
  terrain_params_hash?: string
  terrain_status?: 'ok' | 'wind_only' | 'failed'
  debug?: TerrainAnalysisDebug
  processing_time_ms?: number
}

/**
 * Summary of batch analysis operation
 */
export interface AnalysisSummary {
  total_beaches: number
  successful: number
  failed: number
  skipped: number
  total_time_ms: number
  avg_time_per_beach_ms: number
}

/**
 * Beach data loaded from database
 */
export interface BeachForAnalysis {
  id: string
  name: string
  lat: number
  lon: number
  region?: string
  terrain_method?: string | null
  terrain_params_hash?: string | null
  terrain_enabled: boolean
}

export interface TerrainProposedExportFilters {
  beachId?: string
  beachIds?: string[]
  region?: string
  missingOnly?: boolean
  limit?: number
  offset?: number
  force?: boolean
}

export interface TerrainProposedExportBeach {
  id: string
  name: string
  wind_exposure_factors: number[]
  swell_access_factors: number[]
  terrain_method: string
  terrain_params: TerrainAnalysisParams
  terrain_params_hash: string
  terrain_status: 'ok' | 'wind_only' | 'failed'
}

export interface TerrainProposedExportFailure {
  id: string
  name: string
  error: string
}

export interface TerrainApprovalPolicy {
  status: 'phase0_required'
  production_write_allowed: false
  requires_phase0_approval: true
  required_gate: '0-72h'
  required_metric: 'face_height_mae'
  required_validator: 'forecast-accuracy-report-validate --approval'
  min_gate_samples: number
  min_slice_samples: number
  max_report_age_hours: number
}

export interface TerrainProposedExport {
  artifact_schema_version: 1
  generated_at: string
  terrain_method: string
  approval_policy: TerrainApprovalPolicy
  filters: TerrainProposedExportFilters
  summary: AnalysisSummary
  beaches: TerrainProposedExportBeach[]
  failures: TerrainProposedExportFailure[]
}
