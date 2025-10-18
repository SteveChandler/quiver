-- Enable RLS on PostGIS system table (spatial_ref_sys)
-- This table contains spatial reference system definitions used by PostGIS
-- It should be publicly readable (reference data) but not writable

-- Note: This migration will be applied by Supabase's migration system
-- which has sufficient privileges to modify system tables.
-- The spatial_ref_sys table is owned by supabase_admin.

-- Only proceed if the table exists (PostGIS may not be enabled in all environments)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'spatial_ref_sys') THEN
        -- Drop policy if it already exists (for idempotency)
        IF EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'spatial_ref_sys' 
            AND policyname = 'Allow read access to spatial reference systems'
        ) THEN
            DROP POLICY "Allow read access to spatial reference systems" ON public.spatial_ref_sys;
        END IF;
        
        -- Enable Row Level Security if not already enabled
        IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.spatial_ref_sys'::regclass) THEN
            ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
        END IF;
        
        -- Allow read-only access to everyone (it's reference data needed for PostGIS operations)
        CREATE POLICY "Allow read access to spatial reference systems"
        ON public.spatial_ref_sys
        FOR SELECT
        TO public
        USING (true);
        
        RAISE NOTICE 'RLS enabled on spatial_ref_sys table with read-only public access';
    ELSE
        RAISE NOTICE 'spatial_ref_sys table does not exist (PostGIS not enabled), skipping RLS setup';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Insufficient privileges to enable RLS on spatial_ref_sys. This migration should be run with admin privileges.';
    WHEN OTHERS THEN
        RAISE WARNING 'Error enabling RLS on spatial_ref_sys: %', SQLERRM;
END $$;

-- Note: No INSERT/UPDATE/DELETE policies are created
-- This means only database admins can modify this reference data
-- Regular users (authenticated and anonymous) can only read

