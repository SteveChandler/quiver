-- Migration: Add Admin RLS Policies
-- Description: Create RLS policies that allow admin users to bypass standard restrictions
-- Date: 2025-10-24
-- Author: Admin Portal Implementation (Workstream A)

BEGIN;

-- ================================================
-- Helper: Create admin check function for reuse
-- ================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND is_admin = true
    );
$$;

COMMENT ON FUNCTION public.is_admin_user IS 'Returns true if the current authenticated user is an admin. Used in RLS policies.';

-- ================================================
-- 1. Admin policies for beaches table
-- ================================================

-- Admin can select all beaches (including soft-deleted)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beaches'
        AND policyname = 'Admins can view all beaches'
    ) THEN
        CREATE POLICY "Admins can view all beaches" ON public.beaches
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admin can update any beach
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beaches'
        AND policyname = 'Admins can update any beach'
    ) THEN
        CREATE POLICY "Admins can update any beach" ON public.beaches
            FOR UPDATE
            USING (public.is_admin_user())
            WITH CHECK (public.is_admin_user());
    END IF;
END $$;

-- Admin can delete any beach
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beaches'
        AND policyname = 'Admins can delete any beach'
    ) THEN
        CREATE POLICY "Admins can delete any beach" ON public.beaches
            FOR DELETE
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admin can insert beaches
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beaches'
        AND policyname = 'Admins can insert beaches'
    ) THEN
        CREATE POLICY "Admins can insert beaches" ON public.beaches
            FOR INSERT
            WITH CHECK (public.is_admin_user());
    END IF;
END $$;

-- ================================================
-- 2. Admin policies for sessions table
-- ================================================

-- Admin can view all sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'sessions'
        AND policyname = 'Admins can view all sessions'
    ) THEN
        CREATE POLICY "Admins can view all sessions" ON public.sessions
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admin can update any session
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'sessions'
        AND policyname = 'Admins can update any session'
    ) THEN
        CREATE POLICY "Admins can update any session" ON public.sessions
            FOR UPDATE
            USING (public.is_admin_user())
            WITH CHECK (public.is_admin_user());
    END IF;
END $$;

-- Admin can delete any session
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'sessions'
        AND policyname = 'Admins can delete any session'
    ) THEN
        CREATE POLICY "Admins can delete any session" ON public.sessions
            FOR DELETE
            USING (public.is_admin_user());
    END IF;
END $$;

-- ================================================
-- 3. Admin policies for beach_reviews table
-- ================================================

-- Admin can view all reviews
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beach_reviews'
        AND policyname = 'Admins can view all reviews'
    ) THEN
        CREATE POLICY "Admins can view all reviews" ON public.beach_reviews
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admin can update any review
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beach_reviews'
        AND policyname = 'Admins can update any review'
    ) THEN
        CREATE POLICY "Admins can update any review" ON public.beach_reviews
            FOR UPDATE
            USING (public.is_admin_user())
            WITH CHECK (public.is_admin_user());
    END IF;
END $$;

-- Admin can delete any review
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beach_reviews'
        AND policyname = 'Admins can delete any review'
    ) THEN
        CREATE POLICY "Admins can delete any review" ON public.beach_reviews
            FOR DELETE
            USING (public.is_admin_user());
    END IF;
END $$;

-- ================================================
-- 4. Admin policies for beach_photos table (if exists)
-- ================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'beach_photos'
    ) THEN
        -- Admin can view all photos
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'beach_photos'
            AND policyname = 'Admins can view all photos'
        ) THEN
            CREATE POLICY "Admins can view all photos" ON public.beach_photos
                FOR SELECT
                USING (public.is_admin_user());
        END IF;

        -- Admin can update any photo
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'beach_photos'
            AND policyname = 'Admins can update any photo'
        ) THEN
            CREATE POLICY "Admins can update any photo" ON public.beach_photos
                FOR UPDATE
                USING (public.is_admin_user())
                WITH CHECK (public.is_admin_user());
        END IF;

        -- Admin can delete any photo
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'beach_photos'
            AND policyname = 'Admins can delete any photo'
        ) THEN
            CREATE POLICY "Admins can delete any photo" ON public.beach_photos
                FOR DELETE
                USING (public.is_admin_user());
        END IF;

        -- Admin can insert photos
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'beach_photos'
            AND policyname = 'Admins can insert photos'
        ) THEN
            CREATE POLICY "Admins can insert photos" ON public.beach_photos
                FOR INSERT
                WITH CHECK (public.is_admin_user());
        END IF;

        RAISE NOTICE 'Created admin RLS policies for beach_photos table';
    ELSE
        RAISE NOTICE 'beach_photos table does not exist - policies will be created when table is added';
    END IF;
END $$;

-- ================================================
-- 5. Admin policies for intel_posts table
-- ================================================

-- Admin can view all intel posts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'intel_posts'
        AND policyname = 'Admins can view all intel posts'
    ) THEN
        CREATE POLICY "Admins can view all intel posts" ON public.intel_posts
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admin can update any intel post
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'intel_posts'
        AND policyname = 'Admins can update any intel post'
    ) THEN
        CREATE POLICY "Admins can update any intel post" ON public.intel_posts
            FOR UPDATE
            USING (public.is_admin_user())
            WITH CHECK (public.is_admin_user());
    END IF;
END $$;

-- Admin can delete any intel post
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'intel_posts'
        AND policyname = 'Admins can delete any intel post'
    ) THEN
        CREATE POLICY "Admins can delete any intel post" ON public.intel_posts
            FOR DELETE
            USING (public.is_admin_user());
    END IF;
END $$;

-- ================================================
-- 6. Admin policies for session_media table (if exists)
-- ================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media'
    ) THEN
        -- Admin can view all session media
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

        -- Admin can update any session media
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

        -- Admin can delete any session media
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

        RAISE NOTICE 'Created admin RLS policies for session_media table';
    ELSE
        RAISE NOTICE 'session_media table does not exist - policies will be created with migration 6';
    END IF;
END $$;

-- ================================================
-- 7. Admin policies for history tables (view only)
-- ================================================

-- Admins can view beaches_history
ALTER TABLE public.beaches_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beaches_history'
        AND policyname = 'Admins can view beaches history'
    ) THEN
        CREATE POLICY "Admins can view beaches history" ON public.beaches_history
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admins can view sessions_history
ALTER TABLE public.sessions_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'sessions_history'
        AND policyname = 'Admins can view sessions history'
    ) THEN
        CREATE POLICY "Admins can view sessions history" ON public.sessions_history
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admins can view beach_reviews_history
ALTER TABLE public.beach_reviews_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'beach_reviews_history'
        AND policyname = 'Admins can view reviews history'
    ) THEN
        CREATE POLICY "Admins can view reviews history" ON public.beach_reviews_history
            FOR SELECT
            USING (public.is_admin_user());
    END IF;
END $$;

-- Admins can view beach_photos_history (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'beach_photos_history'
    ) THEN
        ALTER TABLE public.beach_photos_history ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'beach_photos_history'
            AND policyname = 'Admins can view photos history'
        ) THEN
            CREATE POLICY "Admins can view photos history" ON public.beach_photos_history
                FOR SELECT
                USING (public.is_admin_user());
        END IF;

        RAISE NOTICE 'Created admin RLS policy for beach_photos_history';
    END IF;
END $$;

-- Admins can view session_media_history (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media_history'
    ) THEN
        ALTER TABLE public.session_media_history ENABLE ROW LEVEL SECURITY;

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

        RAISE NOTICE 'Created admin RLS policy for session_media_history';
    END IF;
END $$;

COMMIT;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP POLICY IF EXISTS "Admins can view all beaches" ON public.beaches;
-- DROP POLICY IF EXISTS "Admins can update any beach" ON public.beaches;
-- DROP POLICY IF EXISTS "Admins can delete any beach" ON public.beaches;
-- DROP POLICY IF EXISTS "Admins can insert beaches" ON public.beaches;
-- DROP POLICY IF EXISTS "Admins can view all sessions" ON public.sessions;
-- DROP POLICY IF EXISTS "Admins can update any session" ON public.sessions;
-- DROP POLICY IF EXISTS "Admins can delete any session" ON public.sessions;
-- DROP POLICY IF EXISTS "Admins can view all reviews" ON public.beach_reviews;
-- DROP POLICY IF EXISTS "Admins can update any review" ON public.beach_reviews;
-- DROP POLICY IF EXISTS "Admins can delete any review" ON public.beach_reviews;
-- DROP POLICY IF EXISTS "Admins can view all photos" ON public.beach_photos;
-- DROP POLICY IF EXISTS "Admins can update any photo" ON public.beach_photos;
-- DROP POLICY IF EXISTS "Admins can delete any photo" ON public.beach_photos;
-- DROP POLICY IF EXISTS "Admins can insert photos" ON public.beach_photos;
-- DROP POLICY IF EXISTS "Admins can view all intel posts" ON public.intel_posts;
-- DROP POLICY IF EXISTS "Admins can update any intel post" ON public.intel_posts;
-- DROP POLICY IF EXISTS "Admins can delete any intel post" ON public.intel_posts;
-- DROP POLICY IF EXISTS "Admins can view all session media" ON public.session_media;
-- DROP POLICY IF EXISTS "Admins can update any session media" ON public.session_media;
-- DROP POLICY IF EXISTS "Admins can delete any session media" ON public.session_media;
-- DROP POLICY IF EXISTS "Admins can view beaches history" ON public.beaches_history;
-- DROP POLICY IF EXISTS "Admins can view sessions history" ON public.sessions_history;
-- DROP POLICY IF EXISTS "Admins can view reviews history" ON public.beach_reviews_history;
-- DROP POLICY IF EXISTS "Admins can view photos history" ON public.beach_photos_history;
-- DROP POLICY IF EXISTS "Admins can view media history" ON public.session_media_history;
-- DROP FUNCTION IF EXISTS public.is_admin_user();
-- COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- Verify admin policies exist:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND policyname LIKE '%Admin%'
-- ORDER BY tablename, policyname;
--
-- Test admin access (run as admin user):
-- SELECT COUNT(*) FROM public.beaches; -- Should include all beaches
-- SELECT COUNT(*) FROM public.beaches_history; -- Should show history
--
-- Test non-admin access (run as regular user):
-- SELECT COUNT(*) FROM public.beaches_history; -- Should return 0 or error
