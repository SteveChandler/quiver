BEGIN;

-- Persist optional watch and FIT session metrics without changing existing track rows.
ALTER TABLE public.session_tracks
  ADD COLUMN IF NOT EXISTS water_temp_start_c real,
  ADD COLUMN IF NOT EXISTS water_temp_end_c real,
  ADD COLUMN IF NOT EXISTS calories smallint;

ALTER TABLE public.session_wave_corrections
  DROP CONSTRAINT IF EXISTS session_wave_corrections_action_check;
ALTER TABLE public.session_wave_corrections
  ADD CONSTRAINT session_wave_corrections_action_check CHECK (action IN ('exclude', 'include'));

NOTIFY pgrst, 'reload schema';

COMMIT;
