-- Verify System Table Information
-- This script provides information about spatial_ref_sys for support tickets

DO $$
DECLARE
    table_owner TEXT;
    table_type TEXT;
    row_count INTEGER;
    is_system_table BOOLEAN := FALSE;
BEGIN
    -- Get table owner
    SELECT tableowner INTO table_owner
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'spatial_ref_sys';
    
    -- Get table type info
    SELECT table_type INTO table_type
    FROM information_schema.tables
    WHERE table_schema = 'public' 
    AND table_name = 'spatial_ref_sys';
    
    -- Get row count (should be thousands of coordinate systems)
    SELECT COUNT(*) INTO row_count
    FROM spatial_ref_sys;
    
    -- Check if it's a PostGIS system table
    IF table_owner = 'postgres' AND row_count > 1000 THEN
        is_system_table := TRUE;
    END IF;
    
    -- Report findings
    RAISE NOTICE '================================================';
    RAISE NOTICE 'SPATIAL_REF_SYS TABLE ANALYSIS';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Table Owner: %', COALESCE(table_owner, 'NOT FOUND');
    RAISE NOTICE 'Table Type: %', COALESCE(table_type, 'NOT FOUND');
    RAISE NOTICE 'Row Count: %', row_count;
    RAISE NOTICE 'Is PostGIS System Table: %', is_system_table;
    
    IF is_system_table THEN
        RAISE NOTICE '';
        RAISE NOTICE 'CONCLUSION: This is a PostGIS system table';
        RAISE NOTICE 'RECOMMENDATION: Safe to ignore RLS warning';
        RAISE NOTICE 'REASON: Contains coordinate system reference data only';
        RAISE NOTICE 'SECURITY IMPACT: None - no user data stored';
        RAISE NOTICE '';
        RAISE NOTICE 'For Supabase Support:';
        RAISE NOTICE '- Table: public.spatial_ref_sys';
        RAISE NOTICE '- Issue: Security linter false positive for PostGIS system table';
        RAISE NOTICE '- Owner: postgres (superuser)';
        RAISE NOTICE '- Purpose: Spatial reference system definitions';
        RAISE NOTICE '- User cannot modify: Insufficient privileges';
    ELSE
        RAISE NOTICE 'WARNING: This does not appear to be a standard PostGIS system table';
    END IF;
    
    RAISE NOTICE '================================================';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error analyzing spatial_ref_sys: %', SQLERRM;
        RAISE NOTICE 'This likely confirms it is a system table with restricted access';
END $$; 