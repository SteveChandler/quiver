/**
 * Database operations for terrain analysis
 *
 * Handles loading beaches and upserting terrain analysis results.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BeachForAnalysis, BeachAnalysisResult } from './types'
import type { DEFAULT_TERRAIN_PARAMS } from '../../types/terrain'
import { createHash } from 'crypto'

/**
 * Load beaches for analysis
 *
 * @param supabase Supabase client
 * @param filters Filtering options
 * @returns Array of beaches to analyze
 */
export async function loadBeaches(
  supabase: SupabaseClient,
  filters: {
    beachId?: string
    beachIds?: string[]
    region?: string
    limit?: number
    offset?: number
    force?: boolean
    missingOnly?: boolean
  }
): Promise<BeachForAnalysis[]> {
  let query = supabase
    .from('beaches')
    .select('id, name, lat, lon, region, terrain_method, terrain_params_hash, terrain_enabled')
    .order('name')

  // Apply filters
  if (filters.beachId) {
    query = query.eq('id', filters.beachId)
  }

  if (filters.beachIds && filters.beachIds.length > 0) {
    query = query.in('id', filters.beachIds)
  }

  if (filters.region) {
    // Match region case-insensitively. Production beaches has no location column.
    const regionLower = filters.region.toLowerCase()
    query = query.ilike('region', `%${regionLower}%`)
  }

  if (filters.missingOnly) {
    query = query
      .is('deleted_at', null)
      .or('terrain_status.is.null,swell_access_factors.is.null,wind_exposure_factors.is.null')
  }

  if (filters.limit !== undefined) {
    query = query.limit(filters.limit)
  }

  if (filters.offset !== undefined) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to load beaches: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return []
  }

  return data as BeachForAnalysis[]
}

/**
 * Check if beach needs analysis
 *
 * Returns true if:
 * - Beach has no terrain analysis
 * - Terrain method doesn't match current method
 * - Params hash doesn't match current params
 * - Force flag is set
 *
 * @param beach Beach to check
 * @param currentMethod Current terrain method identifier
 * @param currentParamsHash Hash of current parameters
 * @param force Force recomputation flag
 * @returns True if beach should be analyzed
 */
export function shouldAnalyzeBeach(
  beach: BeachForAnalysis,
  currentMethod: string,
  currentParamsHash: string,
  force: boolean
): boolean {
  // Force flag overrides all checks
  if (force) {
    return true
  }

  // No analysis yet
  if (!beach.terrain_method || !beach.terrain_params_hash) {
    return true
  }

  // Method or params changed
  if (
    beach.terrain_method !== currentMethod ||
    beach.terrain_params_hash !== currentParamsHash
  ) {
    return true
  }

  // Already analyzed with current method and params
  return false
}

/**
 * Compute SHA256 hash of terrain parameters
 *
 * Creates a canonical JSON representation and hashes it for
 * fast cache validation without deep JSON comparison.
 *
 * @param params Terrain analysis parameters
 * @returns SHA256 hash as hex string
 */
export function computeParamsHash(params: typeof DEFAULT_TERRAIN_PARAMS): string {
  // Create canonical JSON (sorted keys)
  const canonical = JSON.stringify(params, Object.keys(params).sort())

  // Compute SHA256 hash
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * Upsert terrain analysis results to database
 *
 * @param supabase Supabase client
 * @param result Analysis result
 * @param terrainMethod Method identifier (e.g., 'dem_horizon_v1')
 * @returns Success status
 */
export async function upsertAnalysisResult(
  supabase: SupabaseClient,
  result: BeachAnalysisResult,
  terrainMethod: string
): Promise<{ success: boolean; error?: string }> {
  if (!result.success) {
    // For failed analyses, we could still update status
    const { error } = await supabase
      .from('beaches')
      .update({
        terrain_status: 'failed',
        terrain_analyzed_at: new Date().toISOString(),
      })
      .eq('id', result.beach_id)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  // Prepare update data
  const now = new Date().toISOString()
  const updateData: any = {
    wind_exposure_factors: result.wind_exposure_factors,
    swell_access_factors: result.swell_access_factors,
    terrain_method: terrainMethod,
    terrain_params: result.terrain_params,
    terrain_params_hash: result.terrain_params_hash,
    terrain_status: result.terrain_status || 'ok',
    terrain_analyzed_at: now,
  }

  // Update granular timestamps based on what was computed
  if (result.wind_exposure_factors && result.wind_exposure_factors.length === 72) {
    updateData.wind_analyzed_at = now
  }

  if (result.swell_access_factors && result.swell_access_factors.length === 72) {
    updateData.swell_analyzed_at = now
  }

  // Store debug data if present
  if (result.debug) {
    updateData.terrain_analysis_debug = result.debug
  }

  // Upsert (update by beach_id)
  const { error } = await supabase
    .from('beaches')
    .update(updateData)
    .eq('id', result.beach_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Count beaches matching filters
 *
 * @param supabase Supabase client
 * @param filters Filtering options
 * @returns Total count
 */
export async function countBeaches(
  supabase: SupabaseClient,
  filters: {
    beachId?: string
    beachIds?: string[]
    region?: string
    missingOnly?: boolean
  }
): Promise<number> {
  let query = supabase
    .from('beaches')
    .select('id', { count: 'exact', head: true })

  if (filters.beachId) {
    query = query.eq('id', filters.beachId)
  }

  if (filters.beachIds && filters.beachIds.length > 0) {
    query = query.in('id', filters.beachIds)
  }

  if (filters.region) {
    const regionLower = filters.region.toLowerCase()
    query = query.ilike('region', `%${regionLower}%`)
  }

  if (filters.missingOnly) {
    query = query
      .is('deleted_at', null)
      .or('terrain_status.is.null,swell_access_factors.is.null,wind_exposure_factors.is.null')
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Failed to count beaches: ${error.message}`)
  }

  return count || 0
}
