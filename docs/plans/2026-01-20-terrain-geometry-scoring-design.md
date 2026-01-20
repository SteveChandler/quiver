# Terrain-Aware Geometry Scoring Design

**Date:** 2026-01-20
**Status:** Approved
**Author:** Brainstorming session

## Overview

Encode beach-specific wind shelter and swell wrap behavior into Quiver's scoring algorithm using terrain/elevation data. This captures the surfer intuition that "Beach C fires when wind is SW because the hills block it" - knowledge that currently takes years of experience to develop.

## Problem Statement

Current scoring treats all beaches as equivalent receivers of swell/wind. In reality, the interaction between:
- Swell direction + beach orientation + headland refraction
- Wind direction + terrain shelter (hills, headlands, valleys)

...determines which spot actually fires on a given day.

**Example:** Three beach breaks, W swell, SW wind:
- Beach A (faces SW): Direct swell but onshore wind → junky
- Beach B (faces W): Good swell but cross-onshore → medium
- Beach C (faces NW): Wrapped swell + hills block SW wind → **cleanest option**

Current scoring can't make the Beach C call. This design fixes that.

---

## Section 1: Data Model

**New fields on `beaches` table:**

```sql
-- Directional factors as fixed 5° bins (72 values: 0°, 5°, 10°... 355°)
-- Semantics: 1.0 = fully exposed, 0.0 = fully sheltered/blocked
wind_exposure_factors    real[],   -- length 72
swell_access_factors     real[],   -- length 72 (includes direct + wrap)

-- Versioning with method contract
terrain_method           text,     -- e.g., 'dem_horizon_v1'
terrain_params           jsonb,    -- {radius_km, step_m, dem_source, resolution_m, ...}
terrain_analyzed_at      timestamptz,

-- Granular status tracking
wind_analyzed_at         timestamptz,
swell_analyzed_at        timestamptz,
terrain_status           text,     -- 'ok' | 'wind_only' | 'failed'

-- Optional debug/visualization (not used in hot path)
terrain_analysis_debug   jsonb     -- horizon angles, headland detection, etc.
```

**Design rationale:**
- `real[]` arrays for fast O(1) scoring lookups (vs JSONB parsing)
- Fixed 5° bins: consistent, no ambiguity, 72 values covers full circle
- Exposure semantics (1=exposed, 0=sheltered): natural multiplier behavior
- Separate status fields for partial analysis tracking
- Debug JSONB for visualization/troubleshooting without polluting hot path

---

## Section 2: Wind Exposure Algorithm

**Core concept:** Horizon angle along continuous rays

For each direction, cast a ray and find the maximum angle to the horizon created by terrain. Higher horizon = more sheltered.

```python
# Config (stored in terrain_params)
max_radius_m = 5000
step_m = dem_resolution * 2  # e.g., 60m for 30m DEM
angle_mid = 8.0              # degrees where shelter becomes significant
k = 3.0                      # sigmoid steepness

# Get beach elevation (handle beach coord over water)
beach_elev = get_elevation(beach_location)
if beach_elev is null:
    beach_elev = get_nearest_land_elevation(beach_location, search_radius=100m)

for direction_deg in [0, 5, 10, ... 355]:
    max_horizon_near = 0  # 0-500m (micro-shelter: dunes, bluffs)
    max_horizon_far = 0   # 500m-max_radius

    for distance in range(step_m, max_radius_m, step_m):
        sample_point = beach_location + (distance along direction_deg)
        elevation = get_elevation(sample_point)

        # No data: contributes 0 blocking, continue ray
        if elevation is null:
            continue

        horizon_angle = atan2(elevation - beach_elev, distance) * (180/π)

        if distance <= 500:
            max_horizon_near = max(max_horizon_near, horizon_angle)
        else:
            max_horizon_far = max(max_horizon_far, horizon_angle)

    # Blend near and far (near-field weighted higher for micro-shelter)
    max_horizon = 0.6 * max_horizon_near + 0.4 * max_horizon_far

    # Store raw angle for debug/UI
    wind_horizon_angles[direction_deg / 5] = max_horizon

    # Sigmoid: high angle → low exposure
    raw_exposure = sigmoid((angle_mid - max_horizon) / k)
    wind_exposure_raw[direction_deg / 5] = raw_exposure

# Smooth across bins (±1 bin = 15° window)
for i in 0..71:
    wind_exposure_factors[i] = (
        0.25 * wind_exposure_raw[(i-1) % 72] +
        0.50 * wind_exposure_raw[i] +
        0.25 * wind_exposure_raw[(i+1) % 72]
    )
```

**Direction convention:**
- `direction_deg` = direction wind is **coming from**
- Ray samples terrain **upwind** of the beach

**Key parameters (stored in `terrain_params`):**
- `sample_distances`: step based on DEM resolution
- `near_far_split_m`: 500
- `angle_mid`: 8° (shelter threshold)
- `k`: 3.0 (sigmoid steepness)
- `smoothing_kernel`: [0.25, 0.5, 0.25]

---

## Section 3: Swell Access Algorithm

**Core concept:** Direct access + refraction wrap

Swell reaches a beach via:
1. **Direct:** Clear line over water from that direction
2. **Wrapped:** Swell from adjacent direction refracts around headland

```python
# Config (stored in terrain_params)
swell_ray_length_m = 10000
blockage_threshold_m = 3000
wrap_lambda = 0.04            # exponential decay per degree
max_wrap_angle = 45

# Step 1: Calculate direct access for each direction
for swell_from_deg in [0, 5, 10, ... 355]:
    # Ray goes toward swell source (same direction, not +180)
    ray_bearing = swell_from_deg

    first_land_distance = null

    for distance in range(step_m, swell_ray_length_m, step_m):
        sample_point = beach_location + (distance along ray_bearing)

        if is_land(sample_point):  # Raster landmask lookup (O(1))
            first_land_distance = distance
            break

    if first_land_distance is null or first_land_distance > blockage_threshold_m:
        direct_access[swell_from_deg / 5] = 1.0
    else:
        # Blocked - factor based on how close the blockage is
        direct_access[swell_from_deg / 5] = clamp((first_land_distance / blockage_threshold_m) ** 1.5, 0, 1)

# Step 2: Calculate wrap contribution
for i in 0..71:
    if direct_access[i] >= 0.8:
        wrap_access[i] = 0
        continue

    best_wrap = 0

    for offset_deg in [5, 10, 15, 20, 25, 30, 35, 40, 45]:
        for sign in [-1, +1]:
            adjacent_bin = (i + sign * (offset_deg / 5)) % 72
            adjacent_direct = direct_access[adjacent_bin]

            if adjacent_direct > 0.7:
                # Exponential decay based on refraction angle
                wrap_factor = adjacent_direct * exp(-wrap_lambda * offset_deg)
                best_wrap = max(best_wrap, wrap_factor)

    wrap_access[i] = best_wrap

# Step 3: Combine direct + wrap
for i in 0..71:
    swell_access_factors[i] = max(direct_access[i], wrap_access[i] * 0.85)

# Step 4: Smooth (same kernel as wind)
swell_access_factors = smooth_circular(swell_access_factors, kernel=[0.25, 0.5, 0.25])
```

**Land detection:**
- Use rasterized landmask (30-60m resolution) for O(1) lookups
- Source: OSM-derived coastline (higher fidelity than Natural Earth)
- Build once per region, reuse in-memory

**Projections:**
- Convert to UTM zone for accurate distance/bearing math
- Prevents drift over 5-10km rays

---

## Section 4: Scoring Integration

**Current formula:**
```typescript
total = 0.4 * windScore + 0.4 * swellDirScore + 0.2 * tideScore
```

**Modified scoring:**

```typescript
// Bin selection (stable at boundaries)
const toBin5 = (deg: number): number => {
  const norm = ((deg % 360) + 360) % 360
  return Math.floor((norm + 2.5) / 5) % 72
}

const windBin = toBin5(windDirectionDeg)
const swellBin = toBin5(swellDirectionDeg)

// Read factors with clamping
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const windExposure = clamp01(beach.wind_exposure_factors?.[windBin] ?? 1)
const swellAccess = clamp01(beach.swell_access_factors?.[swellBin] ?? 1)

// Min exposure cap (prevents "perfect wind" in extreme shelter)
const MIN_EXPOSURE = 0.15
const effectiveExposure = MIN_EXPOSURE + (1 - MIN_EXPOSURE) * windExposure

// Wind: exposure reduces penalty of bad wind
const rawWindScore = computeWindScore(...)
const rawWindPenalty = 1 - rawWindScore
const adjustedWindPenalty = rawWindPenalty * effectiveExposure
const windScore = 1 - adjustedWindPenalty

// Swell: access gates how much swell direction score counts
const rawSwellScore = computeSwellDirScore(...)
const swellDirScore = rawSwellScore * swellAccess

// Tide unchanged
const tideScore = computeTideScore(...)

// Final
total = 0.4 * windScore + 0.4 * swellDirScore + 0.2 * tideScore
```

**Behavior:**
| Beach | Wind (SW) | Swell (W) | Result |
|-------|-----------|-----------|--------|
| A (faces SW) | exposure=1.0, full penalty | access=1.0 | Low - junky |
| B (faces W) | exposure=1.0, cross-onshore | access=1.0 | Medium |
| C (faces NW) | exposure=0.3, reduced penalty | access=0.7 (wrap) | **Highest** |

**Fallback:** `?? 1` means unanalyzed beaches score exactly as today.

---

## Section 5: Terrain Analysis Pipeline

**Data sources:**
| Source | Purpose | Notes |
|--------|---------|-------|
| Copernicus/USGS DEM | Elevation sampling | Local/cached, not API |
| OSM-derived coastline | Rasterized landmask | Higher fidelity than Natural Earth |
| Mapbox | UI/debug visualization only | Not in batch pipeline |

**Pipeline:**
```
1. Load beach coordinates
2. For each beach (parallelizable):
   a. Project to UTM zone
   b. Fetch DEM tile covering beach + max_radius
   c. Load rasterized landmask for region
   d. Run wind exposure algorithm
   e. Run swell access algorithm
   f. Upsert results to beaches table
3. Log summary
```

**Implementation:**
- File: `scripts/terrain-analysis.ts`
- Commands:
  - `yarn terrain:analyze`
  - `yarn terrain:analyze --beach-id=xyz`
  - `yarn terrain:analyze --region=nz-north --limit=50 --dry-run`

**Flags:**
- `--limit`, `--offset`: batch slicing
- `--concurrency`: parallel processing (default: 4)
- `--dry-run`: compute and log without writing
- `--force`: recompute even if already analyzed

**Idempotency:**
- Upsert keyed by `beach_id`
- Skip if `terrain_method` and `terrain_params` hash match
- Override with `--force`

**Performance:**
- ~6,000 elevation samples per beach (wind)
- ~12,000 landmask lookups per beach (swell)
- With raster landmask: ~0.1-0.2 sec per beach
- 500 beaches: ~1-2 minutes

---

## Section 6: Rollout & Verification

### Phase 1: Golden Beach Validation

**Beach types to include:**
| Type | Purpose |
|------|---------|
| Known shelter (hills block SW) | Validate wind exposure |
| Open beach break | Baseline (factors ~1.0) |
| Deep bay | Protected wind, narrow swell |
| Headland point | Asymmetric wrap |
| False-shelter trap (low dunes) | Catch over-shelter bugs |
| Harbor/marina nearby | Coastline complexity |
| Long peninsula | Wrap asymmetry |

**Process:**
1. Run `--dry-run` on golden beaches
2. Generate polar plots of factors
3. Compare to surfer intuition
4. Adjust parameters until golden beaches look right

### Phase 2: Before/After Diff

**Freeze inputs:**
```sql
-- Snapshot forecast inputs for fixed 48h window
CREATE TABLE terrain_scoring_baseline AS
SELECT
  beach_id, hour_ts,
  wind_dir_deg, wind_speed_ms, swell_dir_deg,
  total_score, wind_score, swell_dir_score
FROM mv_beach_hourly_scores
WHERE hour_ts BETWEEN '2026-01-21 00:00' AND '2026-01-23 00:00';
```

**Diff metrics:**
- Score deltas (mean, p95)
- **Rank changes:**
  - "Top 1 changed?" rate
  - "Top 3 set changed?" rate
  - Median rank shift, p95 rank shift
- Big movers list (top 20 by delta)

### Phase 3: Staged Rollout

**Use per-beach flag, not global:**
```sql
ALTER TABLE beaches ADD COLUMN terrain_enabled boolean DEFAULT false;
```

| Stage | Scope | Duration | Criteria |
|-------|-------|----------|----------|
| 1 | 10 golden beaches | 1 week | Polar plots validated |
| 2 | Top 50 by traffic | 1 week | <5% complaints, diffs explainable |
| 3 | One region (e.g., NZ North) | 1 week | Pipeline stable |
| 4 | Global (default true) | - | Full coverage |

### Safety Checks

1. **Score bounds:** 0 ≤ total ≤ 100
2. **Fallback works:** Unanalyzed beaches unchanged
3. **Monotonic sanity:** If exposure=1 and access=1, adjusted = raw (exact match)
4. **Factor sanity:** Arrays length 72, values in [0,1]
5. **Perf regression:** Scoring query time unchanged

### Monitoring

- `terrain_factors_applied: true/false` in scoring debug
- Dashboard: % of scored hours using terrain
- **Big movers watchlist:** Top 20 beaches by score/rank delta (daily)
- Alert if analysis job fails on >10% of beaches

### Rollback

- Feature flag: `TERRAIN_SCORING_ENABLED=false` (global kill switch)
- Per-beach: `UPDATE beaches SET terrain_enabled = false`
- Terrain data stays in DB, just ignored

---

## Implementation Order

1. **Database migration:** Add new columns to beaches table
2. **Terrain analysis script:** Wind exposure algorithm first
3. **Golden beach validation:** Tune parameters
4. **Add swell access:** Complete analysis pipeline
5. **Scoring integration:** Modify scoring functions
6. **Staged rollout:** Per-beach enable, monitor, expand

---

## Open Questions

1. **DEM source for NZ:** LINZ has high-res data - worth integrating?
2. **Coastline rasterization:** Build once globally or per-region on demand?
3. **Parameter tuning:** Should angle_mid/k be per-region or global?

---

## Appendix: Parameter Reference

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `max_radius_m` | 5000 | Wind ray length |
| `swell_ray_length_m` | 10000 | Swell ray length |
| `step_m` | DEM res × 2 | Sample spacing |
| `angle_mid` | 8° | Shelter threshold |
| `k` | 3.0 | Sigmoid steepness |
| `MIN_EXPOSURE` | 0.15 | Floor for wind exposure |
| `blockage_threshold_m` | 3000 | Swell blockage distance |
| `wrap_lambda` | 0.04 | Wrap decay per degree |
| `smoothing_kernel` | [0.25, 0.5, 0.25] | Circular smoothing |
