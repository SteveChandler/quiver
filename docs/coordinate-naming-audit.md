# Database Function Coordinate Naming Audit

**Date**: 2025-10-29
**Purpose**: Ensure all database functions that return beach data use consistent coordinate property names

## Context

- **Database schema**: Uses `latitude`/`longitude` columns (DOUBLE PRECISION)
- **TypeScript types**: Expect `lat`/`lon` properties (number | null)
- **Solution**: Database functions must alias columns as `latitude as lat, longitude as lon`

## Audit Results

### ✅ Functions with CORRECT Coordinate Naming

#### 1. `get_beaches_near`
**File**: `20250820133000_create_get_beaches_near.sql`

```sql
RETURNS TABLE (
  lat double precision,  -- ✅ Correct
  lon double precision,  -- ✅ Correct
  ...
)
...
SELECT
  b.latitude AS lat,  -- ✅ Proper aliasing
  b.longitude AS lon, -- ✅ Proper aliasing
```

**Status**: ✅ No changes needed

---

#### 2. `get_beaches_by_location_with_scores`
**File**: `20251029172934_create_location_ranking_functions.sql`

```sql
RETURNS TABLE (
  lat DOUBLE PRECISION,  -- ✅ Correct (fixed)
  lon DOUBLE PRECISION,  -- ✅ Correct (fixed)
  ...
)
...
SELECT
  b.latitude as lat,  -- ✅ Proper aliasing (fixed)
  b.longitude as lon, -- ✅ Proper aliasing (fixed)
```

**Status**: ✅ Fixed in this PR

---

### ✅ Functions Previously Needing Fixes (Now FIXED)

#### 1. `get_nearby_beaches` ✅ **FIXED**
**Original File**: `20250904000002_add_beaches_geog_and_update_get_nearby_beaches.sql`
**Fix Migration**: `20251029180000_update_get_nearby_beaches_coordinates.sql`
**Fixed Date**: 2025-10-29

```sql
-- ✅ NOW CORRECT:
RETURNS TABLE(
  lat DOUBLE PRECISION,     -- ✅ Fixed - was 'latitude'
  lon DOUBLE PRECISION,     -- ✅ Fixed - was 'longitude'
  ...
)
...
SELECT
  b.latitude as lat,        -- ✅ Added proper aliasing
  b.longitude as lon,       -- ✅ Added proper aliasing
```

**Status**: ✅ **FIXED in migration 20251029180000**

**Changes Made**:
- Updated RETURNS TABLE to use `lat`/`lon`
- Added proper column aliases in SELECT statement
- Changed parameters to `input_lat`/`input_lng` to avoid naming conflicts
- Updated all 6 consumers in codebase to use new parameter names
- Regenerated TypeScript types

**Files Modified**:
- Migration: [supabase/migrations/20251029180000_update_get_nearby_beaches_coordinates.sql](../supabase/migrations/20251029180000_update_get_nearby_beaches_coordinates.sql)
- [actions/intel-actions.ts](../actions/intel-actions.ts)
- [actions/beach/beach-location-actions.ts](../actions/beach/beach-location-actions.ts)
- [lib/surf/data.ts](../lib/surf/data.ts)
- [actions/beach/best-beaches-simple.ts](../actions/beach/best-beaches-simple.ts)
- [app/api/v1/recommendations/route.ts](../app/api/v1/recommendations/route.ts)
- [__tests__/actions/beach/beach-location-actions.test.ts](../__tests__/actions/beach/beach-location-actions.test.ts)
- [components/location/location-map.tsx](../components/location/location-map.tsx) - Removed unnecessary transformation
- [types/location.ts](../types/location.ts) - Updated comments and types

---

## Summary

### ✅ All Functions Now Compliant

As of **2025-10-29**, all database functions that return beach coordinates now use the standardized `lat`/`lon` naming convention with proper column aliasing.

**Audit Status**:
- ✅ `get_beaches_near` - Compliant
- ✅ `get_beaches_by_location_with_scores` - Compliant
- ✅ `get_nearby_beaches` - **NOW COMPLIANT** (fixed 2025-10-29)

### No Outstanding Issues

There are currently **no functions** requiring coordinate naming fixes.
   ```

2. **Update any TypeScript code that calls `get_nearby_beaches`**
   - Search for usages: `grep -r "get_nearby_beaches" --include="*.ts" --include="*.tsx"`
   - Check if code expects `latitude`/`longitude` properties
   - Update to use `lat`/`lon` after migration

### Medium Priority

3. **Audit other spatial functions**
   - Check `get_coach_picks` and `strict_radius_get_coach_picks`
   - Verify any custom RPC functions

4. **Add integration tests**
   - Test that functions return `lat`/`lon` (not `latitude`/`longitude`)
   - Prevent regression

### Low Priority

5. **Add linting rule**
   - Catch direct references to `latitude`/`longitude` in function outputs
   - Enforce aliasing pattern

---

## Testing Checklist

After fixing `get_nearby_beaches`:

- [ ] Verify function returns `lat`/`lon` properties
- [ ] Test that InteractiveMap displays markers correctly
- [ ] Check that no TypeScript errors occur
- [ ] Run e2e tests for map features
- [ ] Verify backward compatibility (if any external consumers)

---

## Notes

- The database will continue to store `latitude`/`longitude` columns
- Functions must alias these to `lat`/`lon` for TypeScript consistency
- Frontend components should still transform defensively as a best practice
- This pattern is already used successfully in `get_beaches_near`
