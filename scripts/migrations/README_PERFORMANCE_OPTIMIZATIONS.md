# Database Performance Optimizations

This document explains the comprehensive performance optimizations implemented to address the query bottlenecks identified in your Supabase performance analysis.

## 🚀 Performance Issues Addressed

Based on your query analytics, we identified these primary bottlenecks:

| Query Type               | Calls | Time % | Issue                                              |
| ------------------------ | ----- | ------ | -------------------------------------------------- |
| Beach pagination         | 4,336 | 2.0%   | Missing indexes on `ORDER BY name ASC`             |
| Session complex joins    | 2,183 | 0.4%   | Expensive lateral joins to beaches/boards/profiles |
| Individual beach lookups | 261   | 0.4%   | Single record lookups without optimized indexes    |

## 📋 Optimizations Implemented

### 1. Beach Table Optimizations

```sql
-- Primary optimization for pagination
CREATE INDEX idx_beaches_name_asc ON beaches (name ASC);

-- Covering index to avoid table lookups
CREATE INDEX idx_beaches_covering ON beaches (id, name, latitude, longitude, description);
```

**Expected Impact**: 60-80% reduction in beach query time

### 2. Sessions Table Optimizations (High Priority)

```sql
-- Critical for session listing performance
CREATE INDEX idx_sessions_created_at_desc ON sessions (created_at DESC);

-- Foreign key indexes for lateral joins
CREATE INDEX idx_sessions_beach_id ON sessions (beach_id);
CREATE INDEX idx_sessions_profile_id ON sessions (profile_id);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_sessions_user_arrival_desc ON sessions (user_id, arrival_time DESC);
CREATE INDEX idx_sessions_public_created_desc ON sessions (is_public, created_at DESC);
```

**Expected Impact**: 50-70% reduction in session query time

### 3. Materialized View for Session Data

```sql
-- Pre-computed session data with resolved names
CREATE MATERIALIZED VIEW mv_session_summary AS
SELECT s.*, b.name as beach_name_resolved, p.full_name as user_name, ...
FROM sessions s
LEFT JOIN beaches b ON s.beach_id = b.id
LEFT JOIN profiles p ON s.profile_id = p.id
LEFT JOIN boards board ON s.board_id = board.id
WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days';
```

**Expected Impact**: 80-90% reduction for recent session queries

## 🛠️ Implementation Steps

### 1. Run the Migration

```bash
# Apply the comprehensive optimization migration
psql -d your_database -f scripts/migrations/019_comprehensive_performance_optimization.sql
```

### 2. Set Up Materialized View Refresh

```sql
-- Create a cron job to refresh the materialized view every 15 minutes
SELECT cron.schedule('refresh-session-summary', '*/15 * * * *', 'SELECT refresh_session_summary();');
```

### 3. Update Application Queries (Optional but Recommended)

#### For Recent Sessions (Last 30 Days)

```typescript
// Instead of complex joins, use the materialized view
const { data } = await supabase
  .from("mv_session_summary")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(20);
```

#### For Simple Session Lists

```typescript
// Use the optimized view for basic session data
const { data } = await supabase
  .from("v_sessions_with_names")
  .select("id, beach_name, user_full_name, created_at")
  .order("created_at", { ascending: false });
```

## 📊 Monitoring Performance

### 1. Check Index Usage

```sql
-- Monitor index usage
SELECT
    indexrelname as index_name,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 2. Monitor Query Performance

```sql
-- Enable pg_stat_statements if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Check slow queries
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE query LIKE '%beaches%' OR query LIKE '%sessions%'
ORDER BY total_time DESC
LIMIT 10;
```

### 3. Check Materialized View Freshness

```sql
-- See when the materialized view was last refreshed
SELECT
    schemaname,
    matviewname,
    hasindexes,
    ispopulated
FROM pg_matviews
WHERE matviewname = 'mv_session_summary';
```

## 🎯 Expected Performance Improvements

| Query Pattern                      | Before | After | Improvement |
| ---------------------------------- | ------ | ----- | ----------- |
| Beach pagination (`ORDER BY name`) | ~50ms  | ~5ms  | 90% faster  |
| Session joins (recent data)        | ~100ms | ~10ms | 90% faster  |
| Session joins (all data)           | ~100ms | ~30ms | 70% faster  |
| Individual beach lookup            | ~20ms  | ~2ms  | 90% faster  |

## 🔧 Advanced Optimizations

### 1. Connection Pooling

```typescript
// In your Supabase client configuration
const supabase = createClient(url, key, {
  db: {
    schema: "public",
  },
  global: {
    headers: { "x-client-info": "your-app/1.0.0" },
  },
});
```

### 2. Query Optimization

```typescript
// Prefer specific selects over select('*')
const { data } = await supabase
  .from("sessions")
  .select("id, beach_name, created_at, user:profiles(full_name)")
  .limit(10);

// Use single() for individual records
const { data } = await supabase
  .from("beaches")
  .select("id, name, latitude, longitude")
  .eq("id", beachId)
  .single();
```

### 3. Caching Strategy

```typescript
// Implement Redis caching for frequently accessed data
const getCachedBeaches = async () => {
  const cached = await redis.get("beaches:all");
  if (cached) return JSON.parse(cached);

  const { data } = await supabase.from("beaches").select("*");
  await redis.setex("beaches:all", 300, JSON.stringify(data)); // 5 min cache
  return data;
};
```

## 🚨 Maintenance Tasks

### Daily

- Monitor slow query log
- Check materialized view refresh status

### Weekly

- Run `ANALYZE` on high-traffic tables:

```sql
SELECT analyze_performance_tables();
```

### Monthly

- Review index usage and remove unused indexes
- Update table statistics:

```sql
ALTER TABLE beaches ALTER COLUMN name SET STATISTICS 1000;
ALTER TABLE sessions ALTER COLUMN created_at SET STATISTICS 1000;
```

## 🔍 Troubleshooting

### Issue: Materialized View Not Refreshing

```sql
-- Check for locks
SELECT * FROM pg_locks WHERE relation = 'mv_session_summary'::regclass;

-- Manual refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_summary;
```

### Issue: Query Still Slow After Optimization

```sql
-- Check if indexes are being used
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sessions
ORDER BY created_at DESC
LIMIT 20;
```

### Issue: High Write Latency

```sql
-- Check index overhead
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename IN ('sessions', 'beaches')
ORDER BY tablename, attname;
```

## 📈 Performance Metrics to Track

1. **Average Response Time**: Should decrease by 50-80%
2. **95th Percentile Response Time**: Should decrease by 60-90%
3. **Database CPU Usage**: Should decrease by 20-40%
4. **Connection Pool Utilization**: Should decrease by 30-50%

Run these optimizations and monitor the improvements. The combination of proper indexing, materialized views, and query optimization should significantly improve your application's performance.
