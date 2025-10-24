-- Migration: Create Audit Trigger System
-- Description: Create trigger function and triggers to automatically log changes to history tables
-- Date: 2025-10-24
-- Author: Admin Portal Implementation (Workstream A)

BEGIN;

-- ================================================
-- Create the log_revision trigger function
-- ================================================

CREATE OR REPLACE FUNCTION public.log_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    history_table_name TEXT;
    change_type_value TEXT;
    changed_by_id UUID;
    insert_query TEXT;
    column_list TEXT;
    value_list TEXT;
BEGIN
    -- Determine history table name
    history_table_name := TG_TABLE_NAME || '_history';

    -- Determine change type
    IF TG_OP = 'DELETE' THEN
        change_type_value := 'DELETE';
    ELSIF TG_OP = 'UPDATE' THEN
        change_type_value := 'UPDATE';
    ELSE
        -- This trigger should only fire on UPDATE or DELETE
        RETURN OLD;
    END IF;

    -- Get the current user ID from auth context (if available)
    BEGIN
        changed_by_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        changed_by_id := NULL;
    END;

    -- Build column list from OLD record
    -- We'll use a dynamic approach to capture all columns
    SELECT
        string_agg(column_name, ', ' ORDER BY ordinal_position),
        string_agg('($1).' || column_name, ', ' ORDER BY ordinal_position)
    INTO column_list, value_list
    FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA
    AND table_name = TG_TABLE_NAME
    AND column_name NOT IN ('changed_at', 'changed_by', 'change_type', 'history_id');

    -- Build and execute dynamic insert query
    insert_query := format(
        'INSERT INTO %I.%I (%s, changed_at, changed_by, change_type) VALUES (%s, NOW(), $2, $3)',
        TG_TABLE_SCHEMA,
        history_table_name,
        column_list,
        value_list
    );

    -- Execute the insert
    EXECUTE insert_query USING OLD, changed_by_id, change_type_value;

    -- Return the appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the operation
    RAISE WARNING 'Failed to log revision for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.log_revision IS 'Trigger function that automatically logs row changes to corresponding history tables. Fires BEFORE UPDATE OR DELETE.';

-- ================================================
-- Create triggers for beaches table
-- ================================================

DROP TRIGGER IF EXISTS log_beaches_changes ON public.beaches;
CREATE TRIGGER log_beaches_changes
    BEFORE UPDATE OR DELETE ON public.beaches
    FOR EACH ROW
    EXECUTE FUNCTION public.log_revision();

-- ================================================
-- Create triggers for sessions table
-- ================================================

DROP TRIGGER IF EXISTS log_sessions_changes ON public.sessions;
CREATE TRIGGER log_sessions_changes
    BEFORE UPDATE OR DELETE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_revision();

-- ================================================
-- Create triggers for beach_reviews table
-- ================================================

DROP TRIGGER IF EXISTS log_beach_reviews_changes ON public.beach_reviews;
CREATE TRIGGER log_beach_reviews_changes
    BEFORE UPDATE OR DELETE ON public.beach_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.log_revision();

-- ================================================
-- Create triggers for beach_photos table (if exists)
-- ================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'beach_photos'
    ) THEN
        DROP TRIGGER IF EXISTS log_beach_photos_changes ON public.beach_photos;
        CREATE TRIGGER log_beach_photos_changes
            BEFORE UPDATE OR DELETE ON public.beach_photos
            FOR EACH ROW
            EXECUTE FUNCTION public.log_revision();

        RAISE NOTICE 'Created audit trigger for beach_photos table';
    ELSE
        RAISE NOTICE 'beach_photos table does not exist - trigger will be created when table is added';
    END IF;
END $$;

-- ================================================
-- Create triggers for session_media table (if exists)
-- ================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_media'
    ) THEN
        DROP TRIGGER IF EXISTS log_session_media_changes ON public.session_media;
        CREATE TRIGGER log_session_media_changes
            BEFORE UPDATE OR DELETE ON public.session_media
            FOR EACH ROW
            EXECUTE FUNCTION public.log_revision();

        RAISE NOTICE 'Created audit trigger for session_media table';
    ELSE
        RAISE NOTICE 'session_media table does not exist - trigger will be created with migration 6';
    END IF;
END $$;

-- ================================================
-- Create helper function to disable/enable triggers
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
    EXECUTE format('ALTER TABLE public.beaches %s TRIGGER log_beaches_changes', trigger_state);
    EXECUTE format('ALTER TABLE public.sessions %s TRIGGER log_sessions_changes', trigger_state);
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

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.set_audit_triggers_enabled(BOOLEAN);
-- DROP TRIGGER IF EXISTS log_beaches_changes ON public.beaches;
-- DROP TRIGGER IF EXISTS log_sessions_changes ON public.sessions;
-- DROP TRIGGER IF EXISTS log_beach_reviews_changes ON public.beach_reviews;
-- DROP TRIGGER IF EXISTS log_beach_photos_changes ON public.beach_photos;
-- DROP TRIGGER IF EXISTS log_session_media_changes ON public.session_media;
-- DROP FUNCTION IF EXISTS public.log_revision() CASCADE;
-- COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
-- Verify triggers exist:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- AND trigger_name LIKE 'log_%_changes'
-- ORDER BY event_object_table;
--
-- Test trigger functionality:
-- -- Make a test update
-- UPDATE public.beaches SET name = name WHERE id = (SELECT id FROM public.beaches LIMIT 1);
--
-- -- Verify history was logged
-- SELECT * FROM public.beaches_history ORDER BY changed_at DESC LIMIT 5;
--
-- -- Test soft delete logging
-- UPDATE public.beaches SET deleted_at = NOW() WHERE id = (SELECT id FROM public.beaches LIMIT 1);
-- SELECT * FROM public.beaches_history WHERE id = (SELECT id FROM public.beaches LIMIT 1) ORDER BY changed_at DESC LIMIT 1;
--
-- -- Check trigger status
-- SELECT trigger_name, action_timing, event_manipulation, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- AND action_statement LIKE '%log_revision%';
