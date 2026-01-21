-- Enable pg_stat_statements extension for query performance monitoring
-- This extension tracks execution statistics of all SQL statements
--
-- What pg_stat_statements provides:
-- - Tracks execution statistics for all SQL statements
-- - Shows total/mean execution time per query
-- - Tracks number of calls, rows returned
-- - Essential for identifying slow queries and optimization targets

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_stat_statements extension could not be created: %', SQLERRM;
  END;
END $$;

-- Verify installation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
    RAISE NOTICE 'pg_stat_statements is not available - this is expected in some environments';
  ELSE
    RAISE NOTICE 'pg_stat_statements extension enabled successfully';
  END IF;
END $$;

-- Note: On Supabase hosted, pg_stat_statements may already be enabled at the instance level
-- This migration ensures it's available and documents its presence in the migration history
