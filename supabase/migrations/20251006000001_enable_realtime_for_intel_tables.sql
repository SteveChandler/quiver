-- Enable Realtime for Intel Tables
-- Adds intel_posts and intel_post_confirmations to the supabase_realtime publication
-- This is required for real-time subscriptions in the frontend to work

BEGIN;

-- Enable replica identity for intel_posts (required for realtime updates and deletes)
ALTER TABLE public.intel_posts REPLICA IDENTITY FULL;

-- Enable replica identity for intel_post_confirmations (required for realtime updates and deletes)
ALTER TABLE public.intel_post_confirmations REPLICA IDENTITY FULL;

-- Add intel_posts to the realtime publication
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'intel_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intel_posts;
  END IF;
END $$;

-- Add intel_post_confirmations to the realtime publication
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'intel_post_confirmations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intel_post_confirmations;
  END IF;
END $$;

COMMIT;

-- Verification: You can verify tables are in publication with:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'intel%';

