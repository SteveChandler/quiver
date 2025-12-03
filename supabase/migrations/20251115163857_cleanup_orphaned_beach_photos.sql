-- Migration: Cleanup Orphaned Beach Photos
-- Created: 2025-11-15
-- Description: Removes beach_photos records that reference non-existent beaches
--              and verifies foreign key constraints are enforced.
--
-- Problem Context:
--   - 505 beach_photos exist in the database
--   - Only 2 of the referenced beach_ids exist in the beaches table
--   - 503 photos are orphaned (references to 74 non-existent beaches)
--   - This occurred during data import despite FK constraint existence
--
-- Solution:
--   1. Backup orphaned records to a temporary table (for audit/recovery)
--   2. Delete orphaned beach_photos records
--   3. Verify FK constraint is properly enforced
--   4. Log cleanup statistics
--
-- Expected Impact:
--   - Removes ~503 orphaned beach_photos records
--   - Ensures referential integrity
--   - Prevents future orphaned records via FK constraint
--
-- Rollback Strategy: See corresponding rollback file
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Create backup table for orphaned records (audit trail)
-- =============================================================================

CREATE TEMP TABLE orphaned_beach_photos_backup AS
SELECT
    bp.id,
    bp.beach_id,
    bp.source,
    bp.source_id,
    bp.image_url,
    bp.title,
    bp.approved,
    bp.attribution_html,
    bp.creator_name,
    bp.creator_url,
    bp.license_code,
    bp.license_url,
    bp.thumb_url,
    bp.fetched_at,
    bp.deleted_at,
    NOW() AS cleanup_deleted_at,
    'orphaned_cleanup_20251115' AS deletion_reason
FROM public.beach_photos bp
WHERE NOT EXISTS (
    SELECT 1
    FROM public.beaches b
    WHERE b.id = bp.beach_id
);

-- Log count of orphaned records
DO $$
DECLARE
    orphaned_count INTEGER;
    unique_beach_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count FROM orphaned_beach_photos_backup;
    SELECT COUNT(DISTINCT beach_id) INTO unique_beach_count FROM orphaned_beach_photos_backup;

    RAISE NOTICE 'Found % orphaned beach_photos referencing % non-existent beaches',
        orphaned_count, unique_beach_count;
END $$;

-- =============================================================================
-- STEP 2: Delete orphaned beach_photos records
-- =============================================================================

-- Delete records that reference non-existent beaches
DELETE FROM public.beach_photos
WHERE id IN (
    SELECT id FROM orphaned_beach_photos_backup
);

-- Log deletion
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % orphaned beach_photos records', deleted_count;
END $$;

-- =============================================================================
-- STEP 3: Verify foreign key constraint exists and is enforced
-- =============================================================================

-- Check if FK constraint exists
DO $$
DECLARE
    constraint_exists BOOLEAN;
    constraint_name TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'beach_photos'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name LIKE '%beach_id%'
    ) INTO constraint_exists;

    IF NOT constraint_exists THEN
        RAISE EXCEPTION 'Foreign key constraint on beach_photos.beach_id is missing!';
    END IF;

    -- Get constraint name for logging
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'beach_photos'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name LIKE '%beach_id%'
    LIMIT 1;

    RAISE NOTICE 'Foreign key constraint verified: %', constraint_name;
END $$;

-- =============================================================================
-- STEP 4: Verification queries
-- =============================================================================

-- Verify no orphaned records remain
DO $$
DECLARE
    remaining_orphans INTEGER;
    total_photos INTEGER;
    valid_photos INTEGER;
BEGIN
    -- Count remaining orphaned records (should be 0)
    SELECT COUNT(*) INTO remaining_orphans
    FROM public.beach_photos bp
    WHERE NOT EXISTS (
        SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id
    );

    -- Count total remaining photos
    SELECT COUNT(*) INTO total_photos FROM public.beach_photos;

    -- Count valid photos (should equal total_photos)
    SELECT COUNT(*) INTO valid_photos
    FROM public.beach_photos bp
    WHERE EXISTS (
        SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id
    );

    RAISE NOTICE 'Verification Results:';
    RAISE NOTICE '  - Remaining orphaned records: %', remaining_orphans;
    RAISE NOTICE '  - Total beach_photos: %', total_photos;
    RAISE NOTICE '  - Valid beach_photos: %', valid_photos;

    IF remaining_orphans > 0 THEN
        RAISE EXCEPTION 'Cleanup failed: % orphaned records still exist', remaining_orphans;
    END IF;

    IF total_photos != valid_photos THEN
        RAISE EXCEPTION 'Data integrity issue: total (%) != valid (%)', total_photos, valid_photos;
    END IF;

    RAISE NOTICE 'SUCCESS: All beach_photos now reference valid beaches';
END $$;

-- =============================================================================
-- STEP 5: Export backup data to permanent audit table (optional)
-- =============================================================================

-- Create permanent audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.data_cleanup_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleanup_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    table_name TEXT NOT NULL,
    records_affected INTEGER NOT NULL,
    cleanup_reason TEXT NOT NULL,
    backup_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert cleanup summary into audit table
INSERT INTO public.data_cleanup_audit (
    table_name,
    records_affected,
    cleanup_reason,
    backup_data
)
SELECT
    'beach_photos' AS table_name,
    COUNT(*) AS records_affected,
    'Removed orphaned beach_photos referencing non-existent beaches' AS cleanup_reason,
    jsonb_agg(
        jsonb_build_object(
            'photo_id', id,
            'beach_id', beach_id,
            'source', source,
            'source_id', source_id,
            'image_url', image_url,
            'title', title,
            'approved', approved,
            'attribution_html', attribution_html,
            'creator_name', creator_name,
            'creator_url', creator_url,
            'license_code', license_code,
            'license_url', license_url,
            'thumb_url', thumb_url,
            'fetched_at', fetched_at,
            'deleted_at', deleted_at,
            'cleanup_deleted_at', cleanup_deleted_at
        )
    ) AS backup_data
FROM orphaned_beach_photos_backup;

-- Log audit record creation
DO $$
DECLARE
    audit_id UUID;
BEGIN
    SELECT id INTO audit_id
    FROM public.data_cleanup_audit
    WHERE table_name = 'beach_photos'
    ORDER BY created_at DESC
    LIMIT 1;

    RAISE NOTICE 'Audit record created: %', audit_id;
    RAISE NOTICE 'Orphaned data backed up to data_cleanup_audit table';
END $$;

-- =============================================================================
-- STEP 6: Final summary
-- =============================================================================

DO $$
DECLARE
    beach_count INTEGER;
    photo_count INTEGER;
    beaches_with_photos INTEGER;
BEGIN
    SELECT COUNT(*) INTO beach_count FROM public.beaches;
    SELECT COUNT(*) INTO photo_count FROM public.beach_photos;
    SELECT COUNT(DISTINCT beach_id) INTO beaches_with_photos FROM public.beach_photos;

    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'CLEANUP COMPLETE';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Database Statistics:';
    RAISE NOTICE '  - Total beaches: %', beach_count;
    RAISE NOTICE '  - Total beach_photos: %', photo_count;
    RAISE NOTICE '  - Beaches with photos: %', beaches_with_photos;
    RAISE NOTICE '  - Orphaned records removed: See data_cleanup_audit table';
    RAISE NOTICE '=============================================================================';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =============================================================================
-- Run these queries after migration to verify success:

-- 1. Check for any remaining orphaned records (should return 0)
-- SELECT COUNT(*) AS orphaned_count
-- FROM public.beach_photos bp
-- WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id);

-- 2. View cleanup audit details
-- SELECT
--     id,
--     cleanup_date,
--     table_name,
--     records_affected,
--     cleanup_reason,
--     jsonb_array_length(backup_data) AS backed_up_records
-- FROM public.data_cleanup_audit
-- WHERE table_name = 'beach_photos'
-- ORDER BY cleanup_date DESC;

-- 3. List beaches with photos
-- SELECT
--     b.id,
--     b.name,
--     COUNT(bp.id) AS photo_count
-- FROM public.beaches b
-- LEFT JOIN public.beach_photos bp ON bp.beach_id = b.id
-- GROUP BY b.id, b.name
-- ORDER BY photo_count DESC;

-- 4. Verify FK constraint prevents orphaned inserts (should fail)
-- INSERT INTO public.beach_photos (beach_id, source, source_id, image_url)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'test123', 'http://example.com/test.jpg');
