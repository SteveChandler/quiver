# Security Fix: beach_photos RLS Policy

**Migration:** `20251117033703_fix_beach_photos_rls_security.sql`
**Date:** 2025-11-17
**Severity:** CRITICAL
**Status:** Fixed

---

## Executive Summary

A critical security vulnerability was discovered in the `beach_photos` table RLS policy that allowed public access to soft-deleted and unapproved photos. This migration fixes the vulnerability by implementing proper access controls.

---

## Vulnerability Details

### The Problem

The original RLS policy on `public.beach_photos` was overly permissive:

```sql
CREATE POLICY beach_photos_read ON public.beach_photos
  FOR SELECT
  USING (true);  -- ⚠️ ALLOWS ACCESS TO ALL PHOTOS
```

This policy allowed **any user** (including anonymous/unauthenticated users) to:
- ✗ Access soft-deleted photos (`deleted_at IS NOT NULL`)
- ✗ Access unapproved photos (`approved = false`)
- ✗ Access photos that should be hidden from public view

### Security Impact

**Data Exposure:**
- Deleted photos remained accessible via direct database queries
- Unapproved photos (potentially containing inappropriate content) were publicly visible
- No differentiation between public and admin access levels

**Affected Users:**
- All anonymous users could access deleted content
- All authenticated non-admin users could access deleted content
- Admin moderation actions (soft-delete, unapprove) had no effect on public visibility

**Attack Vector:**
- Direct database queries via Supabase client
- API endpoints that query `beach_photos` table
- Any application feature that displays beach photos

---

## The Fix

### New Security Model

**1. Public Access (Restricted)**
```sql
CREATE POLICY beach_photos_read_public ON public.beach_photos
    FOR SELECT
    USING (
        deleted_at IS NULL      -- Only non-deleted photos
        AND approved = true     -- Only approved photos
    );
```

**2. Admin Access (Full Access)**
```sql
-- Already exists from migration 20251024000005_add_admin_rls_policies.sql
CREATE POLICY "Admins can view all photos" ON public.beach_photos
    FOR SELECT
    USING (public.is_admin_user());
```

### Access Control Matrix

| User Type | Can View Active Photos | Can View Deleted Photos | Can View Unapproved Photos |
|-----------|----------------------|------------------------|---------------------------|
| **Anonymous** | ✓ (if approved) | ✗ | ✗ |
| **Authenticated (non-admin)** | ✓ (if approved) | ✗ | ✗ |
| **Admin** | ✓ | ✓ | ✓ |

---

## Implementation Details

### Files Changed

1. **Migration File:**
   - `/supabase/migrations/20251117033703_fix_beach_photos_rls_security.sql`
   - Drops insecure policy
   - Creates new secure policy
   - Includes verification queries and audit logging

2. **Test Suite:**
   - `/supabase/migrations/test_beach_photos_rls_security.sql`
   - Comprehensive test coverage
   - Verifies policy logic
   - Tests edge cases

3. **Documentation:**
   - `/supabase/migrations/SECURITY_FIX_beach_photos_rls.md` (this file)

### Migration Steps

The migration performs the following operations:

```sql
BEGIN;

-- 1. Drop insecure policy
DROP POLICY IF EXISTS beach_photos_read ON public.beach_photos;

-- 2. Create secure public policy
CREATE POLICY beach_photos_read_public ON public.beach_photos
    FOR SELECT
    USING (deleted_at IS NULL AND approved = true);

-- 3. Verify admin policies exist
-- 4. Run security audit
-- 5. Update table documentation

COMMIT;
```

### Dependencies

**Required:**
- `is_admin_user()` function (from `20251024000005_add_admin_rls_policies.sql`)
- `deleted_at` column (from `20251024000002_add_soft_delete_columns.sql`)
- `approved` column (original table schema)

**Related:**
- Admin policies already exist for admin access
- `beach_photos_featured` view already filters by `approved` and `deleted_at`

---

## Testing

### Automated Tests

Run the test suite:
```sql
-- Apply migration first
psql -f supabase/migrations/20251117033703_fix_beach_photos_rls_security.sql

-- Run test suite
psql -f supabase/migrations/test_beach_photos_rls_security.sql
```

Expected results:
- ✓ TEST 1: Policy configuration correct
- ✓ TEST 2: Public visibility restricted
- ✓ TEST 3: Individual photo visibility correct
- ✓ TEST 4: Policy logic verified
- ✓ TEST 5: Featured view security correct
- ✓ TEST 6: Overall security audit passed
- ✓ TEST 7: Admin policies exist
- ✓ TEST 8: Production data secured

### Manual Testing

**Test Public Access (should be restricted):**
```sql
SET ROLE anon;
SELECT COUNT(*) FROM public.beach_photos WHERE deleted_at IS NOT NULL;
-- Expected: 0 (access denied by RLS)
RESET ROLE;
```

**Test Admin Access (should see all):**
```sql
-- Requires admin user UUID
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "your-admin-uuid"}';
SELECT COUNT(*) FROM public.beach_photos WHERE deleted_at IS NOT NULL;
-- Expected: Actual count of deleted photos
RESET ROLE;
```

---

## Rollback Procedure

**⚠️ WARNING:** Rolling back this migration will **RESTORE THE SECURITY VULNERABILITY**!

Only rollback if absolutely necessary and you understand the security implications.

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

---

## Verification Checklist

After applying the migration, verify:

- [ ] Migration applied successfully
- [ ] No errors in migration logs
- [ ] Test suite passes all tests
- [ ] Public users cannot access deleted photos
- [ ] Public users cannot access unapproved photos
- [ ] Admin users can still access all photos
- [ ] `beach_photos_featured` view excludes deleted photos
- [ ] Application features work correctly with new policy
- [ ] No performance degradation

---

## Performance Considerations

### Query Performance

The new policy adds conditions to all SELECT queries:
```sql
WHERE deleted_at IS NULL AND approved = true
```

**Indexes:**
- `idx_beach_photos_deleted_at` - Exists (from soft-delete migration)
- `approved` column - Boolean, small overhead

**Expected Impact:**
- Minimal performance impact
- Indexes support efficient filtering
- Most photos are non-deleted, so index is selective

**Query Plan Example:**
```sql
EXPLAIN ANALYZE
SELECT * FROM public.beach_photos WHERE deleted_at IS NULL AND approved = true;
```

### Monitoring

Monitor these metrics after deployment:
- Query execution time for `beach_photos` SELECT queries
- Index usage statistics
- RLS policy overhead
- Application response times

---

## Security Best Practices Applied

1. **Principle of Least Privilege**
   - Public users only see what they need
   - Admin access separated from public access

2. **Defense in Depth**
   - RLS policies enforce access at database level
   - Cannot be bypassed by application code
   - Works even if API logic has bugs

3. **Audit Trail**
   - Migration includes security audit queries
   - Test suite validates security properties
   - Admin actions logged in audit tables

4. **Secure by Default**
   - New policy denies access unless explicitly allowed
   - No implicit permissions

---

## Related Migrations

### Previous Migrations
- `20251020093001_create_beach_photos.sql` - Original table creation (INSECURE)
- `20251024000002_add_soft_delete_columns.sql` - Added `deleted_at` column
- `20251024000005_add_admin_rls_policies.sql` - Added admin policies and `is_admin_user()` function
- `20251117032239_exclude_deleted_photos_from_featured.sql` - Fixed featured view

### Future Migrations
- Consider similar security reviews for other tables with soft-delete
- Apply consistent RLS patterns across the application

---

## Timeline

| Date | Action |
|------|--------|
| 2025-10-20 | Original insecure policy created |
| 2025-10-24 | Soft-delete support added |
| 2025-10-24 | Admin infrastructure added |
| 2025-11-17 | Security vulnerability discovered |
| 2025-11-17 | **Migration created and applied** |

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)

---

## Contact

**Questions or Concerns?**
- Review the migration file for detailed comments
- Run the test suite to validate the fix
- Check application logs for RLS-related errors
- Consult Supabase documentation for RLS troubleshooting

---

**Migration Status:** ✅ Ready for Production Deployment

This migration fixes a critical security vulnerability and should be deployed as soon as possible.
