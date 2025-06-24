-- Alternative approach: Move system tables to a separate schema
-- This is a more aggressive approach if the @hidden comment doesn't work

-- Create a separate schema for system tables
CREATE SCHEMA IF NOT EXISTS postgis_system;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA postgis_system TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA postgis_system TO anon, authenticated, service_role;

-- Note: We cannot actually move spatial_ref_sys as it's owned by postgres
-- Instead, we'll create a view in the postgis_system schema for reference
-- and try to exclude the original from PostgREST

DO $$
BEGIN
    -- Try to create a view of spatial_ref_sys in the system schema
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'spatial_ref_sys'
    ) THEN
        -- Create a view in the system schema
        CREATE OR REPLACE VIEW postgis_system.spatial_ref_sys AS 
        SELECT * FROM public.spatial_ref_sys;
        
        -- Try to comment the original table to exclude it
        COMMENT ON TABLE public.spatial_ref_sys IS 'PostGIS system table - use postgis_system.spatial_ref_sys for API access';
        
        RAISE NOTICE 'Created view of spatial_ref_sys in postgis_system schema';
        RAISE NOTICE 'Original table commented to discourage direct access';
    END IF;
    
    -- Do the same for other PostGIS system tables
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'geometry_columns'
    ) THEN
        CREATE OR REPLACE VIEW postgis_system.geometry_columns AS 
        SELECT * FROM public.geometry_columns;
        
        COMMENT ON TABLE public.geometry_columns IS 'PostGIS system table - use postgis_system.geometry_columns for API access';
        
        RAISE NOTICE 'Created view of geometry_columns in postgis_system schema';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'geography_columns'
    ) THEN
        CREATE OR REPLACE VIEW postgis_system.geography_columns AS 
        SELECT * FROM public.geography_columns;
        
        COMMENT ON TABLE public.geography_columns IS 'PostGIS system table - use postgis_system.geography_columns for API access';
        
        RAISE NOTICE 'Created view of geography_columns in postgis_system schema';
    END IF;
    
END $$;

-- Add helpful comment
COMMENT ON SCHEMA postgis_system IS 'Schema containing PostGIS system table views for API access';

RAISE NOTICE 'Alternative system table handling complete';
RAISE NOTICE 'If PostgREST still exposes public.spatial_ref_sys, you may need to configure it at the project level'; 