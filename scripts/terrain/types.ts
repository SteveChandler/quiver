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
  /** Specific beach ID to analyze */
  beachId?: string
  /** Region filter (e.g., 'california', 'hawaii') */
  region?: string
  /** Maximum number of beaches to process */
  limit?: number
  /** Number of beaches to skip */
  offset?: number
  /** Number of concurrent operations */
  concurrency?: number
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
