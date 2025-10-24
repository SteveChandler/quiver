-- Migration: Document Storage Contracts
-- Description: Add database comments documenting storage bucket relationships and requirements
-- Date: 2025-10-24
-- Author: Admin Portal Implementation (Workstream A)

BEGIN;

-- ================================================
-- Document session-media bucket contract
-- ================================================

COMMENT ON TABLE public.session_media IS
'Session media (photos/videos) storage tracking table.

STORAGE CONTRACT:
- Files stored in "session-media" Supabase storage bucket
- storage_path must match actual file path in bucket
- public_url should be generated from storage bucket public URL

DELETION REQUIREMENTS:
When deleting media, TWO operations are required:
1. Database: Set deleted_at = NOW() on this table (soft delete)
2. Storage: Remove file from session-media bucket using storage_path

IMPORTANT: Failing to remove storage files will result in orphaned files
and wasted storage space. Always perform both operations in admin actions.

Example deletion flow:
  1. UPDATE session_media SET deleted_at = NOW() WHERE id = ?
  2. DELETE FROM storage.objects WHERE bucket_id = ''session-media'' AND name = storage_path

For admin operations, use the cleanup_session_media_storage() function
which handles the database soft-delete and returns the storage path
for cleanup in the application layer.';

COMMENT ON COLUMN public.session_media.storage_path IS
'Path to file in session-media storage bucket. Format: user_id/session_id/filename.ext
CRITICAL: When soft-deleting this record, also remove file from storage bucket using this path.';

COMMENT ON COLUMN public.session_media.public_url IS
'Public URL for accessing the media file. Generated from Supabase storage public URL + storage_path.
Example: https://[project].supabase.co/storage/v1/object/public/session-media/[storage_path]';

COMMENT ON COLUMN public.session_media.deleted_at IS
'Soft delete timestamp. NULL = active media.
When set: Media is hidden from app but storage file may still exist.
Admin must ensure corresponding storage file is also removed.';

-- ================================================
-- Document beach_photos storage considerations (if exists)
-- ================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'beach_photos'
    ) THEN
        COMMENT ON TABLE public.beach_photos IS
        'Beach photos from external sources and user uploads.

        STORAGE NOTES:
        - External photos (openverse, flickr, etc.): URLs stored in image_url, no local storage
        - User-uploaded photos: May use session-media bucket, storage path would be tracked

        MODERATION:
        - approved column controls visibility in public API
        - deleted_at controls soft delete (admin can restore)
        - Admin operations should respect attribution requirements';

        COMMENT ON COLUMN public.beach_photos.image_url IS
        'URL to beach photo. For external sources, this is the source URL.
        For user uploads, this may reference session-media storage bucket.';

        COMMENT ON COLUMN public.beach_photos.approved IS
        'Moderation flag. Only approved=true photos appear in public beach listings.
        Admins can toggle this to moderate user-submitted beach photos.';

        RAISE NOTICE 'Added documentation comments for beach_photos table';
    ELSE
        RAISE NOTICE 'beach_photos table does not exist - comments will be added when table exists';
    END IF;
END $$;

-- ================================================
-- Document intel_posts photo storage
-- ================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'intel_posts'
        AND column_name = 'photo_storage_path'
    ) THEN
        COMMENT ON COLUMN public.intel_posts.photo_storage_path IS
        'Path to photo in intel-photos storage bucket (if applicable).
        When deactivating intel post (is_active=false), consider if associated photo should be removed.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'intel_posts'
        AND column_name = 'photo_url'
    ) THEN
        COMMENT ON COLUMN public.intel_posts.photo_url IS
        'Public URL to intel post photo. May reference intel-photos storage bucket or external source.';
    END IF;
END $$;

-- ================================================
-- Document storage bucket structure
-- ================================================

-- Create a documentation table for storage buckets
CREATE TABLE IF NOT EXISTS public.storage_bucket_docs (
    bucket_name TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    path_pattern TEXT NOT NULL,
    deletion_policy TEXT NOT NULL,
    max_file_size TEXT,
    allowed_types TEXT[],
    public_access BOOLEAN NOT NULL DEFAULT false,
    notes TEXT
);

COMMENT ON TABLE public.storage_bucket_docs IS
'Documentation table describing Supabase storage buckets used by the application.
This is a metadata table for developer reference.';

-- Document session-media bucket
INSERT INTO public.storage_bucket_docs (
    bucket_name,
    purpose,
    path_pattern,
    deletion_policy,
    max_file_size,
    allowed_types,
    public_access,
    notes
) VALUES (
    'session-media',
    'User-uploaded session photos and videos',
    'user_id/session_id/timestamp_filename.ext',
    'Require manual deletion when session_media.deleted_at is set',
    '10MB for photos, 50MB for videos',
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
    true,
    'Public bucket - files accessible via public URL. Admin must ensure sensitive content is properly moderated.'
)
ON CONFLICT (bucket_name) DO UPDATE SET
    purpose = EXCLUDED.purpose,
    path_pattern = EXCLUDED.path_pattern,
    deletion_policy = EXCLUDED.deletion_policy,
    max_file_size = EXCLUDED.max_file_size,
    allowed_types = EXCLUDED.allowed_types,
    public_access = EXCLUDED.public_access,
    notes = EXCLUDED.notes;

-- Document intel-photos bucket
INSERT INTO public.storage_bucket_docs (
    bucket_name,
    purpose,
    path_pattern,
    deletion_policy,
    max_file_size,
    allowed_types,
    public_access,
    notes
) VALUES (
    'intel-photos',
    'Intel post user-submitted photos',
    'user_id/intel_post_id/timestamp_filename.ext',
    'Optional - consider cleanup when intel_posts.is_active set to false',
    '5MB',
    ARRAY['image/jpeg', 'image/png', 'image/webp'],
    true,
    'Public bucket for intel post photos. Photos remain accessible even if post is deactivated unless explicitly deleted.'
)
ON CONFLICT (bucket_name) DO UPDATE SET
    purpose = EXCLUDED.purpose,
    path_pattern = EXCLUDED.path_pattern,
    deletion_policy = EXCLUDED.deletion_policy,
    max_file_size = EXCLUDED.max_file_size,
    allowed_types = EXCLUDED.allowed_types,
    public_access = EXCLUDED.public_access,
    notes = EXCLUDED.notes;

-- Document avatars bucket
INSERT INTO public.storage_bucket_docs (
    bucket_name,
    purpose,
    path_pattern,
    deletion_policy,
    max_file_size,
    allowed_types,
    public_access,
    notes
) VALUES (
    'avatars',
    'User profile avatar images',
    'user_id/avatar.ext',
    'Cascade delete when user account deleted',
    '2MB',
    ARRAY['image/jpeg', 'image/png', 'image/webp'],
    true,
    'Public bucket - avatar URLs stored in profiles.avatar_url'
)
ON CONFLICT (bucket_name) DO UPDATE SET
    purpose = EXCLUDED.purpose,
    path_pattern = EXCLUDED.path_pattern,
    deletion_policy = EXCLUDED.deletion_policy,
    max_file_size = EXCLUDED.max_file_size,
    allowed_types = EXCLUDED.allowed_types,
    public_access = EXCLUDED.public_access,
    notes = EXCLUDED.notes;

-- ================================================
-- Create helper function to list orphaned storage files
-- ================================================

CREATE OR REPLACE FUNCTION public.find_orphaned_session_media()
RETURNS TABLE (
    storage_path TEXT,
    media_id UUID,
    deleted_at TIMESTAMPTZ,
    days_since_deletion INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only admins can run this query
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Only administrators can query orphaned media';
    END IF;

    RETURN QUERY
    SELECT
        sm.storage_path,
        sm.id as media_id,
        sm.deleted_at,
        EXTRACT(DAY FROM (NOW() - sm.deleted_at))::INTEGER as days_since_deletion
    FROM public.session_media sm
    WHERE sm.deleted_at IS NOT NULL
    AND sm.deleted_at < NOW() - INTERVAL '7 days'  -- Grace period
    ORDER BY sm.deleted_at ASC;
END;
$$;

COMMENT ON FUNCTION public.find_orphaned_session_media IS
'Admin function to find soft-deleted media records older than 7 days.
These records indicate storage files that should be cleaned up.
Returns storage paths for bulk cleanup operations.';

-- ================================================
-- Document best practices in database comment
-- ================================================

COMMENT ON SCHEMA public IS
'Quiver Surf App - Public Schema

STORAGE MANAGEMENT BEST PRACTICES:

1. SOFT DELETE PATTERN:
   - Set deleted_at timestamp instead of hard DELETE
   - Allows recovery and maintains audit trail
   - Query with WHERE deleted_at IS NULL to exclude deleted items

2. STORAGE CLEANUP:
   - Soft deleting DB records does NOT remove storage files
   - Admin portal must handle storage cleanup separately
   - Use cleanup_session_media_storage() for session media
   - Run find_orphaned_session_media() periodically to identify cleanup tasks

3. ADMIN OPERATIONS:
   - All admin actions logged to admin_audit_log
   - History tables track changes (beaches_history, sessions_history, etc.)
   - Triggers automatically populate history on UPDATE/DELETE
   - Admin RLS policies grant full access to admins (profiles.is_admin = true)

4. AUDIT TRAIL:
   - History tables capture full row snapshots
   - Use get_entity_history(table_name, entity_id) to retrieve history
   - changed_by field tracks which admin made changes

See storage_bucket_docs table for bucket-specific documentation.';

COMMIT;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.find_orphaned_session_media();
-- DROP TABLE IF EXISTS public.storage_bucket_docs CASCADE;
-- COMMENT ON SCHEMA public IS NULL;
-- COMMENT ON TABLE public.session_media IS NULL;
-- COMMENT ON COLUMN public.session_media.storage_path IS NULL;
-- COMMENT ON COLUMN public.session_media.public_url IS NULL;
-- COMMENT ON COLUMN public.session_media.deleted_at IS NULL;
-- COMMENT ON TABLE public.beach_photos IS NULL;
-- COMMENT ON COLUMN public.beach_photos.image_url IS NULL;
-- COMMENT ON COLUMN public.beach_photos.approved IS NULL;
-- COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- View storage bucket documentation:
-- SELECT * FROM public.storage_bucket_docs;
--
-- Check for orphaned media (as admin):
-- SELECT * FROM public.find_orphaned_session_media();
--
-- View table comments:
-- SELECT
--     c.relname as table_name,
--     pg_catalog.obj_description(c.oid, 'pg_class') as table_comment
-- FROM pg_catalog.pg_class c
-- WHERE c.relnamespace = 'public'::regnamespace
-- AND c.relkind = 'r'
-- AND pg_catalog.obj_description(c.oid, 'pg_class') IS NOT NULL
-- ORDER BY c.relname;
