# Database Column Deprecation and Time-Series Data Retention Research

**Date:** 2026-02-14
**Context:** Deprecating `forecast_date` (text) and `forecast_time` (text) in favor of canonical `forecast_at` (timestamptz) column, plus managing forecast data growth in production PostgreSQL/Supabase.

---

## Executive Summary

This research covers five critical areas for safely deprecating legacy database columns in production:

1. **Column Write Prevention Strategies** - BEFORE triggers with RAISE EXCEPTION are the most reliable approach for Supabase/PostgreSQL
2. **Deprecation Timeline Best Practices** - Industry standard is a 3-4 phase approach over 2-4 weeks minimum
3. **Monitoring Deprecated Column Usage** - Audit triggers are necessary since `pg_stat_user_tables` doesn't track column-level writes
4. **Supabase-Specific Considerations** - service_role bypasses RLS, legacy anon keys being phased out, TypeScript types include all columns
5. **Database Growth Management** - TimescaleDB offers superior automation vs native PostgreSQL partitioning for time-series data

---

## 1. Column Write Prevention Strategies

### Recommended: BEFORE Trigger with RAISE EXCEPTION

**Why it works best for Supabase:**
- Works regardless of which role makes the write (service_role, anon, authenticated)
- Provides clear error messages to developers when deprecated columns are accessed
- No schema changes required to existing columns
- Can be selectively applied to INSERT, UPDATE, or both operations

**Implementation Pattern:**

```sql
CREATE OR REPLACE FUNCTION prevent_deprecated_column_writes()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if deprecated columns are being written to
  IF NEW.forecast_date IS DISTINCT FROM OLD.forecast_date THEN
    RAISE EXCEPTION 'Column "forecast_date" is deprecated. Use "forecast_at" instead.';
  END IF;

  IF NEW.forecast_time IS DISTINCT FROM OLD.forecast_time THEN
    RAISE EXCEPTION 'Column "forecast_time" is deprecated. Use "forecast_at" instead.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER block_deprecated_forecast_columns
  BEFORE INSERT OR UPDATE ON forecasts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_deprecated_column_writes();
```

**Key considerations:**
- Use `IS DISTINCT FROM` to handle NULL values correctly
- For INSERT operations, compare against NULL since there's no OLD row
- BEFORE triggers can inspect and modify NEW values before they're written
- If exception is raised, the entire transaction is rolled back

**Source:** [PostgreSQL BEFORE UPDATE Trigger](https://neon.com/postgresql/postgresql-triggers/postgresql-before-update-trigger), [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)

### Alternative Approaches (Not Recommended for This Use Case)

**CHECK Constraints:**
- **Limitation:** Only validate values, can't prevent writes entirely
- **Example:** `CHECK (forecast_date IS NULL)` would reject non-NULL values but doesn't provide helpful migration messaging
- **Use case:** Better for data validation than deprecation signaling

**GENERATED ALWAYS AS Columns:**
- **Limitation:** Cannot convert existing columns to GENERATED; requires new column creation
- **How it works:** Values are computed automatically and cannot be manually written
- **Use case:** Good for derived data, not for deprecating existing columns
- **Source:** [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)

**Column-Level REVOKE:**
- **Limitation:** Supabase primarily uses service_role (superuser) which bypasses column permissions
- **Complexity:** Would need to revoke from specific roles, doesn't work for service_role
- **Use case:** Multi-tenant systems with distinct database roles

---

## 2. Deprecation Timeline Best Practices

### Industry-Standard "Expand, Migrate, Contract" Pattern

**Phase 1: Expand (Add New Column)**
- **Duration:** 1 deployment cycle
- **Actions:**
  - Add new `forecast_at` column alongside legacy columns
  - Create adapter/migration layer to populate both old and new columns
  - Deploy application code that writes to BOTH schemas
- **Success criteria:** Zero errors writing to new column in production

**Phase 2: Migrate (Dual Read/Write)**
- **Duration:** 1-2 weeks minimum (longer for high-traffic systems)
- **Actions:**
  - Update application code to READ from new column
  - Continue writing to both columns for backward compatibility
  - Monitor for any reads of deprecated columns via audit triggers
  - Backfill historical data to new column
- **Success criteria:** Zero reads from deprecated columns for 7+ days
- **Monitoring:** Track audit logs, application logs, and error rates

**Phase 3: Contract (Make Deprecated Columns Read-Only)**
- **Duration:** 1-2 weeks minimum
- **Actions:**
  - Add BEFORE trigger to prevent writes to deprecated columns
  - Remove code that writes to deprecated columns
  - Monitor for any trigger exceptions
- **Success criteria:** No trigger exceptions for 7+ days
- **Rollback plan:** Drop trigger if issues arise, revert to dual-write

**Phase 4: Drop (Remove Deprecated Columns)**
- **Duration:** 2-4 weeks after Phase 3
- **Actions:**
  - Verify zero usage via logs and monitoring
  - Remove columns in separate migration
  - Update TypeScript types
- **Success criteria:** Clean removal with no errors

**Total timeline:** 4-8 weeks minimum for critical production systems

**Critical best practice:** "Take your time with migrations, test thoroughly, and always have a rollback plan." - Multiple sources emphasize this principle.

**Sources:**
- [PlanetScale: Backward Compatible Database Changes](https://planetscale.com/blog/backward-compatible-databases-changes)
- [GitLab: Avoiding Downtime in Migrations](https://docs.gitlab.com/development/database/avoiding_downtime_in_migrations/)
- [JetBrains: Database Migrations in the Real World](https://blog.jetbrains.com/idea/2025/02/database-migrations-in-the-real-world/)
- [Medium: Database Schema Evolution](https://medium.com/@shbhggrwl/database-schema-evolution-techniques-and-tools-for-zero-downtime-migrations-e0c5bc3f9ef3)

---

## 3. Monitoring Deprecated Column Usage

### Why Built-In PostgreSQL Stats Are Insufficient

**Limitation of `pg_stat_user_tables`:**
- Tracks table-level statistics only (total rows updated, sequential scans, etc.)
- **Does NOT track column-level writes**
- Useful for overall table health but not for column deprecation tracking

**What `pg_stat_user_tables` provides:**
- `n_tup_upd`: Total number of rows updated (table-level)
- `n_tup_ins`: Total number of rows inserted (table-level)
- `last_vacuum`, `last_autovacuum`: Maintenance metrics
- **No per-column write counters**

**Source:** [PostgreSQL Statistics Collector](https://www.postgresql.org/docs/current/monitoring-stats.html), [Monitoring Table-Level Statistics](https://medium.com/@jramcloud1/24-postgresql-17-performance-tuning-monitoring-table-level-statistics-with-pg-stat-user-tables-9b281933b03e)

### Recommended: Audit Trigger for Column-Level Tracking

**Implementation Strategy:**

```sql
-- Create audit log table
CREATE TABLE IF NOT EXISTS audit.deprecated_column_access (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'INSERT' or 'UPDATE'
  old_value TEXT,
  new_value TEXT,
  user_id UUID,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  session_user TEXT DEFAULT SESSION_USER,
  application_name TEXT DEFAULT CURRENT_SETTING('application_name')
);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_deprecated_forecast_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Track forecast_date writes
  IF (TG_OP = 'INSERT' AND NEW.forecast_date IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.forecast_date IS DISTINCT FROM OLD.forecast_date) THEN
    INSERT INTO audit.deprecated_column_access (
      table_name, column_name, operation, old_value, new_value
    ) VALUES (
      TG_TABLE_NAME,
      'forecast_date',
      TG_OP,
      OLD.forecast_date,
      NEW.forecast_date
    );
  END IF;

  -- Track forecast_time writes
  IF (TG_OP = 'INSERT' AND NEW.forecast_time IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.forecast_time IS DISTINCT FROM OLD.forecast_time) THEN
    INSERT INTO audit.deprecated_column_access (
      table_name, column_name, operation, old_value, new_value
    ) VALUES (
      TG_TABLE_NAME,
      'forecast_time',
      TG_OP,
      OLD.forecast_time,
      NEW.forecast_time
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_forecast_deprecated_columns
  BEFORE INSERT OR UPDATE ON forecasts
  FOR EACH ROW
  EXECUTE FUNCTION audit_deprecated_forecast_columns();
```

**Monitoring queries:**

```sql
-- Check for recent writes to deprecated columns (last 24 hours)
SELECT
  column_name,
  operation,
  COUNT(*) as access_count,
  MAX(occurred_at) as last_access
FROM audit.deprecated_column_access
WHERE occurred_at > NOW() - INTERVAL '24 hours'
  AND table_name = 'forecasts'
GROUP BY column_name, operation
ORDER BY last_access DESC;

-- Identify which users/applications are still writing to deprecated columns
SELECT
  session_user,
  application_name,
  column_name,
  COUNT(*) as write_count
FROM audit.deprecated_column_access
WHERE occurred_at > NOW() - INTERVAL '7 days'
  AND table_name = 'forecasts'
GROUP BY session_user, application_name, column_name
ORDER BY write_count DESC;
```

**Performance considerations:**
- Audit triggers add overhead to every INSERT/UPDATE
- Consider adding conditional logic: only audit if deprecated columns are non-NULL
- Add indexes on `table_name`, `column_name`, `occurred_at` for fast queries
- Set up retention policy to auto-delete audit logs older than 90 days

**Alternative: pg_stat_statements for query-level tracking**

While not column-specific, `pg_stat_statements` can identify queries that reference deprecated columns:

```sql
-- Find queries that mention deprecated columns
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%forecast_date%'
   OR query ILIKE '%forecast_time%'
ORDER BY calls DESC
LIMIT 20;
```

**Limitation:** Only shows query text, not which columns were actually written to.

**Sources:**
- [PostgreSQL Audit Triggers Wiki](https://wiki.postgresql.org/wiki/Audit_trigger)
- [Supabase: Postgres Auditing in 150 Lines of SQL](https://supabase.com/blog/postgres-audit)
- [PostgreSQL pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)

---

## 4. Supabase-Specific Considerations

### RLS and Role Behavior

**Key principle:** Write prevention triggers work at the database level, BEFORE RLS policies are evaluated.

**Role hierarchy:**
1. **service_role / secret key** - Bypasses ALL RLS policies, full database access
2. **anon / publishable key** - Subject to RLS policies for `anon` role
3. **authenticated** - Subject to RLS policies for `authenticated` role

**Why BEFORE triggers are ideal for Supabase:**
- Triggers fire regardless of which role makes the request
- `service_role` may bypass RLS, but it cannot bypass triggers
- Works for Edge Functions (which typically use service_role client)
- Works for client-side Supabase queries (which use anon/authenticated)

**Source:** [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Why is my service role key getting RLS errors?](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)

### API Key Migration (Legacy Concerns)

**Important context for existing projects:**
- **Legacy keys:** `anon` (JWT-based), `service_role` (JWT-based)
- **New keys (2025+):** `sb_publishable_*`, `sb_secret_*`
- **Deprecation timeline:** Projects restored after Nov 1, 2025 no longer get legacy keys
- **Migration impact:** Edge Functions currently only support JWT verification via legacy keys

**For column deprecation:**
- Both legacy and new keys will interact with database triggers the same way
- No special handling needed for API key transition
- Deprecated column prevention works regardless of key type

**Sources:**
- [Supabase: Upcoming Changes to API Keys](https://github.com/orgs/supabase/discussions/29260)
- [Supabase: Understanding API Keys](https://supabase.com/docs/guides/api/api-keys)
- [Use of New API Keys Discussion](https://github.com/orgs/supabase/discussions/40300)

### TypeScript Type Generation

**Current limitation:** `supabase gen types typescript` includes ALL columns in generated types, including deprecated ones.

**Workarounds:**

1. **Manual type override (recommended for short-term deprecation):**

```typescript
// lib/database.types.ts (generated)
export interface Forecast {
  id: string;
  forecast_at: string;
  forecast_date: string; // DEPRECATED - use forecast_at
  forecast_time: string; // DEPRECATED - use forecast_at
  // ... other fields
}

// lib/database-overrides.ts (manual)
export type ForecastSafe = Omit<Forecast, 'forecast_date' | 'forecast_time'>;

// Usage
import { ForecastSafe } from '@/lib/database-overrides';
```

2. **Post-processing script:**

```typescript
// scripts/clean-generated-types.ts
import fs from 'fs';

const typesFile = 'lib/database.types.ts';
let content = fs.readFileSync(typesFile, 'utf-8');

// Comment out deprecated columns
content = content.replace(
  /(\s+forecast_date: string;)/g,
  '// DEPRECATED: $1'
);
content = content.replace(
  /(\s+forecast_time: string;)/g,
  '// DEPRECATED: $1'
);

fs.writeFileSync(typesFile, content);
```

3. **Create view without deprecated columns:**

```sql
-- Create a view that excludes deprecated columns
CREATE VIEW forecasts_v2 AS
SELECT
  id,
  beach_id,
  forecast_at,
  -- Exclude forecast_date and forecast_time
  wave_height_min,
  wave_height_max
  -- ... other columns
FROM forecasts;

-- Grant appropriate permissions
GRANT SELECT ON forecasts_v2 TO anon, authenticated;

-- Generate types from view
-- supabase gen types typescript --schema public --include-tables forecasts_v2
```

**Limitation:** View approach requires code changes to query from `forecasts_v2` instead of `forecasts`.

**Long-term solution:** Once columns are dropped, regenerate types and the problem resolves automatically.

**Sources:**
- [Supabase: Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types)
- [Supabase TypeScript Support](https://supabase.com/docs/reference/javascript/typescript-support)

---

## 5. Database Growth Management for Time-Series Data

### The Challenge: Forecast Data Accumulation

**Typical forecast table growth:**
- 46 observable beaches in Quiver (based on context from MEMORY.md)
- Hourly forecasts = 24 forecasts/day/beach
- Daily volume: 46 beaches × 24 hours = 1,104 rows/day
- Monthly volume: ~33,000 rows
- Yearly volume: ~400,000 rows
- **Without retention policies, table size grows indefinitely**

**PostgreSQL storage impact:**
- Each row in `forecasts` table likely contains 20-30 columns
- Conservative estimate: 500 bytes/row (with indexes)
- 1 year of data = 400K rows × 500 bytes = ~200 MB
- 5 years = ~1 GB
- **Plus indexes, VACUUM overhead, dead tuples**

### Native PostgreSQL Partitioning (Manual Approach)

**Range partitioning by time:**

```sql
-- Convert forecasts table to partitioned table
CREATE TABLE forecasts_partitioned (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  beach_id UUID NOT NULL,
  forecast_at TIMESTAMPTZ NOT NULL,
  wave_height_min NUMERIC,
  -- ... other columns
) PARTITION BY RANGE (forecast_at);

-- Create monthly partitions
CREATE TABLE forecasts_2026_02 PARTITION OF forecasts_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE forecasts_2026_03 PARTITION OF forecasts_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- ... repeat for each month
```

**Benefits:**
- Query performance improves (smaller chunks scanned)
- Dropping old data is fast: `DROP TABLE forecasts_2025_01;`
- No DELETE operations needed (which create dead tuples)

**Drawbacks:**
- **Manual partition creation** - requires monthly maintenance or automation script
- **Manual retention management** - need cron job or script to drop old partitions
- No built-in compression
- Partition management complexity

**Performance comparison (from research):**
- Dropping a partition: ~milliseconds (DDL operation)
- DELETE + VACUUM: could take minutes to hours for large tables
- **TimescaleDB is 2000x faster than DELETE for data retention**

**Source:** [PostgreSQL Partitioning Best Practices](https://stormatics.tech/blogs/improving-postgresql-performance-with-partitioning), [Timescale vs PostgreSQL](https://maddevs.io/writeups/time-series-data-management-with-timescaledb/)

### TimescaleDB (Purpose-Built for Time-Series)

**Automated features for forecast data:**

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert table to hypertable (automatic partitioning)
SELECT create_hypertable(
  'forecasts',
  'forecast_at',
  chunk_time_interval => INTERVAL '7 days'
);

-- Add automatic data retention (drop chunks older than 90 days)
SELECT add_retention_policy('forecasts', INTERVAL '90 days');

-- Add compression for data older than 30 days (90% storage savings)
ALTER TABLE forecasts SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'beach_id'
);

SELECT add_compression_policy('forecasts', INTERVAL '30 days');

-- Create continuous aggregate for daily summaries
CREATE MATERIALIZED VIEW forecasts_daily
WITH (timescaledb.continuous) AS
SELECT
  beach_id,
  time_bucket('1 day', forecast_at) AS day,
  AVG(wave_height_min) as avg_wave_height_min,
  AVG(wave_height_max) as avg_wave_height_max,
  MAX(wave_height_max) as max_wave_height
FROM forecasts
GROUP BY beach_id, day;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('forecasts_daily',
  start_offset => INTERVAL '1 month',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
```

**Benefits:**
- **Automatic partitioning** - no manual partition creation
- **Automatic retention** - chunks older than 90 days are dropped automatically
- **Compression** - 90% storage reduction for old data
- **Downsampling** - continuous aggregates for long-term trends
- **2000x faster deletes** compared to native PostgreSQL DELETE

**Drawbacks:**
- Requires TimescaleDB extension (not available on all Supabase plans)
- Slight learning curve for hypertable concepts
- Some DDL operations (ALTER TABLE) require special handling

**Is TimescaleDB available on Supabase?**
- **Self-hosted Supabase:** Yes, can install TimescaleDB extension
- **Supabase Cloud (Free/Pro):** Check documentation - extension availability varies by plan
- **Alternative:** Use native PostgreSQL partitioning + pg_cron for automation

**Sources:**
- [TimescaleDB vs PostgreSQL for Time-Series](https://www.timescale.com/blog/timescaledb-vs-6a696248104e/)
- [TimescaleDB Data Retention Management](https://www.tigerdata.com/blog/how-timescaledb-solves-common-postgresql-problems-in-database-operations-with-data-retention-management)
- [Timescale Documentation](https://docs.timescale.com/timescaledb/latest/overview/how-does-it-compare/timescaledb-vs-postgres/)

### Recommended Retention Strategy for Quiver

**Based on forecast data characteristics:**

1. **Keep granular hourly data for 90 days**
   - Supports session logs (recent surf sessions)
   - Allows users to review historical conditions
   - Manageable storage: 90 days × 1,104 rows/day = ~100K rows

2. **Compress data older than 30 days**
   - TimescaleDB compression: 90% storage savings
   - Native PostgreSQL: no built-in compression, consider archival to separate table

3. **Keep daily aggregates for 2 years**
   - Long-term trend analysis
   - "What were conditions like this time last year?"
   - Much smaller storage footprint (365 × 46 beaches = ~17K rows/year)

4. **Drop data older than 2 years entirely**
   - Minimal value for surf forecasting
   - Keeps database lean and performant

**Implementation approach:**

**Option A: TimescaleDB (if available)**
- Automatic retention policy for 90 days
- Compression after 30 days
- Continuous aggregate for daily summaries (2 year retention)

**Option B: Native PostgreSQL + pg_cron**
```sql
-- Create daily aggregate table
CREATE TABLE forecast_daily_aggregates (
  beach_id UUID NOT NULL,
  date DATE NOT NULL,
  avg_wave_height_min NUMERIC,
  avg_wave_height_max NUMERIC,
  max_wave_height NUMERIC,
  PRIMARY KEY (beach_id, date)
);

-- pg_cron job to aggregate yesterday's data (run daily at 2am)
SELECT cron.schedule(
  'aggregate-forecasts-daily',
  '0 2 * * *', -- Every day at 2am
  $$
  INSERT INTO forecast_daily_aggregates
  SELECT
    beach_id,
    DATE(forecast_at) as date,
    AVG(wave_height_min),
    AVG(wave_height_max),
    MAX(wave_height_max)
  FROM forecasts
  WHERE DATE(forecast_at) = CURRENT_DATE - INTERVAL '1 day'
  GROUP BY beach_id, DATE(forecast_at)
  ON CONFLICT (beach_id, date) DO UPDATE SET
    avg_wave_height_min = EXCLUDED.avg_wave_height_min,
    avg_wave_height_max = EXCLUDED.avg_wave_height_max,
    max_wave_height = EXCLUDED.max_wave_height;
  $$
);

-- pg_cron job to delete old forecasts (run weekly)
SELECT cron.schedule(
  'delete-old-forecasts',
  '0 3 * * 0', -- Every Sunday at 3am
  $$
  DELETE FROM forecasts
  WHERE forecast_at < NOW() - INTERVAL '90 days';
  $$
);

-- pg_cron job to delete old aggregates (run monthly)
SELECT cron.schedule(
  'delete-old-aggregates',
  '0 4 1 * *', -- First day of month at 4am
  $$
  DELETE FROM forecast_daily_aggregates
  WHERE date < CURRENT_DATE - INTERVAL '2 years';
  $$
);
```

**Performance optimization:**
```sql
-- Index for efficient time-range queries
CREATE INDEX idx_forecasts_forecast_at_beach
  ON forecasts(forecast_at, beach_id);

-- Index for deletion queries
CREATE INDEX idx_forecasts_forecast_at
  ON forecasts(forecast_at);

-- Ensure autovacuum is aggressive enough
ALTER TABLE forecasts SET (
  autovacuum_vacuum_scale_factor = 0.01, -- Vacuum when 1% of rows are dead
  autovacuum_analyze_scale_factor = 0.01
);
```

**Monitoring:**
```sql
-- Check table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  n_live_tup,
  n_dead_tup,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE tablename = 'forecasts';

-- Check oldest forecast
SELECT MIN(forecast_at) as oldest_forecast FROM forecasts;

-- Check newest forecast
SELECT MAX(forecast_at) as newest_forecast FROM forecasts;

-- Row count by month
SELECT
  DATE_TRUNC('month', forecast_at) as month,
  COUNT(*) as row_count
FROM forecasts
GROUP BY DATE_TRUNC('month', forecast_at)
ORDER BY month DESC;
```

**Sources:**
- [PostgreSQL Time-Series Partitioning Strategies](https://medium.com/@connect.hashblock/9-postgres-partitioning-strategies-for-time-series-at-scale-c1b764a9b691)
- [Neon: Timeseries Data in Postgres](https://neon.com/guides/timeseries-data)

---

## Implementation Roadmap for Quiver

### Phase 1: Add Monitoring (Week 1)

**Goal:** Understand current usage of deprecated columns

**Actions:**
1. Deploy audit trigger for `forecast_date` and `forecast_time` writes
2. Run for 7 days to identify all code paths that write to deprecated columns
3. Review audit logs daily
4. Document findings: which API routes, Edge Functions, or cron jobs touch these columns

**Migration:**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_deprecated_column_audit.sql
BEGIN;

-- Create audit schema if not exists
CREATE SCHEMA IF NOT EXISTS audit;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit.deprecated_column_access (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  session_user TEXT DEFAULT SESSION_USER,
  application_name TEXT DEFAULT CURRENT_SETTING('application_name', true)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_deprecated_access_occurred_at
  ON audit.deprecated_column_access(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_deprecated_access_column
  ON audit.deprecated_column_access(table_name, column_name);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit.log_deprecated_forecast_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if columns are actually being changed
  IF TG_OP = 'INSERT' THEN
    IF NEW.forecast_date IS NOT NULL THEN
      INSERT INTO audit.deprecated_column_access (
        table_name, column_name, operation, new_value
      ) VALUES (
        TG_TABLE_NAME, 'forecast_date', TG_OP, NEW.forecast_date
      );
    END IF;

    IF NEW.forecast_time IS NOT NULL THEN
      INSERT INTO audit.deprecated_column_access (
        table_name, column_name, operation, new_value
      ) VALUES (
        TG_TABLE_NAME, 'forecast_time', TG_OP, NEW.forecast_time
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.forecast_date IS DISTINCT FROM OLD.forecast_date THEN
      INSERT INTO audit.deprecated_column_access (
        table_name, column_name, operation, old_value, new_value
      ) VALUES (
        TG_TABLE_NAME, 'forecast_date', TG_OP, OLD.forecast_date, NEW.forecast_date
      );
    END IF;

    IF NEW.forecast_time IS DISTINCT FROM OLD.forecast_time THEN
      INSERT INTO audit.deprecated_column_access (
        table_name, column_name, operation, old_value, new_value
      ) VALUES (
        TG_TABLE_NAME, 'forecast_time', TG_OP, OLD.forecast_time, NEW.forecast_time
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to forecasts table
CREATE TRIGGER audit_deprecated_forecast_columns
  BEFORE INSERT OR UPDATE ON forecasts
  FOR EACH ROW
  EXECUTE FUNCTION audit.log_deprecated_forecast_columns();

COMMIT;
```

**Monitoring queries:**
```sql
-- Check for recent writes (last 7 days)
SELECT
  column_name,
  operation,
  COUNT(*) as access_count,
  MAX(occurred_at) as last_access,
  MIN(occurred_at) as first_access
FROM audit.deprecated_column_access
WHERE occurred_at > NOW() - INTERVAL '7 days'
  AND table_name = 'forecasts'
GROUP BY column_name, operation
ORDER BY access_count DESC;

-- Identify source of writes
SELECT
  session_user,
  application_name,
  column_name,
  operation,
  COUNT(*) as write_count,
  MAX(occurred_at) as last_write
FROM audit.deprecated_column_access
WHERE occurred_at > NOW() - INTERVAL '7 days'
  AND table_name = 'forecasts'
GROUP BY session_user, application_name, column_name, operation
ORDER BY write_count DESC;
```

### Phase 2: Block Writes to Deprecated Columns (Week 2)

**Goal:** Prevent new code from writing to deprecated columns

**Prerequisite:** Phase 1 audit logs show zero writes for 3+ days

**Actions:**
1. Remove audit trigger (replace with write-blocking trigger)
2. Deploy write-blocking trigger
3. Monitor for trigger exceptions in logs
4. Update TypeScript types to mark columns as deprecated

**Migration:**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_block_deprecated_forecast_columns.sql
BEGIN;

-- Drop audit trigger (we've already verified no writes)
DROP TRIGGER IF EXISTS audit_deprecated_forecast_columns ON forecasts;

-- Create write-blocking trigger function
CREATE OR REPLACE FUNCTION prevent_deprecated_forecast_column_writes()
RETURNS TRIGGER AS $$
BEGIN
  -- Block writes to forecast_date
  IF (TG_OP = 'INSERT' AND NEW.forecast_date IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.forecast_date IS DISTINCT FROM OLD.forecast_date) THEN
    RAISE EXCEPTION 'Column "forecast_date" is deprecated. Use "forecast_at" (timestamptz) instead. See docs/COORDINATE_CONVENTIONS.md for migration guide.'
      USING HINT = 'Convert forecast_date + forecast_time to forecast_at using forecast-at-adapter.ts';
  END IF;

  -- Block writes to forecast_time
  IF (TG_OP = 'INSERT' AND NEW.forecast_time IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.forecast_time IS DISTINCT FROM OLD.forecast_time) THEN
    RAISE EXCEPTION 'Column "forecast_time" is deprecated. Use "forecast_at" (timestamptz) instead. See docs/COORDINATE_CONVENTIONS.md for migration guide.'
      USING HINT = 'Convert forecast_date + forecast_time to forecast_at using forecast-at-adapter.ts';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach write-blocking trigger
CREATE TRIGGER block_deprecated_forecast_columns
  BEFORE INSERT OR UPDATE ON forecasts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_deprecated_forecast_column_writes();

COMMIT;
```

**TypeScript type override:**
```typescript
// lib/database-overrides.ts
import { Database } from './database.types';

/**
 * Forecast type with deprecated columns marked.
 * DO NOT USE forecast_date or forecast_time - these columns are read-only
 * and will be removed in a future migration.
 *
 * Use forecast_at (timestamptz) instead.
 * See lib/utils/forecast-at-adapter.ts for conversion helpers.
 */
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

### Phase 3: Make Columns Nullable and Set Default NULL (Week 3)

**Goal:** Allow existing rows to have NULL values in deprecated columns

**Actions:**
1. Remove NOT NULL constraints (if any)
2. Set DEFAULT NULL for new inserts
3. This doesn't delete data, just prepares for eventual removal

**Migration:**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_make_deprecated_columns_nullable.sql
BEGIN;

-- Remove NOT NULL constraints and set default NULL
ALTER TABLE forecasts
  ALTER COLUMN forecast_date DROP NOT NULL,
  ALTER COLUMN forecast_date SET DEFAULT NULL;

ALTER TABLE forecasts
  ALTER COLUMN forecast_time DROP NOT NULL,
  ALTER COLUMN forecast_time SET DEFAULT NULL;

-- Add comment to document deprecation
COMMENT ON COLUMN forecasts.forecast_date IS
  'DEPRECATED: Use forecast_at instead. This column is read-only and will be dropped in a future migration.';

COMMENT ON COLUMN forecasts.forecast_time IS
  'DEPRECATED: Use forecast_at instead. This column is read-only and will be dropped in a future migration.';

COMMIT;
```

### Phase 4: Drop Deprecated Columns (Week 4-6)

**Goal:** Permanently remove deprecated columns

**Prerequisites:**
- No trigger exceptions for 14+ days (proves no code is attempting writes)
- All queries confirmed to use `forecast_at` instead
- Backup taken within 24 hours

**Actions:**
1. Take fresh database backup
2. Drop columns in migration
3. Regenerate TypeScript types
4. Remove type overrides from Phase 2

**Migration:**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_drop_deprecated_forecast_columns.sql
BEGIN;

-- Final safety check: ensure columns are not being read
-- (Run this manually first, don't include in migration)
-- SELECT COUNT(*) FROM forecasts WHERE forecast_date IS NOT NULL OR forecast_time IS NOT NULL;

-- Drop write-blocking trigger (no longer needed)
DROP TRIGGER IF EXISTS block_deprecated_forecast_columns ON forecasts;
DROP FUNCTION IF EXISTS prevent_deprecated_forecast_column_writes();

-- Drop columns
ALTER TABLE forecasts
  DROP COLUMN IF EXISTS forecast_date,
  DROP COLUMN IF EXISTS forecast_time;

-- Drop audit schema if no longer needed
-- (Only if this was the only table being audited)
-- DROP SCHEMA IF EXISTS audit CASCADE;

COMMIT;
```

**Post-migration:**
```bash
# Regenerate TypeScript types
npx supabase gen types typescript --local > lib/database.types.ts

# Remove manual type overrides (lib/database-overrides.ts)
# since deprecated columns no longer exist in generated types
```

### Phase 5: Implement Data Retention (Ongoing)

**Goal:** Prevent unbounded forecast table growth

**Timeline:** Can be done in parallel with Phase 1-4

**Option A: pg_cron (Native PostgreSQL)**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_forecast_retention_policies.sql
BEGIN;

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create daily aggregates table
CREATE TABLE IF NOT EXISTS forecast_daily_aggregates (
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  avg_wave_height_min NUMERIC(5,2),
  avg_wave_height_max NUMERIC(5,2),
  max_wave_height NUMERIC(5,2),
  avg_swell_height NUMERIC(5,2),
  avg_swell_period NUMERIC(5,2),
  PRIMARY KEY (beach_id, date)
);

-- Index for time-range queries
CREATE INDEX idx_forecast_daily_date ON forecast_daily_aggregates(date DESC);

-- Schedule daily aggregation (runs at 2am every day)
SELECT cron.schedule(
  'aggregate-forecasts-daily',
  '0 2 * * *',
  $$
  INSERT INTO forecast_daily_aggregates (
    beach_id, date,
    avg_wave_height_min, avg_wave_height_max, max_wave_height,
    avg_swell_height, avg_swell_period
  )
  SELECT
    beach_id,
    DATE(forecast_at) as date,
    AVG(wave_height_min) as avg_wave_height_min,
    AVG(wave_height_max) as avg_wave_height_max,
    MAX(wave_height_max) as max_wave_height,
    AVG(swell_height) as avg_swell_height,
    AVG(swell_period) as avg_swell_period
  FROM forecasts
  WHERE DATE(forecast_at) = CURRENT_DATE - INTERVAL '1 day'
  GROUP BY beach_id, DATE(forecast_at)
  ON CONFLICT (beach_id, date) DO UPDATE SET
    avg_wave_height_min = EXCLUDED.avg_wave_height_min,
    avg_wave_height_max = EXCLUDED.avg_wave_height_max,
    max_wave_height = EXCLUDED.max_wave_height,
    avg_swell_height = EXCLUDED.avg_swell_height,
    avg_swell_period = EXCLUDED.avg_swell_period;
  $$
);

-- Schedule weekly deletion of old hourly forecasts (runs every Sunday at 3am)
SELECT cron.schedule(
  'delete-old-forecasts',
  '0 3 * * 0',
  $$
  DELETE FROM forecasts
  WHERE forecast_at < NOW() - INTERVAL '90 days';
  $$
);

-- Schedule monthly deletion of old daily aggregates (runs 1st of month at 4am)
SELECT cron.schedule(
  'delete-old-daily-aggregates',
  '0 4 1 * *',
  $$
  DELETE FROM forecast_daily_aggregates
  WHERE date < CURRENT_DATE - INTERVAL '2 years';
  $$
);

-- Optimize autovacuum for forecasts table (high churn)
ALTER TABLE forecasts SET (
  autovacuum_vacuum_scale_factor = 0.01,  -- Vacuum when 1% of rows are dead
  autovacuum_analyze_scale_factor = 0.01, -- Analyze when 1% changed
  autovacuum_vacuum_cost_delay = 10       -- Faster vacuum
);

COMMIT;
```

**Monitoring cron jobs:**
```sql
-- View scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Check if jobs are running successfully
SELECT
  job_id,
  jobname,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
  MAX(start_time) as last_run
FROM cron.job_run_details
GROUP BY job_id, jobname
ORDER BY last_run DESC;
```

**Option B: TimescaleDB (If Available)**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_convert_to_timescaledb.sql
BEGIN;

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert forecasts table to hypertable
-- Note: Table must have a time-based column and primary key
SELECT create_hypertable(
  'forecasts',
  'forecast_at',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Add compression policy (compress chunks older than 30 days)
ALTER TABLE forecasts SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'beach_id',
  timescaledb.compress_orderby = 'forecast_at DESC'
);

SELECT add_compression_policy('forecasts', INTERVAL '30 days');

-- Add retention policy (drop chunks older than 90 days)
SELECT add_retention_policy('forecasts', INTERVAL '90 days');

-- Create continuous aggregate for daily stats
CREATE MATERIALIZED VIEW forecast_daily_stats
WITH (timescaledb.continuous) AS
SELECT
  beach_id,
  time_bucket('1 day', forecast_at) AS day,
  AVG(wave_height_min) as avg_wave_height_min,
  AVG(wave_height_max) as avg_wave_height_max,
  MAX(wave_height_max) as max_wave_height,
  AVG(swell_height) as avg_swell_height,
  AVG(swell_period) as avg_swell_period
FROM forecasts
GROUP BY beach_id, day;

-- Refresh policy for continuous aggregate (refresh every hour)
SELECT add_continuous_aggregate_policy('forecast_daily_stats',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

-- Add retention for continuous aggregate (keep 2 years of daily data)
SELECT add_retention_policy('forecast_daily_stats', INTERVAL '2 years');

COMMIT;
```

---

## Key Takeaways

### Column Deprecation Strategy

1. **Best approach:** BEFORE trigger with RAISE EXCEPTION
2. **Timeline:** Minimum 4-6 weeks from audit to drop
3. **Monitoring:** Audit triggers (not pg_stat_user_tables)
4. **Supabase compatibility:** Triggers work across all roles (service_role, anon, authenticated)

### Data Retention Strategy

1. **TimescaleDB preferred:** Automatic retention, compression, continuous aggregates
2. **Native PostgreSQL fallback:** pg_cron + partitioning + manual aggregation
3. **Recommended retention:** 90 days hourly, 2 years daily aggregates
4. **Performance:** Use indexes, aggressive autovacuum, avoid DELETE (prefer DROP partition)

### Production Safety

1. **Always take backups** before destructive migrations
2. **Monitor for 7-14 days** between phases
3. **Have rollback plan** for each phase
4. **Test locally first** with `supabase db reset`
5. **Use claude_migrator role** for production migrations (read-only by default)

---

## Additional Resources

### PostgreSQL Column Management
- [PostgreSQL DDL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- [CYBERTEC: Triggers to Enforce Constraints](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/)

### Database Migration Best Practices
- [PlanetScale: Backward Compatible Database Changes](https://planetscale.com/blog/backward-compatible-databases-changes)
- [GitLab: Avoiding Downtime in Migrations](https://docs.gitlab.com/development/database/avoiding_downtime_in_migrations/)
- [Medium: 14 Rules for Writing a Data Migration](https://medium.com/autodesk-tlv/14-rules-for-writing-a-data-migration-ac5630648b58)

### PostgreSQL Monitoring and Auditing
- [PostgreSQL Wiki: Audit Trigger](https://wiki.postgresql.org/wiki/Audit_trigger)
- [Supabase: Postgres Auditing in 150 Lines](https://supabase.com/blog/postgres-audit)
- [PostgreSQL Statistics Collector](https://www.postgresql.org/docs/current/monitoring-stats.html)

### Supabase-Specific
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types)
- [Supabase: API Keys Migration](https://github.com/orgs/supabase/discussions/29260)

### Time-Series Data Management
- [TimescaleDB vs PostgreSQL](https://www.timescale.com/blog/timescaledb-vs-6a696248104e/)
- [PostgreSQL Partitioning Strategies](https://medium.com/@connect.hashblock/9-postgres-partitioning-strategies-for-time-series-at-scale-c1b764a9b691)
- [Neon: Timeseries Data in Postgres](https://neon.com/guides/timeseries-data)
- [TimescaleDB Data Retention](https://www.tigerdata.com/blog/how-timescaledb-solves-common-postgresql-problems-in-database-operations-with-data-retention-management)
