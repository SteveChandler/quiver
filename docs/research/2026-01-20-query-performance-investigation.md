# Query Performance Investigation

**Date:** 2026-01-20
**Scope:** `refresh_mv_beach_hourly_scores_and_analyze` and `v_enhanced_forecast_latest`
**Tool Used:** pg_stat_statements

---

## Executive Summary

| Query | Avg Time | Calls | Status |
|-------|----------|-------|--------|
| `refresh_mv_beach_hourly_scores_and_analyze` | **15.9s** | 288 | Needs optimization |
| `v_enhanced_forecast_latest` (direct) | **2.6ms** | - | Fixed |
| `v_enhanced_forecast_latest` (via PostgREST) | **1.7s** | 960 | Historical/Varies |

---

## 1. Materialized View: `mv_beach_hourly_scores`

### Current Structure

```sql
-- Simplified view of the MV definition
CREATE MATERIALIZED VIEW mv_beach_hourly_scores AS
SELECT
  m.beach_id,
  m.ts AT TIME ZONE 'UTC' AS ts_utc,
  -- wave data from marine_forecasts
  m.wave_height_m, m.wave_period_s, m.wave_direction_deg,
  -- wind (COALESCE from marine or NWS)
  COALESCE(m.wind_speed_ms, w_near.wind_speed_ms) AS wind_spd_kts,
  -- tide from nearest ±90min
  t_near.tide_height_m AS tide_ft,
  -- computed score (complex formula)
  ROUND(100 * ...) AS score_0_100
FROM marine_forecasts m
JOIN beaches b ON b.id = m.beach_id
LEFT JOIN LATERAL (
  -- Tide lookup: finds nearest tide within ±90 minutes
  SELECT tide_height_m FROM tide_forecasts t
  WHERE t.beach_id = m.beach_id
    AND t.ts BETWEEN m.ts - '90 min' AND m.ts + '90 min'
  ORDER BY ABS(EXTRACT(EPOCH FROM (t.ts - m.ts)))
  LIMIT 1
) t_near ON TRUE
LEFT JOIN LATERAL (
  -- NWS wind lookup: finds nearest nws_wind within ±90 minutes
  SELECT wind_speed_ms, wind_direction_deg FROM marine_forecasts w
  WHERE w.beach_id = m.beach_id AND w.source = 'nws_wind'
    AND w.ts BETWEEN m.ts - '90 min' AND m.ts + '90 min'
  ORDER BY ABS(EXTRACT(EPOCH FROM (w.ts - m.ts)))
  LIMIT 1
) w_near ON TRUE
WHERE b.is_private = false AND m.source <> 'nws_wind';
```

### Data Volumes

| Table | Rows | Size |
|-------|------|------|
| `marine_forecasts` | 108,909 | 95 MB |
| `tide_forecasts` | 175,677 | 135 MB |
| `beaches` | 261 | 1.2 MB |
| `enhanced_forecasts` | 40,570 | 133 MB |

### Performance Analysis

**Execution Time Breakdown:**
```
Total: 4,030ms (simplified query without full score computation)
Full refresh with score: ~15,900ms (16 seconds)
```

**Query Plan Analysis:**
```
Nested Loop Left Join (4,021ms)
├── Hash Join (73ms) - marine_forecasts × beaches
│   ├── Seq Scan on marine_forecasts (24ms) - 108,909 rows
│   └── Hash on beaches (0.2ms) - 261 rows
└── Memoize (per row)
    ├── Cache Hits: 33,565
    ├── Cache Misses: 75,344  ← Problem!
    ├── Evictions: 24,736     ← Problem!
    └── Index Scan on tide_forecasts_unique (0.05ms × 75,344 loops)
```

### Root Causes

1. **Two LATERAL Subqueries Per Row**
   - Each of the 108,909 marine forecast rows triggers:
     - 1× tide lookup (ORDER BY + LIMIT 1)
     - 1× nws_wind lookup (ORDER BY + LIMIT 1)
   - Total subquery executions: ~218,000

2. **Memoize Cache Evictions**
   - Cache key: `(m.ts, m.beach_id)`
   - 24,736 evictions indicate cache thrashing
   - Only 33,565 hits vs 75,344 misses (31% hit rate)

3. **Time Range Scans**
   - `ts BETWEEN m.ts - '90 min' AND m.ts + '90 min'` cannot use simple index lookups
   - Each lookup scans ~8 rows on average, then sorts

4. **Complex Score Computation**
   - Trigonometric functions (COS, RADIANS)
   - Multiple COALESCE chains
   - Computed per-row during refresh

### Optimization Recommendations

#### Quick Win: Add Covering Index
```sql
-- Optimize tide lookup with covering index
CREATE INDEX idx_tide_forecasts_beach_ts_height
  ON tide_forecasts (beach_id, ts)
  INCLUDE (tide_height_m);

-- Optimize nws_wind lookup
CREATE INDEX idx_marine_forecasts_nws_wind_lookup
  ON marine_forecasts (beach_id, ts)
  INCLUDE (wind_speed_ms, wind_direction_deg)
  WHERE source = 'nws_wind';
```

#### Medium Term: Pre-compute Nearest Joins
```sql
-- Option 1: Pre-join tide to marine at ingest time
-- Add tide_height_m column to marine_forecasts
-- Populate during cron job that loads marine data

-- Option 2: Partition by time
-- Reduces scan range for ±90 minute lookups
```

#### Long Term: Incremental Refresh
```sql
-- Use CONCURRENTLY to avoid blocking
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_beach_hourly_scores;

-- Requires unique index (already exists: idx_mv_vbhs_beach_ts)
```

**Expected Impact:**
| Optimization | Expected Time | Effort |
|--------------|---------------|--------|
| Covering indexes | 8-10s | Low |
| Pre-computed joins | 2-4s | Medium |
| Incremental refresh | <1s | High |

---

## 2. View: `v_enhanced_forecast_latest`

### Current Definition

```sql
-- LATERAL pattern (current, fast)
CREATE VIEW v_enhanced_forecast_latest AS
SELECT b.id AS beach_id, ef.updated_at, ef.data_source
FROM beaches b
CROSS JOIN LATERAL (
  SELECT updated_at, data_source
  FROM enhanced_forecasts ef
  WHERE ef.beach_id = b.id AND ef.updated_at IS NOT NULL
  ORDER BY ef.updated_at DESC
  LIMIT 1
) ef;
```

### Performance Analysis

**Direct Query (Current):**
```
Execution Time: 2.615ms ✓
Plan: Nested Loop with Index Scan
```

**Historical/PostgREST Queries (pg_stat_statements):**
| Query Pattern | Calls | Avg Time | Max Time |
|---------------|-------|----------|----------|
| `SELECT beach_id, updated_at` via PostgREST | 960 | 1,687ms | 7,964ms |
| `SELECT beach_id, updated_at, data_source` via PostgREST | 1,150 | 627ms | 7,976ms |
| `WHERE beach_id = $1` (single lookup) | 6,566 | 13ms | 1,112ms |

### Root Causes of Historical Slowness

1. **PostgREST CTE Wrapper Overhead**
   ```sql
   -- PostgREST wraps queries like this:
   WITH pgrst_source AS (
     SELECT * FROM v_enhanced_forecast_latest LIMIT $1 OFFSET $2
   ) SELECT count(*), json_agg(*) FROM pgrst_source
   ```
   - The `count(*)` and `json_agg()` add overhead
   - CTE materialization prevents optimization pushdown

2. **Previous View Definition Was Slow**
   - Old definition used `DISTINCT ON` pattern
   - Required full table scan + sort
   - Migration `20260106120000` fixed this

3. **Complex Consuming Queries**
   - Cache staleness checks join this view with CTEs
   - Some queries (like cache health check) take 6-8 seconds
   - These are ad-hoc monitoring queries, not user-facing

### Current Status: OPTIMIZED

The view itself is now fast (2.6ms). The historical data in pg_stat_statements includes:
- Pre-optimization queries (before Jan 2026 migrations)
- Complex wrapper queries that use the view

**No further action required** for `v_enhanced_forecast_latest`.

---

## Index Audit

### marine_forecasts Indexes
| Index | Columns | Status |
|-------|---------|--------|
| `marine_forecasts_pkey` | `(id)` | OK |
| `marine_forecasts_unique` | `(beach_id, ts, source)` | OK |
| `idx_marine_forecasts_beach_observed_created_desc` | `(beach_id, is_observed DESC, created_at DESC)` | OK |
| `idx_marine_forecasts_beach_ts_utc` | `(beach_id, ts_utc)` | OK |

**Missing:** Partial index for `source = 'nws_wind'` lookups

### tide_forecasts Indexes
| Index | Columns | Status |
|-------|---------|--------|
| `tide_forecasts_pkey` | `(id)` | OK |
| `tide_forecasts_unique` | `(beach_id, ts, source)` | Used for LATERAL |
| `idx_tide_forecasts_beach_created_desc` | `(beach_id, created_at DESC)` | OK |
| `idx_tide_forecasts_beach_ts_utc` | `(beach_id, ts_utc)` | OK |

**Missing:** Covering index with `tide_height_m` included

---

## Recommended Actions

### Priority 1: Add Covering Indexes (Low Risk, High Impact)

```sql
-- Migration: 20260120_optimize_mv_beach_hourly_scores_indexes.sql

-- Covering index for tide lookups in MV refresh
CREATE INDEX CONCURRENTLY idx_tide_forecasts_mv_lookup
  ON tide_forecasts (beach_id, ts)
  INCLUDE (tide_height_m);

-- Partial covering index for NWS wind lookups
CREATE INDEX CONCURRENTLY idx_marine_forecasts_nws_wind_mv_lookup
  ON marine_forecasts (beach_id, ts)
  INCLUDE (wind_speed_ms, wind_direction_deg)
  WHERE source = 'nws_wind';
```

**Expected Impact:** Reduce refresh from 16s to 8-10s

### Priority 2: Use CONCURRENTLY for Refresh

```sql
-- Update refresh function to use CONCURRENTLY
CREATE OR REPLACE FUNCTION refresh_mv_beach_hourly_scores_and_analyze()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_beach_hourly_scores;
  ANALYZE mv_beach_hourly_scores;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Benefit:** Non-blocking refresh (requires unique index)

### Priority 3: Monitor After Changes

```sql
-- Reset stats after optimization
SELECT pg_stat_statements_reset();

-- Re-check after 24 hours
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%mv_beach_hourly_scores%'
ORDER BY total_exec_time DESC;
```

---

## Appendix: Full Query Plan

### mv_beach_hourly_scores Refresh (Simplified)

```
Nested Loop Left Join  (cost=95.81..63059.97 rows=106980 width=85) (actual time=1.468..4021.325 rows=108909 loops=1)
  Buffers: shared hit=811018 read=4922 dirtied=1100
  ->  Hash Join  (cost=90.87..6171.06 rows=106980 width=60) (actual time=0.224..73.525 rows=108909 loops=1)
        Hash Cond: (m.beach_id = b.id)
        Buffers: shared hit=4810 dirtied=437
        ->  Seq Scan on marine_forecasts m  (actual time=0.008..24.483 rows=108909 loops=1)
        ->  Hash on beaches (0.203ms, 261 rows)
  ->  Memoize  (cost=4.94..4.95 rows=1 width=5) (actual time=0.035..0.035 rows=1 loops=108909)
        Cache Key: m.ts, m.beach_id
        Hits: 33565  Misses: 75344  Evictions: 24736  ← Cache thrashing
        ->  Index Scan using tide_forecasts_unique (actual time=0.049..0.049 rows=1 loops=75344)
              Index Cond: beach_id = m.beach_id AND ts BETWEEN (m.ts - '01:30:00') AND (m.ts + '01:30:00')

Planning Time: 2.815 ms
Execution Time: 4030.752 ms (simplified, without NWS wind join and score computation)
```

### v_enhanced_forecast_latest (Current)

```
Nested Loop  (cost=0.69..419.19 rows=261 width=32) (actual time=0.071..2.505 rows=261 loops=1)
  Buffers: shared hit=1253
  ->  Index Only Scan using beaches_pkey on beaches b  (actual time=0.034..0.221 rows=261 loops=1)
  ->  Limit  (cost=0.41..1.55 rows=1 width=16) (actual time=0.008..0.008 rows=1 loops=261)
        ->  Index Scan using idx_enhanced_forecasts_beach_updated_at_desc  (actual time=0.008 rows=1 loops=261)

Planning Time: 1.369 ms
Execution Time: 2.615 ms ✓
```

---

## Conclusion

1. **`mv_beach_hourly_scores` refresh is slow (16s)** due to two LATERAL joins with poor cache utilization. Adding covering indexes should reduce this to 8-10s. Further optimization requires architectural changes.

2. **`v_enhanced_forecast_latest` is now fast (2.6ms)**. Historical slowness in pg_stat_statements reflects pre-optimization queries and complex wrapper queries.

3. **Next Steps:**
   - Apply covering indexes (Priority 1)
   - Consider pre-computing tide/wind joins at ingest time (Priority 2)
   - Reset pg_stat_statements after optimizations to establish new baseline
