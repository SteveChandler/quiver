--
-- Supabase Security Linter Remediation
--
-- Issues addressed:
-- 1) security_definer_view: View `public.v_beach_hourly_scores` runs with definer rights.
--    Fix: Set `security_invoker = true` so the view respects caller permissions/RLS.
-- 2) rls_disabled_in_public: RLS disabled on public tables exposed to PostgREST.
--    Fix: Enable RLS and add least‑privilege policies on:
--       - public.beaches (public read-only)
--       - public.beach_recommendation_calibration (public read-only)
--       - public.beach_review_likes (authenticated read; user-owned insert/delete)
--
-- Pattern: Least privilege, invoker-rights views, and explicit GRANTs with RLS guarding access.
-- Safety: Conditional blocks to allow re-runs; drops/re-creates policies idempotently.

BEGIN;

-- 1) Ensure v_beach_hourly_scores uses invoker rights
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'v_beach_hourly_scores'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_beach_hourly_scores SET (security_invoker = true)';
    COMMENT ON VIEW public.v_beach_hourly_scores IS 'Per-hour beach suitability scores (0-100). Security: security_invoker = true so underlying table RLS applies to caller.';

    -- Make the view selectable by anon/auth; underlying RLS still applies
    GRANT SELECT ON public.v_beach_hourly_scores TO anon, authenticated;
  ELSE
    RAISE NOTICE 'View public.v_beach_hourly_scores does not exist - skipping security_invoker fix';
  END IF;
END
$$;

-- 2) Enable RLS and policies: public.beaches (public read-only)
DO $$
BEGIN
  IF to_regclass('public.beaches') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.beaches ENABLE ROW LEVEL SECURITY';

    -- Idempotent policy recreate
    EXECUTE 'DROP POLICY IF EXISTS "Public read beaches" ON public.beaches';
    EXECUTE 'CREATE POLICY "Public read beaches" ON public.beaches FOR SELECT TO anon, authenticated USING (true)';

    -- Tighten privileges to least required
    EXECUTE 'REVOKE ALL ON public.beaches FROM PUBLIC';
    EXECUTE 'GRANT SELECT ON public.beaches TO anon, authenticated';
  ELSE
    RAISE NOTICE 'Table public.beaches not found - skipping RLS/policies';
  END IF;
END
$$;

-- 3) Enable RLS and policies: public.beach_recommendation_calibration (public read-only)
DO $$
BEGIN
  IF to_regclass('public.beach_recommendation_calibration') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.beach_recommendation_calibration ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Public read calibration" ON public.beach_recommendation_calibration';
    EXECUTE 'CREATE POLICY "Public read calibration" ON public.beach_recommendation_calibration FOR SELECT TO anon, authenticated USING (true)';

    EXECUTE 'REVOKE ALL ON public.beach_recommendation_calibration FROM PUBLIC';
    EXECUTE 'GRANT SELECT ON public.beach_recommendation_calibration TO anon, authenticated';
  ELSE
    RAISE NOTICE 'Table public.beach_recommendation_calibration not found - skipping RLS/policies';
  END IF;
END
$$;

-- 4) Enable RLS and policies: public.beach_review_likes (authenticated read; user-owned write/delete)
DO $$
BEGIN
  IF to_regclass('public.beach_review_likes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.beach_review_likes ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Read likes (auth)" ON public.beach_review_likes';
    EXECUTE 'DROP POLICY IF EXISTS "Insert own like" ON public.beach_review_likes';
    EXECUTE 'DROP POLICY IF EXISTS "Delete own like" ON public.beach_review_likes';

    EXECUTE 'CREATE POLICY "Read likes (auth)" ON public.beach_review_likes FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "Insert own like" ON public.beach_review_likes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()))';
    EXECUTE 'CREATE POLICY "Delete own like" ON public.beach_review_likes FOR DELETE TO authenticated USING (user_id = (select auth.uid()))';

    EXECUTE 'REVOKE ALL ON public.beach_review_likes FROM PUBLIC';
    EXECUTE 'GRANT SELECT ON public.beach_review_likes TO authenticated';
  ELSE
    RAISE NOTICE 'Table public.beach_review_likes not found - skipping RLS/policies';
  END IF;
END
$$;

COMMIT;

-- 📋 Verification (run in SQL editor)
-- 1) Check view option
--   SELECT viewname, security_invoker FROM pg_views WHERE schemaname='public' AND viewname='v_beach_hourly_scores';
-- 2) Confirm RLS enabled
--   SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relname IN ('beaches','beach_recommendation_calibration','beach_review_likes');
-- 3) List policies
--   SELECT polname, polcmd, polroles::regrole[] FROM pg_policies WHERE schemaname='public' AND tablename IN ('beaches','beach_recommendation_calibration','beach_review_likes');

