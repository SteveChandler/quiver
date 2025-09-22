-- Allow authenticated users to insert their own intel posts
-- Uses (select auth.uid()) pattern per supabase/ARCHITECTURE.md guidance
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intel_posts'
      AND policyname = 'intel_posts_insert_own'
  ) THEN
    EXECUTE 'CREATE POLICY intel_posts_insert_own
      ON public.intel_posts
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = (select auth.uid()))';
  END IF;
END
$$;

COMMIT;


