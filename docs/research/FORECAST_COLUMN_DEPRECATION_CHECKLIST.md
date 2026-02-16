# Forecast Column Deprecation Implementation Checklist

**Target columns:** `forecast_date` (text), `forecast_time` (text)
**Replacement:** `forecast_at` (timestamptz)
**Timeline:** 4-6 weeks minimum

---

## Phase 1: Monitoring (Week 1)

### Goals
- Identify all code paths writing to deprecated columns
- Establish baseline for zero writes before proceeding

### Tasks
- [ ] Deploy audit trigger migration (`add_deprecated_column_audit.sql`)
- [ ] Run audit for 7 days minimum
- [ ] Query audit logs daily to check for writes
- [ ] Document findings: which services/functions write to deprecated columns
- [ ] Fix any code still writing to deprecated columns
- [ ] Confirm zero writes for 3+ consecutive days before moving to Phase 2

### Migration
```bash
# Create migration file
supabase migration new add_deprecated_column_audit

# Copy SQL from DATABASE_COLUMN_DEPRECATION_RESEARCH.md Phase 1
# Apply locally
supabase db reset

# Apply to production (via claude_migrator role)
# See docs/research/DATABASE_COLUMN_DEPRECATION_RESEARCH.md for full migration
```

### Monitoring Queries
```sql
-- Check for recent writes (last 7 days)
SELECT
  column_name,
  operation,
  COUNT(*) as access_count,
  MAX(occurred_at) as last_access
FROM audit.deprecated_column_access
WHERE occurred_at > NOW() - INTERVAL '7 days'
  AND table_name = 'forecasts'
GROUP BY column_name, operation
ORDER BY access_count DESC;

-- Expected result: 0 rows (no writes)
```

---

## Phase 2: Block Writes (Week 2)

### Goals
- Prevent new code from writing to deprecated columns
- Provide helpful error messages to developers

### Prerequisites
- [ ] Phase 1 audit logs show zero writes for 3+ days

### Tasks
- [ ] Remove audit trigger (replace with write-blocking trigger)
- [ ] Deploy write-blocking trigger migration (`block_deprecated_forecast_columns.sql`)
- [ ] Monitor application logs for trigger exceptions
- [ ] If exceptions found, fix code and re-verify zero writes
- [ ] Update TypeScript types to mark columns as deprecated
- [ ] Add type overrides in `lib/database-overrides.ts`
- [ ] Update imports to use `ForecastSafe` type instead of raw `Forecast`

### Migration
```bash
# Create migration file
supabase migration new block_deprecated_forecast_columns

# Copy SQL from DATABASE_COLUMN_DEPRECATION_RESEARCH.md Phase 2
# Test locally first
supabase db reset

# Apply to production
```

### TypeScript Changes
```typescript
// lib/database-overrides.ts (create new file)
import { Database } from './database.types';

export type ForecastSafe = Omit<
  Database['public']['Tables']['forecasts']['Row'],
  'forecast_date' | 'forecast_time'
>;

export type ForecastInsert = Omit<
  Database['public']['Tables']['forecasts']['Insert'],
  'forecast_date' | 'forecast_time'
>;

export type ForecastUpdate = Omit<
  Database['public']['Tables']['forecasts']['Update'],
  'forecast_date' | 'forecast_time'
>;
```

### Validation
- [ ] Attempt to write to `forecast_date` via Supabase client (should fail with helpful error)
- [ ] Verify error message includes migration guide reference
- [ ] Check application logs for any unexpected exceptions
- [ ] No exceptions for 7+ days before proceeding to Phase 3

---

## Phase 3: Make Nullable (Week 3)

### Goals
- Remove NOT NULL constraints
- Prepare columns for eventual deletion

### Prerequisites
- [ ] Phase 2 write-blocking trigger active for 7+ days with zero exceptions

### Tasks
- [ ] Deploy nullable migration (`make_deprecated_columns_nullable.sql`)
- [ ] Verify columns are nullable: `\d forecasts` in psql
- [ ] Add COMMENT to columns documenting deprecation
- [ ] Wait 7 days before Phase 4

### Migration
```bash
# Create migration file
supabase migration new make_deprecated_columns_nullable

# Copy SQL from DATABASE_COLUMN_DEPRECATION_RESEARCH.md Phase 3
# Test locally
supabase db reset

# Apply to production
```

### Validation
```sql
-- Verify columns are nullable
SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'forecasts'
  AND column_name IN ('forecast_date', 'forecast_time');

-- Expected: is_nullable = 'YES', column_default = NULL
```

---

## Phase 4: Drop Columns (Week 4-6)

### Goals
- Permanently remove deprecated columns
- Clean up triggers and functions

### Prerequisites
- [ ] Phase 3 completed for 14+ days
- [ ] No trigger exceptions in logs
- [ ] Fresh database backup taken (within 24 hours)
- [ ] All queries confirmed to use `forecast_at`

### Tasks
- [ ] Take fresh database backup: `pg_dump` or Supabase dashboard backup
- [ ] Document backup artifact name and timestamp
- [ ] Deploy drop columns migration (`drop_deprecated_forecast_columns.sql`)
- [ ] Drop write-blocking trigger and function
- [ ] Drop columns: `forecast_date`, `forecast_time`
- [ ] Regenerate TypeScript types: `npx supabase gen types typescript`
- [ ] Remove type overrides from `lib/database-overrides.ts`
- [ ] Update imports from `ForecastSafe` back to `Forecast`
- [ ] Run full test suite (unit + E2E)
- [ ] Monitor for 24 hours post-deployment

### Migration
```bash
# IMPORTANT: Take backup FIRST
# Supabase Dashboard -> Database -> Backups -> Create Manual Backup

# Create migration file
supabase migration new drop_deprecated_forecast_columns

# Copy SQL from DATABASE_COLUMN_DEPRECATION_RESEARCH.md Phase 4
# Test locally
supabase db reset

# Regenerate types locally
npx supabase gen types typescript --local > lib/database.types.ts

# Apply to production (via claude_migrator role)
```

### Rollback Plan (if needed)
```sql
-- If issues found within 24 hours, rollback:
BEGIN;

-- Re-add columns (nullable)
ALTER TABLE forecasts
  ADD COLUMN IF NOT EXISTS forecast_date TEXT,
  ADD COLUMN IF NOT EXISTS forecast_time TEXT;

-- Re-add write-blocking trigger (from Phase 2 migration)
-- ... (copy from phase 2 migration file)

COMMIT;

-- Then restore data from backup if needed
```

### Post-Drop Cleanup
- [ ] Remove `lib/database-overrides.ts` file
- [ ] Search codebase for `ForecastSafe` and replace with `Forecast`
- [ ] Update CHANGELOG.md under `[Unreleased]`
- [ ] Update `docs/COORDINATE_CONVENTIONS.md` to remove forecast_date/time references
- [ ] Drop audit schema if no longer needed: `DROP SCHEMA IF EXISTS audit CASCADE;`

---

## Phase 5: Data Retention (Parallel Track)

### Goals
- Prevent unbounded forecast table growth
- Implement automated retention policies

### Timeline
Can be implemented in parallel with Phases 1-4

### Option A: pg_cron (Recommended for Supabase)

#### Tasks
- [ ] Deploy retention policies migration (`add_forecast_retention_policies.sql`)
- [ ] Create `forecast_daily_aggregates` table
- [ ] Schedule daily aggregation job (runs 2am)
- [ ] Schedule weekly deletion job for old forecasts (runs Sunday 3am)
- [ ] Schedule monthly deletion job for old aggregates (runs 1st of month 4am)
- [ ] Optimize autovacuum settings for forecasts table
- [ ] Monitor cron job execution for 2 weeks

#### Migration
```bash
# Create migration file
supabase migration new add_forecast_retention_policies

# Copy SQL from DATABASE_COLUMN_DEPRECATION_RESEARCH.md Phase 5 Option A
# Test locally
supabase db reset

# Apply to production
```

#### Monitoring
```sql
-- View scheduled cron jobs
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job;

-- Check job run history
SELECT
  job_id,
  jobname,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Verify aggregation is working
SELECT
  date,
  COUNT(*) as beach_count
FROM forecast_daily_aggregates
GROUP BY date
ORDER BY date DESC
LIMIT 10;

-- Expected: ~46 beaches per day (based on observable_beaches count)
```

#### Validation Tasks
- [ ] Wait 24 hours after deployment
- [ ] Verify daily aggregation ran: check `forecast_daily_aggregates` for yesterday's date
- [ ] Check cron job status: `SELECT * FROM cron.job_run_details WHERE status = 'failed';`
- [ ] Monitor table size: `SELECT pg_size_pretty(pg_total_relation_size('forecasts'));`
- [ ] Set alert for job failures (Sentry or Supabase logs)

### Option B: TimescaleDB (If Available)

#### Tasks
- [ ] Verify TimescaleDB extension available: `SELECT * FROM pg_available_extensions WHERE name = 'timescaledb';`
- [ ] Deploy TimescaleDB migration (`convert_to_timescaledb.sql`)
- [ ] Convert forecasts table to hypertable
- [ ] Add compression policy (30 days)
- [ ] Add retention policy (90 days)
- [ ] Create continuous aggregate for daily stats
- [ ] Monitor hypertable chunks and compression

#### Migration
```bash
# Check if TimescaleDB is available
psql -c "SELECT * FROM pg_available_extensions WHERE name = 'timescaledb';"

# If available, create migration
supabase migration new convert_to_timescaledb

# Copy SQL from DATABASE_COLUMN_DEPRECATION_RESEARCH.md Phase 5 Option B
# Test locally (requires TimescaleDB installed)

# Apply to production
```

#### Monitoring
```sql
-- View hypertable info
SELECT * FROM timescaledb_information.hypertables
WHERE hypertable_name = 'forecasts';

-- View chunks
SELECT * FROM timescaledb_information.chunks
WHERE hypertable_name = 'forecasts'
ORDER BY range_start DESC;

-- View compression stats
SELECT
  chunk_name,
  compression_status,
  before_compression_total_bytes,
  after_compression_total_bytes,
  ROUND(100.0 * (1 - after_compression_total_bytes::numeric / before_compression_total_bytes::numeric), 2) AS compression_ratio
FROM timescaledb_information.compressed_chunk_stats
ORDER BY chunk_name;
```

---

## Monitoring and Alerts

### Key Metrics to Track

**During Deprecation (Phases 1-4):**
- [ ] Audit log writes to deprecated columns (target: 0)
- [ ] Trigger exceptions in application logs (target: 0)
- [ ] Application error rate (should not increase)
- [ ] Database query performance (should not degrade)

**After Retention Implementation (Phase 5):**
- [ ] Forecasts table size (should stabilize around 100K-150K rows)
- [ ] Cron job success rate (target: 100%)
- [ ] Daily aggregates table growth (expected: ~17K rows/year)
- [ ] Oldest forecast date (should not exceed 90 days)

### Queries for Regular Monitoring
```sql
-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('forecasts', 'forecast_daily_aggregates')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Forecast data age distribution
SELECT
  DATE_TRUNC('month', forecast_at) as month,
  COUNT(*) as row_count,
  pg_size_pretty(COUNT(*) * 500) as estimated_size -- ~500 bytes/row
FROM forecasts
GROUP BY DATE_TRUNC('month', forecast_at)
ORDER BY month DESC;

-- Dead tuple percentage (indicator of vacuum health)
SELECT
  schemaname,
  tablename,
  n_live_tup,
  n_dead_tup,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE tablename = 'forecasts';

-- Expected: dead_pct < 5% (autovacuum is working)
```

---

## Risk Mitigation

### Rollback Procedures

**Phase 1 Rollback (Audit Trigger):**
```sql
-- Remove audit trigger
DROP TRIGGER IF EXISTS audit_deprecated_forecast_columns ON forecasts;
DROP FUNCTION IF EXISTS audit.log_deprecated_forecast_columns();
DROP TABLE IF EXISTS audit.deprecated_column_access;
```

**Phase 2 Rollback (Write-Blocking Trigger):**
```sql
-- Remove write-blocking trigger
DROP TRIGGER IF EXISTS block_deprecated_forecast_columns ON forecasts;
DROP FUNCTION IF EXISTS prevent_deprecated_forecast_column_writes();

-- Optionally re-add audit trigger from Phase 1
```

**Phase 3 Rollback (Nullable Columns):**
```sql
-- Re-add NOT NULL constraints (only if data permits)
ALTER TABLE forecasts
  ALTER COLUMN forecast_date SET NOT NULL,
  ALTER COLUMN forecast_time SET NOT NULL;
```

**Phase 4 Rollback (Dropped Columns):**
```sql
-- CRITICAL: Requires backup restore
-- 1. Restore from pg_dump backup taken before Phase 4
-- 2. Or re-add columns (data will be NULL):
ALTER TABLE forecasts
  ADD COLUMN forecast_date TEXT,
  ADD COLUMN forecast_time TEXT;
```

**Phase 5 Rollback (Retention Policies):**
```sql
-- Disable cron jobs (don't delete data)
SELECT cron.unschedule('aggregate-forecasts-daily');
SELECT cron.unschedule('delete-old-forecasts');
SELECT cron.unschedule('delete-old-daily-aggregates');

-- For TimescaleDB:
SELECT remove_retention_policy('forecasts');
SELECT remove_compression_policy('forecasts');
```

### Emergency Contacts

**Before Production Deployment:**
- [ ] Maintainer notified of planned migration window
- [ ] Backup confirmed and tested
- [ ] Rollback plan documented and reviewed

**During Deployment:**
- [ ] Monitor Sentry for new errors
- [ ] Check Supabase logs for database errors
- [ ] Watch application metrics (error rate, response time)

**After Deployment:**
- [ ] 24-hour monitoring period
- [ ] Confirm zero regressions
- [ ] Update team on completion

---

## Success Criteria

### Phase 1 Success
- [ ] Audit logs show zero writes to deprecated columns for 3+ days
- [ ] All code paths identified and documented

### Phase 2 Success
- [ ] Write-blocking trigger deployed
- [ ] Zero trigger exceptions for 7+ days
- [ ] TypeScript types enforce deprecation at compile-time

### Phase 3 Success
- [ ] Columns are nullable
- [ ] Database comments document deprecation
- [ ] No application errors

### Phase 4 Success
- [ ] Columns dropped successfully
- [ ] TypeScript types regenerated
- [ ] All tests passing (unit + E2E)
- [ ] No regressions in production for 24+ hours

### Phase 5 Success
- [ ] Cron jobs running successfully (100% success rate)
- [ ] Table size stabilized (90-day retention working)
- [ ] Daily aggregates populating correctly
- [ ] No performance degradation

---

## Next Steps

1. **Review research document:** `docs/research/DATABASE_COLUMN_DEPRECATION_RESEARCH.md`
2. **Start Phase 1:** Deploy audit trigger migration
3. **Monitor for 7 days:** Identify any unexpected writes
4. **Fix code:** Remove writes to deprecated columns
5. **Proceed to Phase 2:** Only after 3+ days of zero writes

**Estimated completion:** 4-6 weeks from Phase 1 start to Phase 4 completion
**Phase 5 (retention):** Can run in parallel, estimated 1-2 weeks to deploy and validate
