-- Enable Supabase Realtime for Coast Pulse condition and session tables.
-- intel_posts is already in the publication (see 20251006000001).
-- Only INSERTs are subscribed, so default REPLICA IDENTITY (PK) is sufficient.

DO $$
BEGIN
  -- enhanced_forecasts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'enhanced_forecasts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.enhanced_forecasts;
  END IF;

  -- marine_forecasts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'marine_forecasts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marine_forecasts;
  END IF;

  -- tide_forecasts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tide_forecasts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tide_forecasts;
  END IF;

  -- sessions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
END $$;
