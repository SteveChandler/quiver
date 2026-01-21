# Terrain Analysis Validation

This document describes the golden beach validation system for terrain-aware geometry scoring.

## Overview

The golden beach validation system validates terrain analysis algorithms against a curated set of beaches with known coastal geometries. This ensures that wind exposure and swell access factors match surfer intuition before deploying to production.

**Status**: ACTIVE - Real elevation data from AWS Terrain Tiles is now being used. All 31 terrain tests pass.

## Golden Beach Dataset

### Location

`scripts/terrain/golden-beaches.ts`

### Beach Types

The dataset includes 9 California beaches representing 7 distinct coastal geometries:

| Beach | Type | Purpose |
|-------|------|---------|
| Huntington Beach | open | Baseline - uniform exposure/access |
| Ocean Beach SF | open | Exposed beach break validation |
| Rincon | sheltered | Hills block NE winds |
| Malibu First Point | headland | Asymmetric wrap effects |
| Trestles | sheltered | Semi-protected (partial shelter) |
| Santa Cruz - Cowell Beach | deep_bay | Protected wind, narrow swell window |
| Stinson Beach | false_shelter | Catches over-shelter bugs (low dunes) |
| San Diego - Tourmaline | harbor | Complex coastline geometry |
| Steamer Lane | peninsula | Long peninsula with wrap asymmetry |

### Expected Behaviors

Each beach includes:
- **Wind exposure pattern**: uniform, directional_shelter, or asymmetric
- **Swell access pattern**: full, narrow_window, or wrap_dependent
- **Detailed notes**: Explains why this beach was chosen and what to expect
- **Sheltered directions**: Specific angles expected to show low wind exposure
- **Open swell directions**: Specific angles expected to have good swell access
- **Blocked swell directions**: Specific angles expected to be blocked

## Validation Script

### Location

`scripts/terrain/validate-golden-beaches.ts`

### Usage

```bash
# Validate all golden beaches
yarn terrain:validate

# Validate specific beach
yarn terrain:validate --beach="Huntington Beach"

# Validate beaches of specific type
yarn terrain:validate --type=open
yarn terrain:validate --type=sheltered

# Show detailed factor arrays
yarn terrain:validate --verbose

# Generate polar plot data (CSV format)
yarn terrain:validate --polar
```

### Output

The script produces detailed validation reports including:
- Wind exposure factors (mean, stddev, range)
- Swell access factors (mean, stddev, range)
- Type-specific validation checks
- Errors and warnings
- Processing time per beach
- Summary statistics

### Exit Codes

- `0`: All validations passed
- `1`: One or more validations failed

## Validation Checks

### For All Beaches

1. **Array structure**: 72 elements for both wind and swell factors
2. **Value range**: All factors in [0, 1]
3. **Processing success**: No exceptions during analysis

### For Open Beaches

1. **Uniform exposure**: StdDev < 0.1 for wind exposure
2. **Uniform access**: StdDev < 0.1 for swell access
3. **Expected mean**: Wind exposure ~0.935 (sigmoid of flat terrain)
4. **High swell access**: Mean > 0.9

### For Sheltered Beaches

1. **Directional variation**: Wind exposure StdDev > 0.05
2. **Sheltered directions**: Specified directions have exposure < 0.7
3. **Asymmetric patterns**: Not uniform across all directions

### For Bay Beaches

1. **Swell access variation**: Range > 0.3 (blocked vs open directions)
2. **Reduced mean access**: Mean < 0.8 due to surrounding land

## Current Status

### Real Data Implementation (COMPLETE)

The validation system now uses **real elevation data** from AWS Terrain Tiles:

- **DEM Source**: AWS Terrain Tiles (Terrarium PNG format)
- **Resolution**: ~30m at zoom level 12
- **Land Detection**: Elevation-based (elevation > 0.5m = land)
- **Two-Phase Algorithm**: Correctly handles beach landmass detection

**Critical Bug Fix Applied**: The `analyzeSwellPath()` function now implements two-phase detection:
1. Phase 1: Exit beach landmass (skip land until reaching water)
2. Phase 2: Check for blocking land beyond the water

This fixed the issue where swell access was uniformly low (~0.003) because the algorithm was detecting the beach itself as "land".

### Production Results

261 beaches processed successfully:
- Total processing time: 37.4 seconds
- Average: 143ms per beach
- All 31 terrain tests pass

### Expected Validation Outcomes

With real data:

| Beach Type | Wind Exposure | Swell Access |
|------------|---------------|--------------|
| Open | Uniform (~0.93) | High (~1.0) |
| Sheltered | Directional variation | Varies by geometry |
| Deep Bay | Directional shelter | Narrow window |
| Headland | Asymmetric | Wrap-dependent |
| Peninsula | Directional | Strong wrap effects |

## Automated Testing

### Test Suite Location

`scripts/terrain/__tests__/golden-beaches.test.ts`

### Coverage

- Dataset structure validation (40+ tests)
- Helper function validation (checkSymmetrySanity, calculateFactorStats)
- Beach type classifications
- Expected behavior consistency

### Running Tests

```bash
# Run all terrain tests
yarn test:unit scripts/terrain/__tests__/

# Run golden beaches tests only
yarn test:unit scripts/terrain/__tests__/golden-beaches.test.ts

# Run with coverage
yarn test:unit --coverage scripts/terrain/__tests__/
```

## Parameter Tuning Workflow

When adjusting algorithm parameters:

1. **Run baseline validation**
   ```bash
   yarn terrain:validate > baseline.txt
   ```

2. **Inspect open beaches first**
   - Should show uniform factors (~0.93 wind, ~1.0 swell)
   - If not, indicates projection bugs or DEM artifacts

3. **Check sheltered beaches**
   - Compare expected sheltered directions to actual exposure values
   - If shelter too strong/weak, adjust `angle_mid` or `k` parameters

4. **Validate bay beaches**
   - Check swell access patterns match expected blockage
   - If blockage too aggressive, adjust `blockage_threshold_m`

5. **Test wrap effects**
   - Headland/peninsula beaches should show asymmetric swell access
   - If wrap too weak, decrease `wrap_lambda`
   - If wrap too strong, increase `wrap_lambda` or reduce `max_wrap_angle`

6. **Generate polar plots**
   ```bash
   yarn terrain:validate --beach="Rincon" --polar > rincon_polar.csv
   # Plot in your favorite tool (Python matplotlib, R ggplot2, etc.)
   ```

7. **Iterate parameters**
   - Edit `DEFAULT_TERRAIN_PARAMS` in `types/terrain.ts`
   - Re-run validation
   - Repeat until golden beaches "look right"

## Safety Checks

The validation system includes automated checks for common bugs:

1. **Projection errors**: Open beaches with high variance indicate coordinate/UTM bugs
2. **DEM artifacts**: Sudden spikes in horizon angles
3. **Landmask errors**: Phantom land in open ocean
4. **Algorithm bugs**: Factors outside [0, 1] range
5. **Performance issues**: Processing time >1000ms per beach

## Known Issues and Workarounds

### Beach Landmass Detection (FIXED)

**Issue**: Initial swell access implementation detected the beach itself as land, resulting in uniformly low access (~0.003).

**Solution**: Implemented two-phase `analyzeSwellPath()` algorithm that first exits the beach landmass before checking for blocking land.

### Tile Fetch Failures

**Issue**: Occasionally a tile fetch may fail due to network issues.

**Workaround**: The system falls back to flat terrain (elevation = 0) for failed tiles. Retry the analysis for affected beaches.

### Mock Mode for Testing

**Usage**: Set `USE_MOCK_TERRAIN=true` environment variable to use mock flat terrain for testing without network requests.

```bash
USE_MOCK_TERRAIN=true yarn terrain:validate
```

## Adding New Golden Beaches

To add a new golden beach:

1. Choose a beach with well-known terrain characteristics
2. Add entry to `GOLDEN_BEACHES` array in `golden-beaches.ts`:
   ```typescript
   {
     name: 'Beach Name',
     latitude: XX.XXXX,
     longitude: -XXX.XXXX,
     type: 'open' | 'sheltered' | 'deep_bay' | 'headland' | 'false_shelter' | 'harbor' | 'peninsula',
     location: 'City, State',
     region: 'region_identifier',
     expected_behavior: {
       wind_exposure_pattern: 'uniform' | 'directional_shelter' | 'asymmetric',
       swell_access_pattern: 'full' | 'narrow_window' | 'wrap_dependent',
       notes: 'Detailed explanation of why this beach is interesting...',
       wind_sheltered_directions: [0, 5, 10, ...], // Optional
       swell_open_directions: [180, 185, ...], // Optional
       swell_blocked_directions: [90, 95, ...], // Optional
     },
   }
   ```
3. Run tests: `yarn test:unit scripts/terrain/__tests__/golden-beaches.test.ts`
4. Run validation: `yarn terrain:validate --beach="Beach Name"`
5. Document expected behavior in this file

## Integration with Design Document

This validation system implements **Section 6: Rollout and Verification / Phase 1: Golden Beach Validation** from the [Terrain-Aware Geometry Scoring Design](../../docs/plans/2026-01-20-terrain-geometry-scoring-design.md).

### Completed Phases

- [x] **Phase 1**: Golden Beach Validation - Real terrain data integrated and validated
- [ ] **Phase 2**: Before/After Diff (compare terrain-enabled vs disabled scoring)
- [ ] **Phase 3**: Staged Rollout (per-beach enablement)

## API Reference

### analyzeSwellPath()

```typescript
function analyzeSwellPath(
  landmask: LandmaskTile,
  originUtmX: number,
  originUtmY: number,
  bearingDeg: number,
  maxDistanceM: number,
  stepM: number
): SwellPathResult

interface SwellPathResult {
  reachedWater: boolean          // Did we exit beach landmass?
  distanceToWater: number | null // Distance to reach water
  distanceToBlockingLand: number | null // Distance to blocking land (from water edge)
}
```

### checkSymmetrySanity()

```typescript
function checkSymmetrySanity(factors: number[], maxStdDev?: number): boolean
```

Returns `true` if the factor array has sufficiently low variance (default threshold: 0.1).

### calculateFactorStats()

```typescript
function calculateFactorStats(factors: number[]): FactorStats

interface FactorStats {
  mean: number
  stdDev: number
  min: number
  max: number
  range: number
}
```
