-- Migration: Create History Tables
-- Description: Create audit history tables for tracking changes to managed entities
-- Date: 2025-10-24
-- Author: Admin Portal Implementation (Workstream A)

BEGIN;

-- ================================================
-- 1. Create beaches_history table
-- ================================================

CREATE TABLE IF NOT EXISTS public.beaches_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Original beach columns
    id UUID NOT NULL,
    name TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_private BOOLEAN,
    owner_id UUID,
    created_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    -- Additional columns from existing schema
    geog GEOGRAPHY(POINT, 4326),
    region_id UUID,
    best_tide_height NUMERIC,
    best_tide_type TEXT,
    best_swell_direction TEXT,
    best_wind_direction TEXT,
    experience_level TEXT,
    break_type TEXT,
    amenities TEXT[],
    hazards TEXT[],
    description TEXT,
    photo_url TEXT,
    -- Audit columns
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_beaches_history_id ON public.beaches_history(id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_beaches_history_changed_at ON public.beaches_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_beaches_history_changed_by ON public.beaches_history(changed_by);

COMMENT ON TABLE public.beaches_history IS 'Audit trail for beaches table. Captures snapshots on UPDATE/DELETE operations.';

-- ================================================
-- 2. Create sessions_history table
-- ================================================

CREATE TABLE IF NOT EXISTS public.sessions_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Original session columns
    id UUID NOT NULL,
    profile_id UUID,
    user_id UUID,
    beach_id UUID,
    board_id UUID,
    arrival_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    goals TEXT[],
    notes TEXT,
    invitee_ids UUID[],
    created_at TIMESTAMPTZ,
    status TEXT,
    beach_name TEXT,
    rating SMALLINT,
    description TEXT,
    image_url TEXT,
    likes_count INTEGER,
    comments_count INTEGER,
    crowd_level INTEGER,
    wave_quality INTEGER,
    water_temp NUMERIC,
    parking_ease INTEGER,
    is_public BOOLEAN,
    deleted_at TIMESTAMPTZ,
    -- Audit columns
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_history_id ON public.sessions_history(id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_history_changed_at ON public.sessions_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_history_changed_by ON public.sessions_history(changed_by);

COMMENT ON TABLE public.sessions_history IS 'Audit trail for sessions table. Captures snapshots on UPDATE/DELETE operations.';

-- ================================================
-- 3. Create beach_reviews_history table
-- ================================================

CREATE TABLE IF NOT EXISTS public.beach_reviews_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Original review columns
    id UUID NOT NULL,
    beach_id UUID,
    user_id UUID,
    overall_rating INTEGER,
    wave_quality_rating INTEGER,
    crowd_density_rating INTEGER,
    parking_rating INTEGER,
    accessibility_rating INTEGER,
    title VARCHAR(255),
    content TEXT,
    visit_date DATE,
    helpful_count INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    -- Audit columns
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_beach_reviews_history_id ON public.beach_reviews_history(id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_beach_reviews_history_changed_at ON public.beach_reviews_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_beach_reviews_history_changed_by ON public.beach_reviews_history(changed_by);

COMMENT ON TABLE public.beach_reviews_history IS 'Audit trail for beach_reviews table. Captures snapshots on UPDATE/DELETE operations.';

-- ================================================
-- 4. Create beach_photos_history table
-- ================================================

CREATE TABLE IF NOT EXISTS public.beach_photos_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Original photo columns
    id UUID NOT NULL,
    beach_id UUID,
    source TEXT,
    source_id TEXT,
    image_url TEXT,
    thumb_url TEXT,
    title TEXT,
    creator_name TEXT,
    creator_url TEXT,
    license_code TEXT,
    license_url TEXT,
    attribution_html TEXT,
    fetched_at TIMESTAMPTZ,
    approved BOOLEAN,
    deleted_at TIMESTAMPTZ,
    -- Audit columns
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_beach_photos_history_id ON public.beach_photos_history(id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_beach_photos_history_changed_at ON public.beach_photos_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_beach_photos_history_changed_by ON public.beach_photos_history(changed_by);

COMMENT ON TABLE public.beach_photos_history IS 'Audit trail for beach_photos table. Captures snapshots on UPDATE/DELETE operations.';

-- ================================================
-- 5. Create session_media_history table (if parent exists)
-- ================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media'
    ) THEN
        -- Create history table matching session_media structure
        CREATE TABLE IF NOT EXISTS public.session_media_history (
            history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            -- Original media columns (matching SessionMediaFallbackRow structure)
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

        RAISE NOTICE 'Created session_media_history table';
    ELSE
        RAISE NOTICE 'session_media table does not exist - history table will be created with migration 6';
    END IF;
END $$;

-- Add comment only if table was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media_history'
    ) THEN
        COMMENT ON TABLE public.session_media_history IS 'Audit trail for session_media table. Captures snapshots on UPDATE/DELETE operations.';
    END IF;
END $$;

-- ================================================
-- Create helper function to query history
-- ================================================

CREATE OR REPLACE FUNCTION public.get_entity_history(
    table_name TEXT,
    entity_id UUID,
    limit_rows INTEGER DEFAULT 50
)
RETURNS TABLE (
    history_id UUID,
    changed_at TIMESTAMPTZ,
    changed_by UUID,
    change_type TEXT,
    snapshot JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sql_query TEXT;
BEGIN
    -- Validate table name to prevent SQL injection
    IF table_name NOT IN ('beaches', 'sessions', 'beach_reviews', 'beach_photos', 'session_media') THEN
        RAISE EXCEPTION 'Invalid table name: %', table_name;
    END IF;

    -- Build and execute history query
    sql_query := format(
        'SELECT history_id, changed_at, changed_by, change_type, to_jsonb(h.*) as snapshot
         FROM public.%I h
         WHERE id = $1
         ORDER BY changed_at DESC
         LIMIT $2',
        table_name || '_history'
    );

    RETURN QUERY EXECUTE sql_query USING entity_id, limit_rows;
END;
$$;

COMMENT ON FUNCTION public.get_entity_history IS 'Retrieve audit history for a specific entity. Returns up to limit_rows most recent changes.';

COMMIT;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.get_entity_history(TEXT, UUID, INTEGER);
-- DROP TABLE IF EXISTS public.beaches_history CASCADE;
-- DROP TABLE IF EXISTS public.sessions_history CASCADE;
-- DROP TABLE IF EXISTS public.beach_reviews_history CASCADE;
-- DROP TABLE IF EXISTS public.beach_photos_history CASCADE;
-- DROP TABLE IF EXISTS public.session_media_history CASCADE;
-- COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- Verify history tables exist:
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name LIKE '%_history'
-- ORDER BY table_name;
--
-- Check history table structure:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'beaches_history'
-- ORDER BY ordinal_position;
--
-- Test history retrieval function:
-- SELECT * FROM public.get_entity_history('beaches', 'some-uuid-here', 10);
