BEGIN;

-- Persist optional watch and FIT session metrics without changing existing track rows.
ALTER TABLE public.session_tracks
  ADD COLUMN IF NOT EXISTS water_temp_start_c real,
  ADD COLUMN IF NOT EXISTS water_temp_end_c real,
  ADD COLUMN IF NOT EXISTS calories smallint;

NOTIFY pgrst, 'reload schema';

COMMIT;
