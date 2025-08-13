-- ROLLBACK Migration for RLS performance fixes
-- This can be used to revert the changes made in 20250102000000_fix_rls_performance_issues.sql
-- Only use this if there are issues with the performance optimizations

-- ================================================
-- ROLLBACK: Restore Original Intel Posts Policies
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert their own intel posts" ON public.intel_posts;
    DROP POLICY IF EXISTS "Users can update their own intel posts" ON public.intel_posts;
    DROP POLICY IF EXISTS "Users can delete their own intel posts" ON public.intel_posts;

    CREATE POLICY "Users can insert their own intel posts" ON public.intel_posts
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own intel posts" ON public.intel_posts
      FOR UPDATE USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own intel posts" ON public.intel_posts
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.intel_post_confirmations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert their own confirmations" ON public.intel_post_confirmations;
    DROP POLICY IF EXISTS "Users can delete their own confirmations" ON public.intel_post_confirmations;

    CREATE POLICY "Users can insert their own confirmations" ON public.intel_post_confirmations
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own confirmations" ON public.intel_post_confirmations
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ================================================
-- ROLLBACK: Restore Original Multiple Policies
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.enhanced_forecasts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public can view enhanced forecasts" ON public.enhanced_forecasts;
    DROP POLICY IF EXISTS "Anyone can view enhanced forecasts" ON public.enhanced_forecasts;
    DROP POLICY IF EXISTS "Service role can manage enhanced forecasts" ON public.enhanced_forecasts;
    DROP POLICY IF EXISTS "Service role can insert enhanced forecasts" ON public.enhanced_forecasts;
    DROP POLICY IF EXISTS "Service role can update enhanced forecasts" ON public.enhanced_forecasts;
    DROP POLICY IF EXISTS "Service role can delete enhanced forecasts" ON public.enhanced_forecasts;

    CREATE POLICY "Anyone can view enhanced forecasts" ON public.enhanced_forecasts
      FOR SELECT USING (true);

    CREATE POLICY "Service role can manage enhanced forecasts" ON public.enhanced_forecasts
      FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role' OR
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.uid() = id 
          AND raw_app_meta_data->>'role' = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.buoys') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public can view buoys" ON public.buoys;
    DROP POLICY IF EXISTS "Service role can manage buoys" ON public.buoys;
    DROP POLICY IF EXISTS "Service role can insert buoys" ON public.buoys;
    DROP POLICY IF EXISTS "Service role can update buoys" ON public.buoys;
    DROP POLICY IF EXISTS "Service role can delete buoys" ON public.buoys;

    CREATE POLICY "Service role can manage buoys" ON public.buoys
      FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.forecasts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public can view forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Forecasts are viewable by everyone" ON public.forecasts;
    DROP POLICY IF EXISTS "Anyone can view forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Service role can manage forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Service role can insert forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Service role can update forecasts" ON public.forecasts;
    DROP POLICY IF EXISTS "Service role can delete forecasts" ON public.forecasts;

    CREATE POLICY "Forecasts are viewable by everyone" ON public.forecasts
      FOR SELECT USING (true);

    CREATE POLICY "Service role can manage forecasts" ON public.forecasts
      FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- ================================================
-- ROLLBACK: Remove Comments
-- ================================================

DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    COMMENT ON TABLE public.intel_posts IS 'Community-generated surf intelligence and reports';
  END IF;
  IF to_regclass('public.intel_post_confirmations') IS NOT NULL THEN
    COMMENT ON TABLE public.intel_post_confirmations IS 'User confirmations of intel post accuracy';
  END IF;
END $$;

-- Add rollback notification
DO $$
BEGIN
    RAISE NOTICE 'RLS Performance Optimization ROLLBACK Complete:';
    RAISE NOTICE '  ⚠️ Restored original auth function calls (may cause performance issues)';
    RAISE NOTICE '  ⚠️ Restored multiple permissive policies (may cause performance overhead)';
    RAISE NOTICE '  ⚠️ You may see Supabase linter warnings again';
END $$; 