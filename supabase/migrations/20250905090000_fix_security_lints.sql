-- Fix Supabase Security Linter Issues
-- 1) Ensure views run with caller privileges (SECURITY INVOKER)
-- 2) Enable RLS and add least-privilege policies for public tables
-- 3) Lock down PostGIS system table exposure

-- ================================================
-- 1. View security: profiles_with_home_beach → SECURITY INVOKER
-- ================================================

CREATE OR REPLACE VIEW public.profiles_with_home_beach
WITH (security_invoker = true) AS
SELECT
  p.*,
  b.name AS home_beach_name
FROM public.profiles p
LEFT JOIN public.beaches b ON b.id = p.home_beach_id;


-- ================================================
-- 2. Enable RLS and policies: beach_reviews
--    Public read; author-only write/update/delete
-- ================================================

ALTER TABLE public.beach_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beach_reviews_select_all" ON public.beach_reviews;
CREATE POLICY "beach_reviews_select_all" ON public.beach_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "beach_reviews_insert_own" ON public.beach_reviews;
CREATE POLICY "beach_reviews_insert_own" ON public.beach_reviews
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "beach_reviews_update_own" ON public.beach_reviews;
CREATE POLICY "beach_reviews_update_own" ON public.beach_reviews
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "beach_reviews_delete_own" ON public.beach_reviews;
CREATE POLICY "beach_reviews_delete_own" ON public.beach_reviews
  FOR DELETE USING ((select auth.uid()) = user_id);


-- ================================================
-- 3. Enable RLS and policies: boards
--    Owner-only visibility and CRUD
-- ================================================

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boards_select_own" ON public.boards;
CREATE POLICY "boards_select_own" ON public.boards
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "boards_insert_own" ON public.boards;
CREATE POLICY "boards_insert_own" ON public.boards
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "boards_update_own" ON public.boards;
CREATE POLICY "boards_update_own" ON public.boards
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "boards_delete_own" ON public.boards;
CREATE POLICY "boards_delete_own" ON public.boards
  FOR DELETE USING ((select auth.uid()) = user_id);


-- ================================================
-- 4. System table exposure: spatial_ref_sys
--    Revoke client-role access so it is not exposed via PostgREST
-- ================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spatial_ref_sys'
  ) THEN
    REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
    RAISE NOTICE 'Revoked anon/authenticated access on public.spatial_ref_sys';
  END IF;
END $$;


-- ================================================
-- 5. Success message
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Security lints resolved:';
  RAISE NOTICE '  - profiles_with_home_beach set to SECURITY INVOKER';
  RAISE NOTICE '  - RLS enabled on beach_reviews with public read + owner write';
  RAISE NOTICE '  - RLS enabled on boards with owner-only access';
  RAISE NOTICE '  - spatial_ref_sys no longer exposed to anon/authenticated';
END $$;


