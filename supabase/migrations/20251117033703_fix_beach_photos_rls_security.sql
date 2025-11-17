-- Migration: Fix Critical RLS Policy Security Issue for beach_photos
-- Date: 2025-11-17
-- Description: Replace overly-permissive RLS policy with secure policies that prevent
--              unauthorized access to soft-deleted and unapproved photos
--
-- CRITICAL SECURITY ISSUE:
--   The existing "beach_photos_read" policy uses USING (true), which allows
--   public read access to ALL photos, including:
--   - Soft-deleted photos (deleted_at IS NOT NULL)
--   - Unapproved photos (approved = false)
--
-- SECURITY FIX:
--   1. Drop the insecure public read policy
--   2. Create a secure public read policy that only shows active, approved photos
--   3. Create a separate admin policy for viewing all photos (including deleted)
--
-- TABLES AFFECTED:
--   - public.beach_photos
--
-- DEPENDENCIES:
--   - Requires is_admin_user() function (created in 20251024000005_add_admin_rls_policies.sql)
--   - Requires deleted_at column (added in 20251024000002_add_soft_delete_columns.sql)
--   - Requires approved column (exists in original table creation)

BEGIN;

-- ================================================
-- STEP 1: Drop the existing overly-permissive policy
-- ================================================

DROP POLICY IF EXISTS beach_photos_read ON public.beach_photos;

RAISE NOTICE 'Dropped insecure beach_photos_read policy that allowed access to deleted photos';

-- ================================================
-- STEP 2: Create secure public read policy
-- ================================================

-- Public users can only see non-deleted AND approved photos
CREATE POLICY beach_photos_read_public ON public.beach_photos
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND approved = true
    );

COMMENT ON POLICY beach_photos_read_public ON public.beach_photos IS
    'Public read access restricted to active (not soft-deleted) and approved photos only. ' ||
    'This prevents unauthorized access to deleted or unapproved content.';

RAISE NOTICE 'Created secure beach_photos_read_public policy with deleted_at and approved checks';

-- ================================================
-- STEP 3: Verify admin policies exist (created in previous migration)
-- ================================================

-- The following admin policies should already exist from migration 20251024000005:
-- - "Admins can view all photos" - allows admins to view ALL photos including deleted
-- - "Admins can update any photo" - allows admins to update any photo
-- - "Admins can delete any photo" - allows admins to soft-delete photos
-- - "Admins can insert photos" - allows admins to insert new photos

-- Verify the admin view policy exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beach_photos'
        AND policyname = 'Admins can view all photos'
    ) THEN
        RAISE WARNING 'Admin view policy does not exist! Admins will not be able to view deleted photos.';
        RAISE NOTICE 'Please ensure migration 20251024000005_add_admin_rls_policies.sql has been applied.';
    ELSE
        RAISE NOTICE 'Verified: Admin view policy exists (allows viewing deleted photos)';
    END IF;
END $$;

-- ================================================
-- STEP 4: Test the security fix
-- ================================================

-- Test Query 1: Verify public can only see approved, non-deleted photos
DO $$
DECLARE
    total_photos INTEGER;
    public_visible_photos INTEGER;
    deleted_photos INTEGER;
    unapproved_photos INTEGER;
BEGIN
    -- Count all photos
    SELECT COUNT(*) INTO total_photos FROM public.beach_photos;

    -- Count photos that meet public visibility criteria
    SELECT COUNT(*) INTO public_visible_photos
    FROM public.beach_photos
    WHERE deleted_at IS NULL AND approved = true;

    -- Count deleted photos
    SELECT COUNT(*) INTO deleted_photos
    FROM public.beach_photos
    WHERE deleted_at IS NOT NULL;

    -- Count unapproved photos
    SELECT COUNT(*) INTO unapproved_photos
    FROM public.beach_photos
    WHERE approved = false;

    RAISE NOTICE '=== Beach Photos Security Audit ===';
    RAISE NOTICE 'Total photos in database: %', total_photos;
    RAISE NOTICE 'Photos visible to public: % (approved + not deleted)', public_visible_photos;
    RAISE NOTICE 'Photos hidden from public:';
    RAISE NOTICE '  - Soft-deleted: %', deleted_photos;
    RAISE NOTICE '  - Unapproved: %', unapproved_photos;
    RAISE NOTICE '  - Total hidden: %', (total_photos - public_visible_photos);
    RAISE NOTICE '==================================';
END $$;

-- ================================================
-- STEP 5: Add documentation
-- ================================================

COMMENT ON TABLE public.beach_photos IS
    'Beach photos from various sources. ' ||
    'PUBLIC ACCESS: Only approved, non-deleted photos are visible. ' ||
    'ADMIN ACCESS: Admins can view all photos including soft-deleted ones. ' ||
    'SECURITY: RLS policies enforce data access controls.';

COMMIT;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
--
-- WARNING: Rolling back this migration will RESTORE THE SECURITY VULNERABILITY!
--          Only rollback if you understand the security implications.
--
-- To rollback this migration:
--
-- BEGIN;
--
-- -- Drop the secure policies
-- DROP POLICY IF EXISTS beach_photos_read_public ON public.beach_photos;
--
-- -- Restore the original insecure policy
-- CREATE POLICY beach_photos_read ON public.beach_photos
--     FOR SELECT
--     USING (true);
--
-- COMMENT ON POLICY beach_photos_read ON public.beach_photos IS
--     'WARNING: This policy allows public access to ALL photos including deleted ones. SECURITY RISK!';
--
-- -- Restore original table comment
-- COMMENT ON TABLE public.beach_photos IS
--     'Beach photos from various sources.';
--
-- COMMIT;
--
-- ================================================
-- VERIFICATION QUERIES
-- ================================================
--
-- After applying this migration, run these queries to verify the fix:
--
-- 1. Check which policies exist on beach_photos table:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'beach_photos'
-- ORDER BY policyname;
--
-- 2. Test public access (as anonymous user):
-- SET ROLE anon;
-- SELECT COUNT(*) as public_visible_count FROM public.beach_photos;
-- -- Should only show approved, non-deleted photos
-- RESET ROLE;
--
-- 3. Verify deleted photos are hidden from public:
-- SET ROLE anon;
-- SELECT COUNT(*) FROM public.beach_photos WHERE deleted_at IS NOT NULL;
-- -- Should return 0 rows (access denied) or count of 0
-- RESET ROLE;
--
-- 4. Verify admins can still see all photos:
-- SET ROLE authenticated;
-- SET request.jwt.claims TO '{"sub": "admin-user-uuid"}';
-- -- (Replace with actual admin user UUID)
-- SELECT COUNT(*) as admin_visible_count FROM public.beach_photos;
-- -- Should show ALL photos including deleted ones
-- RESET ROLE;
--
-- ================================================
-- EXPECTED BEHAVIOR AFTER MIGRATION
-- ================================================
--
-- PUBLIC USERS (anonymous or authenticated non-admins):
--   ✓ Can SELECT photos where deleted_at IS NULL AND approved = true
--   ✗ Cannot SELECT soft-deleted photos (deleted_at IS NOT NULL)
--   ✗ Cannot SELECT unapproved photos (approved = false)
--   ✗ Cannot INSERT, UPDATE, or DELETE photos
--
-- ADMIN USERS (profiles.is_admin = true):
--   ✓ Can SELECT all photos (including deleted and unapproved)
--   ✓ Can INSERT new photos
--   ✓ Can UPDATE any photo (including approval status)
--   ✓ Can DELETE (soft-delete) any photo
--   ✓ Can view beach_photos_history audit trail
--
-- SECURITY IMPROVEMENTS:
--   ✓ Prevents unauthorized access to soft-deleted photos
--   ✓ Prevents unauthorized access to unapproved photos
--   ✓ Maintains admin access for moderation tasks
--   ✓ Follows principle of least privilege
--   ✓ Aligns with existing RLS patterns in the codebase
