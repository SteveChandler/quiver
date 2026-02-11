# Migration: Terrain-Aware Geometry Scoring

**Migration ID**: 20260120211015
**Created**: 2026-01-20
**Status**: Ready for review

## Overview

This migration adds terrain-aware geometry scoring capabilities to the `beaches` table, enabling fine-grained directional analysis of wind exposure and swell access based on actual coastal terrain geometry.

## Schema Changes

### New Columns

| Column                      | Type          | Nullable | Default | Purpose                                                                 |
| --------------------------- | ------------- | -------- | ------- | ----------------------------------------------------------------------- |
| `wind_exposure_factors`     | `real[]`      | YES      | NULL    | 72-element array of wind exposure factors (5° bins: 0°, 5°... 355°)    |
| `swell_access_factors`      | `real[]`      | YES      | NULL    | 72-element array of swell access factors (5° bins)                      |
| `terrain_method`            | `text`        | YES      | NULL    | Analysis method identifier (e.g., 'dem_horizon_v1')                     |
| `terrain_params`            | `jsonb`       | YES      | NULL    | Analysis parameters (radius_km, step_m, dem_source, etc.)               |
| `terrain_params_hash`       | `text`        | YES      | NULL    | SHA256 hash of terrain_params for fast cache validation                 |
| `terrain_analyzed_at`       | `timestamptz` | YES      | NULL    | Timestamp when terrain analysis completed                                |
| `wind_analyzed_at`          | `timestamptz` | YES      | NULL    | Timestamp when wind exposure analysis completed                          |
| `swell_analyzed_at`         | `timestamptz` | YES      | NULL    | Timestamp when swell access analysis completed                           |
| `terrain_status`            | `text`        | YES      | NULL    | Analysis status: 'ok', 'wind_only', 'failed'                            |
| `terrain_enabled`           | `boolean`     | NO       | false   | Feature flag for staged rollout                                          |
| `terrain_analysis_debug`    | `jsonb`       | YES      | NULL    | Optional debug data (horizon angles, headland detection, etc.)           |

### Constraints

1. **`wind_exposure_len`**: Validates `wind_exposure_factors` is NULL or has exactly 72 elements
2. **`swell_access_len`**: Validates `swell_access_factors` is NULL or has exactly 72 elements
3. **`terrain_status_valid`**: Validates `terrain_status` is NULL or one of ('ok', 'wind_only', 'failed')

### Indexes

1. **`idx_beaches_terrain_enabled`**: Partial index for finding terrain-enabled beaches
2. **`idx_beaches_terrain_status`**: Composite index for finding beaches by status and analysis time
3. **`idx_beaches_terrain_method_hash`**: Index for cache validation queries
4. **`idx_beaches_terrain_rollout`**: Composite index for staged rollout queries

## Data Semantics

### Directional Factor Arrays

Both `wind_exposure_factors` and `swell_access_factors` are 72-element arrays representing 5° directional bins:

```
Index 0  = 0°   (North)
Index 1  = 5°
Index 2  = 10°
...
Index 18 = 90°  (East)
Index 36 = 180° (South)
Index 54 = 270° (West)
Index 71 = 355°
```

**Value Semantics**:
- `1.0` = Fully exposed/accessible (no terrain blocking)
- `0.0` = Fully sheltered/blocked (complete terrain obstruction)
- `0.5` = Partially blocked (50% reduction in exposure/access)

### Wind Exposure Factors

Represents how exposed the beach is to wind from each direction, accounting for:
- Terrain elevation and blocking
- Distance to blocking terrain
- Angular extent of blocking features

### Swell Access Factors

Represents how accessible the beach is to swell from each direction, including:
- Direct swell access (open ocean fetch)
- Wrap-around effects (swell bending around headlands)
- Offshore/nearshore bathymetry effects (if available in terrain data)

## Analysis Method Versioning

The `terrain_method`, `terrain_params`, and `terrain_params_hash` fields implement a versioning system for reproducibility and cache invalidation:

### Example `terrain_params`:

```json
{
  "radius_km": 50,
  "step_m": 100,
  "dem_source": "SRTM",
  "resolution_m": 30,
  "min_obstacle_height_m": 5,
  "wrap_angle_threshold": 45
}
```

### Cache Validation Flow:

1. Compute SHA256 hash of canonical JSON representation of `terrain_params`
2. Check if `terrain_params_hash` matches AND `terrain_method` matches
3. If both match, terrain analysis is up-to-date
4. If either differs, re-run analysis with new method/params

## Status Tracking

The migration includes granular status tracking for monitoring analysis progress:

### Status Values:

- **`'ok'`**: Both wind and swell analysis completed successfully
- **`'wind_only'`**: Wind analysis complete, swell analysis pending or failed
- **`'failed'`**: Terrain analysis failed (check logs for details)
- **`NULL`**: No analysis attempted yet

### Timestamp Fields:

- **`terrain_analyzed_at`**: Overall completion time (when status = 'ok')
- **`wind_analyzed_at`**: Wind-specific completion time
- **`swell_analyzed_at`**: Swell-specific completion time

## Staged Rollout

The `terrain_enabled` flag supports careful feature rollout:

### Phase 1: Initial Analysis
```sql
-- Enable for test beaches
UPDATE beaches
SET terrain_enabled = true
WHERE id IN (SELECT id FROM beaches WHERE name LIKE '%Test Beach%');
```

### Phase 2: Regional Rollout
```sql
-- Enable by region
UPDATE beaches
SET terrain_enabled = true
WHERE region = 'Southern California'
  AND terrain_status = 'ok';
```

### Phase 3: Full Rollout
```sql
-- Enable for all beaches with successful analysis
UPDATE beaches
SET terrain_enabled = true
WHERE terrain_status = 'ok';
```

## Query Patterns

### Find beaches needing analysis:

```sql
SELECT id, name, center_lat, center_lng
FROM beaches
WHERE terrain_analyzed_at IS NULL
   OR terrain_status = 'failed'
ORDER BY popularity DESC
LIMIT 100;
```

### Find beaches with outdated analysis:

```sql
-- Assume new method is 'dem_horizon_v2'
SELECT id, name, terrain_method, terrain_analyzed_at
FROM beaches
WHERE terrain_method IS NOT NULL
  AND terrain_method != 'dem_horizon_v2'
ORDER BY terrain_analyzed_at ASC;
```

### Get wind exposure for specific direction:

```sql
-- Get wind exposure at 270° (West) for all enabled beaches
-- Index: 270 / 5 = 54
SELECT
  id,
  name,
  wind_exposure_factors[55] AS west_wind_exposure  -- Arrays are 1-indexed in PostgreSQL
FROM beaches
WHERE terrain_enabled = true
  AND wind_exposure_factors IS NOT NULL;
```

### Get swell access for range of directions:

```sql
-- Get average swell access from 180° to 270° (South to West)
-- Indices: 36 to 54 (1-indexed: 37 to 55)
SELECT
  id,
  name,
  (SELECT AVG(factor)
   FROM unnest(swell_access_factors[37:55]) AS factor
  ) AS sw_swell_access
FROM beaches
WHERE terrain_enabled = true
  AND swell_access_factors IS NOT NULL;
```

## Performance Considerations

### Storage Impact

- Each real array (72 elements) = ~288 bytes per beach
- Total per beach: ~576 bytes for both arrays
- For 10,000 beaches: ~5.76 MB (negligible)

### Query Performance

- Array access is O(1) for specific indices
- Partial index on `terrain_enabled = true` optimizes hot path queries
- Composite indexes support common filtering patterns

### Recommendations

1. Keep `terrain_analysis_debug` NULL in production unless debugging
2. Query only `terrain_enabled = true` beaches in hot paths
3. Use specific array indices rather than full array scans when possible
4. Consider materialized views for aggregate terrain statistics

## RLS Considerations

This migration does not add RLS policies. Existing RLS policies on the `beaches` table will apply to these new columns.

### Recommended RLS Updates

If beaches table has restrictive RLS:

```sql
-- Allow authenticated users to read terrain data
CREATE POLICY "Users can read terrain data"
  ON beaches
  FOR SELECT
  USING (
    terrain_enabled = true
    AND terrain_status = 'ok'
  );

-- Restrict write access to service role only
-- (Analysis should be done via background jobs)
```

## Testing Checklist

- [ ] Verify migration applies cleanly on fresh database
- [ ] Verify rollback removes all columns and constraints
- [ ] Insert test data with valid 72-element arrays
- [ ] Attempt to insert invalid array lengths (should fail)
- [ ] Attempt to insert invalid `terrain_status` values (should fail)
- [ ] Query performance on indexed fields
- [ ] Verify RLS policies still work correctly
- [ ] Test array element access (remember 1-based indexing!)
- [ ] Verify comments are visible in database tools

## Rollback Procedure

If issues arise, rollback using:

```bash
psql -f supabase/migrations/20260120211015_add_terrain_geometry_scoring_rollback.sql
```

**WARNING**: Rollback permanently deletes all terrain analysis data. Ensure backups exist.

## Future Enhancements

Potential future improvements:

1. **Adaptive resolution**: Store different bin resolutions (5°, 10°, 15°) based on beach type
2. **Time-based factors**: Account for tidal effects on exposure/access
3. **Bathymetry integration**: Incorporate underwater terrain for better swell modeling
4. **Compressed storage**: Use custom composite type or binary encoding for large deployments
5. **Materialized statistics**: Pre-compute common directional ranges (NW sector, etc.)

## References

- Design document: `/docs/design-plans/terrain-aware-geometry-scoring.md`
- Coordinate conventions: `/docs/COORDINATE_CONVENTIONS.md`
- Database architecture: `/supabase/ARCHITECTURE.md`

---

**Migration Author**: Claude Code
**Reviewed By**: [Pending]
**Applied On**: [Pending]
