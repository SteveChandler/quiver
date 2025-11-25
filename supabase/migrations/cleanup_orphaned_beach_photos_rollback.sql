-- Rollback Migration: Cleanup Orphaned Beach Photos
-- Created: 2025-11-15
-- Description: Restores beach_photos records that were removed during orphan cleanup
--
-- IMPORTANT: This rollback will restore orphaned records (photos referencing
-- non-existent beaches). This should only be used if:
--   1. The beaches were deleted by mistake and will be restored
--   2. You need to recover the photo data before re-mapping to correct beaches
--   3. There was an error during the cleanup process
--
-- WARNING: Restoring orphaned records will leave your database in an
-- inconsistent state until the referenced beaches are also restored or
-- the beach_id values are corrected.
--
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Verify audit record exists
-- =============================================================================

DO $$
DECLARE
    audit_count INTEGER;
    records_to_restore INTEGER;
BEGIN
    -- Check if audit record exists
    SELECT COUNT(*) INTO audit_count
    FROM public.data_cleanup_audit
    WHERE table_name = 'beach_photos'
    AND cleanup_reason LIKE '%orphaned%';

    IF audit_count = 0 THEN
        RAISE EXCEPTION 'No audit record found for beach_photos cleanup. Cannot rollback.';
    END IF;

    -- Get count of records to restore
    SELECT records_affected INTO records_to_restore
    FROM public.data_cleanup_audit
    WHERE table_name = 'beach_photos'
    AND cleanup_reason LIKE '%orphaned%'
    ORDER BY cleanup_date DESC
    LIMIT 1;

    RAISE NOTICE 'Found audit record with % records to restore', records_to_restore;
END $$;

-- =============================================================================
-- STEP 2: Temporarily disable FK constraint for restoration
-- =============================================================================

-- Get the FK constraint name
DO $$
DECLARE
    fk_constraint_name TEXT;
BEGIN
    SELECT constraint_name INTO fk_constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'beach_photos'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%beach_id%'
    LIMIT 1;

    RAISE NOTICE 'Disabling FK constraint: %', fk_constraint_name;

    -- Drop the FK constraint temporarily
    EXECUTE format('ALTER TABLE public.beach_photos DROP CONSTRAINT IF EXISTS %I', fk_constraint_name);

    RAISE NOTICE 'FK constraint disabled for restoration';
END $$;

-- =============================================================================
-- STEP 3: Restore orphaned records from audit table
-- =============================================================================

-- Restore records from the most recent cleanup audit
INSERT INTO public.beach_photos (
    id,
    beach_id,
    source,
    source_id,
    image_url,
    thumb_url,
    title,
    creator_name,
    creator_url,
    license_code,
    license_url,
    attribution_html,
    fetched_at,
    approved
)
SELECT
    (item->>'photo_id')::UUID,
    (item->>'beach_id')::UUID,
    item->>'source',
    item->>'source_id',
    item->>'image_url',
    item->>'thumb_url',
    item->>'title',
    item->>'creator_name',
    item->>'creator_url',
    item->>'license_code',
    item->>'license_url',
    item->>'attribution_html',
    (item->>'fetched_at')::TIMESTAMPTZ,
    COALESCE((item->>'approved')::BOOLEAN, true)
FROM (
    SELECT jsonb_array_elements(backup_data) AS item
    FROM public.data_cleanup_audit
    WHERE table_name = 'beach_photos'
    AND cleanup_reason LIKE '%orphaned%'
    ORDER BY cleanup_date DESC
    LIMIT 1
) AS backup_items
ON CONFLICT (id) DO NOTHING;

-- Log restoration
DO $$
DECLARE
    restored_count INTEGER;
BEGIN
    GET DIAGNOSTICS restored_count = ROW_COUNT;
    RAISE NOTICE 'Restored % beach_photos records', restored_count;
END $$;

-- =============================================================================
-- STEP 4: Re-enable FK constraint with validation disabled
-- =============================================================================

-- Re-create the FK constraint without validation (allows existing orphaned records)
ALTER TABLE public.beach_photos
ADD CONSTRAINT beach_photos_beach_id_fkey
FOREIGN KEY (beach_id)
REFERENCES public.beaches(id)
ON DELETE CASCADE
NOT VALID;

RAISE NOTICE 'FK constraint re-enabled (NOT VALID to allow restored orphaned records)';
RAISE WARNING 'Database now contains orphaned records. You must either:';
RAISE WARNING '  1. Restore the missing beaches, or';
RAISE WARNING '  2. Update beach_id values to valid beaches, or';
RAISE WARNING '  3. Delete the orphaned records again';

-- =============================================================================
-- STEP 5: Mark audit record as rolled back
-- =============================================================================

UPDATE public.data_cleanup_audit
SET cleanup_reason = cleanup_reason || ' [ROLLED BACK]'
WHERE table_name = 'beach_photos'
AND cleanup_reason LIKE '%orphaned%'
AND cleanup_reason NOT LIKE '%ROLLED BACK%'
AND id = (
    SELECT id
    FROM public.data_cleanup_audit
    WHERE table_name = 'beach_photos'
    AND cleanup_reason LIKE '%orphaned%'
    ORDER BY cleanup_date DESC
    LIMIT 1
);

RAISE NOTICE 'Audit record marked as rolled back';

-- =============================================================================
-- STEP 6: Verification and summary
-- =============================================================================

DO $$
DECLARE
    total_photos INTEGER;
    orphaned_photos INTEGER;
    valid_photos INTEGER;
    unique_beaches INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_photos FROM public.beach_photos;

    SELECT COUNT(*) INTO orphaned_photos
    FROM public.beach_photos bp
    WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id);

    SELECT COUNT(*) INTO valid_photos
    FROM public.beach_photos bp
    WHERE EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id);

    SELECT COUNT(DISTINCT beach_id) INTO unique_beaches FROM public.beach_photos;

    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'ROLLBACK COMPLETE';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Database Statistics:';
    RAISE NOTICE '  - Total beach_photos: %', total_photos;
    RAISE NOTICE '  - Valid photos (with existing beach): %', valid_photos;
    RAISE NOTICE '  - Orphaned photos (no beach exists): %', orphaned_photos;
    RAISE NOTICE '  - Unique beach IDs referenced: %', unique_beaches;
    RAISE NOTICE '=============================================================================';
    RAISE WARNING 'Action required: Fix % orphaned records', orphaned_photos;
    RAISE NOTICE '=============================================================================';
END $$;

COMMIT;

-- =============================================================================
-- POST-ROLLBACK ACTIONS REQUIRED
-- =============================================================================

-- 1. Identify orphaned beach IDs
-- SELECT DISTINCT bp.beach_id, COUNT(*) AS photo_count
-- FROM public.beach_photos bp
-- WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id)
-- GROUP BY bp.beach_id
-- ORDER BY photo_count DESC;

-- 2. Option A: Restore missing beaches (if you have backup)
-- INSERT INTO public.beaches (id, name, ...) VALUES (...);

-- 3. Option B: Remap to existing beaches
-- UPDATE public.beach_photos
-- SET beach_id = 'valid-beach-uuid-here'
-- WHERE beach_id = 'orphaned-beach-uuid-here';

-- 4. Option C: Delete orphaned records again
-- DELETE FROM public.beach_photos
-- WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = beach_photos.beach_id);

-- 5. After fixing, validate the FK constraint:
-- ALTER TABLE public.beach_photos VALIDATE CONSTRAINT beach_photos_beach_id_fkey;
