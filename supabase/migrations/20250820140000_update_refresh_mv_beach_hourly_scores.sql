-- Update refresh function to non-concurrent refresh to avoid unique-index requirement
CREATE OR REPLACE FUNCTION public.refresh_mv_beach_hourly_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_beach_hourly_scores;
END;
$$;

COMMENT ON FUNCTION public.refresh_mv_beach_hourly_scores() IS 'Refresh mv_beach_hourly_scores (non-concurrent)';

