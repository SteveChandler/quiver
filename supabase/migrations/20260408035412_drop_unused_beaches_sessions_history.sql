-- Backfilled from remote supabase_migrations.schema_migrations on 2026-04-08
-- to reconcile drift from a parallel branch that applied directly to prod.
-- This migration was already applied to prod on 2026-04-08 03:54:12 UTC.

-- Migration: Drop unused beaches_history and sessions_history audit tables
--
-- Why this exists:
-- Both tables were created 2025-10-24 as part of an "Admin Portal Workstream A"
-- build that was never wired up to a reader UI. Six months later:
--   - beaches_history: 2 total rows, 0 in last 30 days. Trigger has been
--     silently failing on every UPDATE since ~2025-12-08 due to schema drift
--     (17 missing columns vs public.beaches).
--   - sessions_history: 0 rows, ever.
--   - Zero references in lib/, app/, components/, hooks/, actions/ for either
--     table or the get_entity_history() RPC that was meant to read them.
--
-- What this migration does:
--   1. Drops the log_beaches_changes and log_sessions_changes triggers
--   2. Drops public.beaches_history and public.sessions_history (CASCADE cleans
--      up their indexes and RLS policies)
--   3. Updates get_entity_history() allowlist to remove 'beaches' and 'sessions'
--   4. Updates set_audit_triggers_enabled() to stop referencing the dropped
--      triggers
--
-- What this migration does NOT touch:
--   - beach_reviews_history (3,367 rows of real data) and its trigger
--   - beach_photos_history (12,851 rows of real data) and its trigger
--   - session_media_history (and its trigger) -- unrelated, still in use
--   - admin_audit_log (empty but referenced by lib/logging/admin-audit.ts)
--   - log_revision() function (still used by the three surviving triggers)
--
-- Rollback:
--   - Re-create the tables from 20251024000003_create_history_tables.sql
--   - Re-create the triggers from 20251024000004_create_audit_triggers.sql
--   - Restore get_entity_history and set_audit_triggers_enabled to their
--     previous definitions (also in 20251024000003 / 20251024000004)
--   - Historical data is NOT recoverable (the 2 beaches_history rows will be
--     lost)

BEGIN;

-- ================================================
-- 1. Drop triggers first (explicit, before tables)
-- ================================================

DROP TRIGGER IF EXISTS log_beaches_changes ON public.beaches;
DROP TRIGGER IF EXISTS log_sessions_changes ON public.sessions;

-- ================================================
-- 2. Drop tables (CASCADE drops indexes + RLS policies)
-- ================================================

DROP TABLE IF EXISTS public.beaches_history CASCADE;
DROP TABLE IF EXISTS public.sessions_history CASCADE;

-- ================================================
-- 3. Update get_entity_history allowlist
--    Removes 'beaches' and 'sessions' from the valid table_name list so
--    callers get a clean error instead of a dynamic query against a dropped
--    table. Body otherwise identical to 20251024000003.
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
    IF table_name NOT IN ('beach_reviews', 'beach_photos', 'session_media') THEN
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

-- ================================================
-- 4. Update set_audit_triggers_enabled
--    Stops referencing the dropped log_beaches_changes and
--    log_sessions_changes triggers. Body otherwise identical to 20251024000004.
-- ================================================

CREATE OR REPLACE FUNCTION public.set_audit_triggers_enabled(
    enabled BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    trigger_state TEXT;
    result_message TEXT;
BEGIN
    -- Only admins can disable audit triggers
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Only administrators can modify audit trigger state';
    END IF;

    IF enabled THEN
        trigger_state := 'ENABLE';
        result_message := 'Audit triggers enabled';
    ELSE
        trigger_state := 'DISABLE';
        result_message := 'Audit triggers disabled (WARNING: Changes will not be logged!)';
    END IF;

    -- Enable/disable triggers on all tracked tables
    EXECUTE format('ALTER TABLE public.beach_reviews %s TRIGGER log_beach_reviews_changes', trigger_state);

    -- Handle beach_photos if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'beach_photos'
    ) THEN
        EXECUTE format('ALTER TABLE public.beach_photos %s TRIGGER log_beach_photos_changes', trigger_state);
    END IF;

    -- Handle session_media if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media'
    ) THEN
        EXECUTE format('ALTER TABLE public.session_media %s TRIGGER log_session_media_changes', trigger_state);
    END IF;

    RETURN result_message;
END;
$$;

COMMENT ON FUNCTION public.set_audit_triggers_enabled IS 'Enable or disable audit triggers. Only admins can call this function. Use with caution - disabling triggers means changes will not be logged.';

COMMIT;
