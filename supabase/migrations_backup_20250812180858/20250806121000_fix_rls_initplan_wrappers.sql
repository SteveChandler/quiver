-- Fix RLS InitPlan warnings by wrapping auth.*() calls with SELECT wrappers
-- Lint: 0003_auth_rls_initplan

-- ================================================
-- intel_posts
-- ================================================
DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NULL THEN
    RAISE NOTICE 'Skipping RLS wrapper updates: intel_posts not found';
  ELSE
    -- Insert policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'intel_posts' AND policyname = 'Users can insert their own intel posts'
    ) THEN
      DROP POLICY "Users can insert their own intel posts" ON public.intel_posts;
    END IF;
    CREATE POLICY "Users can insert their own intel posts" ON public.intel_posts
      FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

    -- Update policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'intel_posts' AND policyname = 'Users can update their own intel posts'
    ) THEN
      DROP POLICY "Users can update their own intel posts" ON public.intel_posts;
    END IF;
    CREATE POLICY "Users can update their own intel posts" ON public.intel_posts
      FOR UPDATE USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    -- Delete policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'intel_posts' AND policyname = 'Users can delete their own intel posts'
    ) THEN
      DROP POLICY "Users can delete their own intel posts" ON public.intel_posts;
    END IF;
    CREATE POLICY "Users can delete their own intel posts" ON public.intel_posts
      FOR DELETE USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- ================================================
-- intel_post_confirmations
-- ================================================
DO $$
BEGIN
  IF to_regclass('public.intel_post_confirmations') IS NULL THEN
    RAISE NOTICE 'Skipping RLS wrapper updates: intel_post_confirmations not found';
  ELSE
    -- Insert policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'intel_post_confirmations' AND policyname = 'Users can insert their own confirmations'
    ) THEN
      DROP POLICY "Users can insert their own confirmations" ON public.intel_post_confirmations;
    END IF;
    CREATE POLICY "Users can insert their own confirmations" ON public.intel_post_confirmations
      FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

    -- Delete policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'intel_post_confirmations' AND policyname = 'Users can delete their own confirmations'
    ) THEN
      DROP POLICY "Users can delete their own confirmations" ON public.intel_post_confirmations;
    END IF;
    CREATE POLICY "Users can delete their own confirmations" ON public.intel_post_confirmations
      FOR DELETE USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- ================================================
-- session_forecast_snapshots
-- ================================================
DO $$
BEGIN
  IF to_regclass('public.session_forecast_snapshots') IS NULL THEN
    RAISE NOTICE 'Skipping RLS wrapper updates: session_forecast_snapshots not found';
  ELSE
    -- SELECT policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'session_forecast_snapshots' AND policyname = 'Users can view their own session forecast snapshots'
    ) THEN
      DROP POLICY "Users can view their own session forecast snapshots" ON public.session_forecast_snapshots;
    END IF;
    CREATE POLICY "Users can view their own session forecast snapshots" 
      ON public.session_forecast_snapshots FOR SELECT 
      USING ((select auth.uid()) = user_id);

    -- INSERT policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'session_forecast_snapshots' AND policyname = 'Users can insert their own session forecast snapshots'
    ) THEN
      DROP POLICY "Users can insert their own session forecast snapshots" ON public.session_forecast_snapshots;
    END IF;
    CREATE POLICY "Users can insert their own session forecast snapshots" 
      ON public.session_forecast_snapshots FOR INSERT 
      WITH CHECK ((select auth.uid()) = user_id);

    -- UPDATE policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'session_forecast_snapshots' AND policyname = 'Users can update their own session forecast snapshots'
    ) THEN
      DROP POLICY "Users can update their own session forecast snapshots" ON public.session_forecast_snapshots;
    END IF;
    CREATE POLICY "Users can update their own session forecast snapshots" 
      ON public.session_forecast_snapshots FOR UPDATE 
      USING ((select auth.uid()) = user_id);

    -- DELETE policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'session_forecast_snapshots' AND policyname = 'Users can delete their own session forecast snapshots'
    ) THEN
      DROP POLICY "Users can delete their own session forecast snapshots" ON public.session_forecast_snapshots;
    END IF;
    CREATE POLICY "Users can delete their own session forecast snapshots" 
      ON public.session_forecast_snapshots FOR DELETE 
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- ================================================
-- beach_forecast_accuracy
-- ================================================
DO $$
BEGIN
  IF to_regclass('public.beach_forecast_accuracy') IS NULL THEN
    RAISE NOTICE 'Skipping RLS wrapper updates: beach_forecast_accuracy not found';
  ELSE
    -- Service/Admin manage policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'beach_forecast_accuracy' AND policyname = 'Service role can manage beach forecast accuracy'
    ) THEN
      DROP POLICY "Service role can manage beach forecast accuracy" ON public.beach_forecast_accuracy;
    END IF;
    CREATE POLICY "Service role can manage beach forecast accuracy" 
      ON public.beach_forecast_accuracy FOR ALL 
      USING (
        (select auth.jwt()) ->> 'role' = 'service_role' OR
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE (select auth.uid()) = id 
          AND raw_app_meta_data->>'role' = 'admin'
        )
      );
  END IF;
END $$;


