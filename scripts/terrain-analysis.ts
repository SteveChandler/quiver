#!/usr/bin/env node
/**
 * Terrain Analysis Script
 *
 * Computes directional wind exposure and swell access factors for beaches
 * using terrain/elevation data. Results are stored in the beaches table.
 *
 * Usage:
 *   yarn terrain:analyze                                    # Analyze all beaches
 *   yarn terrain:analyze --beach-id=xyz                     # Analyze specific beach
 *   yarn terrain:analyze --beach-ids=id1,id2,id3            # Analyze exact beaches
 *   yarn terrain:analyze --region=california --limit=50     # Analyze region subset
 *   yarn terrain:analyze --missing-only --dry-run           # Rehearse terrain gaps only
 *   yarn terrain:analyze --missing-only --dry-run --output-json=/tmp/terrain-proposed.json
 *   yarn terrain:analyze --dry-run                          # Compute without writing
 *   yarn terrain:analyze --beach-ids=id1,id2,id3 --human-approval-token=<token> --approval-report-json=/tmp/harness.json --approval-proposed-json=/tmp/proposed.json
 *   yarn terrain:analyze --force                            # Recompute all
 *   yarn terrain:analyze --concurrency=8                    # Parallel processing
 *
 * Environment Variables Required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *
 * Algorithm:
 *   1. Load beaches from database (with filtering)
 *   2. For each beach (parallelized):
 *      a. Project to UTM zone
 *      b. Fetch DEM tile covering beach + max_radius
 *      c. Load rasterized landmask for region
 *      d. Run wind exposure algorithm
 *      e. Run swell access algorithm
 *      f. Upsert results to beaches table
 *   3. Log summary statistics
 *
 * Idempotency:
 *   - Skips beaches where terrain_method and terrain_params_hash match
 *   - Use --force to recompute all beaches
 *   - Safe to run multiple times
 *
 * Performance:
 *   - ~6,000 elevation samples per beach (wind)
 *   - ~12,000 landmask lookups per beach (swell)
 *   - Target: ~0.1-0.2 sec per beach with raster landmask
 *   - 500 beaches: ~1-2 minutes with concurrency=4
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import pLimit from 'p-limit'
import type { TerrainAnalysisArgs, BeachAnalysisResult, AnalysisSummary } from './terrain/types'
import { DEFAULT_TERRAIN_PARAMS } from '../types/terrain'
import {
  loadBeaches,
  shouldAnalyzeBeach,
  computeParamsHash,
  upsertAnalysisResult,
  countBeaches,
} from './terrain/database'
import { loadDEMTile } from './terrain/dem-loader'
import { loadLandmask } from './terrain/landmask-loader'
import { computeWindExposure as computeWindExposureFromAlgorithm } from './terrain/wind-exposure'
import { computeSwellAccess as computeSwellAccessFromAlgorithm } from './terrain/swell-access'
import { parseTerrainAnalysisArgs } from './terrain/cli'
import {
  buildTerrainProposedExport,
  loadTerrainProposedExport,
  validateTerrainProposedExportArtifact,
  writeTerrainProposedExport,
} from './terrain/proposed-export'
import {
  assertTerrainResultsMatchApproval,
  assertTerrainWriteApproved,
} from './terrain/write-guard'

// Load environment variables from .env.local
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Current terrain analysis method identifier
// Increment version when algorithm changes to invalidate cache
const TERRAIN_METHOD = 'dem_horizon_v1'

/**
 * Parse command-line arguments
 */
const parseArgs = parseTerrainAnalysisArgs

/**
 * Validate required environment variables
 */
function validateEnvironment(): boolean {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:')
    if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    console.error('\nPlease check your .env.local file.')
    return false
  }

  return true
}

/**
 * Compute wind exposure factors for a beach
 *
 * @param latitude Beach latitude
 * @param longitude Beach longitude
 * @returns Array of 72 exposure factors (0-1)
 */
async function computeWindExposure(
  latitude: number,
  longitude: number
): Promise<number[]> {
  // Load DEM tile
  const demTile = await loadDEMTile(latitude, longitude, DEFAULT_TERRAIN_PARAMS)

  // Run wind exposure algorithm
  const result = computeWindExposureFromAlgorithm(
    latitude,
    longitude,
    DEFAULT_TERRAIN_PARAMS,
    demTile
  )

  console.log(`  [Wind] Complete: ${result.factors.length} exposure factors computed`)
  console.log(`         Beach elevation: ${result.beach_elevation.toFixed(1)}m, UTM zone: ${result.utm_zone}`)

  return result.factors
}

/**
 * Compute swell access factors for a beach
 *
 * @param latitude Beach latitude
 * @param longitude Beach longitude
 * @returns Array of 72 access factors (0-1)
 */
async function computeSwellAccess(
  latitude: number,
  longitude: number
): Promise<number[]> {
  // Load landmask tile
  const landmask = await loadLandmask(latitude, longitude, DEFAULT_TERRAIN_PARAMS)

  // Run swell access algorithm
  const result = computeSwellAccessFromAlgorithm(
    latitude,
    longitude,
    DEFAULT_TERRAIN_PARAMS,
    landmask
  )

  console.log(`  [Swell] Complete: ${result.factors.length} access factors computed`)

  return result.factors
}

/**
 * Analyze a single beach
 *
 * @param beach Beach to analyze
 * @param args CLI arguments
 * @returns Analysis result
 */
async function analyzeBeach(
  beach: { id: string; name: string; lat: number; lon: number },
  args: TerrainAnalysisArgs
): Promise<BeachAnalysisResult> {
  const startTime = Date.now()

  try {
    console.log(`\n🏖️  Analyzing: ${beach.name}`)
    console.log(`   Location: (${beach.lat.toFixed(4)}, ${beach.lon.toFixed(4)})`)

    // Compute wind exposure factors
    const windExposureFactors = await computeWindExposure(
      beach.lat,
      beach.lon
    )

    // Compute swell access factors
    const swellAccessFactors = await computeSwellAccess(
      beach.lat,
      beach.lon
    )

    // Validate results
    if (windExposureFactors.length !== 72) {
      throw new Error(`Invalid wind exposure array length: ${windExposureFactors.length}`)
    }
    if (swellAccessFactors.length !== 72) {
      throw new Error(`Invalid swell access array length: ${swellAccessFactors.length}`)
    }

    // Compute params hash for caching
    const paramsHash = computeParamsHash(DEFAULT_TERRAIN_PARAMS)

    const processingTime = Date.now() - startTime

    console.log(`   ✅ Complete (${processingTime}ms)`)

    return {
      beach_id: beach.id,
      beach_name: beach.name,
      success: true,
      wind_exposure_factors: windExposureFactors,
      swell_access_factors: swellAccessFactors,
      terrain_params: DEFAULT_TERRAIN_PARAMS,
      terrain_params_hash: paramsHash,
      terrain_status: 'ok',
      processing_time_ms: processingTime,
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.log(`   ❌ Failed: ${errorMessage}`)

    return {
      beach_id: beach.id,
      beach_name: beach.name,
      success: false,
      error: errorMessage,
      processing_time_ms: processingTime,
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('=' .repeat(60))
  console.log('🌊 Terrain Analysis for Quiver Beaches')
  console.log('=' .repeat(60))
  console.log('')

  // Parse arguments
  const args = parseArgs(process.argv)

  if (args.validateOutputJsonPath) {
    const proposedExport = loadTerrainProposedExport(args.validateOutputJsonPath)
    const result = validateTerrainProposedExportArtifact(proposedExport, {
      maxArtifactAgeHours: args.maxArtifactAgeHours ?? null,
    })
    if (!result.ok) {
      throw new Error(result.findings.join('\n'))
    }
    console.log(`Terrain proposed artifact is valid: ${args.validateOutputJsonPath}`)
    return
  }

  // Display configuration
  console.log('Configuration:')
  if (args.beachId) {
    console.log(`  Beach ID: ${args.beachId}`)
  }
  if (args.beachIds && args.beachIds.length > 0) {
    console.log(`  Beach IDs: ${args.beachIds.join(', ')}`)
  }
  if (args.region) {
    console.log(`  Region: ${args.region}`)
  }
  if (args.limit !== undefined) {
    console.log(`  Limit: ${args.limit}`)
  }
  if (args.offset !== undefined) {
    console.log(`  Offset: ${args.offset}`)
  }
  if (args.outputJsonPath) {
    console.log(`  Output JSON: ${args.outputJsonPath}`)
  }
  if (args.approvalReportJsonPath) {
    console.log(`  Approval report JSON: ${args.approvalReportJsonPath}`)
  }
  if (args.approvalProposedJsonPath) {
    console.log(`  Approval proposed JSON: ${args.approvalProposedJsonPath}`)
  }
  console.log(`  Missing Only: ${args.missingOnly === true}`)
  console.log(`  Concurrency: ${args.concurrency}`)
  console.log(`  Dry Run: ${args.dryRun}`)
  console.log(`  Force Recompute: ${args.force}`)
  console.log(`  Terrain Method: ${TERRAIN_METHOD}`)
  console.log('')

  assertTerrainWriteApproved(args)

  // Validate environment
  if (!validateEnvironment()) {
    process.exit(1)
  }

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Count total beaches
  const totalBeaches = await countBeaches(supabase, {
    beachId: args.beachId,
    beachIds: args.beachIds,
    region: args.region,
    missingOnly: args.missingOnly,
  })

  console.log(`📊 Found ${totalBeaches} beach(es) matching filters`)
  console.log('')

  // Load beaches
  console.log('📥 Loading beaches...')
  const beaches = await loadBeaches(supabase, {
    beachId: args.beachId,
    beachIds: args.beachIds,
    region: args.region,
    limit: args.limit,
    offset: args.offset,
    force: args.force,
    missingOnly: args.missingOnly,
  })

  if (beaches.length === 0) {
    console.log('✅ No beaches to analyze')
    process.exit(0)
  }

  console.log(`   Loaded ${beaches.length} beach(es)`)
  console.log('')

  // Filter beaches that need analysis (unless force is set)
  const paramsHash = computeParamsHash(DEFAULT_TERRAIN_PARAMS)
  const beachesToAnalyze = beaches.filter((beach) =>
    shouldAnalyzeBeach(beach, TERRAIN_METHOD, paramsHash, args.force)
  )

  const skippedCount = beaches.length - beachesToAnalyze.length

  if (skippedCount > 0) {
    console.log(`⏭️  Skipping ${skippedCount} beach(es) (already analyzed)`)
  }

  if (beachesToAnalyze.length === 0) {
    console.log('✅ All beaches already analyzed with current method and params')
    console.log('   Use --force to recompute')
    process.exit(0)
  }

  console.log(`🔄 Analyzing ${beachesToAnalyze.length} beach(es)...`)
  console.log('')

  // Set up concurrency limiter
  const limit = pLimit(args.concurrency || 4)

  // Analyze beaches in parallel
  const batchStartTime = Date.now()
  const results = await Promise.all(
    beachesToAnalyze.map((beach) =>
      limit(() => analyzeBeach(beach, args))
    )
  )
  const batchTime = Date.now() - batchStartTime

  // Write results to database (unless dry-run)
  if (!args.dryRun) {
    assertTerrainResultsMatchApproval(args, results, TERRAIN_METHOD)

    console.log('')
    console.log('💾 Writing results to database...')

    let writeSuccessCount = 0
    let writeFailCount = 0

    for (const result of results) {
      const { success, error } = await upsertAnalysisResult(
        supabase,
        result,
        TERRAIN_METHOD
      )

      if (success) {
        writeSuccessCount++
      } else {
        writeFailCount++
        console.log(`   ❌ Failed to write ${result.beach_name}: ${error}`)
      }
    }

    console.log(`   ✅ Wrote ${writeSuccessCount} result(s)`)
    if (writeFailCount > 0) {
      console.log(`   ❌ Failed to write ${writeFailCount} result(s)`)
    }
  } else {
    console.log('')
    console.log('⚠️  DRY RUN - Results not written to database')
  }

  // Calculate summary statistics
  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const avgTime =
    results.reduce((sum, r) => sum + (r.processing_time_ms || 0), 0) / results.length

  const summary: AnalysisSummary = {
    total_beaches: beachesToAnalyze.length,
    successful,
    failed,
    skipped: skippedCount,
    total_time_ms: batchTime,
    avg_time_per_beach_ms: avgTime,
  }

  if (args.outputJsonPath) {
    const proposedExport = buildTerrainProposedExport({
      results,
      summary,
      terrainMethod: TERRAIN_METHOD,
      args,
    })
    const outputPath = writeTerrainProposedExport(
      args.outputJsonPath,
      proposedExport
    )
    console.log('')
    console.log(`🧾 Wrote Phase 0 proposed terrain JSON: ${outputPath}`)
    console.log(`   Beaches exported: ${proposedExport.beaches.length}`)
    if (proposedExport.failures.length > 0) {
      console.log(`   Failed beaches included: ${proposedExport.failures.length}`)
    }
  }

  // Display summary
  console.log('')
  console.log('=' .repeat(60))
  console.log('📊 Analysis Summary')
  console.log('=' .repeat(60))
  console.log(`Total beaches:          ${summary.total_beaches}`)
  console.log(`Successful:             ${summary.successful}`)
  console.log(`Failed:                 ${summary.failed}`)
  console.log(`Skipped (cached):       ${summary.skipped}`)
  console.log(`Total time:             ${(summary.total_time_ms / 1000).toFixed(1)}s`)
  console.log(`Avg time per beach:     ${summary.avg_time_per_beach_ms.toFixed(0)}ms`)
  console.log('')

  if (args.dryRun) {
    console.log('⚠️  DRY RUN MODE - No data was written to the database')
    console.log('   Run without --dry-run to persist results')
  } else {
    console.log('✅ Analysis complete - Results written to database')
  }

  console.log('')

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0)
}

// Execute script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
}

// Export for testing
export { main, parseArgs, analyzeBeach }
