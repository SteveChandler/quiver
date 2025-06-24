# Database Performance & Migration Guide

This guide covers database migrations, performance optimizations, and testing for the Quiver surf application.

## 🚀 Quick Performance Fixes

### Step 1: Apply Performance Optimizations

Run these migrations in order:

1. **`018_fix_performance_warnings.sql`** - Fixes RLS performance issues
2. **`019_comprehensive_performance_optimization.sql`** - Adds indexes and optimizations

### What Gets Fixed

#### ✅ Auth RLS InitPlan Issues (32+ warnings)

**Problem**: RLS policies using `auth.uid()` directly re-evaluate for each row  
**Solution**: Replace with `(select auth.uid())` to evaluate once per query  
**Performance Impact**: 3-10x faster queries on tables with many rows

```sql
-- Before: ❌ Slow
auth.uid() = user_id

-- After: ✅ Fast
(select auth.uid()) = user_id
```

#### ✅ Missing Database Indexes

**Problem**: Slow queries due to missing indexes on frequently queried columns  
**Solution**: Added comprehensive indexes for beach pagination, session joins, etc.  
**Performance Impact**: 50-90% reduction in query time

**Key Indexes Added:**

- `idx_beaches_name_asc` - Beach pagination
- `idx_sessions_created_at_desc` - Session listing
- `idx_sessions_beach_id` - Session-beach joins
- `idx_sessions_covering_joins` - Covering index for complex queries

## 📋 Performance Improvements Expected

| Query Pattern                      | Before | After | Improvement |
| ---------------------------------- | ------ | ----- | ----------- |
| Beach pagination (`ORDER BY name`) | ~50ms  | ~5ms  | 90% faster  |
| Session joins (recent data)        | ~100ms | ~10ms | 90% faster  |
| Session joins (all data)           | ~100ms | ~30ms | 70% faster  |
| Individual beach lookup            | ~20ms  | ~2ms  | 90% faster  |

## 🧪 Testing

### End-to-End Tests

The `e2e/` directory contains comprehensive Playwright tests covering:

- **Authentication** - Sign in/up flows
- **Navigation** - Page routing and URL handling
- **Beach Cards** - Review clicks, map interactions
- **Session Management** - Logging, planning, viewing
- **Profile Management** - Editing, preferences
- **Map Functionality** - Search, filtering, geolocation

#### Key Test Features

**Beach Card Interactions** (`beach-card-interactions.spec.ts`):

- Review click navigation to `/beach/{id}?tab=reviews`
- Instant positioning at reviews section
- Map click navigation to beach details
- Tab state management and URL persistence

**Running Tests:**

```bash
# All tests
npm run test:e2e

# With UI
npm run test:e2e:ui

# Specific test
npx playwright test beach-card-interactions.spec.ts
```

## 🗄️ Database Schema

### Core Tables

- **`beaches`** - Beach locations and metadata
- **`sessions`** - Surf session records
- **`profiles`** - User profiles
- **`enhanced_forecasts`** - 10-day weather/wave forecasts
- **`beach_reviews`** - User reviews and ratings
- **`session_media`** - Photos/videos attached to sessions

### Key Migrations

1. **`003_create_enhanced_forecasts_table.sql`** - Enhanced forecast system
2. **`012_allow_null_wave_data.sql`** - Allow null wave data when unavailable
3. **`014_fix_security_issues.sql`** - RLS security fixes
4. **`018_fix_performance_warnings.sql`** - Performance optimizations
5. **`019_comprehensive_performance_optimization.sql`** - Comprehensive indexes

## 🔧 Maintenance

### Regular Tasks

**Daily:**

- Monitor slow query log
- Check materialized view refresh status

**Weekly:**

```sql
-- Analyze performance tables
SELECT analyze_performance_tables();
```

**Monthly:**

```sql
-- Update table statistics
ALTER TABLE beaches ALTER COLUMN name SET STATISTICS 1000;
ALTER TABLE sessions ALTER COLUMN created_at SET STATISTICS 1000;
```

### Monitoring Performance

```sql
-- Check index usage
SELECT
    indexrelname as index_name,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Monitor slow queries (requires pg_stat_statements)
SELECT
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements
WHERE query LIKE '%beaches%' OR query LIKE '%sessions%'
ORDER BY total_time DESC
LIMIT 10;
```

## 🚨 Troubleshooting

### Common Issues

**Tests timing out:**

- Increase timeout in `playwright.config.ts`
- Check if application is running on `http://localhost:3000`

**Query still slow after optimization:**

```sql
-- Check if indexes are being used
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sessions
ORDER BY created_at DESC
LIMIT 20;
```

**Materialized view not refreshing:**

```sql
-- Check for locks
SELECT * FROM pg_locks WHERE relation = 'mv_session_summary'::regclass;

-- Manual refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_summary;
```

## ✅ Verification

After applying optimizations:

1. **Supabase Dashboard** → **Settings** → **Database** → **Linter**

   - Should show no performance warnings

2. **Run Tests:**

   ```bash
   npm run test:e2e
   ```

3. **Monitor Query Performance:**
   - Beach pagination should be <10ms
   - Session joins should be <30ms
   - No auth RLS InitPlan warnings

## 📚 Additional Resources

- [Supabase Performance Guide](https://supabase.com/docs/guides/database/performance)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Playwright Testing Guide](https://playwright.dev/docs/intro)

Your Quiver surf app database is now optimized for high performance! 🌊⚡
