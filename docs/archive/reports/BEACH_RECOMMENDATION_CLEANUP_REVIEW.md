# Data Engineering Review: Beach Recommendation Service Cleanup

**Date:** 2025-11-19  
**Status:** Awaiting Data Engineering Review  
**Related Migration:** `20251119000000_cleanup_unused_best_conditions_indexes.sql`  
**Context:** BeachRecommendationService removed from home screen (Nov 2025)

---

## Overview

The BeachRecommendationService feature was removed as part of home screen simplification. While most database infrastructure introduced for this feature is still actively used by other services (personalization, intel generation), there are several data retention and maintenance items that require data engineering review.

---

## Review Items

### 1. beach_daily_intel Retention Policy

**Current Configuration:**
- **Table:** `beach_daily_intel`
- **Retention:** 3 days (auto-cleanup via `cleanup_old_beach_intel()` function)
- **Generation Frequency:** 3x daily (6am, 10am, 2pm PT)
- **Data Volume:** ~300-900 records (100 beaches × 3 generations/day × 3 days)

**Current Usage:**
- ✅ **Active:** BestSurfWindow component (beach detail pages)
- ✅ **Active:** IntelGenerationService (scheduled workflow)
- ✅ **Active:** GitHub Actions workflow (`.github/workflows/daily-intel.yml`)

**Question for Data Engineering:**
Is 3-day retention still appropriate, or should we:
- **Option A:** Keep 3 days (current)
- **Option B:** Extend to 7 days (allows week-over-week comparison)
- **Option C:** Reduce to 1 day (minimize storage, intel is time-sensitive)

**Recommendation:** Keep 3 days unless storage optimization is critical. Provides good balance between freshness and historical context for users checking multiple days.

---

### 2. mv_beach_hourly_scores Refresh Schedule

**Current Configuration:**
- **Materialized View:** `mv_beach_hourly_scores`
- **Refresh Function:** `refresh_mv_beach_hourly_scores()`
- **Schedule:** pg_cron job (frequency TBD - check `cron.job` table)
- **Purpose:** Precompute hourly marine+tide joins with surf suitability scores

**Dependent Assets:**
- `mv_best_times` (uses `v_beach_hourly_scores` which can fall back to live computation)
- `get_best_times` RPC function
- Helper: `lib/bestTimes.ts`

**Current Usage:**
- ❌ **No Active Consumers:** No API routes or components currently use this data
- ✅ **Future Feature:** Planned for "best times to surf" feature
- ℹ️ **Data Source:** Depends on `marine_forecasts` and `tide_forecasts` tables

**Question for Data Engineering:**
Should the pg_cron refresh job continue running, or should we:
- **Option A:** Keep running (ready for feature launch, minimal compute cost)
- **Option B:** Pause refresh until feature is actively developed
- **Option C:** Drop materialized view entirely and use live computation via `v_beach_hourly_scores` view

**Data Points Needed:**
- Current pg_cron job frequency
- Compute cost of refresh operation
- Storage size of `mv_beach_hourly_scores` table
- Query: `SELECT pg_size_pretty(pg_total_relation_size('public.mv_beach_hourly_scores'));`

**Recommendation:** Pause refresh if compute cost is significant and feature launch is >1 month away. Can resume when feature development begins.

---

### 3. mv_best_times Materialized View Status

**Current Configuration:**
- **Materialized View:** `mv_best_times`
- **Refresh Function:** `refresh_mv_best_times()`
- **Schedule:** Hourly via pg_cron (minute 7: `7 * * * *`)
- **Purpose:** Precomputed 2-hour surf windows for next 72 hours

**Current Usage:**
- ❌ **No Active Consumers:** No API routes or components
- ✅ **Future Feature:** Planned for "best times to surf" recommendation widget
- ⚠️ **Dependency:** Uses `v_beach_hourly_scores` (live view, not materialized)

**Question for Data Engineering:**
Same options as #2 above. Additionally:
- Are both materialized views necessary, or can we use just `v_beach_hourly_scores` (live computation)?
- What's the performance difference between live view vs materialized view for typical queries?

**Recommendation:** Consider dropping `mv_best_times` and using live computation from `v_beach_hourly_scores` until feature launch. Hourly refresh may be overkill if not actively consumed.

---

### 4. Performance Impact Analysis

**Question:** Now that BeachRecommendationService is removed, what performance changes should we monitor?

**Removed Load:**
- Complex multi-table joins (user_beach_affinity + enhanced_forecasts + beach_daily_intel + session_media)
- Home screen queries that ran on every page load
- Estimated query reduction: 100-500 requests/day (depending on user traffic)

**Remaining Load:**
- PersonalizedScoringService: Uses `user_beach_affinity` (lighter queries, batch optimized)
- BestSurfWindow: Uses `beach_daily_intel` (simple single-beach queries)
- Enhanced forecasts: Still heavily used by beach detail, home screen, session conditions

**Monitoring Recommendations:**
1. Track query performance for remaining index users:
   - `idx_user_beach_affinity_user_beach_covering` usage
   - `idx_enhanced_forecasts_date_time_beach` usage
   - `idx_beach_daily_intel_latest` usage
2. Check for unused indexes that could be dropped:
   ```sql
   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public' 
     AND idx_scan = 0 
     AND idx_tup_read = 0
   ORDER BY pg_relation_size(indexrelid) DESC;
   ```
3. Monitor materialized view refresh times if kept running

---

## Migration Safety Check

**Low-Risk Changes Made:**
- ✅ Dropped `idx_session_media_photos_recent` (only used by removed service)
- ✅ Rollback available if needed

**No Changes Made (Preserved):**
- ✅ All actively-used indexes preserved
- ✅ All tables with active consumers preserved
- ✅ Future feature infrastructure (mv_beach_hourly_scores, mv_best_times) preserved

---

## Action Items for Data Engineering

- [ ] **Priority 1:** Review beach_daily_intel retention policy (3 days vs 7 days vs 1 day)
- [ ] **Priority 2:** Check pg_cron job status for materialized view refreshes
- [ ] **Priority 3:** Measure compute cost and storage size of materialized views
- [ ] **Priority 4:** Decide whether to pause or continue materialized view refreshes
- [ ] **Priority 5:** Set up monitoring for remaining index usage
- [ ] **Priority 6:** Schedule follow-up review in 1 month to check for unused indexes

---

## SQL Queries for Analysis

### Check Current Retention Settings
```sql
-- Verify beach_daily_intel cleanup function
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'cleanup_old_beach_intel';

-- Check actual data retention
SELECT 
  COUNT(*) as total_records,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record,
  EXTRACT(epoch FROM (MAX(created_at) - MIN(created_at)))/86400 as days_retained
FROM beach_daily_intel;
```

### Check Materialized View Status
```sql
-- List all pg_cron jobs
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname LIKE '%beach%' OR jobname LIKE '%best_times%';

-- Check materialized view sizes
SELECT 
  schemaname,
  matviewname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname IN ('mv_beach_hourly_scores', 'mv_best_times');

-- Check last refresh times
SELECT 
  schemaname,
  matviewname,
  last_refresh
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname IN ('mv_beach_hourly_scores', 'mv_best_times');
```

### Check Index Usage
```sql
-- Analyze index usage for preserved indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_user_beach_affinity_user_beach_covering',
    'idx_enhanced_forecasts_date_time_beach',
    'idx_beach_daily_intel_latest'
  )
ORDER BY idx_scan DESC;
```

---

## Contact

For questions or to provide review feedback:
- **Engineering Lead:** [Your Name]
- **Migration File:** `supabase/migrations/20251119000000_cleanup_unused_best_conditions_indexes.sql`
- **Related Docs:** `docs/ARCHITECTURE_REVIEW.md`, `supabase/ARCHITECTURE.md`

