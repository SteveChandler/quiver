# Deployment Checklist - Beach Database Fix

## Pre-Deployment ✅

- [ ] **Read** `BEACH_DATABASE_FIX_SUMMARY.md` for complete overview
- [ ] **Review** migration file: `20251115101930_fix_get_nearby_beaches_location_field.sql`
- [ ] **Understand** the fix: Constructs location from city + state (not from non-existent location column)

## Local Testing ✅

- [ ] **Apply migration locally**:
  ```bash
  cd /Users/stevenchandler/Desktop/quiver/quiver
  supabase db reset
  ```

- [ ] **Verify function exists**:
  ```sql
  SELECT proname, pg_get_function_identity_arguments(oid)
  FROM pg_proc
  WHERE proname = 'get_nearby_beaches';
  ```
  Expected: `get_nearby_beaches(input_lat double precision, input_lng double precision, max_distance_meters integer, limit_count integer)`

- [ ] **Test function with sample coordinates**:
  ```sql
  -- La Jolla Shores area (San Diego)
  SELECT name, location, ROUND(distance_meters::numeric, 0) AS dist_m
  FROM get_nearby_beaches(32.8528, -117.2540, 25000, 5)
  ORDER BY dist_m;
  ```
  Expected: Returns beaches with properly formatted locations like "La Jolla, CA"

- [ ] **Run data quality queries**:
  ```bash
  psql -f supabase/migrations/20251115101930_verify_data_quality.sql > data_quality_report.txt
  ```

- [ ] **Check for beaches with missing location data**:
  ```sql
  SELECT COUNT(*) AS missing_location
  FROM beaches
  WHERE (city IS NULL OR state IS NULL)
    AND lat IS NOT NULL
    AND lon IS NOT NULL;
  ```

## Production Deployment ✅

### Option A: Supabase CLI (Recommended)

- [ ] **Push migration to production**:
  ```bash
  supabase db push
  ```

- [ ] **Confirm migration applied**:
  Check Supabase dashboard → Database → Migrations
  Look for: `20251115101930_fix_get_nearby_beaches_location_field`

### Option B: Supabase Dashboard

- [ ] Navigate to **Database → Migrations** in Supabase dashboard
- [ ] Click **New migration**
- [ ] Upload `20251115101930_fix_get_nearby_beaches_location_field.sql`
- [ ] Review SQL preview
- [ ] Click **Run migration**
- [ ] Wait for "Migration successful" message

## Post-Deployment Verification ✅

### Database Checks

- [ ] **Verify function signature**:
  ```sql
  SELECT proname, prokind, provolatile
  FROM pg_proc
  WHERE proname = 'get_nearby_beaches';
  ```
  Expected: `proname=get_nearby_beaches, prokind=f, provolatile=s`

- [ ] **Test function in production**:
  ```sql
  SELECT name, location, distance_meters
  FROM get_nearby_beaches(32.7157, -117.1611, 50000, 10)
  ORDER BY distance_meters
  LIMIT 5;
  ```

- [ ] **Check for SQL errors in logs**:
  Supabase Dashboard → Logs → Database
  Look for: No errors related to "column location does not exist"

### Application Checks

- [ ] **Test map view**:
  - Navigate to `/map`
  - Search for a location
  - Verify nearby beaches display correctly
  - Check beach markers show proper location

- [ ] **Test beach search**:
  - Use beach search autocomplete
  - Verify results show "City, State" format
  - Click a result to navigate to beach detail

- [ ] **Test beach detail page**:
  - Navigate to any beach (e.g., `/beach/la-jolla-shores`)
  - Verify breadcrumb shows correct location
  - Check "Nearby Beaches" section displays
  - Verify location format is "City, State"

- [ ] **Test navigation**:
  - Click location link in breadcrumb
  - Verify navigation to location page (e.g., `/location/la-jolla-ca`)
  - Check "Back to Map" link works

- [ ] **Check browser console**:
  - Open DevTools → Console
  - Look for: No errors about missing fields
  - Look for: No database query errors

### Mobile App Testing (if applicable)

- [ ] **Test on iOS**:
  - Beach search works
  - Map view shows beaches
  - Beach detail displays correctly

- [ ] **Test on Android**:
  - Beach search works
  - Map view shows beaches
  - Beach detail displays correctly

## Data Quality Follow-Up ✅

- [ ] **Review data quality report** from local testing
- [ ] **Identify beaches with missing city/state data** (if any)
- [ ] **Decide on fix strategy** for incomplete data:
  - Option 1: Accept "Unknown" display for incomplete data
  - Option 2: Manually update beaches with missing location
  - Option 3: Use geocoding API to populate missing data

- [ ] **If fixing incomplete data**, use suggested queries from:
  `20251115101930_verify_data_quality.sql` (bottom section)

## Monitoring (First 24 Hours) ✅

- [ ] **Check error rates** in Sentry/error monitoring
- [ ] **Review database logs** for query errors
- [ ] **Monitor API response times** for beach-related endpoints
- [ ] **Check user reports** for any beach-related issues
- [ ] **Verify analytics** show normal beach view traffic

## Rollback Procedure (If Needed) ⚠️

**WARNING**: Only use if critical production issue occurs

- [ ] **Identify the issue**: Confirm it's migration-related
- [ ] **Check if data fix is better**: Most issues can be fixed without rollback
- [ ] **If rollback is absolutely necessary**:
  ```bash
  # DO NOT USE unless absolutely required
  # This restores BROKEN state - only for emergency
  psql -f supabase/migrations/20251115101930_rollback_get_nearby_beaches_location_field.sql
  ```
- [ ] **Document rollback reason** for future reference
- [ ] **Plan alternative fix** before re-deploying

## Success Indicators ✅

**Migration is successful when**:
- [x] Function `get_nearby_beaches()` exists with correct signature
- [x] Function returns location in "City, State" format
- [x] No SQL errors in database logs
- [x] Map view displays nearby beaches correctly
- [x] Beach search autocomplete works
- [x] Beach detail pages show proper location
- [x] Navigation to/from location pages works
- [x] No console errors in browser
- [x] No increase in error rates
- [x] User experience unchanged or improved

## Completion Sign-Off

### Local Testing
- **Tested by**: _________________
- **Date**: _________________
- **Result**: ☐ Pass ☐ Fail
- **Notes**: _________________

### Production Deployment
- **Deployed by**: _________________
- **Date/Time**: _________________
- **Migration ID**: 20251115101930
- **Result**: ☐ Success ☐ Failed (rolled back)
- **Notes**: _________________

### Post-Deployment Verification
- **Verified by**: _________________
- **Date/Time**: _________________
- **Database**: ☐ OK ☐ Issues found
- **Application**: ☐ OK ☐ Issues found
- **Notes**: _________________

## Additional Resources

- **Complete Summary**: `/Users/stevenchandler/Desktop/quiver/quiver/BEACH_DATABASE_FIX_SUMMARY.md`
- **Migration File**: `supabase/migrations/20251115101930_fix_get_nearby_beaches_location_field.sql`
- **Verification Queries**: `supabase/migrations/20251115101930_verify_data_quality.sql`
- **Technical Details**: `supabase/migrations/20251115101930_MIGRATION_SUMMARY.md`
- **Rollback Script**: `supabase/migrations/20251115101930_rollback_get_nearby_beaches_location_field.sql`

---

**Status**: Ready for Deployment
**Risk**: Low (fixes existing P0 bug)
**Impact**: High (enables nearby beaches feature)
**Rollback**: Available (not recommended)
