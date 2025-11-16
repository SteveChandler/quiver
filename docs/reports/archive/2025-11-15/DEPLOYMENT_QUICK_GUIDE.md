# Beach Database Migration - Quick Deployment Guide

## 🚨 P0 - CRITICAL: Deploy Immediately

### Issue
`get_nearby_beaches()` function broken - references non-existent `location` column

### Quick Fix
```bash
# 1. Push migration to production
supabase db push

# 2. Verify it worked
# Test via Supabase dashboard SQL editor:
SELECT name, location, lat, lon
FROM get_nearby_beaches(32.7157, -117.1611, 50000, 5);

# Expected: Should return San Diego area beaches with location as "City, State"
```

### Migration File
`supabase/migrations/20251115101930_fix_get_nearby_beaches_location_field.sql`

### What It Fixes
- Changes function to construct `location` from `city + ', ' + state`
- Previously tried to use non-existent `b.location` column
- Now works correctly with current schema

---

## ⚠️ P1 - HIGH PRIORITY: Fix Admin Beach Form

### Issue
Admin beach creation form is BROKEN - schema mismatch

### Quick Fix

**Update** `/lib/validation/admin/beach-schema.ts`:

```typescript
// CHANGE THIS:
export const beachFormSchema = z.object({
  name: z.string().min(1).max(100).trim(),

  location: z.string().max(200).trim().optional().nullable(), // ❌ REMOVE
  region: z.string().min(1).max(100).trim(),                  // ❌ CHANGE

  latitude: z.number().min(-90).max(90).optional().nullable(),   // ❌ CHANGE
  longitude: z.number().min(-180).max(180).optional().nullable(), // ❌ CHANGE

  // ... rest of schema
});

// TO THIS:
export const beachFormSchema = z.object({
  name: z.string().min(1).max(100).trim(),

  city: z.string().min(1, "City is required").max(100).trim(),  // ✅ NEW
  state: z.string().min(1, "State is required").max(100).trim(), // ✅ NEW
  country: z.string().max(100).trim().default("USA"),            // ✅ UPDATE

  lat: z.number().min(-90).max(90),       // ✅ REQUIRED, not optional
  lon: z.number().min(-180).max(180),     // ✅ REQUIRED, not optional

  // ... rest of schema unchanged
});

// Also update beachUpdateSchema at bottom:
export const beachUpdateSchema = beachFormSchema
  .partial()
  .required({ name: true, city: true, state: true }); // ✅ UPDATE
```

**No changes needed to** `/actions/admin/beaches.ts` - it already uses `lat`/`lon` correctly!

### Test
1. Open admin beach form
2. Try creating a beach
3. Should submit successfully with lat/lon values

---

## 🔧 P1 - MEDIUM PRIORITY: Update Code References

### Files Using Old Column Names

**1. Update** `/app/api/cron/enhanced-forecast-sync/route.ts`:
```typescript
// OLD
beach.latitude >= 32.0 && beach.latitude <= 35.0
beach.longitude >= -120.0 && beach.longitude <= -117.0

// NEW
beach.lat >= 32.0 && beach.lat <= 35.0
beach.lon >= -120.0 && beach.lon <= -117.0
```

**2. Update** `/scripts/query-missing-city-beaches.ts`:
```typescript
// OLD
beach.latitude, beach.longitude

// NEW
beach.lat, beach.lon
```

**3. Update** `/e2e/recommendations-performance.spec.ts`:
```typescript
// OLD
if (beach.latitude && beach.longitude) {
  expect(typeof beach.latitude).toBe("number");
  expect(typeof beach.longitude).toBe("number");
}

// NEW
if (beach.lat && beach.lon) {
  expect(typeof beach.lat).toBe("number");
  expect(typeof beach.lon).toBe("number");
}
```

**4. Archive** `/scripts/archive/calculate-beach-geometry.ts`:
- This is in /archive folder, probably not used
- Update if needed, or leave as historical reference

### After Updates
```bash
# Regenerate types
yarn db:types

# Run tests
yarn test:unit
yarn test:e2e

# Check TypeScript
yarn typecheck
```

---

## 📊 P2 - OPTIONAL: Add Coordinate Constraint

### Safe to Add (100% data quality)
All 81 beaches have coordinates - safe to enforce with constraint.

### Migration (create new file)
`supabase/migrations/20251115120000_add_coordinate_constraint.sql`:

```sql
BEGIN;

-- Add constraint to prevent NULL coordinates
ALTER TABLE beaches
ADD CONSTRAINT beaches_coords_not_null
CHECK (lat IS NOT NULL AND lon IS NOT NULL);

-- Add helpful comment
COMMENT ON CONSTRAINT beaches_coords_not_null ON beaches IS
'Ensures all beaches have valid coordinates. Added after 100% data quality audit.';

COMMIT;
```

### Apply
```bash
supabase db push
```

---

## 🧹 Cleanup: Remove Duplicate Columns from beaches_history

### Migration (create new file)
`supabase/migrations/20251115130000_cleanup_beaches_history.sql`:

```sql
BEGIN;

-- Drop duplicate coordinate columns
ALTER TABLE beaches_history
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude;

-- Add comments to remaining columns
COMMENT ON COLUMN beaches_history.lat IS 'Latitude in decimal degrees (-90 to 90)';
COMMENT ON COLUMN beaches_history.lon IS 'Longitude in decimal degrees (-180 to 180)';

COMMIT;
```

### Apply
```bash
supabase db push
yarn db:types  # Regenerate types
```

---

## ✅ Deployment Order

1. **IMMEDIATE**: Deploy P0 migration (get_nearby_beaches fix)
2. **ASAP**: Fix admin beach form schema
3. **MEDIUM**: Update code to use lat/lon
4. **LOW**: Add coordinate constraint
5. **LOW**: Clean up beaches_history duplicates

## 🧪 Testing Checklist

After each deployment:

- [ ] Check Supabase logs for errors
- [ ] Test beach search on frontend
- [ ] Test admin beach creation
- [ ] Run E2E tests: `yarn test:e2e`
- [ ] Check Sentry for new errors
- [ ] Verify TypeScript builds: `yarn build`

## 📝 Documentation

After all deployments:

- [ ] Update CHANGELOG.md with completion
- [ ] Mark migrations as deployed in tracking
- [ ] Document any issues encountered
- [ ] Update team on deployment status

---

**Quick Reference:**
- **P0 Migration**: `20251115101930_fix_get_nearby_beaches_location_field.sql`
- **Rollback**: `20251115101930_rollback_get_nearby_beaches_location_field.sql`
- **Verification**: `20251115101930_verify_data_quality.sql`
- **Full Report**: `BEACH_DATABASE_MIGRATION_REPORT.md`
