# Performance Documentation

This directory contains performance analysis, optimization documentation, and performance-related fixes for the Quiver application.

## Documents

### React Rendering Performance Analysis (2025-11-14)

Comprehensive analysis of React component rendering performance identifying critical optimization opportunities and one UI bug.

**Files:**
- **`REACT_RENDERING_ANALYSIS.md`** - Complete performance audit (25KB)
- **`PERFORMANCE_FIXES_SUMMARY.md`** - Quick reference guide (11KB)
- **`IMPLEMENTATION_GUIDE.md`** - Step-by-step fix instructions (16KB)

**Quick Links:**
- [Full Analysis Report](./REACT_RENDERING_ANALYSIS.md)
- [Fixes Summary](./PERFORMANCE_FIXES_SUMMARY.md)
- [Implementation Guide](./IMPLEMENTATION_GUIDE.md)

**Key Findings:**
- **320 components analyzed**, 265 client components
- **Only 4 components (1.5%)** using React.memo - severely under-optimized
- **1 CRITICAL BUG:** PersonalizedBadge has incomplete memo comparison causing stale UI
- **18 critical performance issues** identified
- **45+ optimization opportunities** documented

**Performance Impact (Estimated):**
- Component re-renders: 50-70% reduction
- CPU time in rendering: 40-60% reduction
- Time to Interactive: Target <3.5s
- Lighthouse Performance: Target >90

**Priority Fixes:**

**P0 (Critical - Fix Immediately):**
1. Fix PersonalizedBadge comparison bug (BUG - causes stale UI)
2. Add React.memo to ForecastTable (40-60% improvement)
3. Add React.memo to TideChart (60-80% improvement)

**P1 (High - This Sprint):**
4. Add React.memo to ForecastDisplayWithTransparency (50-70%)
5. Add React.memo to ForecastDayTable (80-90%)
6. Add useCallback to BeachCard event handlers (20-30%)
7. Memoize WaveHeightDisplay calculations (10-20%)
8. Add useCallback to ForecastTable handleToggle

**Files Requiring Changes:**
- `components/recommendations/PersonalizedBadge.tsx` (BUG FIX)
- `components/forecast/forecast-table.tsx`
- `components/forecast/tide-chart-recharts.tsx`
- `components/forecast/forecast-display-with-transparency.tsx`
- `components/beach-card.tsx`
- `components/ui/wave-height-display.tsx`

**Testing:**
```bash
# Profile with React DevTools
yarn dev
# Open http://localhost:3000
# Open React DevTools > Profiler
# Record interaction and analyze re-renders

# Lighthouse performance test
yarn build && yarn start
# Run Chrome DevTools > Lighthouse > Performance

# Verify TypeScript after changes
yarn typecheck

# Run unit tests
yarn test:unit

# Run E2E tests
yarn test:e2e
```

---

### N+1 Query Fix (2025-11-14)

Critical performance fix for the recommendations API endpoint that was suffering from a severe N+1 query anti-pattern.

**Files:**
- **`N+1_QUERY_FIX.md`** - Complete technical documentation
- **`N+1_QUERY_FIX_SUMMARY.md`** - Executive summary and deployment guide
- **`QUERY_COMPARISON.md`** - Before/after SQL query analysis
- **`VALIDATION_CHECKLIST.md`** - Testing and validation procedures

**Quick Links:**
- [Technical Documentation](./N+1_QUERY_FIX.md)
- [Executive Summary](./N+1_QUERY_FIX_SUMMARY.md)
- [Query Analysis](./QUERY_COMPARISON.md)
- [Validation Checklist](./VALIDATION_CHECKLIST.md)

**Performance Improvement:**
- Database queries: 50 → 2 (25x reduction)
- Response time: 5-10s → <500ms (10-20x faster)
- User experience: Critical improvement

**Testing:**
```bash
# Run performance validation
npx tsx scripts/test-recommendations-perf.ts

# Manual API test
curl "http://localhost:3000/api/v1/recommendations?lat=32.7157&lon=-117.1611"

# Check server logs for performance metrics
[PERF] Fetched forecasts for 25 beaches in 127ms (was 50 queries, now 2)
```

---

## Performance Monitoring

### Key Metrics to Track

1. **API Response Times (P95)**
   - Target: <500ms for recommendations endpoint
   - Alert threshold: >1000ms

2. **Database Query Count**
   - Target: 2 queries per recommendations request
   - Alert threshold: >10 queries

3. **Error Rates**
   - Target: <0.1%
   - Alert threshold: >1%

4. **Core Web Vitals**
   - LCP (Largest Contentful Paint): <2.5s
   - FID (First Input Delay): <100ms
   - CLS (Cumulative Layout Shift): <0.1

### Performance Logging

All performance-critical endpoints should include logging:

```typescript
const perfStart = Date.now();
// ... operation
const duration = Date.now() - perfStart;
console.log(`[PERF] Operation completed in ${duration}ms`);
```

Look for `[PERF]` prefix in logs for performance metrics.

---

## Common Performance Patterns

### 1. Avoid N+1 Queries

**Bad:**
```typescript
for (const item of items) {
  const data = await db.query("SELECT * FROM table WHERE id = ?", item.id);
}
```

**Good:**
```typescript
const ids = items.map(i => i.id);
const data = await db.query("SELECT * FROM table WHERE id IN (?)", ids);
const dataByID = groupBy(data, 'id');
```

### 2. Use Database Indexes

Ensure indexes exist for common query patterns:

```sql
-- Composite index for common queries
CREATE INDEX idx_table_common_pattern ON table(column1, column2);

-- Partial index for filtered queries
CREATE INDEX idx_table_active ON table(status) WHERE status = 'active';
```

### 3. Implement Response Caching

For frequently accessed, slowly changing data:

```typescript
const cacheKey = `resource:${id}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const data = await fetchData(id);
await cache.set(cacheKey, data, 300); // 5min TTL
return data;
```

### 4. Batch Operations

Group similar operations together:

```typescript
// Bad: Multiple small operations
await Promise.all(items.map(item => saveItem(item)));

// Good: Single batch operation
await saveBatch(items);
```

### 5. Optimize Database Queries

Use `EXPLAIN ANALYZE` to understand query performance:

```sql
EXPLAIN ANALYZE
SELECT * FROM beaches
WHERE lat BETWEEN ? AND ?
  AND lon BETWEEN ? AND ?
ORDER BY distance
LIMIT 25;
```

---

## Performance Testing

### Automated Performance Tests

Run performance validation scripts:

```bash
# Recommendations API performance
npx tsx scripts/test-recommendations-perf.ts
```

### Manual Performance Testing

1. **Use Browser DevTools**
   - Network tab: Check API response times
   - Performance tab: Profile JavaScript execution
   - Lighthouse: Measure Core Web Vitals

2. **Database Query Monitoring**
   - Use Supabase dashboard to monitor slow queries
   - Review query execution plans
   - Check index usage

3. **Load Testing**
   - Use tools like Apache Bench or k6
   - Test concurrent user scenarios
   - Identify bottlenecks under load

---

## Optimization Workflow

1. **Measure** - Establish baseline metrics
2. **Identify** - Find the bottleneck
3. **Optimize** - Apply targeted fix
4. **Validate** - Verify improvement
5. **Monitor** - Track in production
6. **Document** - Update this directory

---

## Performance Budget

### API Endpoints

| Endpoint | P95 Target | Alert Threshold |
|----------|-----------|-----------------|
| `/api/v1/recommendations` | <500ms | >1000ms |
| `/api/beaches/nearby` | <200ms | >500ms |
| `/api/forecasts/bulk` | <1000ms | >2000ms |
| `/api/sessions/[id]` | <300ms | >800ms |

### Page Load Times

| Page | LCP Target | Alert Threshold |
|------|-----------|-----------------|
| Home | <2.0s | >3.0s |
| Beach Detail | <2.5s | >4.0s |
| Sessions List | <2.0s | >3.0s |
| Profile | <1.5s | >2.5s |

---

## Future Optimizations

### High Priority

1. **Response Caching** for recommendations API
   - Expected impact: 90% cache hit rate, <50ms response time
   - Implementation: Redis/Upstash cache with 5-minute TTL

2. **Database Materialized Views** for hourly conditions
   - Expected impact: 50% faster queries
   - Implementation: Pre-computed hourly snapshots

3. **Composite Indexes** for common query patterns
   - Expected impact: 20-30% faster queries
   - Implementation: Beach + timestamp composite indexes

### Medium Priority

4. **Image Optimization** with Next.js Image component
5. **Code Splitting** for large components
6. **Service Worker** for offline support

### Low Priority

7. **GraphQL** for flexible data fetching
8. **CDN** for static assets
9. **Edge Functions** for geo-distributed compute

---

## Resources

### Internal Documentation
- [E2E Testing Architecture](../../e2e/ARCHITECTURE.md)
- [Component Architecture](../../components/ARCHITECTURE.md)
- [Supabase Architecture](../../supabase/ARCHITECTURE.md)

### External Resources
- [Supabase Query Performance](https://supabase.com/docs/guides/database/query-performance)
- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
- [Next.js Performance](https://nextjs.org/docs/pages/building-your-application/optimizing)
- [Web Vitals](https://web.dev/vitals/)

---

## Contact

For questions about performance optimization or to report performance issues:

1. Check existing documentation in this directory
2. Review the specific fix documentation (e.g., N+1_QUERY_FIX.md)
3. Run validation tests to verify the issue
4. Document findings and proposed solutions
5. Create a PR with performance improvements

---

**Last Updated:** 2025-11-14
**Maintainer:** Engineering Team
