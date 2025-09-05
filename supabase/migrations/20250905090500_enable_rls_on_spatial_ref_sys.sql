-- Enable RLS on PostGIS spatial_ref_sys to satisfy Supabase linter
-- Keep public read-only access with a permissive SELECT policy

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spatial_ref_sys'
  ) THEN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "spatial_ref_sys_select_all" ON public.spatial_ref_sys;
    CREATE POLICY "spatial_ref_sys_select_all" ON public.spatial_ref_sys
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ Enabled RLS on spatial_ref_sys with public SELECT policy';
END $$;


