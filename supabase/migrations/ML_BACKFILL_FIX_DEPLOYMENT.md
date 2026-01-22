# ML Backfill-Observations Pipeline Fix

## Problem Summary

The ML ground truth backfill pipeline stopped working on January 21, 2026, causing:
- **585,323 pending predictions** without ground truth
- **0% match rate** for the last 12+ days
- Model performance cannot be validated

## Root Cause

The Vercel cron job at `/api/cron/ml/backfill-observations` (configured in `vercel.json` at line 68-69) stopped executing. This fix adds a pg_cron backup that runs directly in the database.

## Files Created

| File | Purpose |
|------|---------|
| `20260122002142_add_pg_cron_ml_backfill.sql` | Main migration - adds functions and pg_cron job |
| `rollback_pg_cron_ml_backfill.sql` | Rollback script if issues arise |
| `clear_ml_backlog.sql` | One-time script to clear pending backlog |

## Deployment Steps

### Step 1: Apply the Migration

```bash
# Option A: Via Supabase CLI (local)
supabase db push

# Option B: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Paste contents of 20260122002142_add_pg_cron_ml_backfill.sql
# 3. Run
```

### Step 2: Verify Migration Success

Run this in Supabase SQL Editor:

```sql
-- Check functions were created
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('backfill_ml_observations_batch', 'get_ml_health_metrics');

-- Check pg_cron job was scheduled
SELECT jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'ml-backfill-observations';

-- Get current health metrics
SELECT * FROM get_ml_health_metrics();
```

### Step 3: Clear the Backlog

Run the `clear_ml_backlog.sql` script to process pending predictions:

```bash
# Via Supabase CLI
supabase db execute --file supabase/migrations/clear_ml_backlog.sql

# Or paste into SQL Editor and run
```

**Note:** This script processes ~100,000 predictions per run. Re-run until `pending_observations` approaches zero (some predictions may never match due to missing observation data).

### Step 4: Monitor Ongoing Health

After 1 hour, verify the pg_cron job is running:

```sql
-- Check recent job executions
SELECT
  jobname,
  status,
  start_time,
  end_time,
  return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
ORDER BY start_time DESC
LIMIT 10;

-- Check current health
SELECT * FROM get_ml_health_metrics();
```

## Expected Results

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| `pending_observations` | ~585,000 | < 10,000 |
| `match_rate_24h` | 0% | > 50% |
| `oldest_pending_age_hours` | > 288 | < 24 |

## Rollback

If issues arise:

```sql
-- Run the rollback script
\i rollback_pg_cron_ml_backfill.sql

-- Or manually:
SELECT cron.unschedule('ml-backfill-observations');
DROP FUNCTION IF EXISTS get_ml_health_metrics();
DROP FUNCTION IF EXISTS backfill_ml_observations_batch(INT);
```

## Architecture Notes

### Dual-Cron Strategy

The pipeline now has two redundant cron mechanisms:

1. **Vercel Cron** (`vercel.json` line 68-69)
   - Schedule: `30 * * * *` (every hour at :30)
   - Endpoint: `/api/cron/ml/backfill-observations`
   - Batch size: 1000 predictions

2. **pg_cron Backup** (this migration)
   - Schedule: `*/10 * * * *` (every 10 minutes)
   - Function: `backfill_ml_observations_batch(500)`
   - Batch size: 500 predictions

Both are idempotent - if one processes a prediction, the other won't re-process it.

### Why pg_cron?

- **Reliability**: Runs inside PostgreSQL, independent of external services
- **Visibility**: Job history available in `cron.job_run_details`
- **Performance**: Direct database access, no HTTP overhead
- **Resilience**: Survives Vercel deployment issues

## Monitoring Queries

```sql
-- Quick health check
SELECT * FROM get_ml_health_metrics();

-- Detailed backlog analysis
SELECT
  DATE_TRUNC('day', predicted_at) as day,
  COUNT(*) as predictions,
  COUNT(observed_m) as matched,
  ROUND(100.0 * COUNT(observed_m) / COUNT(*), 1) as match_rate
FROM ml_predictions_log
WHERE predicted_at > NOW() - INTERVAL '14 days'
GROUP BY 1
ORDER BY 1 DESC;

-- pg_cron job performance
SELECT
  DATE_TRUNC('hour', start_time) as hour,
  COUNT(*) as runs,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration_s
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
  AND start_time > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```
