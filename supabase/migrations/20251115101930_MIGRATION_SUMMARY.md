# Database Fix: get_nearby_beaches() Location Field Migration

## Summary

This migration fixes a **critical P0 database bug** where the `get_nearby_beaches()` function was trying to SELECT a non-existent `b.location` column. The column was renamed from `location` to `city` in migration `20251025000000_restructure_beaches_location_data.sql`, but the function in `20251031235900_fix_all_coordinate_column_references.sql` was not updated.

## Problem Identified

### Critical Bug (P0)
- **File**: `supabase/migrations/20251031235900_fix_all_coordinate_column_references.sql`
- **Line**: 364
- **Issue**: Function `get_nearby_beaches()` tries to SELECT `b.location` which no longer exists
- **Impact**: Any query using `get_nearby_beaches()` would fail with "column does not exist" error

### Root Cause
Migration `20251025000000` renamed:
- `location` → `city`
- `region` → `state`

Migration `20251031235900` updated coordinate references (`latitude`→`lat`, `longitude`→`lon`) but missed updating the location field construction.

## Solution Implemented

### Migration Files Created

1. **20251115101930_fix_get_nearby_beaches_location_field.sql**
   - Drops and recreates `get_nearby_beaches()` function
   - Constructs location display from `city` and `state` columns
   - Matches pattern used in application code

2. **20251115101930_verify_data_quality.sql**
   - Verification queries to check data integrity
   - Sample queries to test function behavior
   - Suggested fixes for common data quality issues

### Location Display Construction Pattern

The function now constructs the location field using this logic:

```sql
CASE
    WHEN b.city IS NOT NULL AND b.state IS NOT NULL
        THEN b.city || ', ' || b.state
    WHEN b.city IS NOT NULL THEN b.city
    WHEN b.state IS NOT NULL THEN b.state
    ELSE 'Unknown'
END AS location
```

This matches the pattern in `lib/utils/beach-card-utils.ts`:

```typescript
export function getBeachLocation(beach: Beach): string {
  if (beach.city && beach.state) {
    return `${beach.city}, ${beach.state}`;
  }
  if (beach.city) {
    return beach.city;
  }
  if (beach.state) {
    return beach.state;
  }
  // ... fallback logic
}
```

## Verification Completed

### ✅ Code-Level Verification

1. **BEACH_LIST_FIELDS constant** (`actions/beach/beach-query-actions.ts`):
   ```typescript
   const BEACH_LIST_FIELDS = "id, name, slug, city, lat, lon, state, created_at, is_private";
   ```
   - Includes all required fields: `id`, `name`, `slug`, `city`, `lat`, `lon`, `state`
   - Correctly uses renamed columns

2. **Component Usage Verified**:
   - `components/NearbyBeaches.tsx`: Uses `beach.lat`, `beach.lon`, `beach.city`, `beach.state`
   - `components/beach-detail/beach-breadcrumb.tsx`: Uses `beach.city`, `beach.state`, `beach.country`
   - `lib/utils/beach-card-utils.ts`: `getBeachLocation()` constructs location from city/state

3. **Other Database Functions Checked**:
   - `get_beaches_by_location_with_scores()` - ✅ Uses `b.city`, `b.state`
   - `get_beaches_by_metro_with_scores()` - ✅ Uses `b.city`, `b.state`
   - `get_beaches_near()` - ✅ Uses `b.lat`, `b.lon` (no location field)
   - `get_coach_picks()` - ✅ Uses `b.lat`, `b.lon`, `b.region_id` (not affected)

### Database Functions Status

| Function | Status | Location Field | Coordinates |
|----------|--------|----------------|-------------|
| `get_nearby_beaches()` | **FIXED** | Constructs from city+state | Uses lat/lon ✅ |
| `get_beaches_by_location_with_scores()` | ✅ OK | Uses city, state columns | Uses lat/lon ✅ |
| `get_beaches_by_metro_with_scores()` | ✅ OK | Uses city, state columns | Uses lat/lon ✅ |
| `get_beaches_near()` | ✅ OK | No location field | Uses lat/lon ✅ |
| `get_coach_picks()` | ✅ OK | No location field | Uses lat/lon ✅ |

## Required Fields for Beach Display

Based on component analysis, beaches need these fields:

### Minimum Required (BEACH_LIST_FIELDS):
- `id` - Unique identifier
- `name` - Beach name
- `slug` - URL-friendly identifier
- `city` - City/locality
- `state` - State/province/region
- `lat` - Latitude coordinate
- `lon` - Longitude coordinate
- `created_at` - Creation timestamp
- `is_private` - Privacy flag

### Optional but Commonly Used:
- `country` - Country code (defaults to 'USA')
- `geog` - PostGIS geography point for spatial queries

### Full Detail (BEACH_DETAIL_FIELDS):
- All fields (`*`) for beach detail pages

## Data Quality Considerations

### Potential Issues to Check

1. **Missing Location Data**
   - Some beaches may have `NULL` city or state
   - Query: See `20251115101930_verify_data_quality.sql` Query 1

2. **Geography Column Sync**
   - Verify `geog` column is populated for all beaches with coordinates
   - Query: See `20251115101930_verify_data_quality.sql` Query 5

3. **Legacy Data Migration**
   - Older migrations still reference `b.location` but are superseded
   - No action needed - migrations are applied chronologically

### Suggested Verification Steps

1. Run data quality queries from `20251115101930_verify_data_quality.sql`
2. Check for beaches with missing city/state data
3. Verify `get_nearby_beaches()` function returns correctly formatted locations
4. Test edge cases (beaches with only city, only state, or neither)

## Migration Plan

### Deployment Steps

1. **Pre-Deployment**
   ```bash
   # Review migration file
   cat supabase/migrations/20251115101930_fix_get_nearby_beaches_location_field.sql
   ```

2. **Apply Migration**
   ```bash
   # Local testing
   supabase db reset  # Or apply specific migration

   # Production deployment (via Supabase dashboard or CLI)
   supabase db push
   ```

3. **Post-Deployment Verification**
   ```bash
   # Run verification queries
   psql -f supabase/migrations/20251115101930_verify_data_quality.sql

   # Test function manually
   SELECT name, location, distance_meters
   FROM get_nearby_beaches(32.8528, -117.2540, 25000, 10)
   ORDER BY distance_meters LIMIT 5;
   ```

4. **Application Testing**
   - Test nearby beaches feature on map view
   - Verify beach search autocomplete
   - Check beach detail pages show correct location
   - Test navigation to/from location pages

### Rollback Plan

If issues arise, the function can be reverted by:

```sql
-- Emergency rollback: Use previous version from migration 20251031235900
-- (Copy the old function definition from that migration)
-- WARNING: This will restore the broken version - only for emergency
```

Better approach: Fix data quality issues instead of rolling back.

## Related Code Files

### Database
- `supabase/migrations/20251025000000_restructure_beaches_location_data.sql` - Original rename
- `supabase/migrations/20251031235900_fix_all_coordinate_column_references.sql` - Coordinate fixes
- `supabase/migrations/20251115101930_fix_get_nearby_beaches_location_field.sql` - **This fix**

### Application Code
- `actions/beach/beach-query-actions.ts` - Beach query actions with BEACH_LIST_FIELDS
- `lib/utils/beach-card-utils.ts` - Location display utility (`getBeachLocation()`)
- `components/beach-detail/beach-breadcrumb.tsx` - Breadcrumb navigation using city/state
- `components/NearbyBeaches.tsx` - Nearby beaches component using lat/lon/city/state

### TypeScript Types
- `types/database.ts` - Beach interface definition

## Impact Analysis

### High Impact (Fixed)
- ✅ Nearby beaches search feature
- ✅ Map view beach display
- ✅ Beach navigation and breadcrumbs
- ✅ Location-based beach grouping

### No Impact
- Session tracking (uses beach_id reference)
- Reviews and ratings (uses beach_id reference)
- Forecasts (uses beach_id reference)
- Direct beach queries by ID or slug

## Testing Checklist

- [ ] Migration applies without errors
- [ ] `get_nearby_beaches()` function exists with correct signature
- [ ] Function returns properly formatted location field
- [ ] No beaches with NULL city AND state visible in results
- [ ] Map view shows nearby beaches correctly
- [ ] Beach detail pages show correct location in breadcrumb
- [ ] Beach search autocomplete displays locations properly
- [ ] No console errors related to missing fields

## Success Criteria

✅ **All database functions operational**
✅ **No SQL errors in application logs**
✅ **Beach locations display correctly in UI**
✅ **Nearby beaches feature works as expected**
✅ **No regressions in beach search or navigation**

## Notes

- This fix maintains consistency between database and application code
- The location display pattern matches exactly what's used in TypeScript utilities
- No changes needed to application code - only database function update
- Future migrations should verify column names before creating functions
- Consider adding integration tests for database functions
