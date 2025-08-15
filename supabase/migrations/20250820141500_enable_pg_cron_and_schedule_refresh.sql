-- Enable pg_cron (if available) and schedule periodic refresh + analyze of MV

-- Create extension if present in environment
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions';
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if extension cannot be created (e.g. not available on this plan)
    NULL;
  END;
END $$;

-- Wrapper function: refresh MV and analyze for planner stats
CREATE OR REPLACE FUNCTION public.refresh_mv_beach_hourly_scores_and_analyze()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_mv_beach_hourly_scores();
  -- Update planner stats to keep queries fast
  PERFORM 1;
  BEGIN
    EXECUTE 'ANALYZE public.mv_beach_hourly_scores';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- Schedule every 2 hours at minute 5, if pg_cron is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'cron' AND p.proname = 'schedule') THEN
    PERFORM cron.schedule(
      'refresh_mv_scores_every_2h',
      '5 */2 * * *',
      'SELECT public.refresh_mv_beach_hourly_scores_and_analyze();'
    );
  END IF;
END $$;

COMMENT ON FUNCTION public.refresh_mv_beach_hourly_scores_and_analyze() IS 'Wrapper: refresh MV + compute scores + analyze; scheduled via pg_cron when available.';

