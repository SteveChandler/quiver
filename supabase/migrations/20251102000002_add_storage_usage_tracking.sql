-- Migration: Add Storage Usage Tracking Infrastructure
-- Description: Adds storage_usage table and related functions for tracking user storage quotas
-- Date: 2025-11-02
-- Fixes: Photo upload failures due to missing storage tracking infrastructure

BEGIN;

-- ================================================
-- Create storage_usage table for quota tracking
-- ================================================

CREATE TABLE IF NOT EXISTS public.storage_usage (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_bytes BIGINT NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  image_count INTEGER NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_usage_user_id ON public.storage_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_usage_last_updated ON public.storage_usage(last_updated DESC);

COMMENT ON TABLE public.storage_usage IS 'Tracks storage usage per user for quota management (100MB default limit)';

-- ================================================
-- Enable RLS on storage_usage table
-- ================================================

ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own storage usage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'storage_usage'
        AND policyname = 'Users can view own storage usage'
    ) THEN
        CREATE POLICY "Users can view own storage usage" ON public.storage_usage
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Users can insert their own storage usage records
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'storage_usage'
        AND policyname = 'Users can insert own storage usage'
    ) THEN
        CREATE POLICY "Users can insert own storage usage" ON public.storage_usage
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Users can update their own storage usage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'storage_usage'
        AND policyname = 'Users can update own storage usage'
    ) THEN
        CREATE POLICY "Users can update own storage usage" ON public.storage_usage
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Admins can view all storage usage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'storage_usage'
        AND policyname = 'Admins can view all storage usage'
    ) THEN
        CREATE POLICY "Admins can view all storage usage" ON public.storage_usage
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- ================================================
-- RPC Function: update_user_storage_usage()
-- ================================================
-- Called by storage.ts after successful file upload
-- Updates user's storage tracking atomically

CREATE OR REPLACE FUNCTION public.update_user_storage_usage(
  p_user_id UUID,
  p_bytes_to_add INTEGER,
  p_images_to_add INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.storage_usage (user_id, total_bytes, image_count, last_updated)
  VALUES (
    p_user_id,
    GREATEST(0, p_bytes_to_add),
    GREATEST(0, p_images_to_add),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_bytes = GREATEST(0, public.storage_usage.total_bytes + p_bytes_to_add),
    image_count = GREATEST(0, public.storage_usage.image_count + p_images_to_add),
    last_updated = NOW();
END;
$$;

COMMENT ON FUNCTION public.update_user_storage_usage IS 'Updates user storage usage tracking. Called after successful file upload. Supports negative values for deletion.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_storage_usage TO authenticated;

-- ================================================
-- Trigger Function: track_session_media_upload()
-- ================================================
-- Automatically updates storage_usage when media is inserted/deleted

CREATE OR REPLACE FUNCTION public.track_session_media_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update storage usage when new media is inserted
  IF TG_OP = 'INSERT' THEN
    PERFORM public.update_user_storage_usage(NEW.user_id, NEW.file_size, 1);
    RETURN NEW;
  END IF;

  -- Update storage usage when media is deleted
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_user_storage_usage(OLD.user_id, -OLD.file_size, -1);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.track_session_media_upload IS 'Trigger function that automatically updates storage_usage when session_media records are inserted or deleted';

-- ================================================
-- Create trigger on session_media table
-- ================================================

DROP TRIGGER IF EXISTS trigger_track_session_media_upload ON public.session_media;
CREATE TRIGGER trigger_track_session_media_upload
  AFTER INSERT OR DELETE ON public.session_media
  FOR EACH ROW
  EXECUTE FUNCTION public.track_session_media_upload();

-- ================================================
-- Helper Function: cleanup_orphaned_session_media()
-- ================================================
-- Removes media records that reference deleted sessions

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_session_media()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete media records that reference non-existent sessions
  DELETE FROM public.session_media
  WHERE session_id NOT IN (SELECT id FROM public.sessions);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_orphaned_session_media IS 'Removes session_media records that reference deleted sessions. Returns count of deleted records.';

-- ================================================
-- Helper Function: get_user_storage_stats()
-- ================================================
-- Returns comprehensive storage statistics for a user

CREATE OR REPLACE FUNCTION public.get_user_storage_stats(p_user_id UUID)
RETURNS TABLE (
  total_bytes BIGINT,
  image_count INTEGER,
  remaining_bytes BIGINT,
  usage_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_limit CONSTANT BIGINT := 104857600; -- 100MB per user
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(su.total_bytes, 0) as total_bytes,
    COALESCE(su.image_count, 0) as image_count,
    GREATEST(0, user_limit - COALESCE(su.total_bytes, 0)) as remaining_bytes,
    ROUND((COALESCE(su.total_bytes, 0)::NUMERIC / user_limit::NUMERIC) * 100, 2) as usage_percentage
  FROM public.storage_usage su
  WHERE su.user_id = p_user_id
  UNION ALL
  SELECT 0::BIGINT, 0::INTEGER, user_limit, 0.00::NUMERIC
  WHERE NOT EXISTS (SELECT 1 FROM public.storage_usage WHERE user_id = p_user_id)
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_user_storage_stats IS 'Returns storage statistics for a user including total bytes, image count, remaining quota, and usage percentage';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_storage_stats TO authenticated;

COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- After migration, verify with:
--
-- -- Check table exists:
-- SELECT EXISTS (
--     SELECT 1 FROM information_schema.tables
--     WHERE table_schema = 'public' AND table_name = 'storage_usage'
-- ) as storage_usage_exists;
--
-- -- Check function exists:
-- SELECT EXISTS (
--     SELECT 1 FROM pg_proc p
--     JOIN pg_namespace n ON p.pronamespace = n.oid
--     WHERE n.nspname = 'public' AND p.proname = 'update_user_storage_usage'
-- ) as function_exists;
--
-- -- Test getting storage stats:
-- SELECT * FROM public.get_user_storage_stats(auth.uid());
--
-- -- Check trigger exists:
-- SELECT tgname FROM pg_trigger
-- WHERE tgrelid = 'public.session_media'::regclass
-- AND tgname = 'trigger_track_session_media_upload';
