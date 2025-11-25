-- Verification Queries for Orphaned Beach Photos Cleanup
-- Created: 2025-11-15
-- Description: Pre and post-migration verification queries
--
-- Run these queries BEFORE the migration to understand current state,
-- and AFTER the migration to verify cleanup was successful.
--
-- =============================================================================

-- =============================================================================
-- PRE-MIGRATION VERIFICATION
-- =============================================================================

-- 1. Count total beach_photos
SELECT
    'Total beach_photos' AS metric,
    COUNT(*) AS count
FROM public.beach_photos;

-- 2. Count orphaned beach_photos (photos referencing non-existent beaches)
SELECT
    'Orphaned beach_photos' AS metric,
    COUNT(*) AS count
FROM public.beach_photos bp
WHERE NOT EXISTS (
    SELECT 1
    FROM public.beaches b
    WHERE b.id = bp.beach_id
);

-- 3. Count valid beach_photos (photos referencing existing beaches)
SELECT
    'Valid beach_photos' AS metric,
    COUNT(*) AS count
FROM public.beach_photos bp
WHERE EXISTS (
    SELECT 1
    FROM public.beaches b
    WHERE b.id = bp.beach_id
);

-- 4. List orphaned beach IDs with photo counts
SELECT
    bp.beach_id,
    COUNT(*) AS photo_count,
    MIN(bp.title) AS sample_title,
    MIN(bp.source) AS sample_source
FROM public.beach_photos bp
WHERE NOT EXISTS (
    SELECT 1
    FROM public.beaches b
    WHERE b.id = bp.beach_id
)
GROUP BY bp.beach_id
ORDER BY photo_count DESC;

-- 5. List valid beaches with photo counts
SELECT
    b.id AS beach_id,
    b.name AS beach_name,
    b.region_id,
    COUNT(bp.id) AS photo_count
FROM public.beaches b
LEFT JOIN public.beach_photos bp ON bp.beach_id = b.id
GROUP BY b.id, b.name, b.region_id
HAVING COUNT(bp.id) > 0
ORDER BY photo_count DESC;

-- 6. Summary statistics
SELECT
    COUNT(DISTINCT b.id) AS total_beaches,
    COUNT(DISTINCT bp.beach_id) AS beaches_referenced_in_photos,
    COUNT(DISTINCT CASE
        WHEN NOT EXISTS (SELECT 1 FROM public.beaches WHERE id = bp.beach_id)
        THEN bp.beach_id
    END) AS orphaned_beach_ids,
    COUNT(bp.id) AS total_photos,
    COUNT(CASE
        WHEN NOT EXISTS (SELECT 1 FROM public.beaches WHERE id = bp.beach_id)
        THEN 1
    END) AS orphaned_photos,
    COUNT(CASE
        WHEN EXISTS (SELECT 1 FROM public.beaches WHERE id = bp.beach_id)
        THEN 1
    END) AS valid_photos
FROM public.beaches b
FULL OUTER JOIN public.beach_photos bp ON bp.beach_id = b.id;

-- 7. Check FK constraint exists
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'beach_photos'
AND tc.constraint_type = 'FOREIGN KEY';

-- 8. Sample orphaned records (first 10)
SELECT
    bp.id,
    bp.beach_id,
    bp.source,
    bp.source_id,
    bp.title,
    bp.image_url,
    bp.fetched_at,
    'Beach does not exist' AS status
FROM public.beach_photos bp
WHERE NOT EXISTS (
    SELECT 1
    FROM public.beaches b
    WHERE b.id = bp.beach_id
)
ORDER BY bp.fetched_at DESC
LIMIT 10;

-- =============================================================================
-- POST-MIGRATION VERIFICATION
-- =============================================================================

-- 9. Verify no orphaned records remain (should return 0)
SELECT
    'Remaining orphaned beach_photos' AS metric,
    COUNT(*) AS count
FROM public.beach_photos bp
WHERE NOT EXISTS (
    SELECT 1
    FROM public.beaches b
    WHERE b.id = bp.beach_id
);

-- 10. Verify all photos reference valid beaches (should equal total photos)
SELECT
    'Valid beach_photos after cleanup' AS metric,
    COUNT(*) AS count
FROM public.beach_photos bp
WHERE EXISTS (
    SELECT 1
    FROM public.beaches b
    WHERE b.id = bp.beach_id
);

-- 11. Check cleanup audit record
SELECT
    id,
    cleanup_date,
    table_name,
    records_affected,
    cleanup_reason,
    jsonb_array_length(backup_data) AS backed_up_records,
    created_at
FROM public.data_cleanup_audit
WHERE table_name = 'beach_photos'
ORDER BY cleanup_date DESC
LIMIT 1;

-- 12. List beaches with photos after cleanup
SELECT
    b.id AS beach_id,
    b.name AS beach_name,
    b.region_id,
    COUNT(bp.id) AS photo_count,
    MIN(bp.fetched_at) AS oldest_photo,
    MAX(bp.fetched_at) AS newest_photo
FROM public.beaches b
LEFT JOIN public.beach_photos bp ON bp.beach_id = b.id
GROUP BY b.id, b.name, b.region_id
HAVING COUNT(bp.id) > 0
ORDER BY photo_count DESC;

-- 13. Verify FK constraint is still enforced (this should fail with FK violation)
-- DO NOT RUN IN PRODUCTION - This is a test query
/*
DO $$
BEGIN
    -- Try to insert orphaned record (should fail)
    INSERT INTO public.beach_photos (beach_id, source, source_id, image_url)
    VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'test123', 'http://example.com/test.jpg');

    RAISE EXCEPTION 'FK constraint is NOT enforced! This is a problem.';
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'SUCCESS: FK constraint properly prevents orphaned records';
END $$;
*/

-- =============================================================================
-- DATA RECOVERY QUERIES (if needed)
-- =============================================================================

-- 14. View all backed up orphaned records
SELECT
    item->>'photo_id' AS photo_id,
    item->>'beach_id' AS beach_id,
    item->>'source' AS source,
    item->>'source_id' AS source_id,
    item->>'title' AS title,
    item->>'image_url' AS image_url,
    item->>'deleted_at' AS deleted_at
FROM (
    SELECT jsonb_array_elements(backup_data) AS item
    FROM public.data_cleanup_audit
    WHERE table_name = 'beach_photos'
    AND cleanup_reason LIKE '%orphaned%'
    ORDER BY cleanup_date DESC
    LIMIT 1
) AS backup_items
ORDER BY (item->>'fetched_at')::TIMESTAMPTZ DESC
LIMIT 20;

-- 15. Export orphaned beach IDs for investigation
SELECT DISTINCT
    item->>'beach_id' AS orphaned_beach_id,
    COUNT(*) AS photo_count
FROM (
    SELECT jsonb_array_elements(backup_data) AS item
    FROM public.data_cleanup_audit
    WHERE table_name = 'beach_photos'
    AND cleanup_reason LIKE '%orphaned%'
    ORDER BY cleanup_date DESC
    LIMIT 1
) AS backup_items
GROUP BY item->>'beach_id'
ORDER BY photo_count DESC;

-- =============================================================================
-- HEALTH CHECK QUERIES
-- =============================================================================

-- 16. Overall database health check
SELECT
    'Database Health Check' AS check_type,
    jsonb_build_object(
        'total_beaches', (SELECT COUNT(*) FROM public.beaches),
        'total_photos', (SELECT COUNT(*) FROM public.beach_photos),
        'orphaned_photos', (
            SELECT COUNT(*)
            FROM public.beach_photos bp
            WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id)
        ),
        'beaches_with_photos', (SELECT COUNT(DISTINCT beach_id) FROM public.beach_photos),
        'data_integrity_ok', (
            SELECT COUNT(*) = 0
            FROM public.beach_photos bp
            WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id)
        ),
        'fk_constraint_exists', (
            SELECT COUNT(*) > 0
            FROM information_schema.table_constraints
            WHERE table_name = 'beach_photos'
            AND constraint_type = 'FOREIGN KEY'
        )
    ) AS status;

-- 17. Beach photo coverage by region
SELECT
    r.name AS region_name,
    COUNT(DISTINCT b.id) AS beaches_in_region,
    COUNT(DISTINCT bp.beach_id) AS beaches_with_photos,
    COUNT(bp.id) AS total_photos,
    ROUND(
        100.0 * COUNT(DISTINCT bp.beach_id) / NULLIF(COUNT(DISTINCT b.id), 0),
        2
    ) AS photo_coverage_percent
FROM public.regions r
LEFT JOIN public.beaches b ON b.region_id = r.id
LEFT JOIN public.beach_photos bp ON bp.beach_id = b.id
GROUP BY r.id, r.name
ORDER BY total_photos DESC;
