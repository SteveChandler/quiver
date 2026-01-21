#!/usr/bin/env tsx
/**
 * Golden Beach Validation Script
 *
 * Runs terrain analysis on golden beaches and validates results against expected behavior.
 * Used for:
 * - Algorithm validation and parameter tuning
 * - Regression testing after algorithm changes
 * - Detecting bugs in DEM loading, landmask, or projections
 *
 * Usage:
 *   yarn terrain:validate                    # Run all golden beaches
 *   yarn terrain:validate --beach="Rincon"   # Run specific beach
 *   yarn terrain:validate --type=open        # Run beaches of specific type
 *   yarn terrain:validate --verbose          # Show detailed factor arrays
 *   yarn terrain:validate --polar            # Generate polar plot data
 *
 * Exit codes:
 *   0 = All validations passed
 *   1 = One or more validations failed
 */

import {
  GOLDEN_BEACHES,
  getGoldenBeachByName,
  getGoldenBeachesByType,
  checkSymmetrySanity,
  calculateFactorStats,
  type GoldenBeach,
  type BeachType,
} from './golden-beaches'
import { computeWindExposure } from './wind-exposure'
import { computeSwellAccess } from './swell-access'
import { createMockDEMTile } from './dem-loader'
import { createMockLandmaskTile } from './landmask-loader'
import { DEFAULT_TERRAIN_PARAMS } from '../../types/terrain'

// ===================================================
// CLI ARGUMENT PARSING
// ===================================================

interface ValidateArgs {
  beach?: string
  type?: BeachType
  verbose: boolean
  polar: boolean
}

function parseArgs(): ValidateArgs {
  const args: ValidateArgs = {
    verbose: false,
    polar: false,
  }

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--beach=')) {
      args.beach = arg.slice('--beach='.length)
    } else if (arg.startsWith('--type=')) {
      args.type = arg.slice('--type='.length) as BeachType
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true
    } else if (arg === '--polar' || arg === '-p') {
      args.polar = true
    }
  }

  return args
}

// ===================================================
// VALIDATION RESULT TYPES
// ===================================================

interface ValidationResult {
  beach: GoldenBeach
  success: boolean
  wind_factors?: number[]
  swell_factors?: number[]
  wind_stats?: ReturnType<typeof calculateFactorStats>
  swell_stats?: ReturnType<typeof calculateFactorStats>
  errors: string[]
  warnings: string[]
  processing_time_ms: number
}

// ===================================================
// VALIDATION LOGIC
// ===================================================

/**
 * Validate a single golden beach
 */
async function validateGoldenBeach(beach: GoldenBeach, verbose: boolean): Promise<ValidationResult> {
  const startTime = Date.now()
  const errors: string[] = []
  const warnings: string[] = []

  console.log(`\n${'='.repeat(80)}`)
  console.log(`Validating: ${beach.name} (${beach.location})`)
  console.log(`Type: ${beach.type}`)
  console.log(`Expected: ${beach.expected_behavior.notes}`)
  console.log('='.repeat(80))

  try {
    // Create mock DEM and landmask tiles
    // Note: Using mock data until real DEM/landmask integration is complete
    const demTile = createMockDEMTile(beach.latitude, beach.longitude)
    const landmaskTile = createMockLandmaskTile(beach.latitude, beach.longitude)

    // Compute wind exposure
    console.log('\n📊 Computing wind exposure...')
    const windResult = computeWindExposure(
      beach.latitude,
      beach.longitude,
      DEFAULT_TERRAIN_PARAMS,
      demTile
    )
    const windStats = calculateFactorStats(windResult.factors)

    console.log(`   Mean: ${windStats.mean.toFixed(3)}`)
    console.log(`   StdDev: ${windStats.stdDev.toFixed(3)}`)
    console.log(`   Range: [${windStats.min.toFixed(3)}, ${windStats.max.toFixed(3)}]`)

    // Compute swell access
    console.log('\n🌊 Computing swell access...')
    const swellResult = computeSwellAccess(
      beach.latitude,
      beach.longitude,
      DEFAULT_TERRAIN_PARAMS,
      landmaskTile
    )
    const swellStats = calculateFactorStats(swellResult.factors)

    console.log(`   Mean: ${swellStats.mean.toFixed(3)}`)
    console.log(`   StdDev: ${swellStats.stdDev.toFixed(3)}`)
    console.log(`   Range: [${swellStats.min.toFixed(3)}, ${swellStats.max.toFixed(3)}]`)

    // Validate array structure
    if (windResult.factors.length !== 72) {
      errors.push(`Wind factors has ${windResult.factors.length} elements (expected 72)`)
    }
    if (swellResult.factors.length !== 72) {
      errors.push(`Swell factors has ${swellResult.factors.length} elements (expected 72)`)
    }

    // Validate value range [0, 1]
    const windOutOfRange = windResult.factors.filter(f => f < 0 || f > 1)
    if (windOutOfRange.length > 0) {
      errors.push(`Wind factors has ${windOutOfRange.length} values out of [0, 1] range`)
    }

    const swellOutOfRange = swellResult.factors.filter(f => f < 0 || f > 1)
    if (swellOutOfRange.length > 0) {
      errors.push(`Swell factors has ${swellOutOfRange.length} values out of [0, 1] range`)
    }

    // Type-specific validation
    console.log('\n🔍 Validating expected behavior...')

    if (beach.type === 'open') {
      // Open beaches should have uniform factors (low variance)
      const windSymmetric = checkSymmetrySanity(windResult.factors, 0.1)
      const swellSymmetric = checkSymmetrySanity(swellResult.factors, 0.1)

      if (!windSymmetric) {
        warnings.push(
          `Wind exposure not uniform (StdDev: ${windStats.stdDev.toFixed(3)}). ` +
            `Expected uniform exposure for open beach. May indicate DEM artifacts or projection bugs.`
        )
      } else {
        console.log(`   ✅ Wind exposure is uniform (StdDev: ${windStats.stdDev.toFixed(3)} < 0.1)`)
      }

      if (!swellSymmetric) {
        warnings.push(
          `Swell access not uniform (StdDev: ${swellStats.stdDev.toFixed(3)}). ` +
            `Expected uniform access for open beach. May indicate landmask errors.`
        )
      } else {
        console.log(`   ✅ Swell access is uniform (StdDev: ${swellStats.stdDev.toFixed(3)} < 0.1)`)
      }

      // Check that mean exposure is close to expected for flat terrain
      // sigmoid((8.0 - 0) / 3.0) ≈ 0.935
      const expectedWindExposure = 1 / (1 + Math.exp(-(DEFAULT_TERRAIN_PARAMS.angle_mid / DEFAULT_TERRAIN_PARAMS.k)))
      if (Math.abs(windStats.mean - expectedWindExposure) > 0.05) {
        warnings.push(
          `Wind exposure mean ${windStats.mean.toFixed(3)} differs from expected ${expectedWindExposure.toFixed(3)} ` +
            `for flat terrain. May indicate algorithm issue.`
        )
      } else {
        console.log(
          `   ✅ Wind exposure mean ${windStats.mean.toFixed(3)} close to expected ${expectedWindExposure.toFixed(3)}`
        )
      }

      // Open beaches should have high swell access
      if (swellStats.mean < 0.9) {
        warnings.push(
          `Swell access mean ${swellStats.mean.toFixed(3)} is lower than expected for open beach (>0.9). ` +
            `May indicate landmask blockage errors.`
        )
      } else {
        console.log(`   ✅ Swell access mean ${swellStats.mean.toFixed(3)} is high (>0.9)`)
      }
    } else if (beach.type === 'sheltered' || beach.type === 'headland') {
      // Sheltered beaches should have directional variation
      if (windStats.stdDev < 0.05) {
        warnings.push(
          `Wind exposure StdDev ${windStats.stdDev.toFixed(3)} is too low for sheltered beach. ` +
            `Expected directional variation. May indicate DEM loading issue.`
        )
      } else {
        console.log(
          `   ✅ Wind exposure shows directional variation (StdDev: ${windStats.stdDev.toFixed(3)} > 0.05)`
        )
      }

      // Check for expected sheltered directions (if specified)
      if (beach.expected_behavior.wind_sheltered_directions?.length) {
        const shelteredDirs = beach.expected_behavior.wind_sheltered_directions
        const shelteredBins = shelteredDirs.map(deg => Math.floor(deg / 5))
        const avgShelteredExposure =
          shelteredBins.reduce((sum, bin) => sum + windResult.factors[bin], 0) / shelteredBins.length

        if (avgShelteredExposure > 0.7) {
          warnings.push(
            `Expected sheltered directions (${shelteredDirs.join(', ')}°) have high exposure ` +
              `(avg: ${avgShelteredExposure.toFixed(3)}). Expected <0.7 for sheltered directions.`
          )
        } else {
          console.log(
            `   ✅ Sheltered directions (${shelteredDirs.slice(0, 3).join(', ')}°...) have low exposure ` +
              `(avg: ${avgShelteredExposure.toFixed(3)} < 0.7)`
          )
        }
      }
    } else if (beach.type === 'deep_bay') {
      // Bay beaches should have narrow swell window
      if (swellStats.range < 0.3) {
        warnings.push(
          `Swell access range ${swellStats.range.toFixed(3)} is too small for bay. ` +
            `Expected significant variation between blocked and open directions.`
        )
      } else {
        console.log(`   ✅ Swell access shows bay pattern (range: ${swellStats.range.toFixed(3)} > 0.3)`)
      }

      // Check that mean swell access is lower than open beaches
      if (swellStats.mean > 0.8) {
        warnings.push(
          `Swell access mean ${swellStats.mean.toFixed(3)} is too high for bay. ` +
            `Expected reduced access due to surrounding land.`
        )
      } else {
        console.log(`   ✅ Swell access mean ${swellStats.mean.toFixed(3)} shows bay restriction (<0.8)`)
      }
    }

    // Display verbose factor arrays if requested
    if (verbose) {
      console.log('\n📋 Wind Exposure Factors (by direction):')
      printFactorTable(windResult.factors)

      console.log('\n📋 Swell Access Factors (by direction):')
      printFactorTable(swellResult.factors)
    }

    const processingTime = Date.now() - startTime

    return {
      beach,
      success: errors.length === 0,
      wind_factors: windResult.factors,
      swell_factors: swellResult.factors,
      wind_stats: windStats,
      swell_stats: swellStats,
      errors,
      warnings,
      processing_time_ms: processingTime,
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    errors.push(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`)

    return {
      beach,
      success: false,
      errors,
      warnings,
      processing_time_ms: processingTime,
    }
  }
}

/**
 * Print factor array as formatted table
 */
function printFactorTable(factors: number[]) {
  const directionsPerRow = 8
  for (let i = 0; i < factors.length; i += directionsPerRow) {
    const row = factors.slice(i, i + directionsPerRow)
    const directionLabels = row.map((_, idx) => `${((i + idx) * 5).toString().padStart(3, ' ')}°`).join(' ')
    const factorValues = row.map(f => f.toFixed(3)).join(' ')

    console.log(`   ${directionLabels}`)
    console.log(`   ${factorValues}`)
  }
}

/**
 * Generate polar plot data (CSV format)
 */
function generatePolarPlotData(result: ValidationResult) {
  console.log('\n📊 Polar Plot Data (CSV format):')
  console.log('direction_deg,wind_exposure,swell_access')

  for (let i = 0; i < 72; i++) {
    const directionDeg = i * 5
    const windExposure = result.wind_factors?.[i] ?? 0
    const swellAccess = result.swell_factors?.[i] ?? 0
    console.log(`${directionDeg},${windExposure.toFixed(4)},${swellAccess.toFixed(4)}`)
  }
}

// ===================================================
// MAIN VALIDATION RUNNER
// ===================================================

async function main() {
  console.log('🏖️  Golden Beach Validation')
  console.log('=' .repeat(80))
  console.log('')
  console.log('⚠️  Note: Currently using MOCK DEM and landmask data')
  console.log('   Real terrain validation will be possible once DEM/landmask integration is complete.')
  console.log('   This validation tests the pipeline end-to-end with uniform mock data.')
  console.log('')

  const args = parseArgs()

  // Select beaches to validate
  let beachesToValidate: GoldenBeach[] = []

  if (args.beach) {
    const beach = getGoldenBeachByName(args.beach)
    if (!beach) {
      console.error(`❌ Beach "${args.beach}" not found in golden beaches dataset`)
      console.error('Available beaches:', GOLDEN_BEACHES.map(b => b.name).join(', '))
      process.exit(1)
    }
    beachesToValidate = [beach]
  } else if (args.type) {
    beachesToValidate = getGoldenBeachesByType(args.type)
    if (beachesToValidate.length === 0) {
      console.error(`❌ No beaches found with type "${args.type}"`)
      process.exit(1)
    }
  } else {
    beachesToValidate = GOLDEN_BEACHES
  }

  console.log(`📋 Validating ${beachesToValidate.length} golden beach(es)...\n`)

  // Run validation on each beach
  const results: ValidationResult[] = []

  for (const beach of beachesToValidate) {
    const result = await validateGoldenBeach(beach, args.verbose)
    results.push(result)

    // Print result summary
    if (result.success) {
      console.log(`\n✅ PASSED: ${beach.name}`)
    } else {
      console.log(`\n❌ FAILED: ${beach.name}`)
    }

    if (result.errors.length > 0) {
      console.log('   Errors:')
      result.errors.forEach(err => console.log(`     - ${err}`))
    }

    if (result.warnings.length > 0) {
      console.log('   Warnings:')
      result.warnings.forEach(warn => console.log(`     - ${warn}`))
    }

    console.log(`   Processing time: ${result.processing_time_ms}ms`)

    // Generate polar plot data if requested
    if (args.polar) {
      generatePolarPlotData(result)
    }
  }

  // Print final summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 VALIDATION SUMMARY')
  console.log('='.repeat(80))

  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0)
  const avgTime = results.reduce((sum, r) => sum + r.processing_time_ms, 0) / results.length

  console.log(`Total beaches: ${results.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total warnings: ${totalWarnings}`)
  console.log(`Average processing time: ${avgTime.toFixed(0)}ms`)

  if (failed > 0) {
    console.log('\n❌ Validation FAILED')
    process.exit(1)
  } else if (totalWarnings > 0) {
    console.log('\n⚠️  Validation PASSED with warnings')
    console.log('   Review warnings above to ensure expected behavior')
    process.exit(0)
  } else {
    console.log('\n✅ Validation PASSED')
    process.exit(0)
  }
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
