-- Ensure RLS and permissive read policies are in place for intel tables

BEGIN;

-- Enable RLS
ALTER TABLE IF EXISTS public.intel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.intel_post_confirmations ENABLE ROW LEVEL SECURITY;

-- Read policies for public read access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'intel_posts' AND policyname = 'Intel posts are publicly readable'
  ) THEN
    CREATE POLICY "Intel posts are publicly readable" ON public.intel_posts
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'intel_post_confirmations' AND policyname = 'Intel confirmations are readable'
  ) THEN
    CREATE POLICY "Intel confirmations are readable" ON public.intel_post_confirmations
      FOR SELECT USING (true);
  END IF;
END $$;

COMMIT;


