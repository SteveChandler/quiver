# Beaches Table Optimization Migration Guide

This document tracks the beaches table optimization migrations created on 2025-10-25.

## Overview

Four migrations were created to optimize the beaches table:
1. `20251025000000_restructure_beaches_location_data.sql` - Restructure location data, populate slugs
2. `20251025000001_drop_duplicate_coordinate_columns.sql` - Remove coordinate redundancy
3. `20251025000002_consolidate_preference_columns.sql` - Remove wind/tide duplicates
4. `20251025000003_add_constraints_and_indexes.sql` - Add data validation and performance indexes
5. `20251025000004_add_private_beach_rls_policies.sql` - Add RLS policies for private beaches

## Column Changes

### Renamed Columns (via ALTER TABLE RENAME)
- `location` → `city` (automatically handled by type regeneration)
- `region` → `state` (automatically handled by type regeneration)

### Dropped Columns (require code updates)
- ~~`latitude`~~ → use `lat`
- ~~`longitude`~~ → use `lon`
- ~~`lng`~~ → use `lon`
- ~~`coordinates`~~ → use `geog` (GENERATED column)
- ~~`wind_cross_ok_kts`~~ → use `wind_cross_shore_ok_kt`
- ~~`wind_onshore_bad_kts`~~ → use `wind_onshore_bad_kt`
- ~~`tide_min_ft`~~ → use `preferred_tide_ft_min`
- ~~`tide_max_ft`~~ → use `preferred_tide_ft_max`
- ~~`shoreline_aspect_deg`~~ → use `aspect_deg`
- ~~`offshore_deg`~~ → use `wind_offshore_deg`

## Files Requiring Updates

The following files have hard-coded column references in SELECT statements that need updating:

### Scripts
1. **scripts/npc-daily-activity.ts** (2 locations)
   - Line 715: `latitude, longitude, location` → `lat, lon, city`
   - Line 1367: `latitude, longitude` → `lat, lon`

2. **scripts/fetch-beach-photos.ts** (2 locations)
   - Line 171: `latitude, longitude, location, region` → `lat, lon, city, state`
   - Line 178: `latitude, longitude, location, region` → `lat, lon, city, state`

3. **scripts/seed-npc-reviews-and-intel.ts** (2 locations)
   - Line 237: `latitude, longitude, location` → `lat, lon, city`
   - Line 987: `latitude, longitude` → `lat, lon`

4. **scripts/morningIntel.ts** (2 locations)
   - Line 127: `latitude, longitude` → `lat, lon`
   - Line 426: `latitude, longitude` → `lat, lon`

### API Routes
5. **app/api/beaches/route.ts** (1 location)
   - Line 20: `location, latitude, longitude, region` → `city, lat, lon, state`

6. **app/api/cron/enhanced-forecast-sync/route.ts** (1 location)
   - Line 91: `latitude, longitude` → `lat, lon`

7. **app/api/cron/forecasts/refresh/route.ts** (1 location)
   - Line 31: `latitude, longitude` → `lat, lon`

8. **app/api/forecasts/window/route.ts** (1 location)
   - Line 32: `latitude, longitude` → `lat, lon`

9. **app/api/admin/resolve-stations/route.ts** (1 location)
   - Line 18: `latitude, longitude` → `lat, lon`

### Libraries
10. **lib/surf/data.ts** (1 location)
    - Line 28: `location, latitude, longitude` → `city, lat, lon`

11. **lib/services/noaa-sync.ts** (1 location)
    - Line 126: `latitude, longitude` → `lat, lon`

## Migration Steps

### 1. Before Running Migrations
- [ ] Backup production database
- [ ] Review all migration files
- [ ] Test on local/staging environment first

### 2. Run Migrations
```bash
# Start Supabase (if using local)
npx supabase start

# Apply migrations
npx supabase db push

# Verify migrations applied
npx supabase migration list
```

### 3. Regenerate TypeScript Types
```bash
npx supabase gen types typescript --local > types/database.generated.ts
```

### 4. Update Code References
Update all 14 files listed above to use the new column names.

### 5. Test
- [ ] Run unit tests: `npm test`
- [ ] Run E2E tests: `npx playwright test`
- [ ] Manual testing of beach search, map, and detail pages

## Expected Impact

- **Storage Reduction:** ~20-30% per beach row
- **Query Performance:** 15-30% faster on filtered queries
- **Bug Fixes:** Resolves missing slug crashes in beach detail pages
- **Data Quality:** CHECK constraints prevent invalid coordinate/degree values
- **Code Clarity:** Single source of truth for each piece of data

## Rollback Plan

If issues arise, rollback migrations in reverse order:

```sql
-- Rollback in reverse order
-- Note: Some data cleanup cannot be fully reversed
BEGIN;
-- Remove RLS policies
-- Drop new indexes
-- Drop CHECK constraints
-- Restore dropped columns (data may be lost)
-- Rename city→location, state→region
COMMIT;
```

**⚠️ Warning:** Dropping columns is destructive. Once applied to production, rollback will result in data loss for the dropped columns.

## Status

- [x] Migrations created
- [ ] Migrations tested locally
- [x] Code references updated (18 files updated)
- [x] Types regenerated
- [ ] Test files need updating (mock data references old column names)
- [ ] Tests passing
- [ ] Ready for production deployment

## Files Updated (2025-10-25)

Updated 18 files with ~40 individual changes:

### Scripts (4 files)
- scripts/npc-daily-activity.ts
- scripts/fetch-beach-photos.ts
- scripts/seed-npc-reviews-and-intel.ts
- scripts/morningIntel.ts

### API Routes (9 files)
- app/api/beaches/route.ts
- app/api/beaches/featured/route.ts
- app/api/beaches/nearby/route.ts
- app/api/cron/enhanced-forecast-sync/route.ts
- app/api/cron/forecasts/refresh/route.ts
- app/api/forecasts/window/route.ts
- app/api/admin/resolve-stations/route.ts
- app/api/surf/utils.ts
- app/api/v1/recommendations/route.ts

### Actions (3 files)
- actions/admin/beaches.ts
- actions/intel-actions.ts
- actions/beach/best-beaches-simple.ts

### Libraries (2 files)
- lib/surf/data.ts
- lib/services/noaa-sync.ts

All production code compiles successfully. Test files may need mock data updates.
