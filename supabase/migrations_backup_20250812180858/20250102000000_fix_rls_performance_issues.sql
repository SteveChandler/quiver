-- Migration to fix RLS performance issues identified by Supabase database linter
-- This addresses:
-- 1. Auth RLS InitPlan issues (replace auth.uid() with (select auth.uid()))
-- 2. Multiple permissive policies (consolidate redundant policies)

-- ================================================
-- 1. Fix Auth RLS InitPlan Issues
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert their own intel posts" ON public.intel_posts;
    DROP POLICY IF EXISTS "Users can update their own intel posts" ON public.intel_posts;
    DROP POLICY IF EXISTS "Users can delete their own intel posts" ON public.intel_posts;

    CREATE POLICY "Users can insert their own intel posts" ON public.intel_posts
      FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

    CREATE POLICY "Users can update their own intel posts" ON public.intel_posts
      FOR UPDATE USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    CREATE POLICY "Users can delete their own intel posts" ON public.intel_posts
      FOR DELETE USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.intel_post_confirmations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert their own confirmations" ON public.intel_post_confirmations;
    DROP POLICY IF EXISTS "Users can delete their own confirmations" ON public.intel_post_confirmations;

    CREATE POLICY "Users can insert their own confirmations" ON public.intel_post_confirmations
      FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

    CREATE POLICY "Users can delete their own confirmations" ON public.intel_post_confirmations
      FOR DELETE USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role can manage enhanced forecasts" ON public.enhanced_forecasts;

    CREATE POLICY "Service role can manage enhanced forecasts" ON public.enhanced_forecasts
      FOR ALL USING ((select auth.jwt()) ->> 'role' = 'service_role');
  END IF;
END $$;

-- ================================================
-- 2. Fix Multiple Permissive Policies
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.buoys') IS NOT NULL THEN
    -- Remove redundant policies, keep only the essential ones
    DROP POLICY IF EXISTS "Service role can manage buoys" ON public.buoys;
    DROP POLICY IF EXISTS "Service role can insert buoys" ON public.buoys;
    DROP POLICY IF EXISTS "Service role can update buoys" ON public.buoys;
    DROP POLICY IF EXISTS "Service role can delete buoys" ON public.buoys;

    -- Keep the public read policy, create separate policies for service role operations
    CREATE POLICY "Service role can insert buoys" ON public.buoys
      FOR INSERT WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

    CREATE POLICY "Service role can update buoys" ON public.buoys
      FOR UPDATE USING ((select auth.jwt()) ->> 'role' = 'service_role');

    CREATE POLICY "Service role can delete buoys" ON public.buoys
      FOR DELETE USING ((select auth.jwt()) ->> 'role' = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    -- Remove redundant policies
    DROP POLICY IF EXISTS "Anyone can view enhanced forecasts" ON public.enhanced_forecasts;
    DROP POLICY IF EXISTS "Service role can insert enhanced forecasts" ON public.enhanced_forecasts;
    DROP POLICY IF EXISTS "Service role can update enhanced forecasts" ON public.enhanced_forecasts;
    DROP POLICY IF EXISTS "Service role can delete enhanced forecasts" ON public.enhanced_forecasts;

    -- Keep single public read policy and separate service role policies
    -- "Public can view enhanced forecasts" should remain as the single SELECT policy
    CREATE POLICY "Service role can insert enhanced forecasts" ON public.enhanced_forecasts
      FOR INSERT WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

    CREATE POLICY "Service role can update enhanced forecasts" ON public.enhanced_forecasts
      FOR UPDATE USING ((select auth.jwt()) ->> 'role' = 'service_role');

    CREATE POLICY "Service role can delete enhanced forecasts" ON public.enhanced_forecasts
      FOR DELETE USING ((select auth.jwt()) ->> 'role' = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.forecasts') IS NOT NULL THEN
    -- Remove redundant policies
    DROP POLICY IF EXISTS "Forecasts are viewable by everyone" ON public.forecasts;
    DROP POLICY IF EXISTS "Anyone can view forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Service role can insert forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Service role can update forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Service role can delete forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Service role can manage forecasts" ON public.forecasts;

    -- Keep single public read policy and separate service role policies
    -- "Public can view forecasts" should remain as the single SELECT policy
    CREATE POLICY "Service role can insert forecasts" ON public.forecasts
      FOR INSERT WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

    CREATE POLICY "Service role can update forecasts" ON public.forecasts
      FOR UPDATE USING ((select auth.jwt()) ->> 'role' = 'service_role');

    CREATE POLICY "Service role can delete forecasts" ON public.forecasts
      FOR DELETE USING ((select auth.jwt()) ->> 'role' = 'service_role');
  END IF;
END $$;

-- ================================================
-- 3. Add Comments for Transparency
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    COMMENT ON TABLE public.intel_posts IS 'Intel posts with optimized RLS policies for performance';
  END IF;

  IF to_regclass('public.intel_post_confirmations') IS NOT NULL THEN
    COMMENT ON TABLE public.intel_post_confirmations IS 'Intel post confirmations with optimized RLS policies for performance';
  END IF;
END $$;

-- Add success notification
DO $$
BEGIN
    RAISE NOTICE 'RLS Performance Optimization Complete:';
    RAISE NOTICE '  ✓ Fixed Auth RLS InitPlan issues (wrapped auth functions with select)';
    RAISE NOTICE '  ✓ Consolidated multiple permissive policies for better performance';
    RAISE NOTICE '  ✓ Affected tables: intel_posts, intel_post_confirmations, enhanced_forecasts, buoys, forecasts';
END $$; 