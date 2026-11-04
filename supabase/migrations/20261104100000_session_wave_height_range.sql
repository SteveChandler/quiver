-- Log Session wave-height grid: the surfer picks a range, native stores both ends and the midpoint.
-- sessions.wave_height_ft keeps holding the midpoint (CHECK check_wave_height_ft: 0-50, NULL ok), so
-- every existing reader, including the forecast-accuracy observation matcher, is unchanged.
-- Rollback: ALTER TABLE public.sessions DROP COLUMN wave_height_min_ft, DROP COLUMN wave_height_max_ft;
BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS wave_height_min_ft numeric,
  ADD COLUMN IF NOT EXISTS wave_height_max_ft numeric;

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_wave_height_min_ft_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_wave_height_min_ft_check
  CHECK (wave_height_min_ft IS NULL OR (wave_height_min_ft >= 0 AND wave_height_min_ft <= 50));

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_wave_height_max_ft_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_wave_height_max_ft_check
  CHECK (wave_height_max_ft IS NULL OR (wave_height_max_ft >= 0 AND wave_height_max_ft <= 50));

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_wave_height_range_order_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_wave_height_range_order_check
  CHECK (wave_height_min_ft IS NULL OR wave_height_max_ft IS NULL OR wave_height_min_ft <= wave_height_max_ft);

COMMENT ON COLUMN public.sessions.wave_height_min_ft IS
  'Low end of the wave-height range (feet) the surfer logged from the Log Session grid. wave_height_ft holds the range midpoint. NULL when no range was logged.';
COMMENT ON COLUMN public.sessions.wave_height_max_ft IS
  'High end of the wave-height range (feet) the surfer logged from the Log Session grid. wave_height_ft holds the range midpoint. NULL when no range was logged.';

-- authenticated holds table-level SELECT/INSERT/UPDATE on sessions, which covers the new columns;
-- restated per column so a later table-level revoke cannot silently drop them.
GRANT SELECT (wave_height_min_ft, wave_height_max_ft),
      INSERT (wave_height_min_ft, wave_height_max_ft),
      UPDATE (wave_height_min_ft, wave_height_max_ft)
  ON public.sessions TO authenticated;

COMMIT;
