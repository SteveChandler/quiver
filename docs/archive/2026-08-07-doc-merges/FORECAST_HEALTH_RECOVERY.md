> Merged into [Forecast Monitoring and Operations](../../forecast/README.md).

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

**Original optimization migration**: `supabase/migrations/20260105161500_ensure_fast_v_enhanced_forecast_latest.sql`

The view now also prioritizes the local today/tomorrow forecast window. See
`supabase/migrations/20260809050000_fix_near_term_forecast_latest_view.sql` and
the follow-up `supabase/migrations/20260809130000_skip_expired_today_forecast_latest.sql`,
which excludes already-passed forecast slots.

Replaced `DISTINCT ON` with the `LATERAL + LIMIT 1` pattern:

```sql
CREATE OR REPLACE VIEW public.v_enhanced_forecast_latest
WITH (security_invoker = true) AS
SELECT
  b.id AS beach_id,
  near_term.updated_at,
  near_term.data_source
FROM public.beaches b
CROSS JOIN LATERAL (
  SELECT ef.updated_at, ef.data_source
  FROM public.enhanced_forecasts ef
  WHERE ef.beach_id = b.id
    AND ef.forecast_at >= now()
    AND ef.forecast_at < now() + interval '72 hours'
    AND ef.updated_at IS NOT NULL
    AND NULLIF(BTRIM(ef.wave_height), '') IS NOT NULL
    AND NULLIF(BTRIM(ef.data_source), '') IS NOT NULL
  ORDER BY
    CASE
      WHEN (ef.forecast_at AT TIME ZONE COALESCE(NULLIF(b.timezone, ''), 'America/Los_Angeles'))::date =
        (now() AT TIME ZONE COALESCE(NULLIF(b.timezone, ''), 'America/Los_Angeles'))::date THEN 0
      WHEN (ef.forecast_at AT TIME ZONE COALESCE(NULLIF(b.timezone, ''), 'America/Los_Angeles'))::date =
        ((now() AT TIME ZONE COALESCE(NULLIF(b.timezone, ''), 'America/Los_Angeles'))::date + 1) THEN 1
      ELSE 2
    END,
    -- Local today first, then tomorrow; future horizon rows cannot mask a
    -- stale public-answer row.
    ef.forecast_at ASC,
    ef.updated_at DESC
  LIMIT 1
) near_term;
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

**Change**: Updated `vercel.json` to run **hourly** with `maxBeaches=130` (previously every 3h with maxBeaches=60).

```json
{
  "path": "/api/cron/forecasts/refresh?source=marine&maxBeaches=130",
  "schedule": "0 * * * *"
}
```

**Cycle time calculation:**

```
Cycle Time = (Total Beaches / Beaches Per Run) * Run Interval

Before: (780 / 60) * 3h   = 39 hours  (PROBLEM: exceeds 6h threshold)
After:  (780 / 130) * 1h  = 6 hours   (OK: meets 6h threshold ✓)
```

**Why hourly with smaller batches instead of larger batches every 3h:**
- Stays well under the 5-minute Vercel timeout (130 beaches << 390 needed for 3h interval)
- Achieves the 6-hour staleness threshold
- Provides headroom for API latency variations
- Combined with oldest-first prioritization, ensures user-facing freshness

## Beach Count Considerations

The cycle time formula depends heavily on the total number of beaches in the database.

**Current config:** `maxBeaches=130` running hourly

| Total Beaches | Cycle Time (hourly, 130/run) | Meets 6h Threshold? |
|---------------|------------------------------|---------------------|
| 260 (dev)     | 2 hours                      | Yes ✓               |
| 500           | 3.8 hours                    | Yes ✓               |
| 780 (prod)    | 6 hours                      | Yes ✓               |
| 1000          | 7.7 hours                    | No (need 167/run)   |

**Recommendation:** If beach count exceeds 780, increase `maxBeaches` proportionally while staying under Vercel's 5-minute timeout limit.

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
     "path": "/api/cron/forecasts/refresh?source=marine&maxBeaches=130",
     "schedule": "0 * * * *"
   }
   ```

3. Check for execution timeouts in logs.

**Resolution:**
- If timing out: Reduce `maxBeaches` to 100 or 80
- If not running: Verify cron is enabled in Vercel dashboard
- If API errors: Check NDBC/CDIP service availability
- If cycle time too long: Increase `maxBeaches` (stay under ~150 to avoid timeout risk)

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

- [Forecast Monitoring Architecture](/docs/forecast/README.md) - System overview
- [Forecast Cron Architecture](/docs/forecast/README.md) - Cron scheduling strategy
- [Forecast Staleness Thresholds](/docs/forecast/README.md) - Threshold configuration

---

**Last Updated:** January 2026
**Migration:** `20260105161500_ensure_fast_v_enhanced_forecast_latest.sql`
