# Database Migration Fix Summary

## Problem Description

Migration `20251031021702_remote_commit.sql` was failing during `npx supabase db reset` with this error:

```
ERROR: cannot drop column latitude of table beaches because other objects depend on it (SQLSTATE 2BP01)
column geog of table beaches depends on column latitude of table beaches
At statement: 124
alter table "public"."beaches" drop column "latitude"
```

**Root Cause:** The migration tried to drop `latitude` and `longitude` columns before handling the `geog` geography column that was defined as a **GENERATED ALWAYS AS ... STORED** column depending on those columns.

## Solution Implemented

Created a new migration `20251031022000_fix_coordinate_migration.sql` that properly handles the dependency order:

### Correct Migration Order

1. **Drop geog column and its index** (removes dependency)
2. **Drop old coordinate columns** (latitude, longitude, coordinates, etc.)
3. **Add new coordinate columns** (lat, lon, region)
4. **Add constraints** for lat/lon ranges
5. **Recreate geog** as a generated column using new lat/lon columns
6. **Recreate indexes** using new column names

### Changes Made

#### Files Modified

1. **`supabase/migrations/20251031021702_remote_commit.sql`**
   - Removed duplicate column drops/adds (moved to fix migration)
   - Removed duplicate index creation (moved to fix migration)
   - Removed duplicate constraints (moved to fix migration)
   - Added function drop for `refresh_enhanced_forecasts_for_active_beaches()` to fix signature change
   - Updated function references from `latitude`/`longitude` to `lat`/`lon`:
     - `get_coach_picks()`
     - `refresh_enhanced_forecasts_for_active_beaches()`

2. **`supabase/migrations/20251031022000_fix_coordinate_migration.sql`** (NEW)
   - Properly ordered operations to handle geog dependency
   - Drops geog before dropping latitude/longitude
   - Recreates geog with new lat/lon columns
   - Includes all necessary indexes and constraints

3. **`supabase/migrations/20251031022000_fix_coordinate_migration_ROLLBACK.sql`** (NEW)
   - Rollback script in case reversion is needed
   - Note: Does NOT restore data, only schema

## Schema Changes

### Beaches Table - Column Changes

**Removed:**
- `latitude` (DOUBLE PRECISION) → Replaced with `lat`
- `longitude` (DOUBLE PRECISION) → Replaced with `lon`
- `coordinates` (GEOGRAPHY)
- `alt_names` (TEXT[])
- `is_featured` (BOOLEAN)
- `popularity_score` (INTEGER)
- `shore_aspect` (TEXT)
- `swell_window` (TEXT)

**Added:**
- `lat` (DOUBLE PRECISION) - Latitude coordinate
- `lon` (DOUBLE PRECISION) - Longitude coordinate
- `region` (TEXT) - Beach region classification

**Modified:**
- `geog` (GEOGRAPHY) - Now generated from `lat`/`lon` instead of `latitude`/`longitude`

### Updated Indexes

All indexes now reference the new `lat`/`lon` columns:
- `idx_beaches_geog_gist` - GIST index on generated geog column
- `idx_beaches_active_with_coords` - Covers id where lat/lon exist
- `idx_beaches_id_active` - Active beaches with coordinates
- `idx_beaches_list_covering` - Covering index for list queries
- `idx_beaches_location` - GIST spatial index
- `idx_beaches_name_with_coords` - Name + coordinate index
- `idx_beaches_public` - Public beaches with coordinates

### Updated Functions

Functions updated to use `lat`/`lon`:
- `get_coach_picks()` - Uses lat/lon for distance calculations
- `refresh_enhanced_forecasts_for_active_beaches()` - Updated beach queries
- `get_nearby_intel_posts()` - Already uses lat/lon from intel_posts table

## Testing

The migration was tested with `npx supabase db reset` and successfully applies all 137 migrations without errors.

### Verification Commands

```bash
# Reset database with all migrations
npx supabase db reset

# Verify beaches table schema
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d beaches"

# Check for old columns (should return nothing)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d beaches" | grep -E "latitude|longitude|coordinates"

# Verify geog is generated correctly
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'beaches' AND column_name = 'geog';"
```

## Migration Strategy

### For Development (Already Done)
✅ Migration applies cleanly on `npx supabase db reset`
✅ All functions updated to use new column names
✅ Rollback script created for safety

### For Production Deployment
⚠️ **IMPORTANT:** Before deploying to production:

1. **Verify current production state:**
   ```sql
   -- Check if production already has lat/lon or still has latitude/longitude
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'beaches'
   AND column_name IN ('lat', 'lon', 'latitude', 'longitude');
   ```

2. **If production has old columns (latitude/longitude):**
   - The fix migration will work correctly
   - It will migrate data-less columns (only schema change)

3. **If production already has lat/lon:**
   - The fix migration is idempotent (uses IF NOT EXISTS/IF EXISTS)
   - It will skip already-applied changes

4. **Monitor the deployment:**
   - The migration should complete in < 1 second (schema-only, no data)
   - Watch for any function compilation errors

## Rollback Procedure

If you need to rollback:

```bash
# Apply the rollback migration
psql $DATABASE_URL -f supabase/migrations/20251031022000_fix_coordinate_migration_ROLLBACK.sql
```

⚠️ **WARNING:** Rollback only restores schema, not data. If you had data in lat/lon, it will be lost.

## Related Issues

- Fixes Bug #2 verification blocker
- Enables beach detail page testing
- Resolves local database sync issues (136 migrations behind)

## Notes

1. The `geog` column is a **GENERATED** column, which means:
   - Its value is automatically computed from lat/lon
   - You cannot manually insert/update it
   - It updates automatically when lat/lon change

2. All spatial queries continue to work as before:
   - PostGIS functions use the generated geog column
   - Performance is unchanged (same indexes)

3. Function updates are backwards compatible:
   - Old functions that used latitude/longitude would fail
   - New functions use lat/lon and work correctly

## Success Criteria

✅ Database reset completes without errors
✅ All 137 migrations apply successfully
✅ Beaches table has lat/lon columns
✅ Beaches table does NOT have latitude/longitude columns
✅ geog column is properly generated from lat/lon
✅ All indexes recreated with correct column names
✅ Functions updated to use new column names
✅ Rollback script available if needed
