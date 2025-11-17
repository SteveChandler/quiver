# Quick Start: Apply beach_photos RLS Security Fix

**CRITICAL SECURITY FIX - DEPLOY IMMEDIATELY**

---

## Overview

This migration fixes a critical security vulnerability in the `beach_photos` table that allows public access to soft-deleted and unapproved photos.

**Migration File:** `20251117033703_fix_beach_photos_rls_security.sql`

---

## Pre-Deployment Checklist

Before applying this migration, verify:

- [ ] You have database access (local or production)
- [ ] You have reviewed the migration file
- [ ] You understand the security issue being fixed
- [ ] You have a backup (if applying to production)
- [ ] The following migrations have been applied:
  - [ ] `20251024000002_add_soft_delete_columns.sql` (adds `deleted_at` column)
  - [ ] `20251024000005_add_admin_rls_policies.sql` (adds `is_admin_user()` function)

---

## Deployment Instructions

### Option 1: Local Development (Supabase CLI)

```bash
# Navigate to project directory
cd /Users/stevenchandler/Desktop/quiver/quiver

# Apply the migration
supabase migration up

# Verify migration was applied
supabase migration list

# Run test suite
psql -h localhost -p 54322 -d postgres -f supabase/migrations/test_beach_photos_rls_security.sql
```

### Option 2: Production (Supabase Dashboard)

1. Log in to Supabase Dashboard
2. Navigate to Database > Migrations
3. Upload `20251117033703_fix_beach_photos_rls_security.sql`
4. Review the migration SQL
5. Click "Run migration"
6. Verify success in migration history

### Option 3: Direct SQL (Advanced)

```bash
# For local Supabase
psql -h localhost -p 54322 -d postgres -f supabase/migrations/20251117033703_fix_beach_photos_rls_security.sql

# For production (requires connection string)
psql "postgresql://[CONNECTION_STRING]" -f supabase/migrations/20251117033703_fix_beach_photos_rls_security.sql
```

---

## Post-Deployment Verification

### 1. Check Migration Status

```sql
-- Verify the migration was applied
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 5;
```

Expected: You should see version `20251117033703` in the list.

### 2. Verify Policies

```sql
-- Check policies on beach_photos table
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'beach_photos'
ORDER BY policyname;
```

Expected policies:
- `beach_photos_read_public` (FOR SELECT)
- `Admins can view all photos` (FOR SELECT)
- `Admins can update any photo` (FOR UPDATE)
- `Admins can delete any photo` (FOR DELETE)
- `Admins can insert photos` (FOR INSERT)

### 3. Run Test Suite

```bash
# Run comprehensive test suite
psql -h localhost -p 54322 -d postgres -f supabase/migrations/test_beach_photos_rls_security.sql
```

Expected: All 8 tests should pass with ✓ indicators.

### 4. Quick Security Check

```sql
-- Count visible vs hidden photos
SELECT
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND approved = true) AS public_visible,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted,
    COUNT(*) FILTER (WHERE approved = false) AS unapproved,
    COUNT(*) AS total
FROM public.beach_photos;
```

---

## Testing the Fix

### Test as Anonymous User (should be restricted)

```sql
-- Simulate anonymous access
SET ROLE anon;

-- Try to access deleted photos (should return 0)
SELECT COUNT(*) FROM public.beach_photos WHERE deleted_at IS NOT NULL;

-- Try to access unapproved photos (should return 0)
SELECT COUNT(*) FROM public.beach_photos WHERE approved = false;

-- Access active, approved photos (should work)
SELECT COUNT(*) FROM public.beach_photos WHERE deleted_at IS NULL AND approved = true;

RESET ROLE;
```

### Test Application Features

After deployment, verify these application features still work:

- [ ] Beach photo galleries display correctly
- [ ] Featured beach photos show up
- [ ] Deleted photos are not visible to regular users
- [ ] Admin users can still see all photos
- [ ] Photo upload and approval workflow works

---

## Rollback Procedure

**WARNING:** Only rollback if absolutely necessary. This will restore the security vulnerability!

```sql
BEGIN;

-- Drop secure policy
DROP POLICY IF EXISTS beach_photos_read_public ON public.beach_photos;

-- Restore insecure policy
CREATE POLICY beach_photos_read ON public.beach_photos
    FOR SELECT
    USING (true);

COMMIT;
```

After rollback:
1. Investigate why rollback was necessary
2. Fix any issues
3. Re-apply the security fix as soon as possible

---

## Troubleshooting

### Issue: Migration fails with "is_admin_user() does not exist"

**Solution:**
```sql
-- Apply the admin infrastructure migration first
psql -f supabase/migrations/20251024000005_add_admin_rls_policies.sql
```

### Issue: Migration fails with "deleted_at column does not exist"

**Solution:**
```sql
-- Apply the soft-delete migration first
psql -f supabase/migrations/20251024000002_add_soft_delete_columns.sql
```

### Issue: Admin users cannot see deleted photos

**Solution:**
```sql
-- Verify admin status
SELECT id, email, is_admin FROM public.profiles WHERE is_admin = true;

-- Verify admin policy exists
SELECT * FROM pg_policies WHERE tablename = 'beach_photos' AND policyname LIKE '%admin%';
```

### Issue: No photos visible after migration

**Possible causes:**
1. All photos are deleted (`deleted_at IS NOT NULL`)
2. All photos are unapproved (`approved = false`)
3. RLS is blocking access unexpectedly

**Diagnosis:**
```sql
-- Check photo status distribution
SELECT
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND approved = true) AS should_be_visible,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS is_deleted,
    COUNT(*) FILTER (WHERE approved = false) AS is_unapproved,
    COUNT(*) AS total
FROM public.beach_photos;
```

---

## Performance Monitoring

After deployment, monitor:

1. **Query Performance**
   ```sql
   -- Check query execution time
   EXPLAIN ANALYZE
   SELECT * FROM public.beach_photos
   WHERE deleted_at IS NULL AND approved = true
   LIMIT 100;
   ```

2. **Index Usage**
   ```sql
   -- Verify index is being used
   SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   WHERE tablename = 'beach_photos';
   ```

3. **Application Response Times**
   - Monitor API endpoint response times
   - Check for any RLS-related slowdowns
   - Verify caching is still effective

---

## Support

**Issues or Questions?**

1. Review the detailed documentation: `SECURITY_FIX_beach_photos_rls.md`
2. Check the migration file comments: `20251117033703_fix_beach_photos_rls_security.sql`
3. Run the test suite: `test_beach_photos_rls_security.sql`
4. Check Supabase logs for RLS-related errors

---

## Success Criteria

Migration is successful when:

- ✓ Migration applied without errors
- ✓ All test suite tests pass
- ✓ Public users cannot access deleted photos
- ✓ Public users cannot access unapproved photos
- ✓ Admin users can access all photos
- ✓ Application features work correctly
- ✓ No performance degradation observed

---

**DEPLOY THIS MIGRATION AS SOON AS POSSIBLE**

This is a critical security fix that prevents unauthorized access to deleted and unapproved content.
