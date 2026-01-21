# Terrain Analysis Scripts

This directory contains modules for analyzing beach terrain to compute directional wind exposure and swell access factors using real elevation data.

## Overview

The terrain analysis system encodes beach-specific wind shelter and swell wrap behavior into Quiver's scoring algorithm using terrain/elevation data. This captures the surfer intuition that "Beach C fires when wind is SW because the hills block it" - knowledge that currently takes years of experience to develop.

**Status**: IMPLEMENTED - Real terrain data integration complete. 261 beaches processed with AWS Terrain Tiles elevation data.

## Architecture

### Data Flow

```
+-------------------+     +--------------------+     +-------------------+
|  AWS Terrain      |     |   Analysis Layer   |     |   Database        |
|  Tiles (S3)       |     |                    |     |                   |
+-------------------+     +--------------------+     +-------------------+
|                   |     |                    |     |                   |
| Terrarium PNG     |---->| dem-loader.ts      |---->| beaches table     |
| (SRTM 30m)        |     | - Tile fetching    |     | wind_exposure_    |
|                   |     | - PNG decoding     |     |   factors[72]     |
+-------------------+     | - Elevation grid   |     |                   |
                          +--------------------+     | swell_access_     |
                                   |                 |   factors[72]     |
                                   v                 |                   |
                          +--------------------+     | terrain_method    |
                          | wind-exposure.ts   |     | terrain_params    |
                          | - Horizon angles   |     | terrain_status    |
                          | - Sigmoid transform|     +-------------------+
                          +--------------------+
                                   |
                          +--------------------+
                          | landmask-loader.ts |
                          | - Elevation-based  |
                          |   land detection   |
                          | - Swell path       |
                          |   analysis         |
                          +--------------------+
                                   |
                                   v
                          +--------------------+
                          | swell-access.ts    |
                          | - Ray casting      |
                          | - Wrap effects     |
                          +--------------------+
```

### Main Script

**`scripts/terrain-analysis.ts`** - CLI script that orchestrates the terrain analysis pipeline:
1. Loads beaches from database (with filtering)
2. Analyzes each beach in parallel (configurable concurrency)
3. Computes wind exposure and swell access factors
4. Writes results to database

### Modules

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript types for script operations |
| `database.ts` | Database operations (load, upsert, count) |
| `dem-loader.ts` | DEM tile loading from AWS Terrain Tiles |
| `landmask-loader.ts` | Elevation-based land detection and swell path analysis |
| `projection.ts` | UTM coordinate conversion using proj4 |
| `wind-exposure.ts` | Wind exposure algorithm (horizon angles) |
| `swell-access.ts` | Swell access algorithm (ray casting + wrap) |
| `golden-beaches.ts` | Validation dataset for parameter tuning |
| `validate-golden-beaches.ts` | Automated validation runner |

## Implementation Details

### DEM Data Source

**AWS Terrain Tiles** (free, no API key required):
- URL: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- Format: Terrarium PNG encoding
- Resolution: ~30m at zoom level 12
- Coverage: Global (SRTM data)
- Encoding: `elevation = (R * 256 + G + B / 256) - 32768`

### Land Detection

Land vs water is determined using elevation:
- **Land**: elevation > 0.5m
- **Water**: elevation <= 0.5m

This approach eliminates the need for separate coastline data and correctly handles the "beach landmass" problem where beaches themselves are detected as land.

### Critical Bug Fix: Two-Phase Swell Path Analysis

**Problem**: Initial implementation detected the beach itself as "land", causing all swell directions to show as blocked (uniformly low access ~0.003).

**Solution**: The `analyzeSwellPath()` function implements a two-phase algorithm:

1. **Phase 1 - Exit Beach Landmass**: Cast ray from beach, skip past any land until reaching water (the ocean)
2. **Phase 2 - Check for Blocking Land**: Continue ray to detect any land beyond the water that would block swell

```typescript
// Simplified algorithm
for (distance = step; distance <= maxDistance; distance += step) {
  const onLand = isLand(landmask, point)

  if (!foundWater) {
    // Phase 1: Looking for water
    if (!onLand) foundWater = true
  } else {
    // Phase 2: Check for blocking land beyond water
    if (onLand) return { blocked: true, distance }
  }
}
```

## Usage

### Basic Commands

```bash
# Analyze all beaches
yarn terrain:analyze

# Analyze specific beach
yarn terrain:analyze --beach-id=<uuid>

# Analyze region
yarn terrain:analyze --region=california

# Analyze with limits
yarn terrain:analyze --limit=50 --offset=0

# Dry run (compute without writing)
yarn terrain:analyze:dry
yarn terrain:analyze --dry-run

# Force recomputation
yarn terrain:analyze:force
yarn terrain:analyze --force

# Custom concurrency
yarn terrain:analyze --concurrency=8

# Combined flags
yarn terrain:analyze --region=hawaii --limit=100 --dry-run --concurrency=8
```

### Environment Variables

**Required**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access

**Optional**:
- `USE_MOCK_TERRAIN=true` - Use mock flat terrain for testing

### Example Output

```
============================================================
Terrain Analysis for Quiver Beaches
============================================================

Configuration:
  Region: all
  Limit: none
  Concurrency: 4
  Dry Run: false
  Force Recompute: false
  Terrain Method: dem_horizon_v1

Found 261 beach(es) matching filters

Loading beaches...
   Loaded 261 beach(es)

Analyzing 261 beach(es)...

Beach: Pipeline
   Location: (21.6651, -158.0539)
  [DEM] Loading real elevation data for (21.6651, -158.0539)
  [DEM] Loaded 512x512 grid, resolution ~28.9m
  [Wind] Computed exposure factors (mean=0.87, range=0.23)
  [Swell] Computed access factors (mean=0.72, range=0.45)
   Complete (892ms)

[... more beaches ...]

============================================================
Analysis Summary
============================================================
Total beaches:          261
Successful:             261
Failed:                 0
Skipped (cached):       0
Total time:             37.4s
Avg time per beach:     143ms

Analysis complete - Results written to database
```

## Algorithm Details

### Wind Exposure Algorithm

**File**: `wind-exposure.ts`

Computes how exposed a beach is to wind from each direction using horizon angle analysis.

**Algorithm**:
1. Project beach to UTM for accurate distance calculations
2. For each direction (0, 5, 10, ... 355 degrees):
   - Cast ray upwind from beach up to `max_radius_m` (5000m)
   - Sample elevation at `step_m` intervals (60m)
   - Calculate horizon angle: `atan2(elevation_delta, distance)`
   - Track maximum horizon in near zone (0-500m) and far zone (500m+)
   - Blend: `max_horizon = 0.6 * near + 0.4 * far`
   - Apply sigmoid transform: `exposure = sigmoid((angle_mid - max_horizon) / k)`
3. Apply circular smoothing with kernel [0.25, 0.5, 0.25]
4. Return 72-element array of exposure factors [0, 1]

**Key Parameters**:
- `max_radius_m`: 5000 (wind ray length)
- `near_far_split_m`: 500 (micro vs macro shelter boundary)
- `angle_mid`: 8.0 degrees (shelter threshold)
- `k`: 3.0 (sigmoid steepness)

### Swell Access Algorithm

**File**: `swell-access.ts`

Computes how accessible swell is from each direction, including refraction/wrap effects.

**Algorithm**:
1. Project beach to UTM
2. For each direction (0, 5, 10, ... 355 degrees):
   - Use `analyzeSwellPath()` to check for blocking land
   - If no blocking land: `access = 1.0`
   - If blocking land within threshold: `access = (distance/threshold)^1.5`
3. For blocked directions (direct_access < 0.8):
   - Check adjacent directions for wrap contribution
   - Apply exponential decay: `wrap = adjacent * exp(-wrap_lambda * offset)`
4. Combine: `final_access = max(direct_access, wrap_access * 0.85)`
5. Apply circular smoothing
6. Return 72-element array of access factors [0, 1]

**Key Parameters**:
- `swell_ray_length_m`: 3500 (swell ray length)
- `blockage_threshold_m`: 3000 (blocking distance threshold)
- `wrap_lambda`: 0.04 (wrap decay per degree)
- `max_wrap_angle`: 45 degrees

## Database Schema

The script writes to these fields in the `beaches` table:

```sql
-- 72-element arrays (5 degree bins: 0, 5, 10, ... 355)
wind_exposure_factors    real[]      -- 1.0 = exposed, 0.0 = sheltered
swell_access_factors     real[]      -- 1.0 = accessible, 0.0 = blocked

-- Cache validation
terrain_method           text        -- e.g., 'dem_horizon_v1'
terrain_params           jsonb       -- Algorithm parameters
terrain_params_hash      text        -- SHA256 of params (fast check)

-- Timestamps
terrain_analyzed_at      timestamptz -- Last analysis completion
wind_analyzed_at         timestamptz -- Wind analysis timestamp
swell_analyzed_at        timestamptz -- Swell analysis timestamp

-- Status
terrain_status           text        -- 'ok' | 'wind_only' | 'failed'
terrain_enabled          boolean     -- Feature flag

-- Debug (optional)
terrain_analysis_debug   jsonb       -- Visualization data
```

## Performance

**Actual metrics** (production run):
- 261 beaches processed
- Total time: 37.4 seconds
- Average: 143ms per beach (561ms with network latency variance)
- Tile caching reduces repeated fetches within same region

**Resource usage**:
- ~6,000 elevation samples per beach (wind)
- ~12,000 landmask lookups per beach (swell)
- In-memory tile cache prevents redundant downloads

## Testing

### Unit Tests

```bash
# Run all terrain tests
yarn test:unit scripts/terrain/__tests__/

# Run specific test file
yarn test:unit scripts/terrain/__tests__/wind-exposure.test.ts
yarn test:unit scripts/terrain/__tests__/swell-access.test.ts
yarn test:unit scripts/terrain/__tests__/golden-beaches.test.ts
```

### Golden Beach Validation

```bash
# Validate all golden beaches
yarn terrain:validate

# Validate specific beach
yarn terrain:validate --beach="Rincon"

# Validate by type
yarn terrain:validate --type=open
yarn terrain:validate --type=sheltered
```

### Mock Mode Testing

```bash
# Run with mock terrain (flat, all water)
USE_MOCK_TERRAIN=true yarn terrain:analyze --dry-run --limit=5
```

## Golden Beaches

The validation dataset includes 9 California beaches representing 7 coastal geometry types:

| Beach | Type | Purpose |
|-------|------|---------|
| Huntington Beach | open | Baseline - uniform exposure/access |
| Ocean Beach SF | open | Exposed beach break validation |
| Rincon | sheltered | Hills block NE winds |
| Malibu First Point | headland | Asymmetric wrap effects |
| Trestles | sheltered | Semi-protected (partial shelter) |
| Cowell Beach | deep_bay | Protected wind, narrow swell window |
| Stinson Beach | false_shelter | Catches over-shelter bugs |
| Tourmaline | harbor | Complex coastline geometry |
| Steamer Lane | peninsula | Long peninsula with wrap asymmetry |

## Configuration

Default parameters are defined in `types/terrain.ts`:

```typescript
export const DEFAULT_TERRAIN_PARAMS: TerrainAnalysisParams = {
  max_radius_m: 5000,
  blockage_threshold_m: 3000,
  swell_ray_length_m: 3500,
  step_m: 60,
  angle_mid: 8.0,
  k: 3.0,
  min_exposure: 0.15,
  wrap_lambda: 0.04,
  max_wrap_angle: 45,
  smoothing_kernel: [0.25, 0.5, 0.25],
  dem_source: 'aws_terrain_tiles',
  resolution_m: 30,
  near_far_split_m: 500,
}
```

## Error Handling

The script handles:
- Missing environment variables (exits with error)
- Database connection failures (exits with error)
- Tile fetch failures (falls back to flat terrain)
- Beach-level analysis failures (marks as failed, continues)
- Database write failures (logs error, continues)

Exit codes:
- `0` - Success (all beaches analyzed or skipped)
- `1` - Failure (any beaches failed or fatal error)

## Related Documentation

- [Architecture Details](./ARCHITECTURE.md) - System architecture and scoring integration
- [Validation Guide](./VALIDATION.md) - Golden beach validation procedures
- [Types Reference](/Users/stevenchandler/Desktop/quiver/types/terrain.ts) - TypeScript type definitions
- [Design Document](/Users/stevenchandler/Desktop/quiver/docs/plans/2026-01-20-terrain-geometry-scoring-design.md) - Original design specification
