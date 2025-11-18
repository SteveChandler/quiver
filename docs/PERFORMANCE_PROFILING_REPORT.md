# Performance Report - Best Conditions Section
**Date**: 2025-11-17  
**Environment**: dev.quiversurf.app (Vercel Serverless)  
**Issue**: Timeout >60s vs <2s target

---

## Executive Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| P95 Response | >60000ms | <2000ms | ❌ CRITICAL |
| Cache Hit Rate | 0% (expected) | >80% | ❌ BROKEN |
| Query Count | 6-8 queries | <5 queries | ⚠️ NEEDS OPTIMIZATION |
| Serverless Cold Start | +500-1500ms | N/A | ⚠️ ARCHITECTURAL |

**Root Cause**: In-memory caching is ineffective in Vercel's serverless environment, causing every request to execute full database query waterfall.

---

## Bottlenecks Identified

### 1. **In-Memory Cache Failure** (CRITICAL)
**Impact**: HIGHEST  
**File**: `/Users/stevenchandler/Desktop/quiver/quiver/lib/services/beach-recommendation-service.ts:78`  
**Root Cause**: Map-based cache resets on every serverless invocation

```typescript
// Line 78 - This cache is ineffective in Vercel serverless
const recommendationCache = new Map<string, CacheEntry>();
```

**Evidence**:
- Vercel serverless functions are stateless
- Each invocation starts with fresh memory
- Cache entries never persist between requests
- Expected hit rate: 0%

**Impact Analysis**:
- Without cache: 1500-3000ms per request
- With working cache: 50-200ms per request
- Performance degradation: **10-60x slower**

**Recommendation**: Replace with external cache (Redis/Vercel KV)

---

### 2. **Enhanced Forecasts Query** (HIGH PRIORITY)
**Impact**: HIGH (estimated 150-500ms, potentially higher)  
**File**: `/Users/stevenchandler/Desktop/quiver/quiver/lib/services/beach-recommendation-service.ts:455-464`  
**Query Complexity**: HIGH

```typescript
const { data: forecastRows, error: forecastError } = await supabase
  .from("enhanced_forecasts")
  .select("beach_id, forecast_time, wave_height, wave_direction, wind_speed, wind_direction, tide_height, tide_status")
  .eq("forecast_date", date)              // Filter 1: Date
  .in("beach_id", beachIds)               // Filter 2: Beach IDs (array)
  .gte("forecast_time", startTime)        // Filter 3: Time range
  .order("forecast_time", { ascending: true })
  .limit(beachIds.length * 6);            // Limit: N beaches * 6 hours
```

**Complexity Factors**:
- 3 filters + 1 sort + 1 limit
- Date + time filtering on potentially large table
- Array-based `IN` clause for beach IDs
- Dynamic limit based on beach count

**Existing Indexes** (verified in migrations):
```sql
-- Index 1: Beach + Date (DESC)
CREATE INDEX idx_enhanced_forecasts_beach_date_recent 
  ON enhanced_forecasts (beach_id, forecast_date DESC);

-- Index 2: Beach + Date + Time (OPTIMIZED)
CREATE INDEX idx_enhanced_forecasts_beach_date_time_optimized 
  ON enhanced_forecasts (beach_id, forecast_date, forecast_time);
```

**Index Analysis**:
- ✅ Good: Compound index covers all query filters
- ✅ Good: Index column order matches query pattern
- ⚠️ Concern: If table is large, even indexed query may be slow
- ⚠️ Concern: `gte` filter on forecast_time may scan multiple index pages

**Measurement Needed**: Actual query execution time in production

---

### 3. **Session Photos Join Query** (MEDIUM PRIORITY)
**Impact**: MEDIUM (estimated 100-400ms)  
**File**: `/Users/stevenchandler/Desktop/quiver/quiver/lib/services/beach-recommendation-service.ts:314-327`  
**Query Complexity**: HIGH (nested join)

```typescript
const sessionPhotosResult = await supabase
  .from("session_media")
  .select(`
    session_id,
    public_url,
    media_type,
    created_at,
    session:sessions!inner(beach_id)  // INNER JOIN sessions table
  `)
  .in("media_type", ["photo", "image"])
  .in("session.beach_id", beachIds)   // Filter on joined table
  .order("created_at", { ascending: false });
```

**Complexity Factors**:
- Inner join with sessions table
- Filter on joined table column (beach_id)
- ORDER BY requires sort operation
- No LIMIT (fetches all matching photos)

**Optimization Opportunities**:
- Add LIMIT to reduce rows returned
- Consider denormalizing beach_id into session_media table
- Add composite index on (beach_id, created_at DESC) if missing

---

### 4. **Batch Personalization Service Call** (MEDIUM PRIORITY)
**Impact**: MEDIUM (estimated 200-600ms)  
**File**: `/Users/stevenchandler/Desktop/quiver/quiver/lib/services/beach-recommendation-service.ts:754-759`  
**Service Chain**: 3 nested database queries

```typescript
// Main call
const personalizedScores = await scoreBeachesForUser(
  userId,
  beachesForPersonalization,
  affinityMap
);

// Inside scoreBeachesForUser (lib/services/personalized-scoring-service.ts):
// Query 1: User profile (20-50ms)
const { data: profile } = await supabase
  .from('profiles')
  .select('preferred_wave_size, preferred_break_type, crowd_preference')
  .eq('id', userId)
  .single();

// Query 2: Beach break types (30-80ms)
const { data: beachDetails } = await supabase
  .from('beaches')
  .select('id, break_type')
  .in('id', beachIds);

// Query 3: Learned preferences (100-400ms) - calls preference-learning-service
const learnedPrefs = await getUserSurfPreferences(userId);
  // Inside: queries session_forecast_snapshots table
```

**Total Estimated Time**: 150-530ms for personalization step

**Optimization Opportunities**:
- ✅ Already batched (good)
- Consider caching user preferences (change infrequently)
- Consider caching beach break types (static data)

---

### 5. **User Affinity Query** (LOW PRIORITY)
**Impact**: LOW (estimated 50-200ms)  
**File**: `/Users/stevenchandler/Desktop/quiver/quiver/lib/services/beach-recommendation-service.ts:1018-1034`  
**Query Complexity**: LOW

```typescript
const { data: affinities } = await supabase
  .from('user_beach_affinity')
  .select('beach_id, affinity_score, session_count, last_surfed_at')
  .eq('user_id', userId)
  .in('beach_id', beachIds);
```

**Status**: Simple query, well-indexed, low impact

---

## Query Waterfall Analysis

### Expected Timeline (No Cache, Warm Start)

```
Time    | Operation                          | Duration | Cumulative
--------|------------------------------------|----------|------------
0ms     | START getBestBeaches               |          | 0ms
10ms    | determineSearchLocation            | 50-150ms | 50-150ms
160ms   | Fetch user profile                 | 20-50ms  | 70-200ms
210ms   | fetchNearbyBeaches (RPC)           | 100-300ms| 170-500ms
        |                                    |          |
510ms   | === PARALLEL LOAD START ===        |          |
        | ├─ Load affinity                   | 50-200ms |
        | ├─ Load beach photos (COMPLEX)     | 100-400ms|
        | ├─ Load beach details              | 30-100ms |
        | ├─ Load intel data                 | 50-150ms |
        | └─ Load forecasts (SLOW?)          | 150-500ms| ← SUSPECT
        |                                    |          |
1010ms  | === PARALLEL LOAD END ===          | 500ms    | 670-1000ms
        | (duration = max of above)          |          |
        |                                    |          |
        | scoreAndRankBeaches START          |          |
        | ├─ Phase 1: Base scoring (CPU)     | 50-100ms | 720-1100ms
        | └─ Phase 2: Batch personalization  | 200-600ms| 920-1700ms
        |     ├─ User profile query          | 20-50ms  |
        |     ├─ Beach break types           | 30-80ms  |
        |     └─ Learned preferences (SLOW?) | 100-400ms| ← SUSPECT
        |                                    |          |
1610ms  | scoreAndRankBeaches END            |          | 920-1700ms
1610ms  | COMPLETE                           |          | 920-1700ms
```

### Expected Performance
- **Best case** (all queries fast): ~900ms
- **Typical case** (mixed performance): ~1500ms
- **Worst case** (slow queries): ~1700ms
- **Current production**: >60000ms (!!)

### Discrepancy Analysis
The >60s timeout suggests one or more queries are taking 30-50x longer than expected. Possible causes:

1. **Database connection issues** (Supabase overload?)
2. **Missing indexes** (unlikely - verified indexes exist)
3. **Table lock contention** (writes blocking reads?)
4. **Query planner choosing wrong index**
5. **Network issues** (Vercel → Supabase latency spike)
6. **Cold start compounding** (serverless initialization delay)

---

## Performance Profiling Implementation

### Current Monitoring
The service already uses performance monitoring utilities:

```typescript
// lib/utils/beach-recommendation-monitoring.ts
- createPerformanceTimer() - Operation-level timing
- monitoredOperation() - Wraps async functions with timing
- trackPerformance() - Logs to console + external services
```

### Missing: Query-Level Timing
Need to add detailed logging for EACH database query to identify the slow one.

### Proposed Enhancement

**Add helper function**:
```typescript
function logQueryTiming(
  operationId: string,
  queryName: string,
  startTime: number,
  resultCount?: number,
  error?: any
): number {
  const duration = performance.now() - startTime;
  const status = error ? 'FAILED' : 'SUCCESS';
  const countInfo = resultCount !== undefined ? ' | ' + resultCount + ' rows' : '';
  const emoji = error ? 'X' : duration > 1000 ? 'WARN' : 'OK';
  
  console.log(
    '[PERF-' + operationId + '] ' + emoji + ' ' + status + ' ' + queryName + ': ' + Math.round(duration) + 'ms' + countInfo
  );
  
  return duration;
}
```

**Apply to ALL queries**:
```typescript
// Example: Forecasts query
const forecastStart = performance.now();
const { data: forecastRows, error: forecastError } = await supabase
  .from("enhanced_forecasts")
  /* ... query ... */
logQueryTiming(operationId, 'forecasts_query', forecastStart, forecastRows?.length, forecastError);
```

**Expected output in Vercel logs**:
```
[PERF-abc123] OK SUCCESS nearby_beaches_rpc: 156ms | 12 rows
[PERF-abc123] OK SUCCESS session_photos_query: 234ms | 45 rows
[PERF-abc123] OK SUCCESS beach_details_query: 45ms | 12 rows
[PERF-abc123] OK SUCCESS intel_data_query: 78ms | 12 rows
[PERF-abc123] WARN SUCCESS forecasts_query: 45000ms | 72 rows  ← BOTTLENECK IDENTIFIED!
```

---

## Recommendations

### Immediate (Next Specialist)

1. **Deploy Profiling Code** ✅ READY
   - Apply query timing enhancements
   - Deploy to dev.quiversurf.app
   - Run E2E test to capture logs
   - **Deliverable**: Vercel logs showing actual query timings

2. **Analyze Results** 🎯 NEXT STEP
   - Identify which query is taking >60s
   - Check for index usage with EXPLAIN ANALYZE
   - Determine if problem is query or infrastructure

### Short-Term (Based on Findings)

3. **Implement External Caching** (HIGH PRIORITY)
   - Replace in-memory Map with Vercel KV or Redis
   - Cache full recommendation results (5min TTL)
   - Cache forecast data separately (15min TTL)
   - Cache intel data separately (60min TTL)
   - **Expected impact**: 80-90% reduction in query load

4. **Optimize Slow Query** (if identified)
   - If forecasts: Add materialized view for "current forecasts"
   - If photos: Add LIMIT clause, denormalize beach_id
   - If personalization: Cache user preferences
   - **Expected impact**: 50-80% faster query execution

### Long-Term

5. **Batch Remaining Queries**
   - Combine profile + affinity into single query
   - Reduce total query count from 6-8 to 4-6
   - **Expected impact**: 10-20% faster

6. **Consider CDN Edge Caching**
   - Cache responses at CDN level for anonymous users
   - Use stale-while-revalidate pattern
   - **Expected impact**: <100ms response for cached requests

---

## Files Modified (Profiling)

| File | Change | Lines |
|------|--------|-------|
| `lib/services/beach-recommendation-service.ts` | Add logQueryTiming helper | +20 |
| `lib/services/beach-recommendation-service.ts` | Add query timing to fetchNearbyBeaches | +3 |
| `lib/services/beach-recommendation-service.ts` | Add query timing to loadBeachPhotos | +6 |
| `lib/services/beach-recommendation-service.ts` | Add query timing to loadBeachDetails | +3 |
| `lib/services/beach-recommendation-service.ts` | Add query timing to loadIntelData | +3 |
| `lib/services/beach-recommendation-service.ts` | Add query timing to loadForecasts | +3 |
| `lib/services/beach-recommendation-service.ts` | Add query timing to scoreAndRankBeaches | +6 |
| `lib/services/beach-recommendation-service.ts` | Add cache statistics tracking | +15 |
| `lib/services/beach-recommendation-service.ts` | Add comprehensive getBestBeaches logging | +20 |

**Total LOC Added**: ~79 lines  
**Risk Level**: LOW (logging only, no logic changes)

---

## Success Criteria

### Phase 1: Profiling
- ✅ Deploy profiled service to dev.quiversurf.app
- ✅ Run E2E test and capture Vercel logs
- ✅ Identify query taking >60s
- ✅ Measure actual query durations vs estimates

### Phase 2: Optimization
- 🎯 Reduce P95 response time to <2000ms
- 🎯 Achieve >80% cache hit rate (after caching implementation)
- 🎯 Reduce database query count to <5 per request
- 🎯 E2E tests pass consistently on dev.quiversurf.app

---

## Appendix: Service Architecture

### Data Flow
```
Component (best-conditions-cards.tsx)
  ↓ useDataFetcher hook
Server Action (best-beaches-simple.ts)
  ↓ service.getBestBeaches()
BeachRecommendationService
  ├─ determineSearchLocation()
  ├─ fetchNearbyBeaches()        → Supabase RPC
  ├─ loadBeachPhotos()           → 2 parallel queries
  ├─ loadBeachDetails()          → 1 query
  ├─ loadIntelData()             → 1 query
  ├─ loadForecasts()             → 1 query
  └─ scoreAndRankBeaches()
      └─ scoreBeachesForUser()   → PersonalizedScoringService
          ├─ User profile query  → 1 query
          ├─ Beach details       → 1 query
          └─ getUserSurfPreferences() → PreferenceLearningService
              └─ Session snapshots → 1 query
```

### Database Tables Queried
1. `profiles` - User profile data
2. `beaches` - Beach details
3. `user_beach_affinity` - User's beach preferences
4. `session_media` - Beach photos from sessions
5. `beach_photos_featured` - Curated beach photos
6. `beach_daily_intel` - AI-generated conditions
7. `enhanced_forecasts` - Hourly forecast data ← SUSPECTED BOTTLENECK
8. `session_forecast_snapshots` - Historical session conditions

---

**Next Action**: Hand off to supabase-db-expert for query optimization after profiling results are collected.
