# Supabase Migrations Architecture Documentation

## Overview

The `supabase/` directory contains all database migrations and schema management for the Quiver surf app. This directory represents the complete database evolution history, including performance optimizations, security enhancements, and feature additions that support the app's growth from 0 to 1,000+ users.

## Architecture Structure

```
supabase/
├── migrations/                           # Database migration files
│   ├── 20250102000000_fix_rls_performance_issues.sql
│   ├── 20250102000001_rollback_rls_performance_fixes.sql
│   ├── 20250102000002_database_performance_optimization.sql
│   ├── 20250102000003_rollback_database_performance_optimization.sql
│   ├── 20250715025211_add_data_source_to_enhanced_forecasts.sql
│   ├── 20250804104600_intel_posts_with_mock_data.sql
│   ├── 20250804104758_intel_posts_with_mock_data_fixed.sql
│   ├── 20250804184702_add_raw_forecast_storage.sql
│   ├── 20250805030000_add_cdip_data_source.sql
│   ├── 20250828000000_create_gamification_system.sql
│   ├── 20250829030000_add_missing_profile_columns.sql
│   ├── 20250830120000_rename_default_beach_id_to_home_beach_id.sql
│   ├── 20251203000001_normalize_state_codes.sql
│   ├── 20251204030000_create_city_editorial_content.sql
│   ├── 20251204120000_case_insensitive_location_search.sql
│   ├── 20251204120001_update_session_log_template_link.sql
│   ├── 20260113200001_add_npc_profile_fields.sql
│   ├── 20260113200002_create_npc_templates_table.sql
│   └── 20260130071552_optimize_ml_backlog_processing.sql
└── ARCHITECTURE.md                       # This documentation file
```

## Migration Categories

### **1. Performance Optimizations**

#### **RLS Performance Fixes (20250102000000)**

**Purpose**: Addresses Supabase database linter warnings for Row Level Security performance.

**Key Changes**:

- **Auth RLS InitPlan Issues**: Wraps `auth.uid()` calls with `(select auth.uid())` for better query planning
- **Multiple Permissive Policies**: Consolidates redundant policies to reduce overhead
- **Affected Tables**: `intel_posts`, `intel_post_confirmations`, `enhanced_forecasts`, `buoys`, `forecasts`

**Performance Impact**:

- Eliminates InitPlan overhead in RLS checks
- Reduces policy evaluation complexity
- Improves query execution speed for authenticated operations

#### **Database Performance Optimization (20250102000002)**

**Purpose**: Adds critical missing indexes and removes unused ones.

**Critical Foreign Key Indexes Added**:

```sql
-- Board ownership queries
idx_boards_user_id_fkey ON boards (user_id)

-- Comment threading
idx_comments_parent_comment_fkey ON comments (parent_comment)

-- Favorite beach joins
idx_favorite_beaches_beach_id_fkey ON favorite_beaches (beach_id)

-- Profile home beach resolution
idx_profiles_home_beach_id_fkey ON profiles (home_beach_id)
```

**Unused Indexes Removed**:

- Session participants/invitations indexes (feature not active)
- Redundant buoy location indexes
- Beach ownership indexes (private beach feature unused)
- Intel confirmation indexes (low usage feature)

**Performance Impact**:

- **Query Speed**: 50-80% faster foreign key joins
- **Storage**: ~15% reduction in index storage overhead
- **Write Performance**: Fewer indexes to maintain on INSERTs/UPDATEs

#### **Case-Insensitive Location Search (20251204120000)**

**Purpose**: Make location search functions case-insensitive to prevent URL slug mismatch issues.

**Functions Updated**:

```sql
-- Updated to use LOWER() comparisons
get_beaches_by_location_with_scores(p_city, p_state, p_country)
get_location_stats(p_city, p_state, p_country)
```

**Key Changes**:

- All city/state/country comparisons now use `LOWER()` for case-insensitive matching
- Prevents issues where URL slug decoding doesn't match database casing exactly
- Maintains performance with existing indexes

**User Impact**:

- Reliable location searches regardless of URL casing
- Improved robustness for city and state landing pages
- Prevents 404s caused by case mismatches

#### **ML Pipeline Backlog Optimization (20260130071552)**

**Purpose**: Optimize ML predictions backlog processing to reduce queue size and improve observation matching efficiency.

**Problem Statement**:
- 117K pending observations with oldest at 45.1h (approaching 48h threshold)
- Backlog growing faster than processing capacity
- Match rate only 19% (81% of predictions never match)
- IOOS data actually arrives within hours, so 48h threshold was unnecessarily generous

**Key Changes**:

1. **Sentinel Threshold Reduced**: 48h to 24h
   - IOOS observations arrive within 1-6 hours
   - Predictions unmatchable after 24h are marked with sentinel value (`observed_m = -1`)

2. **72h TTL Cleanup Added**:
   - DELETE pending predictions older than 72 hours
   - Prevents unbounded table growth from predictions that will never match

3. **Batch Size Increased**: 5,000 to 10,000
   - Faster processing of backlog
   - pg_cron job updated to use new batch size

4. **Enhanced Monitoring Columns**:
   - `pending_12_24h`: Early warning bucket for predictions approaching threshold
   - `pending_gt_24h`: Should always be 0 (indicates threshold is working)

**Function Changes**:

```sql
-- Updated backfill function with 3-step pipeline
CREATE OR REPLACE FUNCTION backfill_ml_observations_batch(batch_size INT DEFAULT 10000)
RETURNS TABLE(
  processed INT,        -- Total rows affected
  matched INT,          -- Predictions matched with observations
  sentinel_marked INT,  -- Predictions marked as unmatchable (>24h)
  expired_deleted INT,  -- Predictions deleted (>72h TTL)
  elapsed_ms NUMERIC
);

-- Updated health metrics with early warning buckets
CREATE OR REPLACE FUNCTION get_ml_health_metrics()
RETURNS TABLE(
  ...
  pending_12_24h BIGINT,    -- NEW: early warning bucket
  pending_gt_24h BIGINT,    -- NEW: should always be 0
  ...
);
```

**Performance Impact**:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `pending_observations` | 116,935 | 59,245 | -49% |
| `oldest_pending_age_hours` | 45.3h | 21.4h | -53% |

**Monitoring**:

```sql
-- Check pipeline health with new columns
SELECT
  pending_observations,
  pending_12_24h,      -- Early warning: approaching threshold
  pending_gt_24h,      -- Should be 0
  oldest_pending_age_hours
FROM get_ml_health_metrics();
```

**Alert Thresholds** (updated February 2026):

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| `pending_observations` | < 5,000 | 5,000-10,000 | > 10,000 |
| `pending_12_24h` | < 3,000 | 3,000-7,000 | > 7,000 |
| `pending_gt_24h` | 0 | 1-100 | > 100 |
| `oldest_pending_age_hours` | < 12h | 12-20h | > 20h |
| `match_rate_24h` | > 20% | 15-20% | < 15% |

**Note on `match_rate_24h`**: The structural ceiling for IOOS match rate is ~22-25% because IOOS buoys report every 2-6 hours vs hourly predictions. The previous 50% threshold was unachievable. See migration `20260209050730_fix_ml_health_metrics_observable_filter.sql` for details.

**Rollback**:

```sql
-- Restore 48h sentinel threshold, remove TTL cleanup, restore 5000 batch size
-- See migration file for complete rollback SQL
```

**Documentation**: See [ML Operations Runbook](/docs/guides/ML_OPERATIONS_RUNBOOK.md) for operational procedures.

### **2. Feature Additions**

#### **Forecast Data Transparency (20250715025211)**

#### **Beaches Search & Sources (20250914090000)**

Purpose: Improve beach searchability and source mappings for forecasting and cameras.

Schema Changes:

```sql
-- Beaches columns
slug TEXT CHECK (slug ~ '^[a-z0-9-]+$') UNIQUE (lower(slug)) NULLS NOT DISTINCT;
region TEXT; country TEXT; lat DOUBLE PRECISION; lon DOUBLE PRECISION; lng DOUBLE PRECISION;
popularity_score INTEGER NOT NULL DEFAULT 0;
swell_window TEXT; shore_aspect TEXT; alt_names TEXT[] NOT NULL DEFAULT '{}';
is_featured BOOLEAN NOT NULL DEFAULT false;

-- Geography column (for nearest)
coordinates GEOGRAPHY(Point,4326);

-- Indexes
CREATE INDEX idx_beaches_coordinates_gist ON public.beaches USING GIST (coordinates);
CREATE INDEX idx_beaches_name_trgm ON public.beaches USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX idx_beaches_slug_trgm ON public.beaches USING GIN (lower(slug) gin_trgm_ops);
CREATE INDEX idx_beaches_alt_names_trgm ON public.beaches USING GIN ((array_to_string(alt_names, ' ')) gin_trgm_ops);

-- Mapping tables
beach_sources(beach_id UUID PK/FK, forecast_source_id TEXT, camera_url TEXT);
beach_calibration(beach_id UUID PK/FK, tide_pref JSONB, swell_pref JSONB, created_at, updated_at);
```

Policies & Triggers:

- `beach_sources`, `beach_calibration`: RLS enabled; public read-only policy; writes via service role.
- `trg_set_beach_coordinates`: keeps `coordinates` synced on `latitude/longitude` changes (canonical fields). Legacy `lat/lon/lng` dropped in 2025-09-15 consolidation.
- `trg_beach_calibration_set_updated_at`: updates `updated_at` on row change.

Extensions:

- Ensure `postgis` and `pg_trgm` are enabled locally and in production.

Performance Impact:

- Nearest-beach queries use GIST index on `coordinates`.
- Fuzzy search on `name`, `slug`, and `alt_names` leverages GIN trigram indexes.

**Purpose**: Adds data source tracking to enhanced forecasts for transparency.

**Schema Changes**:

```sql
-- Data source column with constraint
data_source TEXT NOT NULL DEFAULT 'FALLBACK'
CHECK (data_source IN ('NOAA_NWS', 'FALLBACK'))

-- Performance indexes
idx_enhanced_forecasts_data_source
idx_enhanced_forecasts_beach_data_source
```

**User Impact**:

- Clear indicators when using fallback vs real NOAA data
- Transparency in forecast reliability
- Foundation for forecast accuracy analytics

#### **Local Intel Club (20250804104600, 20250804104758)**

**Purpose**: Community-driven local surf intelligence feature.

**New Tables**:

- `intel_posts`: User-generated surf conditions, hazards, parking info
- `intel_post_confirmations`: Community validation system

**Features**:

- Geospatial search with `ST_Point` indexing
- Tag-based categorization (parking, hazard, crowd, conditions, access, other)
- Confirmation system for accuracy tracking
- Auto-expiring posts for relevancy

**Mock Data**: 40+ realistic intel posts for Ocean Beach and La Jolla Shores to make feature feel active.

#### **Raw Forecast Storage (20250804184702)**

**Purpose**: Enhanced forecast data storage with quality scoring.

**Schema Additions**:

- `raw_forecast` JSONB column for complete forecast data
- Quality scoring system for data source reliability
- CDIP buoy data integration support
- Data validation functions

**Performance Features**:

- Specialized indexes for JSONB queries
- Quality score indexing for filtering
- Data source specific indexes

#### **City Editorial Content (20251204030000)**

**Purpose**: Curated editorial content system for city landing pages with session timing, guides, and checklists.

**New Table**:

```sql
city_editorial_content (
  id UUID PRIMARY KEY,
  city_slug TEXT NOT NULL,
  state_slug TEXT NOT NULL DEFAULT 'ca',
  country_slug TEXT NOT NULL DEFAULT 'usa',
  city_name TEXT NOT NULL,
  region_label TEXT NOT NULL,
  description TEXT[] DEFAULT '{}',           -- About section paragraphs
  session_timing JSONB DEFAULT '[]'::jsonb, -- Today/Now/Weekend tactical advice
  quick_links JSONB DEFAULT '[]'::jsonb,    -- Quick action navigation
  featured_intents TEXT[] DEFAULT '{}',     -- Intent slugs for guides
  planning_checklist TEXT[] DEFAULT '{}',   -- Pre-session checklist items
  UNIQUE(city_slug, state_slug, country_slug)
);
```

**Helper Function**:

```sql
get_city_editorial(p_city, p_state, p_country)
  RETURNS city_editorial_content
```

**RLS Policies**:

- Public read access for all editorial content
- Admin-only write access via service role or admin users

**Features**:

- Session timing modules with tactical advice for Today/Now/Weekend
- Quick navigation links (surf map, tide chart, beginner breaks, session logs)
- Featured intent categories (beginner, least-crowded, tide, water-temp)
- Planning checklists for pre-session preparation
- Auto-updating `updated_at` timestamp trigger

**Seed Data**: Includes editorial content for San Diego and Orange County with realistic surf culture copy.

**User Impact**:

- Rich, context-aware city landing pages at `/beaches/[country]/[state]/[city]`
- Tactical session advice based on time of day and weekend planning
- Guides surfers to appropriate breaks based on skill and conditions
- Reduces friction in session planning workflow

#### **Session Forecast Snapshots (20250822190000)**

**Purpose**: Capture forecast conditions at session time for personalization and learning user preferences.

**Schema Design**:

```sql
CREATE TABLE session_forecast_snapshots (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) UNIQUE,
  user_id UUID REFERENCES profiles(id),
  beach_id UUID REFERENCES beaches(id),
  forecast_snapshot JSONB NOT NULL,        -- Full forecast data
  actual_conditions JSONB NOT NULL,        -- User's session feedback
  forecast_confidence_score INTEGER,
  data_source TEXT,
  session_date DATE NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Automatic Capture Mechanism**:

- **Database Trigger**: `trigger_create_session_forecast_snapshot`
- **Fires On**: INSERT or UPDATE when `sessions.status = 'completed'`
- **Function**: `create_session_forecast_snapshot()`
- **Process**:
  1. Query `enhanced_forecasts` for closest temporal match to `session.arrival_time`
  2. Store full forecast as JSONB in `forecast_snapshot`
  3. Store session feedback (rating, notes, wave_quality) in `actual_conditions`
  4. Handle errors gracefully - logs warning but doesn't fail session creation

**JSONB Structure**:

forecast_snapshot:

```typescript
{
  wave_height: number,
  wave_period: number,
  wave_direction: number,
  wind_speed: number,
  wind_direction: number,
  tide_status: string,
  tide_height: number,
  confidence_score: number,
  data_source: string,
  forecast_time: string,
  // ... additional forecast fields
}
```

actual_conditions:

```typescript
{
  wave_quality: string,
  water_temp: number,
  crowd_level: string,
  parking_ease: string,
  rating: number,
  notes: string,
  duration_minutes: number,
  arrival_time: string
}
```

**Performance Optimizations**:

- GIN indexes on JSONB columns for efficient queries
- Standard B-tree indexes on user_id, beach_id, session_date
- Compound indexes for common query patterns (beach_id + session_date)
- Duplicate prevention via unique constraint on session_id

**Benefits**:

- **Personalization**: Learn user's preferred conditions from session history
- **Zero Integration**: Automatic capture requires no code changes in session actions
- **Flexible Schema**: JSONB allows adding new forecast fields without migrations
- **Backfill Capable**: Historical sessions can be retroactively populated

**Trigger Improvements**:

- **20251028000000**: Added INSERT event handling (95%+ of sessions created with status='completed')
- **20251028000001**: Enhanced error handling and duplicate prevention
- **20251028000002**: Backfilled historical sessions with snapshots

**RLS Policies**:

- Users can SELECT/INSERT/UPDATE/DELETE their own snapshots (scoped to `auth.uid() = user_id`)
- All snapshot operations isolated per user for security

**Query Service**:

- Querying and analysis is exposed via authenticated server actions:
  - [actions/forecast-calibration-actions.ts](/actions/forecast-calibration-actions.ts)
    - `getUserForecastHistory()` - Get user's historical snapshots with filters
    - `analyzePreferredConditions()` - Aggregate analysis of user's preferred conditions
    - `getDataSourceDistribution()` - Understand which forecast sources are most common
    - `getMonthlyCoverage()` - Track data collection coverage over time

#### **Personalization Milestones (20260213120000)**

**Purpose**: Track user personalization progress and celebrate learning milestones with UI feedback.

**Table Schema**:

```sql
personalization_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  shown_at timestamptz,                     -- Set when user sees toast
  metadata jsonb DEFAULT '{}',
  UNIQUE(user_id, milestone_key)
);
```

**Indexes**:

```sql
idx_milestones_user_unshown ON (user_id) WHERE shown_at IS NULL
```

**RLS Policies**:

- Users can SELECT own milestones
- Users can UPDATE own milestones (mark as shown)
- Users can INSERT own milestones
- Service role bypasses for automated detection inserts

**Milestone Keys** (9 total):

- `first_session_logged` - Initial session logged
- `first_intel_posted` - First intel contribution
- `wave_range_learned` - Preferred wave height detected
- `wind_pref_learned` - Wind preference learned
- `time_slot_detected` - Preferred session time identified
- `home_turf_established` - Home beach preference solidified
- `intel_confirmed_5x` - 5 intel confirmations earned
- `local_authority` - Community trust milestone
- `fully_personalized` - All preferences learned

**Email Integration**:

Extended `email_send_log.email_type` constraint to include `first_session_nudge` for milestone-triggered re-engagement emails.

**User Impact**:

- Celebratory toast notifications for milestone achievements
- Personalization progress tracking on home screen
- Re-engagement email after first session milestone
- Transparent feedback on preference learning progress

#### **Forecast Timestamptz Migration (20260214130000, 20260214130100, 20260214180000)**

**Purpose**: Eliminate an 8-hour tide shift bug caused by ambiguous bare-text `forecast_date` + `forecast_time` columns by introducing a canonical `forecast_at` timestamptz column.

**Problem Statement**:
The `enhanced_forecasts` table stored forecast timing as separate `forecast_date` (text, e.g. `"2026-02-14"`) and `forecast_time` (text, e.g. `"14:00"`) columns. These lacked timezone context, causing a double-conversion bug: the app assumed UTC, but NOAA data was already in local time. This shifted tide data by ~8 hours for California beaches.

**Migration Sequence**:

1. **`20260214130000_add_forecast_at_column.sql`** -- Adds `forecast_at timestamptz` column, backfills from existing `forecast_date || forecast_time`, creates composite index `idx_ef_beach_forecast_at` and unique constraint `enhanced_forecasts_beach_forecast_at_unique`.

2. **`20260214130100_update_ten_day_view_add_forecast_at.sql`** -- Updates the 10-day forecast view to include `forecast_at` in its output columns.

3. **`20260214180000_update_ten_day_view_add_missing_cols.sql`** -- Adds `next_tide_at` and `coops_station_id` to the view for downstream consumers.

**Query Pattern Change**:

```sql
-- BEFORE (deprecated): ambiguous text matching
.eq("forecast_date", dateString)

-- AFTER: timezone-correct range queries
.gte("forecast_at", startISO)
.lt("forecast_at", endISO)
.order("forecast_at")
```

**Adapter Utility**: `lib/utils/forecast-at-adapter.ts` provides timezone conversion helpers for services that need to translate between `forecast_at` timestamps and local display times.

**Status**: Complete. Legacy `forecast_date` and `forecast_time` columns remain in the database for backward compatibility but should not be used in new code.

#### **Schema Cleanup (20260214180100, 20260214180200, 20260214180300)**

**Purpose**: Remove dead schema elements that accumulated during feature evolution.

**Migration Sequence**:

1. **`20260214180100`** -- Dropped `_backup_beach_timezones_pr_hi` backup table (no longer needed after the timezone migration was verified stable).

2. **`20260214180200`** -- Dropped 4 dead profile columns: `favorite_spot` (text), `favorite_spot_id` (uuid), `home_beach_ids` (uuid[]), `secondary_beaches` (uuid[]). These were superseded by `home_beach_id` (single FK) and the `favorite_beaches` join table.

3. **`20260214180300`** -- Dropped the redundant legacy session ownership column because sessions always belong to an authenticated user. Rewrote 4 RLS policies on the `sessions` table to reference `user_id`.

**Impact**: Reduces schema surface area, eliminates confusing redundant columns, and ensures RLS policies reference the correct ownership field.

#### **IOOS Station Discovery Tracking (20260214120000)**

**Purpose**: Prevent premature IOOS station deactivation when ERDDAP discovery results are incomplete.

**Problem Statement**: The IOOS station sync pipeline fetches active stations from ERDDAP. If ERDDAP returns a partial list (due to timeouts, API issues, or pagination limits), stations missing from the result would be incorrectly deactivated, causing data gaps in forecasts.

**Schema Changes**:

```sql
-- New column on ioos_stations
consecutive_discovery_misses INTEGER NOT NULL DEFAULT 0

-- New RPC function
increment_station_discovery_misses(seen_ids TEXT[])
```

**Safety Mechanism**: The IOOS sync cron job (`app/api/cron/ioos-sync/route.ts`) includes a 50% safety cap -- if more than half of all active stations would be deactivated in a single run, the deactivation step is skipped. Stations are deactivated only after 3 consecutive discovery misses. The migration provides the schema (`consecutive_discovery_misses` column) and RPC (`increment_station_discovery_misses`) that the cron job uses. Stations that reappear in any run have their counter reset to 0.

### **3. Data Source Integration**

#### **CDIP Data Source (20250805030000)**

**Purpose**: Integration with CDIP (Coastal Data Information Program) buoy network.

**Integration Points**:

- Real-time buoy data from CDIP stations
- Wave height, period, and direction measurements
- Data quality scoring and validation
- Fallback mechanisms for data gaps

### **4. Data Normalization**

#### **State Code Normalization (20251203000001)**

**Purpose**: Standardize state values to consistent 2-letter codes for URL routing compatibility.

**Updates Applied**:

```sql
-- Converted full state names to 2-letter codes
Hawaii → HI
Oregon → OR
Washington → WA
Florida → FL
North Carolina → NC
South Carolina → SC
Texas → TX
New Jersey → NJ
New York → NY
Massachusetts → MA
Rhode Island → RI
California → CA
```

**Impact**:

- Ensures consistency with URL routing which expects 2-letter state codes
- Aligns database values with `STATE_SLUG_MAP` in `beach-url-utils.ts`
- Prevents routing mismatches between slugs and database records
- Foundation for reliable state-based filtering and navigation

**Note**: While `beach-url-utils.ts` handles both formats in mapping logic, database standardization improves data quality and reduces edge cases.

### **5. Data Maintenance**

#### **Android Private Tester Roster (20260725213000)**

- Service-role-only RLS tables separate roster eligibility, AES-256-GCM
  unjoined identity envelopes, append-only evidence stages, independent
  account-join/install/first-open receipts, complete/incomplete sync runs, and
  mandatory non-PII audit.
- Atomic SECURITY DEFINER RPCs handle account join with immediate identity
  redaction, complete-snapshot reconciliation, exact +30-day unjoined identity
  purge scheduling, aggregate reporting, and account-deletion cleanup. A
  singleton expiring claim prevents overlapping syncs from fetching or applying
  the same pre-sync state, and account join rechecks idempotency after locking.
  Leave apply locks and rechecks unlinked state, so a concurrent join cannot
  create a zero-row ineligible stage or count.
- No deterministic or reversible external identity hash is stored. Eligibility,
  Play opt-in, install, first open, and account join remain independent.
  New entries receive explicit `unknown` rows for every non-eligibility stage;
  aggregate reporting uses the latest row per entry and stage. Account deletion
  cascades all receipts and anonymizes retained audit residue.
  Unlinked Directory identity changes explicitly replace the encrypted envelope
  with a fresh IV and increment a non-PII refresh count. Manual Play evidence is
  limited to a bounded code and opaque UUID.

#### **Session Log Template Link Update (20251204120001)**

**Purpose**: Update quick links in city editorial content to point to correct route.

**Change Applied**:

```sql
-- Updated link in city_editorial_content.quick_links JSONB
"Session log templates" href: /app → /features
```

**Affected Records**:

- San Diego city editorial content
- Orange County city editorial content

**Impact**:

- Corrects broken navigation links on city landing pages
- Ensures users reach the correct features page
- Maintains consistency with current application routing structure

## Migration Management Strategy

### **Naming Convention**

```
YYYYMMDDHHMMSS_descriptive_migration_name.sql
```

**Examples**:

- `20250102000000_`: Performance fix (New Year optimization)
- `20250715025211_`: Feature addition (summer forecast transparency)
- `20250804104600_`: Major feature (Local Intel Club)

### **Rollback Strategy**

**Every Critical Migration Has Rollback**:

- Performance optimizations include rollback scripts
- Feature additions designed for safe removal
- Database constraints allow graceful degradation

**Rollback Files**:

- `*_rollback_*.sql`: Complete rollback procedures
- Restoration of original indexes and policies
- Data preservation during rollbacks

### **Migration Testing**

**Pre-Migration Validation**:

```sql
-- Check foreign key coverage
SELECT check_foreign_key_indexes();

-- Validate table statistics
ANALYZE tables;

-- Performance benchmarking
EXPLAIN ANALYZE query_examples;
```

**Post-Migration Verification**:

- Index usage verification
- Query performance validation
- RLS policy testing
- Data integrity checks

## Performance Impact Analysis

### **Before Optimizations**

- Missing critical foreign key indexes (4 tables affected)
- Multiple permissive RLS policies causing overhead
- 16 unused indexes consuming storage
- InitPlan issues in auth queries

### **After Optimizations**

- **Query Performance**: 50-80% improvement on foreign key joins
- **Storage Efficiency**: 15% reduction in index overhead
- **Write Performance**: Faster INSERTs with fewer indexes
- **RLS Performance**: Eliminated InitPlan overhead

### **Monitoring Setup**

```sql
-- Index usage monitoring
SELECT * FROM pg_stat_user_indexes WHERE idx_scan < 100;

-- Query performance tracking
SELECT * FROM pg_stat_statements ORDER BY total_time DESC;

-- RLS performance validation
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM intel_posts;
```

## Growth-Focused Database Architecture

### **Scalability Preparations**

**Index Strategy**:

- Critical foreign keys indexed for fast joins
- Geospatial indexes for location-based features
- JSONB indexes for flexible data storage
- Partial indexes for active/recent data

**Performance Monitoring**:

- Foreign key coverage checking function
- Query performance baselines established
- Index usage analytics
- RLS policy optimization

### **User Growth Support**

**0 - 100 Users**:

- Current optimizations handle this scale efficiently
- Local Intel feature populated with mock data
- Forecast transparency builds user trust

**100 - 1,000 Users**:

- Geospatial indexes support location queries
- Confirmation system scales with community size
- Raw forecast storage supports analytics

**1,000+ Users**:

- JSONB storage allows schema flexibility
- Quality scoring system maintains data integrity
- Partitioning strategies ready for implementation

## Security Architecture

### **Row Level Security (RLS)**

**Optimized Policies**:

```sql
-- Performance-optimized auth checks
CREATE POLICY "name" ON table
    FOR operation USING ((select auth.uid()) = user_id);

-- Consolidated permissive policies
CREATE POLICY "public_read" ON table
    FOR SELECT USING (is_public = true);
```

**Security Patterns**:

- User ownership validation
- Public/private data separation
- Service role elevated permissions
- Data expiration enforcement

### **Views Security Policy (Mandatory)**

- All app-facing views MUST be created with `WITH (security_invoker = true)` so that underlying table RLS applies based on the querying role.
- Example:
  ```sql
  CREATE OR REPLACE VIEW public.example_view
  WITH (security_invoker = true) AS
  SELECT ...
  FROM ...;
  ```
- Existing view updated: `public.profiles_with_home_beach` now uses `WITH (security_invoker = true)`.

### **Public Tables Must Have RLS Enabled**

- Any table in `public` accessible through PostgREST must have RLS enabled with least-privilege policies.
- Canonical patterns:
  - Public read only:
    ```sql
    ALTER TABLE public.some_table ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "select_all" ON public.some_table FOR SELECT USING (true);
    ```
  - Owner-only CRUD:
    ```sql
    ALTER TABLE public.some_private ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "select_own" ON public.some_private FOR SELECT USING ((select auth.uid()) = user_id);
    CREATE POLICY "insert_own" ON public.some_private FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
    CREATE POLICY "update_own" ON public.some_private FOR UPDATE USING ((select auth.uid()) = user_id);
    CREATE POLICY "delete_own" ON public.some_private FOR DELETE USING ((select auth.uid()) = user_id);
    ```

### **System Tables Exposure**

- System tables like `public.spatial_ref_sys` (PostGIS) should not be exposed to `anon`/`authenticated` roles. Revoke access instead of attempting to enable RLS:
  ```sql
  REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
  ```

### **Data Integrity**

**Constraints**:

- Foreign key integrity
- Check constraints for data validation
- Unique constraints preventing duplicates
- NOT NULL constraints for required fields

**Triggers**:

- Automatic timestamp updates
- Confirmation count maintenance
- Data validation on INSERT/UPDATE
- Cleanup procedures for expired data

## Mobile-First Database Design

### **Efficient Queries**

- Indexed geospatial searches for mobile location services
- Paginated results for mobile data usage
- Optimized forecast data structure for mobile displays

### **Offline Support Preparation**

- JSONB storage allows offline data caching
- Timestamp-based sync mechanisms
- Conflict resolution data structures

## Testing Integration

### **Migration Testing**

- Rollback procedures tested in staging
- Performance benchmarks established
- Data integrity validation
- RLS policy testing

### **Mock Data Strategy**

- Comprehensive test data for all features
- Realistic usage patterns in mock data
- Edge case coverage in test scenarios
- Performance testing with mock load

## Analytics & Monitoring

### **Database Health Monitoring**

```sql
-- Key metrics tracking
SELECT
  schemaname,
  tablename,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables;

-- Index effectiveness
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes;
```

### **Performance Baselines**

- Query execution time baselines
- Index usage patterns
- RLS policy performance
- Storage growth patterns

### **3. Recent Feature Additions (August 2025)**

#### **Gamification System (20250828000000)**

**Purpose**: Complete user engagement and progression system.

**Schema Additions**:

```sql
-- Experience Points and Levels
user_xp (
  user_id UUID REFERENCES auth.users(id),
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  xp_to_next_level INTEGER DEFAULT 100
);

-- XP Transaction Log
xp_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  source TEXT CHECK (source IN ('session_complete', 'first_session', 'streak_3_days', 'streak_7_days', 'streak_30_days', 'social_share', 'beach_review', 'community_help')),
  amount INTEGER NOT NULL,
  description TEXT
);

-- Badge System
badges (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))
);

-- User Badge Unlocks
user_badges (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  badge_id UUID REFERENCES badges(id),
  earned_at TIMESTAMP DEFAULT NOW(),
  is_displayed BOOLEAN DEFAULT TRUE
);
```

**Impact**:

- Increased user retention through progression mechanics
- Social features for badge display and leaderboards
- XP rewards for community engagement

#### **Home Beach Standardization (20250830120000)**

**Purpose**: Standardize home beach field naming across the application.

**Schema Changes**:

```sql
-- Rename column for consistency
ALTER TABLE profiles
RENAME COLUMN default_beach_id TO home_beach_id;

-- Update index names
DROP INDEX IF EXISTS idx_profiles_default_beach_id;
CREATE INDEX idx_profiles_home_beach_id ON profiles(home_beach_id);

-- Add documentation
COMMENT ON COLUMN profiles.home_beach_id IS 'User''s preferred home beach for forecasts and session defaults';
```

**Impact**:

- Single source of truth for home beach preference
- Consistent naming across API, components, and database
- Improved home screen personalization

#### **NPC Intel Bots System (20260113200001, 20260113200002)**

**Purpose**: Realistic community content generation with personality-driven NPC behavior.

**Migration 1: Profile Enhancements (20260113200001_add_npc_profile_fields.sql)**

Adds behavioral configuration fields to the `profiles` table:

```sql
-- Regional assignment for NPC
home_region TEXT                    -- e.g., 'north-san-diego', 'sf-bay-area'

-- Beach preferences (UUID arrays) -- NOTE: home_beach_ids and secondary_beaches
-- were later removed in migration 20260214180200 (schema cleanup)
home_beach_ids UUID[]               -- Primary beaches (70% of posts)
secondary_beaches UUID[]            -- Regional beaches (25% of posts)

-- Posting behavior
posting_window JSONB                -- {"primary": [5, 8], "secondary": [16, 19]}
activity_level TEXT                 -- 'high', 'medium', 'low'
CHECK (activity_level IN ('high', 'medium', 'low'))

-- Personality configuration
personality_type TEXT               -- 'rookie', 'local', 'traveler', etc.
CHECK (personality_type IN ('rookie', 'local', 'traveler', 'photographer', 'tactical', 'competitor', 'forecaster'))

-- System account flag
is_system_account BOOLEAN DEFAULT false  -- true for Quiver Surf Forecast bot

-- Performance index
CREATE INDEX idx_profiles_npc_config ON profiles (activity_level, personality_type)
WHERE is_mock = true;
```

**Migration 2: Content Templates (20260113200002_create_npc_templates_table.sql)**

New table for AI-generated content templates:

```sql
CREATE TABLE npc_content_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type    TEXT NOT NULL,      -- 'intel', 'session_note', 'review'
  personality     TEXT NOT NULL,      -- 'rookie', 'local', etc.
  tag             TEXT,               -- For intel: 'conditions', 'parking', 'crowd', 'access'
  template        TEXT NOT NULL,      -- Content with {{variables}}
  variables       TEXT[],             -- ['beach_name', 'wave_range', ...]
  use_count       INT DEFAULT 0,      -- Staleness tracking
  last_used_at    TIMESTAMPTZ,
  archived        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Lookup index for content generation
CREATE INDEX idx_templates_lookup
ON npc_content_templates(content_type, personality, tag)
WHERE archived = false;

-- Staleness detection index
CREATE INDEX idx_templates_freshness
ON npc_content_templates(use_count, last_used_at)
WHERE archived = false;

-- RLS: Public read access
ALTER TABLE npc_content_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY npc_templates_select_all ON npc_content_templates
  FOR SELECT USING (true);
```

**Features**:

- 25 unique NPC profiles with distinct personalities
- Personality-driven posting windows (dawn patrol for locals, midday for rookies)
- Weighted beach selection (70% home, 25% secondary, 5% adventure)
- Template variable hydration with real forecast data
- Staleness monitoring to prevent repetitive content
- System account for daily regional forecasts

**Application Integration**:

- Config files: `config/npc-roster.ts`, `config/regions.ts`
- Utilities: `lib/npc/` (template-hydration, beach-selection, posting-windows, forecast-formatter)
- Scripts: `scripts/migrate-npc-profiles.ts`, `scripts/morning-forecast.ts`, `scripts/check-template-health.ts`

**Documentation**: See [docs/features/NPC_INTEL_BOTS.md](/docs/features/NPC_INTEL_BOTS.md) for comprehensive details.


#### **ML Forecast Data Retention Extension (extend_forecast_retention_90_days_v2)**

**Purpose**: Extend raw forecast data retention from 7 days to 90 days to support ML bias correction model training.

**Background**: The ML bias correction model (v1) was trained on only 8 days of data (2,275 samples) during an unusual weather period. This caused the model to learn biased patterns that didn't generalize well. Extended retention enables proper training with diverse conditions.

**Schema Changes**:

```sql
-- Updated prune_forecasts_retention function defaults
CREATE OR REPLACE FUNCTION prune_forecasts_retention(
  keep_days_raw integer DEFAULT 90,      -- Changed from 7 to 90
  keep_days_enhanced integer DEFAULT 14, -- Unchanged
  batch_size integer DEFAULT 25000
) RETURNS TABLE(marine_deleted bigint, tide_deleted bigint, enhanced_deleted bigint);

-- Updated pg_cron schedule
SELECT cron.schedule(
  'prune_forecasts_retention',
  '0 5 * * *',
  $$SELECT prune_forecasts_retention(90, 14, 25000);$$
);
```

**Retention Policy Changes**:

| Table | Before | After |
|-------|--------|-------|
| `marine_forecasts` | 7 days | 90 days |
| `tide_forecasts` | 7 days | 90 days |
| `enhanced_forecasts` | 14 days | 14 days (unchanged) |

**Storage Impact**:

- Current DB size: ~535 MB
- Estimated at 90 days: ~1.2 GB for marine_forecasts
- Supabase Pro limit: 8 GB
- Available headroom: ~6.3 GB

**ML Training Requirements**:

- Target samples: 30,000+ (expected by mid-April 2026)
- Time span: 90+ days for seasonal variation
- Data diversity: Multiple weather patterns to prevent overfitting

**Documentation**: See [ML Operations Runbook](/docs/guides/ML_OPERATIONS_RUNBOOK.md) and [ML README](/ml/README.md) for training data requirements.


## Migration Squash Strategy

The project currently has 374+ migration files in `supabase/migrations/`. While this doesn't cause runtime issues, it increases `supabase db reset` times and makes migration history harder to audit.

**Recommendation:** At the next major version boundary, squash all pre-2026 migrations into a single baseline migration. This should be coordinated with:
- A fresh `pg_dump` of the production schema
- Verification that `supabase db reset` produces an identical schema
- Updating any CI/CD scripts that reference specific migration versions

## Future Migration Strategy

### **Planned Enhancements**

1. **Session Analytics**: Enhanced session tracking and analytics
2. **Advanced Social Features**: Expanded community interactions and following system
3. **Forecast ML**: Machine learning forecast improvements and accuracy modeling
4. **Real-time Features**: WebSocket support for live updates and notifications
5. **Leaderboard System**: Global and regional competition features (extends gamification)

### **Scalability Roadmap**

1. **Partitioning**: Table partitioning for large datasets
2. **Read Replicas**: Read-only replicas for analytics
3. **Caching Layer**: Redis integration for hot data
4. **Event Sourcing**: Event-driven architecture for real-time features

## Quality Checklist

Before any new migration:

- [ ] **Performance Impact**: Benchmark query performance changes
- [ ] **Index Strategy**: Add indexes for new foreign keys
- [ ] **RLS Optimization**: Use performance-optimized auth patterns
- [ ] **Rollback Plan**: Create rollback migration if needed
- [ ] **Data Integrity**: Add appropriate constraints and triggers
- [ ] **Documentation**: Update this architecture document
- [ ] **Testing**: Validate in staging environment
- [ ] **Monitoring**: Add relevant monitoring queries

---

**Last Updated**: February 2026
**Status**: Production-ready with growth optimizations
**Next Review**: After reaching 100 active users

**Key Principles**: Performance-first, scalable, secure database evolution that supports the app's growth from 0 to 1,000+ users while maintaining data integrity and user experience.

---

## Utility SQL Functions

- `public.cardinal_to_deg(text)`
  - Converts compass cardinal/ordinal directions (e.g., `N`, `ENE`, `SSW`) to degrees.
  - Marked `IMMUTABLE`; returns `NULL` for unknown inputs after `trim/upper` normalization.
  - Introduced by migration `20250812160000_add_cardinal_to_deg_function.sql` with rollback `20250812160001_rollback_cardinal_to_deg_function.sql`.
  - Intended for use in views, reports, and data normalization queries where directional text must be mapped to numeric bearings.

## Utility Views

- `public.v_beach_hourly_scores`
  - Retired by migration `20260113120100_remove_unused_hourly_scores_mv.sql` together with `mv_beach_hourly_scores`.
  - Current recommendation code must not depend on this view.

## Utility RPCs

- `public.get_coach_picks(_beach_id uuid, _radius_km numeric default 80)`
  - Returns the top three public, non-deleted beaches inside the strict requested radius.
  - Ranks candidates by the latest `beach_daily_intel.conditions_score`, with distance as the deterministic tiebreaker.
  - Repaired by migration `20260722193000_repair_get_coach_picks_daily_intel.sql` after the hourly-score views were retired.

- `public.get_best_times(p_beach uuid, p_start timestamptz, p_end timestamptz, p_limit int default 6)`
  - Retired when `v_beach_hourly_scores` was dropped; current session-window recommendations use the application-layer forecast scorer.

## Scoring Weights (per beach)

## Best Times Performance

**Status: Retired**

- `public.mv_best_times` (materialized view)

  - Precomputes rolling 2-hour windows for next 72h per beach.
  - Refreshed hourly via `pg_cron` job `refresh_mv_best_times_hourly` calling `public.refresh_mv_best_times()`.
  - Unique index on `(beach_id, start_ts)` enables concurrent refresh and fast lookup.
  - Introduced by `20250812170000_create_mv_best_times.sql` with rollback `20250812170001_rollback_mv_best_times.sql`.
  - **Current Usage**: None. Removed after the underlying hourly-score view was retired.

- `public.mv_beach_hourly_scores` (materialized view)

  - Precomputes hourly marine+tide joins with surf suitability scores.
  - Refreshed via `refresh_mv_beach_hourly_scores()` function (pg_cron schedule TBD).
  - Introduced by `20250820134000_create_mv_beach_hourly_scores.sql`.
  - **Current Usage**: None. Removed by `20260113120100_remove_unused_hourly_scores_mv.sql`.

- **Data Engineering Review**: See `docs/data-engineering/BEACH_RECOMMENDATION_CLEANUP_REVIEW.md` for recommendations on:

  - Whether to continue pg_cron refresh jobs for unused materialized views
  - Storage and compute cost analysis
  - Timeline for best-times feature launch

- **Future API** (not yet implemented): Planned `GET /api/recommendations/best-times?beachId&hours&limit`
  - Would prefer MV for performance; fall back to `get_best_times` RPC for live computation.
  - Expected cache headers: `s-maxage=600, stale-while-revalidate=300`.

Weights stored on `public.beaches`:

- `w_wind` (default 0.400)
- `w_swell` (default 0.250)
- `w_tide` (default 0.200)
- `w_period` (default 0.150)
- `w_height` (default 0.100)

All weights are in [0, 1]. The view `public.v_beach_hourly_scores` reads these to compute `score_0_100`. Defaults are applied via `COALESCE` and can be tuned per-spot by admins (future UI). Introduced by migration `20250812162000_add_beach_scoring_weights.sql` with rollback `20250812162001_rollback_beach_scoring_weights.sql`.

---

## Coordinate Naming Conventions

### Database Schema Standards

**Canonical Coordinate Columns**:

```sql
-- Legacy tables (beaches) use PostGIS naming
center_lat DOUBLE PRECISION   -- Latitude
center_lng DOUBLE PRECISION   -- Longitude (PostGIS legacy)

-- New tables use standard naming
latitude DOUBLE PRECISION     -- Latitude
longitude DOUBLE PRECISION    -- Longitude
```

**Important**: The `beaches` table uses `center_lng` (not `center_lon`) due to PostGIS legacy conventions. This is intentional and should NOT be changed without a comprehensive migration.

### Database Function Parameters

All database functions use explicit naming:

```sql
CREATE OR REPLACE FUNCTION get_nearby_intel_posts(
  center_lat DOUBLE PRECISION,    -- Explicit: latitude
  center_lng DOUBLE PRECISION,    -- Explicit: longitude (legacy)
  radius_miles DOUBLE PRECISION DEFAULT 5,
  ...
)
```

### Application Layer Mapping

**Database to TypeScript Mapping**:

```typescript
// Database type (matches schema exactly)
interface Beach {
  center_lat: number; // From beaches.center_lat
  center_lng: number; // From beaches.center_lng
}

// Component props (use full names)
interface ComponentProps {
  latitude: number; // Full name
  longitude: number; // Full name (NOT lng)
}

// Explicit mapping required
<Component
  latitude={beach.center_lat} // Map: center_lat to latitude
  longitude={beach.center_lng} // Map: center_lng to longitude
/>;
```

### Migration Considerations

**DO NOT change database column names without:**

1. Migration script to rename columns
2. Update all database functions that reference columns
3. Update TypeScript generated types
4. Update all application queries
5. Update all components
6. Coordinate production deployment
7. Update all documentation

**See**: [/docs/COORDINATE_CONVENTIONS.md](/docs/COORDINATE_CONVENTIONS.md) for comprehensive coordinate naming standards.

### **Personalized Insights Support** (20251216120000)

#### **Migration**: `20251216120000_add_board_snapshot_to_sessions.sql`

**Purpose**: Enable personalized insights by capturing board configuration at session time for historical comparison.

**Changes**:

1. **New Column: `sessions.board_snapshot`**

   - Type: `jsonb` (nullable)
   - Purpose: Preserves board details even if board is later modified or deleted
   - Structure:
     ```json
     {
       "name": "Fish",
       "board_type": "fish",
       "length_ft": 5.8,
       "volume_liters": 32.5,
       "width_in": 19.5,
       "thickness_in": 2.5
     }
     ```
   - Populated automatically when session is logged with a board
   - Enables board recommendation algorithm in similarity-insights-service

2. **New Index: `idx_sessions_user_rated_completed`**
   - Type: Composite B-tree index with partial filter
   - Columns: `(user_id, rating DESC, arrival_time DESC)`
   - Filter: `WHERE status = 'completed' AND rating IS NOT NULL AND rating >= 3`
   - Purpose: Optimize queries for personalized insights service
   - Benefits:
     - Fast lookup of user's high-rated sessions (3+ stars)
     - Efficient ordering by rating and recency
     - Reduced index size by filtering to only completed, rated sessions
     - Supports 12-month lookback queries with single index scan

**Performance Impact**:

- Similarity insights queries: 95% faster (full table scan to index scan)
- Index size: ~15% of full sessions table (only rated, completed sessions)
- Write overhead: Minimal (most sessions don't have ratings)

**Data Migration**:

- Column added with `DEFAULT NULL` (no backfill required)
- Existing sessions without board_snapshot work gracefully
- Future sessions automatically populate board_snapshot on creation

**Integration**:

- Used by `lib/services/similarity-insights-service.ts`
- Queried via composite index for optimal performance
- Supports board tip generation (60%+ same board threshold)

**Rollback**:

```sql
BEGIN;
DROP INDEX IF EXISTS public.idx_sessions_user_rated_completed;
ALTER TABLE public.sessions DROP COLUMN IF EXISTS board_snapshot;
COMMIT;
```

### Current-Location Weekend Scout Storage (20260719120000)

Migration `20260719120000_create_weekend_scout_location_snapshots.sql` defines two privacy-bounded tables and one service-role candidate RPC:

- `user_location_snapshots` has `user_id` as its primary key, so a new rounded foreground fix replaces the previous row instead of creating history. Authenticated users can select or delete only their row; writes use the validated server endpoint.
- `weekend_scout_snapshots` is append-only to application code and unique on `(user_id, weekend_start)`. It stores the exact top-three evidence, lead summary, scorer version, drive range, and location timestamp used for delivery.
- `get_weekend_scout_candidates` excludes private, deleted, and user-excluded beaches, orders by PostGIS distance, and returns the pre-limit total so the service can suppress truncated rankings.

The API write freshness limit is 15 minutes; push evaluation is limited to snapshots no older than 24 hours. The migration is committed but has not been applied as part of code implementation; database application remains approval-gated.
