# Forecast Health Recovery Guide

This document describes the performance optimizations implemented to resolve forecast health monitoring timeouts and marine cron staleness issues.

## Problem Statement

### Issue 1: Health Check Timeouts

The `/api/monitoring/forecast-health` endpoint was timing out due to a slow database view (`v_enhanced_forecast_latest`). The original view used `DISTINCT ON` with a full table scan:

```sql
-- SLOW: Original pattern (DO NOT USE)
SELECT DISTINCT ON (beach_id) *
FROM enhanced_forecasts
ORDER BY beach_id, updated_at DESC;
```

This pattern requires PostgreSQL to:
1. Scan the entire `enhanced_forecasts` table
2. Sort all rows by `(beach_id, updated_at DESC)`
3. Deduplicate to keep only the first row per `beach_id`

With thousands of forecast rows, this becomes O(N log N) in table size.

### Issue 2: Marine Forecast Staleness

The marine cron job (`/api/cron/forecasts/refresh?source=marine`) was not refreshing all beaches within the 6-hour staleness threshold:

- **Previous**: `maxBeaches=60` beaches per 3-hour run
- **Problem**: With ~780 beaches, cycle time was ~39 hours (780 / 60 * 3h)
- **Result**: Many beaches had stale marine data (>6h old)

## Solution

### Database View Optimization

**Migration**: `supabase/migrations/20260105161500_ensure_fast_v_enhanced_forecast_latest.sql`

Replaced `DISTINCT ON` with the `LATERAL + LIMIT 1` pattern:

```sql
CREATE OR REPLACE VIEW public.v_enhanced_forecast_latest
WITH (security_invoker = true) AS
SELECT
  b.id AS beach_id,
  ef.updated_at,
  ef.data_source
FROM public.beaches b
CROSS JOIN LATERAL (
  SELECT updated_at, data_source
  FROM public.enhanced_forecasts ef
  WHERE ef.beach_id = b.id
    AND ef.updated_at IS NOT NULL
  ORDER BY ef.updated_at DESC
  LIMIT 1
) ef;
```

### Why LATERAL is Faster

The `LATERAL` subquery pattern transforms the query execution:

| Aspect | DISTINCT ON | LATERAL + LIMIT 1 |
|--------|-------------|-------------------|
| **Algorithm** | Full table scan + sort + dedup | Index probe per beach |
| **Complexity** | O(N log N) where N = all forecast rows | O(B * log N) where B = beach count |
| **Index Usage** | Sort-based deduplication | Direct index seek per beach |
| **Memory** | Proportional to total rows | Constant per beach |

**How it works:**

1. For each row in `beaches`, PostgreSQL executes the `LATERAL` subquery
2. The subquery uses the index `idx_enhanced_forecasts_beach_updated_at_desc (beach_id, updated_at DESC)`
3. With `LIMIT 1`, PostgreSQL stops after finding the first matching row
4. This is an index-only operation: O(1) per beach

**Performance improvement**: ~10x faster locally (0.4ms vs 4ms), with much larger gains at scale where the forecasts table has millions of rows.

### Required Index

The optimization requires this composite index:

```sql
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_updated_at_desc
  ON public.enhanced_forecasts (beach_id, updated_at DESC);
```

The `DESC` ordering is critical - it allows the `ORDER BY updated_at DESC LIMIT 1` to be satisfied by reading only the first index entry.

### Marine Cron Throughput

**Change**: Updated `vercel.json` to increase `maxBeaches` from 60 to 160.

```json
{
  "path": "/api/cron/forecasts/refresh?source=marine&maxBeaches=160",
  "schedule": "0 */3 * * *"
}
```

**Cycle time calculation:**

```
Cycle Time = (Total Beaches / Beaches Per Run) * Run Interval

Before: (780 / 60) * 3h  = 39 hours (PROBLEM: exceeds 6h threshold)
After:  (780 / 160) * 3h = 4.9 hours (OK: under 6h threshold)
```

The 160 beach limit was chosen to:
- Stay well under the 5-minute Vercel timeout
- Provide headroom for API latency variations
- Complete a full cycle in ~5 hours (under the 6h staleness threshold)

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FORECAST_MARINE_FRESHNESS_WINDOW_HOURS` | 3 | Hours before marine data considered stale for selection |
| `FORECAST_CRON_TIME_BUDGET_MS` | (computed) | Override time budget for cron execution |
| `FORECAST_CRON_SAFETY_MARGIN_MS` | 20000 | Safety buffer before Vercel timeout |

### Staleness Thresholds

| Data Source | Warning | Critical |
|-------------|---------|----------|
| Enhanced Forecasts | 12h | 24h |
| Marine | 2h | 6h |
| Tide | 24h | 48h |
| Sun Times | 168h (7d) | 336h (14d) |

## Verification

### Check View Performance

Run this query in Supabase SQL Editor to verify the optimization:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.v_enhanced_forecast_latest;
```

**Expected output characteristics:**
- Plan shows `Nested Loop` with `Index Scan` on `idx_enhanced_forecasts_beach_updated_at_desc`
- Execution time <50ms for ~260 beaches
- No `Sort` node in the plan

**Example healthy output:**

```
Nested Loop  (cost=0.42..1234.56 rows=261 width=64) (actual time=0.04..2.31 rows=261 loops=1)
  ->  Seq Scan on beaches b  (cost=0.00..12.61 rows=261 width=16)
  ->  Index Scan using idx_enhanced_forecasts_beach_updated_at_desc on enhanced_forecasts ef
        Index Cond: (beach_id = b.id)
        Filter: (updated_at IS NOT NULL)
Planning Time: 0.234 ms
Execution Time: 2.456 ms
```

### Check Marine Staleness

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '6 hours') AS fresh,
  COUNT(*) FILTER (WHERE updated_at <= NOW() - INTERVAL '6 hours') AS stale,
  ROUND(100.0 * COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '6 hours') / COUNT(*), 1) AS fresh_pct
FROM public.v_enhanced_forecast_latest;
```

**Expected**: `fresh_pct` should be >95% after a full cron cycle.

### Health Check API

```bash
curl https://your-domain.com/api/monitoring/forecast-health
```

**Healthy response indicators:**

```json
{
  "success": true,
  "metrics": {
    "enhancedAvailable": true,
    "healthStatus": "healthy",
    "sources": {
      "marine": {
        "available": true,
        "beachesWithCriticalStaleData": 0,
        "coveragePercentage": 1.0
      }
    }
  },
  "meta": {
    "durationMs": 150
  }
}
```

**Red flags:**
- `durationMs` > 5000 (view may not be optimized)
- `enhancedAvailable: false` (view query failed)
- `healthStatus: "critical"` (staleness or coverage issues)

## Troubleshooting

### Health Check Still Slow

**Symptom**: `/api/monitoring/forecast-health` takes >5s or times out.

**Diagnosis:**

1. Check if the view exists with correct definition:
   ```sql
   SELECT pg_get_viewdef('v_enhanced_forecast_latest', true);
   ```

2. Check if the index exists:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'enhanced_forecasts'
     AND indexname = 'idx_enhanced_forecasts_beach_updated_at_desc';
   ```

3. Run EXPLAIN ANALYZE on the view query directly.

**Resolution:**
- Re-run the migration: `20260105161500_ensure_fast_v_enhanced_forecast_latest.sql`
- Or manually create the index and view in SQL Editor

### Marine Data Still Stale

**Symptom**: Many beaches show marine data >6h old.

**Diagnosis:**

1. Check cron execution logs in Vercel:
   ```
   Filter: "Forecast Refresh" AND "marine"
   ```

2. Verify cron configuration in `vercel.json`:
   ```json
   {
     "path": "/api/cron/forecasts/refresh?source=marine&maxBeaches=160",
     "schedule": "0 */3 * * *"
   }
   ```

3. Check for execution timeouts in logs.

**Resolution:**
- If timing out: Reduce `maxBeaches` to 120 or 100
- If not running: Verify cron is enabled in Vercel dashboard
- If API errors: Check NDBC/CDIP service availability

### View Returns No Rows

**Symptom**: `v_enhanced_forecast_latest` returns empty despite data existing.

**Cause**: The `CROSS JOIN LATERAL` excludes beaches with no matching forecasts (this is intentional for performance).

**Verification:**
```sql
-- Check if forecasts exist
SELECT COUNT(*) FROM enhanced_forecasts WHERE updated_at IS NOT NULL;

-- Check if beaches have matching forecasts
SELECT COUNT(DISTINCT beach_id) FROM enhanced_forecasts;
```

**Note**: Beaches without any enhanced_forecasts rows will not appear in the view. The health check handles this by comparing against total beach count.

## Key Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260105161500_ensure_fast_v_enhanced_forecast_latest.sql` | View definition and index |
| `vercel.json` | Cron configuration including `maxBeaches` |
| `app/api/monitoring/forecast-health/route.ts` | Health check API endpoint |
| `lib/monitoring/forecast-health-check.ts` | Health check logic |
| `app/api/cron/forecasts/refresh/route.ts` | Forecast refresh cron handler |
| `lib/monitoring/forecast-monitoring-config.ts` | Staleness thresholds |

## Related Documentation

- [Forecast Monitoring Architecture](/docs/FORECAST_MONITORING_ARCHITECTURE.md) - System overview
- [Forecast Cron Architecture](/docs/FORECAST_CRON_ARCHITECTURE.md) - Cron scheduling strategy
- [Forecast Staleness Thresholds](/docs/FORECAST_STALENESS_THRESHOLDS.md) - Threshold configuration

---

**Last Updated:** January 2026
**Migration:** `20260105161500_ensure_fast_v_enhanced_forecast_latest.sql`
