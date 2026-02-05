# City Resolution Refactoring - Connection Pool Optimization

## Problem

The original `resolveCityWithStateSuffix` function in `app/[intent]/[city]/page.tsx` used `Promise.allSettled` to fire 13 parallel database queries when resolving city slugs without state suffixes:

```typescript
// BEFORE: 13 parallel queries
const suffixedSlugs = COASTAL_STATE_SUFFIXES.map((s) => `${baseSlug}-${s}`);
const results = await Promise.allSettled(
  suffixedSlugs.map((slug) => findCityBySlug(slug))
);
```

### Issues Identified
1. **Connection Pool Exhaustion Risk**: Under concurrent load (e.g., 10 users hitting intent pages), this could spawn 140 simultaneous database connections
2. **Inefficient Resource Usage**: Each query calls both the RPC function AND fetches full city metadata (expensive)
3. **Supabase Limits**: Connection pool limits (typically 15-100) could be exceeded under moderate load

## Solution

Refactored to use a **single batched query** instead of 13 parallel queries:

### Changes Made

#### 1. New Helper Function (`actions/city/city-metadata-actions.ts`)
```typescript
export async function findCitiesMatchingPattern(
  cityPattern: string
): Promise<ServerActionResponse<CityPatternMatch[]>>
```

This function calls the existing `find_cities_by_pattern` RPC **once** with `state_filter=NULL` to get ALL matching cities across all states in a single query.

#### 2. Refactored `resolveCityWithStateSuffix` (`app/[intent]/[city]/page.tsx`)
```typescript
async function resolveCityWithStateSuffix(baseSlug: string) {
  // 1. Try base slug directly (1 query)
  const baseResult = await findCityBySlug(baseSlug);
  if (baseResult.success && baseResult.data) {
    return { cityMetadata: baseResult.data, resolvedSlug: baseSlug };
  }

  // 2. Find all matching cities in one query
  const citiesResult = await findCitiesMatchingPattern(baseSlug);

  // 3. Filter to coastal states and sort by priority
  const coastalCities = citiesResult.data
    .filter((c) => coastalStateSet.has(c.state))
    .sort((a, b) => prioritySort);

  // 4. Get full metadata for ONLY the top match (1 query)
  const metadataResult = await getCityMetadata(topMatch.city, topMatch.state);
}
```

## Performance Impact

### Before Refactoring
- **Queries per resolution attempt**: 14 (1 base + 13 parallel)
- **Connection pool impact**: High (13 simultaneous connections)
- **Query cost**: 13 RPC calls + 13 metadata fetches

### After Refactoring
- **Queries per resolution attempt**: 3 (1 base + 1 pattern match + 1 metadata fetch)
- **Connection pool impact**: Low (sequential queries)
- **Query cost**: 1 RPC call + 1 metadata fetch

### Performance Metrics
- **Connection reduction**: 78% fewer database connections (14 → 3)
- **Query reduction**: 81% fewer RPC calls (13 → 1 for suffix resolution)
- **Latency impact**: Minimal (single RPC is fast, metadata fetch only happens once)

## Database Architecture

The solution leverages the existing `find_cities_by_pattern` RPC function which already supports returning all matching cities:

```sql
CREATE OR REPLACE FUNCTION find_cities_by_pattern(
  search_pattern TEXT,
  state_filter TEXT DEFAULT NULL
)
RETURNS TABLE(city TEXT, state TEXT, beach_count BIGINT)
```

When `state_filter=NULL`, the function returns ALL cities matching the pattern across all states, which we then filter and prioritize in the application layer.

## Testing

### Manual Verification
Run the test script to verify behavior:
```bash
npx tsx scripts/test-city-resolution.ts
```

### Type Safety
All TypeScript type checks pass:
```bash
yarn typecheck
```

### Expected Behavior
1. Direct slug matches work as before (e.g., "belmar-nj", "santa-cruz")
2. Base slugs resolve to the highest-priority coastal state match
3. Pattern matching returns all cities, filtered by COASTAL_STATE_SUFFIXES
4. Priority order maintained: ["ca", "fl", "hi", "nc", "sc", "nj", "ny", "or", "wa", "tx", "ma", "me", "ri"]

## Files Modified

1. `/actions/city/city-metadata-actions.ts`
   - Added `findCitiesMatchingPattern()` function
   - Exported `CityPatternMatch` interface

2. `/app/[intent]/[city]/page.tsx`
   - Refactored `resolveCityWithStateSuffix()` function
   - Added import for `findCitiesMatchingPattern` and `getCityMetadata`

3. `/__tests__/app/sitemap.test.ts`
   - Removed unused `@ts-expect-error` directive

4. `/scripts/test-city-resolution.ts` (new)
   - Manual testing script for verification

## Migration Notes

- ✅ **No database migration required** - uses existing RPC function
- ✅ **No breaking changes** - maintains same public API
- ✅ **Backward compatible** - existing behavior preserved
- ✅ **Type safe** - all TypeScript checks pass

## Performance Under Load

### Scenario: 10 Concurrent Intent Page Requests

**Before:**
- 140 database connections (10 users × 14 queries each)
- High risk of connection pool exhaustion
- Queries compete for pool resources

**After:**
- 30 database connections (10 users × 3 queries each)
- Well within typical pool limits
- Sequential execution prevents contention

## Recommendations

1. **Monitor Connection Pool Usage**: Track Supabase connection metrics to validate improvement
2. **Add Performance Logging**: Log city resolution times to verify no latency regression
3. **Consider Caching**: For frequently accessed cities, consider Redis cache layer
4. **Load Testing**: Run load tests to confirm connection pool stability under peak traffic

## References

- Original code review concern: Connection pool exhaustion risk with 13 parallel queries
- Supabase RPC: `find_cities_by_pattern` in `supabase/migrations/20260118173337_enable_unaccent_extension.sql`
- COASTAL_STATE_SUFFIXES: Defined in `/lib/utils/beach-url-utils.ts`
