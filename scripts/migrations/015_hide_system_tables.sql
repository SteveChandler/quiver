-- Hide System Tables from PostgREST
-- This prevents the Supabase security linter from flagging system tables
-- that don't need RLS policies because they're not meant to be user-accessible

-- Hide spatial_ref_sys from PostgREST API
-- This is a PostGIS system table containing spatial reference definitions
-- It doesn't need to be accessible via the API and cannot have RLS enabled by regular users
COMMENT ON TABLE spatial_ref_sys IS 'PostGIS spatial reference systems table
@hidden';

-- Also hide other PostGIS system tables if they exist
DO $$
BEGIN
    -- Hide geometry_columns if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'geometry_columns'
    ) THEN
        COMMENT ON TABLE geometry_columns IS 'PostGIS geometry columns metadata
@hidden';
        RAISE NOTICE 'Hidden geometry_columns table from PostgREST';
    END IF;

    -- Hide geography_columns if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'geography_columns'
    ) THEN
        COMMENT ON TABLE geography_columns IS 'PostGIS geography columns metadata
@hidden';
        RAISE NOTICE 'Hidden geography_columns table from PostgREST';
    END IF;

    RAISE NOTICE 'System tables hidden from PostgREST API';
    RAISE NOTICE 'This should resolve the spatial_ref_sys RLS security warning';
END $$; 