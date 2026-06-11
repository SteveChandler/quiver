BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS wave_characteristics TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_wave_characteristics_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_wave_characteristics_check
      CHECK (
        wave_characteristics IS NULL
        OR wave_characteristics <@ ARRAY[
          'clean',
          'glassy',
          'choppy',
          'blown_out',
          'fat',
          'mushy',
          'peaky',
          'powerful',
          'closeouts',
          'barreling',
          'reform',
          'walled'
        ]::text[]
      );
  END IF;
END $$;

COMMIT;
