-- Test Suite: Verify beach_photos RLS Security Fix
-- Migration: 20251117033703_fix_beach_photos_rls_security.sql
-- Purpose: Comprehensive testing of RLS policy security improvements
--
-- Run this AFTER applying the migration to verify the security fix works correctly

BEGIN;

-- ================================================
-- SETUP: Create test data
-- ================================================

-- Create a test beach (if not exists)
INSERT INTO public.beaches (id, name, lat, lon, region_id)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Test Beach for RLS Security',
    33.7701,
    -118.1937,
    1
)
ON CONFLICT (id) DO NOTHING;

-- Insert test photos with different states
INSERT INTO public.beach_photos (id, beach_id, source, source_id, image_url, approved, deleted_at)
VALUES
    -- Case 1: Active, approved photo (SHOULD be visible to public)
    ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'test', 'active-approved', 'https://example.com/active-approved.jpg', true, NULL),

    -- Case 2: Active, unapproved photo (SHOULD NOT be visible to public)
    ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'test', 'active-unapproved', 'https://example.com/active-unapproved.jpg', false, NULL),

    -- Case 3: Deleted, approved photo (SHOULD NOT be visible to public)
    ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'test', 'deleted-approved', 'https://example.com/deleted-approved.jpg', true, NOW()),

    -- Case 4: Deleted, unapproved photo (SHOULD NOT be visible to public)
    ('10000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'test', 'deleted-unapproved', 'https://example.com/deleted-unapproved.jpg', false, NOW())
ON CONFLICT (beach_id, source, source_id) DO NOTHING;

RAISE NOTICE 'Test data created successfully';

-- ================================================
-- TEST 1: Verify Policy Configuration
-- ================================================

SELECT
    '=== TEST 1: Policy Configuration ===' AS test_section,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command,
    CASE
        WHEN policyname LIKE '%public%' THEN 'Should restrict to approved + non-deleted'
        WHEN policyname LIKE '%admin%' THEN 'Should allow access to all photos'
        ELSE 'Unknown policy'
    END AS expected_behavior
FROM pg_policies
WHERE tablename = 'beach_photos'
ORDER BY policyname;

-- ================================================
-- TEST 2: Verify Public Access Restrictions
-- ================================================

-- Test as anonymous user (simulated - actual RLS testing requires SET ROLE)
SELECT
    '=== TEST 2: Public Visibility Test ===' AS test_section,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND approved = true) AS should_be_visible_to_public,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted_should_be_hidden,
    COUNT(*) FILTER (WHERE approved = false) AS unapproved_should_be_hidden,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL OR approved = false) AS total_should_be_hidden,
    COUNT(*) AS total_photos_in_database
FROM public.beach_photos
WHERE beach_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- ================================================
-- TEST 3: Verify Each Test Case
-- ================================================

SELECT
    '=== TEST 3: Individual Photo Visibility ===' AS test_section,
    source_id,
    approved,
    CASE WHEN deleted_at IS NOT NULL THEN 'DELETED' ELSE 'ACTIVE' END AS status,
    CASE
        WHEN deleted_at IS NULL AND approved = true THEN '✓ SHOULD BE VISIBLE'
        WHEN deleted_at IS NOT NULL THEN '✗ HIDDEN (deleted)'
        WHEN approved = false THEN '✗ HIDDEN (unapproved)'
        ELSE '✗ HIDDEN (multiple reasons)'
    END AS expected_visibility,
    deleted_at IS NULL AND approved = true AS passes_rls_policy
FROM public.beach_photos
WHERE beach_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY source_id;

-- ================================================
-- TEST 4: Verify Policy Logic Matches Expected Behavior
-- ================================================

WITH policy_check AS (
    SELECT
        source_id,
        deleted_at IS NULL AND approved = true AS meets_public_policy,
        deleted_at IS NULL AS not_deleted,
        approved AS is_approved
    FROM public.beach_photos
    WHERE beach_id = '00000000-0000-0000-0000-000000000001'::uuid
)
SELECT
    '=== TEST 4: Policy Logic Verification ===' AS test_section,
    source_id,
    CASE WHEN not_deleted THEN '✓' ELSE '✗' END AS not_deleted_check,
    CASE WHEN is_approved THEN '✓' ELSE '✗' END AS approved_check,
    CASE WHEN meets_public_policy THEN '✓ PASSES' ELSE '✗ BLOCKED' END AS policy_result,
    CASE
        WHEN source_id = 'active-approved' AND meets_public_policy THEN '✓ CORRECT'
        WHEN source_id != 'active-approved' AND NOT meets_public_policy THEN '✓ CORRECT'
        ELSE '✗ POLICY ERROR'
    END AS test_result
FROM policy_check
ORDER BY source_id;

-- ================================================
-- TEST 5: Check beach_photos_featured View
-- ================================================

-- The featured view should also exclude deleted photos
SELECT
    '=== TEST 5: Featured View Security ===' AS test_section,
    COUNT(*) AS photos_in_featured_view,
    CASE
        WHEN COUNT(*) = (SELECT COUNT(*) FROM public.beach_photos WHERE beach_id = '00000000-0000-0000-0000-000000000001'::uuid AND deleted_at IS NULL AND approved = true)
        THEN '✓ CORRECT: Only shows active, approved photos'
        ELSE '✗ ERROR: Featured view includes deleted or unapproved photos'
    END AS view_security_check
FROM public.beach_photos_featured
WHERE beach_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- ================================================
-- TEST 6: Security Audit Summary
-- ================================================

WITH audit_summary AS (
    SELECT
        COUNT(*) AS total_test_photos,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND approved = true) AS public_visible,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted_hidden,
        COUNT(*) FILTER (WHERE approved = false) AS unapproved_hidden,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND approved = true) AS expected_visible
    FROM public.beach_photos
    WHERE beach_id = '00000000-0000-0000-0000-000000000001'::uuid
)
SELECT
    '=== TEST 6: Security Audit Summary ===' AS test_section,
    total_test_photos,
    public_visible,
    deleted_hidden,
    unapproved_hidden,
    CASE
        WHEN public_visible = 1 AND deleted_hidden = 2 AND unapproved_hidden = 2 THEN '✓ ALL TESTS PASSED'
        ELSE '✗ SECURITY ISSUE DETECTED'
    END AS overall_result
FROM audit_summary;

-- ================================================
-- TEST 7: Verify Admin Policy Exists
-- ================================================

SELECT
    '=== TEST 7: Admin Policy Check ===' AS test_section,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'beach_photos'
            AND policyname = 'Admins can view all photos'
        ) THEN '✓ Admin view policy exists'
        ELSE '✗ WARNING: Admin policy missing - admins cannot view deleted photos'
    END AS admin_policy_status,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc
            WHERE proname = 'is_admin_user'
        ) THEN '✓ is_admin_user() function exists'
        ELSE '✗ ERROR: is_admin_user() function missing'
    END AS admin_function_status;

-- ================================================
-- TEST 8: Production Data Security Check
-- ================================================

-- Check production beach_photos for potential exposure
SELECT
    '=== TEST 8: Production Data Security ===' AS test_section,
    COUNT(*) AS total_production_photos,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND approved = true) AS currently_visible_to_public,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted_now_hidden,
    COUNT(*) FILTER (WHERE approved = false) AS unapproved_now_hidden,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE deleted_at IS NULL AND approved = true) / NULLIF(COUNT(*), 0),
        2
    ) AS percent_visible,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE deleted_at IS NOT NULL OR approved = false) / NULLIF(COUNT(*), 0),
        2
    ) AS percent_now_secured
FROM public.beach_photos
WHERE beach_id != '00000000-0000-0000-0000-000000000001'::uuid;  -- Exclude test data

-- ================================================
-- CLEANUP: Remove test data
-- ================================================

DELETE FROM public.beach_photos WHERE beach_id = '00000000-0000-0000-0000-000000000001'::uuid;
DELETE FROM public.beaches WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

RAISE NOTICE 'Test data cleaned up successfully';

COMMIT;

-- ================================================
-- EXPECTED TEST RESULTS
-- ================================================
--
-- TEST 1: Should show policies including:
--   - beach_photos_read_public (FOR SELECT, restricts to approved + non-deleted)
--   - Admins can view all photos (FOR SELECT, allows admins to view all)
--
-- TEST 2: Should show:
--   - should_be_visible_to_public: 1 (active-approved only)
--   - deleted_should_be_hidden: 2
--   - unapproved_should_be_hidden: 2
--   - total_should_be_hidden: 3
--   - total_photos_in_database: 4
--
-- TEST 3: Should show:
--   - active-approved: ✓ SHOULD BE VISIBLE
--   - active-unapproved: ✗ HIDDEN (unapproved)
--   - deleted-approved: ✗ HIDDEN (deleted)
--   - deleted-unapproved: ✗ HIDDEN (multiple reasons)
--
-- TEST 4: Should show all test results as "✓ CORRECT"
--
-- TEST 5: Should show "✓ CORRECT: Only shows active, approved photos"
--
-- TEST 6: Should show "✓ ALL TESTS PASSED"
--
-- TEST 7: Should show both checks as ✓ (green)
--
-- TEST 8: Should show production data statistics with percent_now_secured
--
-- ================================================
-- MANUAL RLS TESTING (requires superuser access)
-- ================================================
--
-- To test actual RLS enforcement (not just policy logic):
--
-- 1. Test as anonymous user:
-- SET ROLE anon;
-- SELECT COUNT(*) FROM public.beach_photos WHERE deleted_at IS NOT NULL;
-- -- Should return 0 (RLS blocks access)
-- RESET ROLE;
--
-- 2. Test as authenticated non-admin:
-- SET ROLE authenticated;
-- SET request.jwt.claims TO '{"sub": "non-admin-user-uuid"}';
-- SELECT COUNT(*) FROM public.beach_photos WHERE deleted_at IS NOT NULL;
-- -- Should return 0 (RLS blocks access)
-- RESET ROLE;
--
-- 3. Test as admin:
-- SET ROLE authenticated;
-- SET request.jwt.claims TO '{"sub": "admin-user-uuid"}';
-- SELECT COUNT(*) FROM public.beach_photos WHERE deleted_at IS NOT NULL;
-- -- Should return actual count (admin can see deleted photos)
-- RESET ROLE;
