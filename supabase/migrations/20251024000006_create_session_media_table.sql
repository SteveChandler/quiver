-- Migration: Create Session Media Table
-- Description: Create session_media table if it doesn't exist, matching application expectations
-- Date: 2025-10-24
-- Author: Admin Portal Implementation (Workstream A)

BEGIN;

-- ================================================
-- Create session_media table
-- ================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media'
    ) THEN
        -- Create table matching SessionMediaFallbackRow structure from types/database.ts
        CREATE TABLE public.session_media (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            storage_path TEXT NOT NULL,
            public_url TEXT NOT NULL,
            file_size INTEGER NOT NULL DEFAULT 0,
            media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')) DEFAULT 'photo',
            caption TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT session_media_file_size_positive CHECK (file_size >= 0)
        );

        RAISE NOTICE 'Created session_media table';
    ELSE
        -- Table exists, ensure all expected columns are present
        -- Add deleted_at if missing (should have been added by migration 2, but being defensive)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'session_media'
            AND column_name = 'deleted_at'
        ) THEN
            ALTER TABLE public.session_media ADD COLUMN deleted_at TIMESTAMPTZ;
            RAISE NOTICE 'Added deleted_at column to existing session_media table';
        END IF;

        RAISE NOTICE 'session_media table already exists';
    END IF;
END $$;

-- ================================================
-- Create indexes
-- ================================================

CREATE INDEX IF NOT EXISTS idx_session_media_session_id ON public.session_media(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_media_user_id ON public.session_media(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_media_deleted_at ON public.session_media(deleted_at);
CREATE INDEX IF NOT EXISTS idx_session_media_created_at ON public.session_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_media_media_type ON public.session_media(media_type);

-- ================================================
-- Enable RLS
-- ================================================

ALTER TABLE public.session_media ENABLE ROW LEVEL SECURITY;

-- ================================================
-- Create RLS policies
-- ================================================

-- Public can view non-deleted media from public sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media'
        AND policyname = 'Public can view media from public sessions'
    ) THEN
        CREATE POLICY "Public can view media from public sessions" ON public.session_media
            FOR SELECT
            USING (
                deleted_at IS NULL
                AND (
                    session_id IS NULL
                    OR EXISTS (
                        SELECT 1 FROM public.sessions
                        WHERE id = session_media.session_id
                        AND is_public = true
                        AND deleted_at IS NULL
                    )
                )
            );
    END IF;
END $$;

-- Users can view their own media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media'
        AND policyname = 'Users can view own media'
    ) THEN
        CREATE POLICY "Users can view own media" ON public.session_media
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Users can insert their own media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media'
        AND policyname = 'Users can insert own media'
    ) THEN
        CREATE POLICY "Users can insert own media" ON public.session_media
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Users can update their own media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media'
        AND policyname = 'Users can update own media'
    ) THEN
        CREATE POLICY "Users can update own media" ON public.session_media
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Users can delete their own media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media'
        AND policyname = 'Users can delete own media'
    ) THEN
        CREATE POLICY "Users can delete own media" ON public.session_media
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- ================================================
-- Create session_media_history table
-- ================================================

CREATE TABLE IF NOT EXISTS public.session_media_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Original media columns
    id UUID NOT NULL,
    session_id UUID,
    user_id UUID,
    storage_path TEXT,
    public_url TEXT,
    file_size INTEGER,
    media_type TEXT,
    caption TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    -- Audit columns
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_session_media_history_id ON public.session_media_history(id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_media_history_changed_at ON public.session_media_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_media_history_changed_by ON public.session_media_history(changed_by);

COMMENT ON TABLE public.session_media_history IS 'Audit trail for session_media table. Captures snapshots on UPDATE/DELETE operations.';

-- Enable RLS on history table
ALTER TABLE public.session_media_history ENABLE ROW LEVEL SECURITY;

-- Admins can view media history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media_history'
        AND policyname = 'Admins can view media history'
    ) THEN
        CREATE POLICY "Admins can view media history" ON public.session_media_history
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- ================================================
-- Create audit trigger
-- ================================================

DROP TRIGGER IF EXISTS log_session_media_changes ON public.session_media;
CREATE TRIGGER log_session_media_changes
    BEFORE UPDATE OR DELETE ON public.session_media
    FOR EACH ROW
    EXECUTE FUNCTION public.log_revision();

-- ================================================
-- Admin RLS policies
-- ================================================

-- Admin can view all session media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media'
        AND policyname = 'Admins can view all session media'
    ) THEN
        CREATE POLICY "Admins can view all session media" ON public.session_media
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admin can update any session media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media'
        AND policyname = 'Admins can update any session media'
    ) THEN
        CREATE POLICY "Admins can update any session media" ON public.session_media
            FOR UPDATE
            USING (public.is_admin_user())
            WITH CHECK (public.is_admin_user());
    END IF;
END $$;

-- Admin can delete any session media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'session_media'
        AND policyname = 'Admins can delete any session media'
    ) THEN
        CREATE POLICY "Admins can delete any session media" ON public.session_media
            FOR DELETE
            USING (public.is_admin_user());
    END IF;
END $$;

-- ================================================
-- Create storage cleanup function
-- ================================================

CREATE OR REPLACE FUNCTION public.cleanup_session_media_storage(
    media_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    storage_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    media_record RECORD;
    is_admin BOOLEAN;
BEGIN
    -- Check if user is admin or media owner
    SELECT
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    INTO is_admin;

    -- Get media record
    SELECT sm.*, (sm.user_id = auth.uid() OR is_admin) as can_delete
    INTO media_record
    FROM public.session_media sm
    WHERE sm.id = media_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Media not found', NULL::TEXT;
        RETURN;
    END IF;

    IF NOT media_record.can_delete THEN
        RETURN QUERY SELECT false, 'Unauthorized to delete this media', NULL::TEXT;
        RETURN;
    END IF;

    -- Soft delete the media record
    UPDATE public.session_media
    SET deleted_at = NOW()
    WHERE id = media_id
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Media already deleted', media_record.storage_path;
        RETURN;
    END IF;

    -- Return success with storage path for external cleanup
    RETURN QUERY SELECT
        true,
        'Media record soft-deleted. Storage cleanup required: ' || media_record.storage_path,
        media_record.storage_path;
END;
$$;

COMMENT ON FUNCTION public.cleanup_session_media_storage IS 'Soft deletes session media and returns storage path for cleanup. Caller must remove file from storage bucket separately.';

COMMIT;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.cleanup_session_media_storage(UUID);
-- DROP TRIGGER IF EXISTS log_session_media_changes ON public.session_media;
-- DROP POLICY IF EXISTS "Public can view media from public sessions" ON public.session_media;
-- DROP POLICY IF EXISTS "Users can view own media" ON public.session_media;
-- DROP POLICY IF EXISTS "Users can insert own media" ON public.session_media;
-- DROP POLICY IF EXISTS "Users can update own media" ON public.session_media;
-- DROP POLICY IF EXISTS "Users can delete own media" ON public.session_media;
-- DROP POLICY IF EXISTS "Admins can view all session media" ON public.session_media;
-- DROP POLICY IF EXISTS "Admins can update any session media" ON public.session_media;
-- DROP POLICY IF EXISTS "Admins can delete any session media" ON public.session_media;
-- DROP POLICY IF EXISTS "Admins can view media history" ON public.session_media_history;
-- DROP TABLE IF EXISTS public.session_media_history CASCADE;
-- DROP TABLE IF EXISTS public.session_media CASCADE;
-- COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- Verify session_media table exists:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'session_media'
-- ORDER BY ordinal_position;
--
-- Verify RLS policies:
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename = 'session_media'
-- ORDER BY policyname;
--
-- Test storage cleanup function:
-- SELECT * FROM public.cleanup_session_media_storage('some-media-uuid');
