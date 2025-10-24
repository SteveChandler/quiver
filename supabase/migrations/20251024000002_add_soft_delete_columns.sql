-- Migration: Add Soft Delete Columns
-- Description: Add deleted_at columns to managed tables for soft delete functionality
-- Date: 2025-10-24
-- Author: Admin Portal Implementation (Workstream A)

BEGIN;

-- ================================================
-- Add deleted_at columns to all managed tables
-- ================================================

-- 1. Beaches table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'beaches'
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.beaches ADD COLUMN deleted_at TIMESTAMPTZ;
        RAISE NOTICE 'Added deleted_at column to beaches table';
    ELSE
        RAISE NOTICE 'deleted_at column already exists in beaches table';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_beaches_deleted_at ON public.beaches(deleted_at);

-- 2. Sessions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'sessions'
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.sessions ADD COLUMN deleted_at TIMESTAMPTZ;
        RAISE NOTICE 'Added deleted_at column to sessions table';
    ELSE
        RAISE NOTICE 'deleted_at column already exists in sessions table';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON public.sessions(deleted_at);

-- 3. Beach Reviews table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'beach_reviews'
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.beach_reviews ADD COLUMN deleted_at TIMESTAMPTZ;
        RAISE NOTICE 'Added deleted_at column to beach_reviews table';
    ELSE
        RAISE NOTICE 'deleted_at column already exists in beach_reviews table';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_beach_reviews_deleted_at ON public.beach_reviews(deleted_at);

-- 4. Beach Photos table (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'beach_photos'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'beach_photos'
            AND column_name = 'deleted_at'
        ) THEN
            ALTER TABLE public.beach_photos ADD COLUMN deleted_at TIMESTAMPTZ;
            CREATE INDEX IF NOT EXISTS idx_beach_photos_deleted_at ON public.beach_photos(deleted_at);
            RAISE NOTICE 'Added deleted_at column to beach_photos table';
        ELSE
            RAISE NOTICE 'deleted_at column already exists in beach_photos table';
        END IF;
    ELSE
        RAISE NOTICE 'beach_photos table does not exist - will be handled when table is created';
    END IF;
END $$;

-- 5. Session Media table (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'session_media'
            AND column_name = 'deleted_at'
        ) THEN
            ALTER TABLE public.session_media ADD COLUMN deleted_at TIMESTAMPTZ;
            CREATE INDEX IF NOT EXISTS idx_session_media_deleted_at ON public.session_media(deleted_at);
            RAISE NOTICE 'Added deleted_at column to session_media table';
        ELSE
            RAISE NOTICE 'deleted_at column already exists in session_media table';
        END IF;
    ELSE
        RAISE NOTICE 'session_media table does not exist - will be handled in migration 6';
    END IF;
END $$;

-- ================================================
-- Add table comments documenting soft delete pattern
-- ================================================

COMMENT ON COLUMN public.beaches.deleted_at IS 'Soft delete timestamp. NULL means active. Use WHERE deleted_at IS NULL in queries.';
COMMENT ON COLUMN public.sessions.deleted_at IS 'Soft delete timestamp. NULL means active. Use WHERE deleted_at IS NULL in queries.';
COMMENT ON COLUMN public.beach_reviews.deleted_at IS 'Soft delete timestamp. NULL means active. Use WHERE deleted_at IS NULL in queries.';

-- Add comment for beach_photos only if table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'beach_photos'
    ) THEN
        COMMENT ON COLUMN public.beach_photos.deleted_at IS 'Soft delete timestamp. NULL means active. Use WHERE deleted_at IS NULL in queries.';
    END IF;
END $$;

-- ================================================
-- Document Intel Posts exception
-- ================================================

COMMENT ON COLUMN public.intel_posts.is_active IS 'Serves as soft delete flag for intel posts. FALSE means deleted/inactive. Use WHERE is_active = true in queries. Intel posts use is_active instead of deleted_at for architectural consistency.';

-- ================================================
-- Create helper function to soft delete entities
-- ================================================

CREATE OR REPLACE FUNCTION public.soft_delete_entity(
    table_name TEXT,
    entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sql_query TEXT;
    rows_affected INTEGER;
BEGIN
    -- Validate table name to prevent SQL injection
    IF table_name NOT IN ('beaches', 'sessions', 'beach_reviews', 'beach_photos', 'session_media') THEN
        RAISE EXCEPTION 'Invalid table name: %', table_name;
    END IF;

    -- Build and execute soft delete query
    sql_query := format(
        'UPDATE public.%I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
        table_name
    );

    EXECUTE sql_query USING entity_id;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    RETURN rows_affected > 0;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_entity IS 'Helper function to soft delete entities. Returns true if entity was deleted, false if already deleted or not found.';

-- ================================================
-- Create helper function to restore entities
-- ================================================

CREATE OR REPLACE FUNCTION public.restore_entity(
    table_name TEXT,
    entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sql_query TEXT;
    rows_affected INTEGER;
BEGIN
    -- Validate table name to prevent SQL injection
    IF table_name NOT IN ('beaches', 'sessions', 'beach_reviews', 'beach_photos', 'session_media') THEN
        RAISE EXCEPTION 'Invalid table name: %', table_name;
    END IF;

    -- Build and execute restore query
    sql_query := format(
        'UPDATE public.%I SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
        table_name
    );

    EXECUTE sql_query USING entity_id;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    RETURN rows_affected > 0;
END;
$$;

COMMENT ON FUNCTION public.restore_entity IS 'Helper function to restore soft-deleted entities. Returns true if entity was restored, false if not deleted or not found.';

COMMIT;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.soft_delete_entity(TEXT, UUID);
-- DROP FUNCTION IF EXISTS public.restore_entity(TEXT, UUID);
-- ALTER TABLE public.beaches DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE public.beach_reviews DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE public.beach_photos DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE public.session_media DROP COLUMN IF EXISTS deleted_at;
-- DROP INDEX IF EXISTS idx_beaches_deleted_at;
-- DROP INDEX IF EXISTS idx_sessions_deleted_at;
-- DROP INDEX IF EXISTS idx_beach_reviews_deleted_at;
-- DROP INDEX IF EXISTS idx_beach_photos_deleted_at;
-- DROP INDEX IF EXISTS idx_session_media_deleted_at;
-- COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- Verify deleted_at columns exist:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND column_name = 'deleted_at'
-- ORDER BY table_name;
--
-- Test soft delete function:
-- SELECT public.soft_delete_entity('beaches', 'some-uuid-here');
-- SELECT * FROM public.beaches WHERE id = 'some-uuid-here'; -- Should show deleted_at timestamp
--
-- Test restore function:
-- SELECT public.restore_entity('beaches', 'some-uuid-here');
-- SELECT * FROM public.beaches WHERE id = 'some-uuid-here'; -- Should show deleted_at as NULL
