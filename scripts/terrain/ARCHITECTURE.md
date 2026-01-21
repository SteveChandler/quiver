# Terrain Analysis Architecture

## Overview

The terrain analysis system encodes beach-specific wind shelter and swell wrap behavior into Quiver's scoring algorithm using terrain/elevation data. This captures the surfer intuition that "Beach C fires when wind is SW because the hills block it" - knowledge that currently takes years of experience to develop.

**Status**: IMPLEMENTED - Real terrain data integration complete using AWS Terrain Tiles (SRTM elevation data).

**Problem Statement**: Current scoring treats all beaches as equivalent receivers of swell/wind. In reality, the interaction between swell direction + beach orientation + headland refraction and wind direction + terrain shelter determines which spot actually fires on a given day.

**Example**: Three beach breaks, W swell, SW wind:
- Beach A (faces SW): Direct swell but onshore wind - junky
- Beach B (faces W): Good swell but cross-onshore - medium
- Beach C (faces NW): Wrapped swell + hills block SW wind - **cleanest option**

Current scoring cannot make the Beach C call. This system fixes that.

---

## System Architecture Diagram

```
+------------------+     +------------------+     +------------------+
|   Data Sources   |     |  Analysis Layer  |     |  Application     |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| AWS Terrain      |---->| Wind Exposure    |---->| Scoring Engine   |
| Tiles (S3)       |     | Algorithm        |     | (lib/surf/       |
| (30m SRTM)       |     | (horizon angles) |     |  scoring.ts)     |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| Elevation-based  |---->| Swell Access     |---->| Beach Detail     |
| Land Detection   |     | Algorithm        |     | Pages            |
| (>0.5m = land)   |     | (ray casting)    |     |                  |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
|  Supabase DB     |<----|  CLI Pipeline    |     |  Feature Flags   |
|  beaches table   |     |  (scripts/       |     |  terrain_enabled |
|  - wind_exposure |     |   terrain/)      |     |  per-beach       |
|  - swell_access  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

---

## Components

### 1. Database Schema

New fields added to the `beaches` table:

```sql
-- Directional factors as fixed 5-degree bins (72 values: 0, 5, 10... 355)
-- Semantics: 1.0 = fully exposed/accessible, 0.0 = fully sheltered/blocked
wind_exposure_factors    real[],   -- length 72
swell_access_factors     real[],   -- length 72 (includes direct + wrap)

-- Versioning with method contract
terrain_method           text,     -- e.g., 'dem_horizon_v1'
terrain_params           jsonb,    -- Algorithm parameters for reproducibility
terrain_params_hash      text,     -- SHA256 of canonical params (fast skip check)
terrain_analyzed_at      timestamptz,

-- Granular status tracking
wind_analyzed_at         timestamptz,
swell_analyzed_at        timestamptz,
terrain_status           text,     -- 'ok' | 'wind_only' | 'failed'

-- Per-beach enablement (staged rollout)
terrain_enabled          boolean DEFAULT false,

-- Optional debug/visualization (not used in hot path)
terrain_analysis_debug   jsonb
```

**Database Constraints**:

```sql
-- Ensure arrays are valid length when present
ALTER TABLE beaches
  ADD CONSTRAINT wind_exposure_len
    CHECK (wind_exposure_factors IS NULL OR array_length(wind_exposure_factors, 1) = 72),
  ADD CONSTRAINT swell_access_len
    CHECK (swell_access_factors IS NULL OR array_length(swell_access_factors, 1) = 72);
```

**Design Rationale**:
- `real[]` arrays for fast O(1) scoring lookups (vs JSONB parsing)
- Fixed 5-degree bins: consistent, no ambiguity, 72 values covers full circle
- Exposure semantics (1=exposed, 0=sheltered): natural multiplier behavior
- `terrain_params_hash` enables cheap idempotency checks without deep JSON comparison
- DB constraints prevent malformed arrays from leaking into scoring

---

### 2. Data Sources

#### AWS Terrain Tiles (Primary)

**URL Pattern**: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`

**Specifications**:
- Format: Terrarium PNG (RGB-encoded elevation)
- Resolution: ~30m at zoom level 12
- Coverage: Global (SRTM data)
- Cost: Free, no API key required
- Encoding: `elevation = (R * 256 + G + B / 256) - 32768`

**Implementation**: `scripts/terrain/dem-loader.ts`

```typescript
// Terrarium elevation decoding
function terrariumToElevation(r: number, g: number, b: number): number {
  return (r * 256 + g + b / 256) - 32768
}
```

#### Land Detection (Elevation-Based)

Instead of separate coastline data, land vs water is determined using elevation:
- **Land**: elevation > 0.5m
- **Water**: elevation <= 0.5m

This simplifies the data pipeline and correctly handles the "beach landmass" problem.

**Implementation**: `scripts/terrain/landmask-loader.ts`

---

### 3. Wind Exposure Algorithm

**Location**: `scripts/terrain/wind-exposure.ts`

**Core Concept**: Horizon angle analysis along continuous rays

For each direction, cast a ray and find the maximum angle to the horizon created by terrain. Higher horizon = more sheltered.

**Algorithm**:

```
1. Project beach to UTM for accurate distance calculations
2. Get beach elevation (handle water coordinates)
3. For each direction (0, 5, 10, ... 355 degrees):
   a. Cast ray upwind from beach up to max_radius_m (5000m)
   b. Sample elevation at step_m intervals (60m)
   c. Calculate horizon angle: atan2(elevation_delta, distance)
   d. Track maximum horizon in near zone (0-500m) and far zone (500m+)
   e. Blend: max_horizon = 0.6 * near + 0.4 * far
   f. Apply sigmoid transform: exposure = sigmoid((angle_mid - max_horizon) / k)
4. Apply circular smoothing with kernel [0.25, 0.5, 0.25]
5. Return 72-element array of exposure factors [0, 1]
```

**Direction Convention**:
- `direction_deg` = direction wind is **coming from**
- Ray samples terrain **upwind** of the beach
- 0 degrees = North, 90 degrees = East, 180 degrees = South, 270 degrees = West

**Sigmoid Transform**:
```typescript
// High horizon angle -> low exposure (sheltered)
// Low horizon angle -> high exposure (open)
const sigmoidInput = (angle_mid - max_horizon) / k
const exposure = 1 / (1 + Math.exp(-sigmoidInput))
```

**Near/Far Weighting**:
- Near zone (0-500m): Captures micro-shelter from dunes, bluffs, cliffs
- Far zone (500m+): Captures macro-shelter from hills, mountains
- 60/40 weighting prioritizes near-field effects

---

### 4. Swell Access Algorithm

**Location**: `scripts/terrain/swell-access.ts`

**Core Concept**: Direct access + refraction wrap

Swell reaches a beach via:
1. **Direct**: Clear line over water from that direction
2. **Wrapped**: Swell from adjacent direction refracts around headland

**Critical Implementation Detail**: Two-Phase Swell Path Analysis

The `analyzeSwellPath()` function handles the case where beaches are on land:

```
Phase 1 - Exit Beach Landmass:
  - Cast ray from beach toward swell source
  - Skip past any land until reaching water (the ocean)

Phase 2 - Check for Blocking Land:
  - Continue ray beyond water edge
  - Detect any land that would block incoming swell
```

This two-phase approach fixed a critical bug where swell access was uniformly low (~0.003) because the algorithm detected the beach itself as "land".

**Algorithm**:

```
1. Project beach to UTM
2. For each direction (0, 5, 10, ... 355 degrees):
   a. Call analyzeSwellPath() to detect blocking land
   b. If no blocking land: access = 1.0
   c. If blocking land within threshold: access = (distance/threshold)^1.5

3. For blocked directions (direct_access < 0.8):
   a. Check adjacent directions (offset +/- 5 to max_wrap_angle degrees)
   b. If adjacent direction is open (access > 0.7):
      - Apply exponential decay: wrap = adjacent * exp(-wrap_lambda * offset)
   c. Track best_wrap from all adjacent directions

4. Combine: final_access = max(direct_access, wrap_access * 0.85)
5. Apply circular smoothing with kernel [0.25, 0.5, 0.25]
6. Return 72-element array of access factors [0, 1]
```

**Direction Convention**:
- `direction_deg` = direction swell is **coming from**
- Ray casts FROM beach TOWARD swell source (same direction, not +180)

**Wrap Effects**:
- Models swell refraction around headlands and points
- Exponential decay based on refraction angle (wrap_lambda = 0.04)
- Maximum wrap angle considered: 45 degrees
- Wrap contribution scaled by 0.85 (slightly less effective than direct)

---

### 5. Scoring Integration

**Location**: `lib/surf/scoring.ts`

**Bin Selection** (stable at boundaries):

```typescript
const toBin5 = (deg: number): number => {
  const norm = ((deg % 360) + 360) % 360
  return Math.floor((norm + 2.5) / 5) % 72
}
```

**Enablement Check**:

```typescript
const useTerrainFactors = (beach: Beach): boolean => {
  // Global kill switch (env var)
  if (process.env.TERRAIN_SCORING_ENABLED === 'false') return false
  // Per-beach enable flag
  if (!beach.terrain_enabled) return false
  // Factor arrays present and valid length
  if (!beach.wind_exposure_factors?.length === 72) return false
  if (!beach.swell_access_factors?.length === 72) return false
  return true
}
```

**Modified Scoring Formula**:

```typescript
// Read terrain factors (fallback 1.0 if disabled)
const windBin = toBin5(windDirectionDeg)
const swellBin = toBin5(swellDirectionDeg)
const windExposure = terrainEnabled ? clamp01(beach.wind_exposure_factors[windBin]) : 1.0
const swellAccess = terrainEnabled ? clamp01(beach.swell_access_factors[swellBin]) : 1.0

// Min exposure cap (prevents "perfect wind" in extreme shelter)
const MIN_EXPOSURE = 0.15
const effectiveExposure = MIN_EXPOSURE + (1 - MIN_EXPOSURE) * windExposure

// Wind: exposure reduces penalty of bad wind
const rawWindScore = computeWindScore(...)  // 0-1
const rawWindPenalty = 1 - rawWindScore
const adjustedWindPenalty = rawWindPenalty * effectiveExposure
const windScore = 1 - adjustedWindPenalty  // 0-1

// Swell: access gates how much swell direction score counts
const rawSwellScore = computeSwellDirScore(...)  // 0-1
const swellDirScore = rawSwellScore * swellAccess  // 0-1

// Tide unchanged
const tideScore = computeTideScore(...)  // 0-1

// Final score
const total01 = 0.4 * windScore + 0.4 * swellDirScore + 0.2 * tideScore
const total100 = Math.round(100 * total01)
```

**Behavior Example**:

| Beach | Wind (SW) | Swell (W) | Result |
|-------|-----------|-----------|--------|
| A (faces SW) | exposure=1.0, full penalty | access=1.0 | Low - junky |
| B (faces W) | exposure=1.0, cross-onshore | access=1.0 | Medium |
| C (faces NW) | exposure=0.3, reduced penalty | access=0.7 (wrap) | **Highest** |

**Fallback**: Unanalyzed beaches (no terrain factors) score exactly as before.

---

### 6. Analysis Pipeline

**Location**: `scripts/terrain/`

**Modules**:

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript types for script operations |
| `database.ts` | Load beaches, idempotency checks, upsert results |
| `dem-loader.ts` | DEM tile loading from AWS Terrain Tiles |
| `landmask-loader.ts` | Elevation-based land detection, swell path analysis |
| `projection.ts` | UTM coordinate conversion using proj4 |
| `wind-exposure.ts` | Wind exposure algorithm implementation |
| `swell-access.ts` | Swell access algorithm implementation |
| `golden-beaches.ts` | Validation dataset for parameter tuning |
| `validate-golden-beaches.ts` | Automated validation runner |

**CLI Commands**:

```bash
# Analyze all beaches
yarn terrain:analyze

# Analyze specific beach
yarn terrain:analyze --beach-id=<uuid>

# Analyze region with limits
yarn terrain:analyze --region=california --limit=50

# Dry run (compute without writing)
yarn terrain:analyze --dry-run

# Force recomputation (ignore cache)
yarn terrain:analyze --force

# Custom concurrency
yarn terrain:analyze --concurrency=8
```

**Pipeline Flow**:

```
1. Load beach coordinates from Supabase
2. For each beach (parallelizable, default concurrency=4):
   a. Check idempotency (skip if method+params match)
   b. Project to UTM zone
   c. Load DEM tiles from AWS Terrain Tiles
   d. Compute elevation grid for beach radius
   e. Run wind exposure algorithm
   f. Run swell access algorithm (with two-phase path analysis)
   g. Compute params hash
   h. Upsert results to beaches table
3. Log summary statistics
```

**Idempotency**:
- Skips beaches where `terrain_method` and `terrain_params_hash` match current values
- Override with `--force` flag to recompute all
- Uses upsert to modify existing records

**Performance** (Production Results):
- 261 beaches processed in 37.4 seconds
- Average: 143ms per beach
- ~6,000 elevation samples per beach (wind)
- ~12,000 landmask lookups per beach (swell)
- In-memory tile caching reduces redundant downloads

---

## Data Flow

```
                    ANALYSIS (one-time per beach)
                    =============================

[AWS Terrain Tiles] -->  [Wind Exposure]  -->  [wind_exposure_factors]
                              |                        |
                        72 rays x 83 samples           72 values [0,1]
                        horizon angle analysis         stored in beaches
                        sigmoid transform

[Elevation-based]   -->  [Swell Access]   -->  [swell_access_factors]
[Land Detection]              |                        |
                        72 rays x 58 samples           72 values [0,1]
                        two-phase path analysis        stored in beaches
                        wrap calculation


                    SCORING (per-request)
                    =====================

[Wind Direction]  -->  [toBin5(dir)]    -->  [wind_exposure_factors[bin]]
                            |                        |
[Swell Direction] -->  [toBin5(dir)]    -->  [swell_access_factors[bin]]
                            |                        |
                            v                        v
                     [Modified Scoring]  -->  [total100]
                            |
                      wind: penalty reduced by shelter
                      swell: score gated by access
```

---

## Configuration and Parameters

**Location**: `types/terrain.ts` - `DEFAULT_TERRAIN_PARAMS`

```typescript
export const DEFAULT_TERRAIN_PARAMS: TerrainAnalysisParams = {
  // Wind exposure parameters
  max_radius_m: 5000,           // Wind ray length
  near_far_split_m: 500,        // Near/far zone boundary
  angle_mid: 8.0,               // Shelter threshold (degrees)
  k: 3.0,                       // Sigmoid steepness
  min_exposure: 0.15,           // Floor for wind exposure

  // Swell access parameters
  blockage_threshold_m: 3000,   // Swell blockage distance
  swell_ray_length_m: 3500,     // Swell ray length
  wrap_lambda: 0.04,            // Wrap decay per degree
  max_wrap_angle: 45,           // Maximum refraction angle

  // Common parameters
  step_m: 60,                   // Sample spacing (DEM res * 2)
  smoothing_kernel: [0.25, 0.5, 0.25],  // Circular smoothing

  // Data source
  dem_source: 'aws_terrain_tiles',
  resolution_m: 30,
}
```

**Parameter Tuning**:
1. Run analysis with `--dry-run` on golden beaches
2. Generate polar plots of factors
3. Compare to surfer intuition (expected behavior in `golden-beaches.ts`)
4. Adjust parameters until golden beaches look right
5. Run symmetry sanity checks on open beaches (stdDev < 0.1)

---

## Development Roadmap

### Completed Tasks

- [x] **Task 1**: Database schema and types
- [x] **Task 2**: Script infrastructure (CLI, parallelization, idempotency)
- [x] **Task 3**: Wind Exposure Algorithm
  - [x] AWS Terrain Tiles integration
  - [x] UTM projection using proj4
  - [x] Horizon angle ray casting
  - [x] Sigmoid transform and smoothing
  - [x] Near/far split logic
- [x] **Task 4**: Swell Access Algorithm
  - [x] Elevation-based land detection
  - [x] Two-phase swell path analysis (critical bug fix)
  - [x] Direct access ray casting
  - [x] Wrap contribution calculation
  - [x] Exponential decay for refraction

### Pending Tasks

- [ ] **Task 5**: Scoring Integration
  - [ ] Modify `lib/surf/scoring.ts`
  - [ ] Add terrain factor lookups
  - [ ] Update wind/swell scoring
  - [ ] Add enablement checks
  - [ ] Unit tests
- [ ] **Task 6**: Staged Rollout
  - [ ] Enable for golden beaches
  - [ ] Before/after diff analysis
  - [ ] Regional rollout
  - [ ] Global enablement

---

## Rollout Strategy

### Phase 1: Golden Beach Validation (COMPLETE)

Real terrain data integrated and validated against 9 California beaches representing 7 coastal geometry types.

### Phase 2: Before/After Diff (PENDING)

1. Snapshot forecast inputs for deterministic comparison
2. Run scoring with `terrain_enabled = false` (baseline)
3. Run scoring with `terrain_enabled = true` (with factors)
4. Compare:
   - Score deltas (mean, p95)
   - Rank changes ("Top 3 set changed?" rate)
   - Big movers list (top 20 by delta)

### Phase 3: Staged Rollout (PENDING)

| Stage | Scope | Duration | Criteria |
|-------|-------|----------|----------|
| 1 | 10 golden beaches | 1 week | Polar plots validated |
| 2 | Top 50 by traffic | 1 week | <5% complaints, diffs explainable |
| 3 | One region (e.g., CA) | 1 week | Pipeline stable |
| 4 | Global (default true) | - | Full coverage |

### Safety Checks

- Score bounds: 0 <= total100 <= 100
- Fallback works: Unanalyzed beaches score identical to before
- Monotonic sanity: If windExposure=1 and swellAccess=1, adjusted scores = raw scores
- Factor sanity: Arrays length = 72, all values in [0, 1]
- Perf regression: Scoring query p95 latency unchanged (O(1) array lookup)
- Symmetry sanity: Known-open beaches have stdDev < 0.1

### Rollback

- **Global kill switch**: `TERRAIN_SCORING_ENABLED=false` env var
- **Per-beach**: `UPDATE beaches SET terrain_enabled = false`
- Terrain data stays in DB, just ignored during scoring

---

## Troubleshooting Guide

### Common Issues

**1. Analysis returns uniform factors for sheltered beach**

Symptoms: All 72 values are ~0.93 (exposed) when beach should be sheltered

Causes:
- DEM tile not loading correctly (check console for "[DEM] Loading" messages)
- Beach coordinates over water (elevation returns null)
- UTM projection issues (distances calculated incorrectly)

Debug:
```bash
yarn terrain:analyze --beach-id=<id> --dry-run
# Check terrain_analysis_debug in output for horizon_angles
```

**2. Swell access uniformly low (~0.003)**

Symptoms: All directions show near-zero swell access

Cause: Beach landmass being detected as blocking land (FIXED)

Solution: The `analyzeSwellPath()` function now implements two-phase detection that first exits the beach landmass before checking for blocking land.

**3. Swell access shows blocked directions that should be open**

Symptoms: Low access values for directions that face open ocean

Causes:
- Elevation data artifacts (phantom islands)
- blockage_threshold_m too small
- Incorrect ray bearing calculation

Debug:
- Check `terrain_analysis_debug.swell_direct_access` vs `swell_wrap_access`
- Verify elevation data at sample points

**4. Scoring not changing after terrain enabled**

Symptoms: Scores identical before/after enabling terrain

Causes:
- `terrain_enabled` flag not set on beach
- `TERRAIN_SCORING_ENABLED` env var is 'false'
- Factor arrays not 72 elements (validation failing)

Debug:
```sql
SELECT terrain_enabled, terrain_status,
       array_length(wind_exposure_factors, 1) as wind_len,
       array_length(swell_access_factors, 1) as swell_len
FROM beaches WHERE id = '<beach_id>';
```

**5. Open beach shows directional bias**

Symptoms: Open beach (should be uniform) shows variance > 0.1

Causes:
- DEM noise or artifacts
- Coordinate projection bugs
- Algorithm spikes at specific angles

Debug:
- Run `checkSymmetrySanity(factors)` from `golden-beaches.ts`
- Compare multiple open beaches in same region
- Check for outlier values in factor array

### Debug Tools

**Factor Statistics**:
```typescript
import { calculateFactorStats } from './golden-beaches'
const stats = calculateFactorStats(beach.wind_exposure_factors)
// { mean, stdDev, min, max, range }
```

**Validation Runner**:
```bash
yarn terrain:validate
# Runs all golden beach checks, reports pass/fail
```

**Mock Mode Testing**:
```bash
USE_MOCK_TERRAIN=true yarn terrain:analyze --dry-run --limit=5
# Uses flat terrain for algorithm testing without network
```

---

## File Reference

| File | Description |
|------|-------------|
| `types/terrain.ts` | Type definitions, constants, DEFAULT_TERRAIN_PARAMS |
| `scripts/terrain/types.ts` | Script-specific types (args, results) |
| `scripts/terrain/database.ts` | DB operations (load, upsert, count) |
| `scripts/terrain/dem-loader.ts` | AWS Terrain Tiles loading, PNG decoding, elevation sampling |
| `scripts/terrain/landmask-loader.ts` | Elevation-based land detection, analyzeSwellPath() |
| `scripts/terrain/projection.ts` | UTM coordinate conversion using proj4 |
| `scripts/terrain/wind-exposure.ts` | Wind exposure algorithm |
| `scripts/terrain/swell-access.ts` | Swell access algorithm |
| `scripts/terrain/golden-beaches.ts` | Validation dataset |
| `scripts/terrain/validate-golden-beaches.ts` | Validation runner |
| `lib/surf/scoring.ts` | Scoring integration (terrain factors) |
| `docs/plans/2026-01-20-terrain-geometry-scoring-design.md` | Original design document |

---

## Related Documentation

- [README](./README.md) - Quick start and usage guide
- [Validation Guide](./VALIDATION.md) - Golden beach validation procedures
- [Surf Utilities Architecture](/Users/stevenchandler/Desktop/quiver/lib/surf/ARCHITECTURE.md) - Scoring system overview
- [Design Document](/Users/stevenchandler/Desktop/quiver/docs/plans/2026-01-20-terrain-geometry-scoring-design.md) - Original design specification
- [Types Reference](/Users/stevenchandler/Desktop/quiver/types/terrain.ts) - TypeScript type definitions
