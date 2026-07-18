-- Forward repair for the already-applied auto_title migration. Rebuild from
-- the live expression so later source additions are never removed.

BEGIN;

DO $$
DECLARE
  current_check text;
  candidate_sources text[] := ARRAY['auto_title'];
  missing_sources text[];
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.sessions'::regclass
    AND conname = 'sessions_source_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'sessions_source_check constraint not found';
  END IF;

  SELECT array_agg(source_name)
    INTO missing_sources
  FROM unnest(candidate_sources) AS source_name
  WHERE current_check NOT LIKE '%' || source_name || '%';

  IF missing_sources IS NULL OR array_length(missing_sources, 1) IS NULL THEN
    RAISE NOTICE 'auto_title is already allowed; no change.';
    RETURN;
  END IF;

  ALTER TABLE public.sessions
    DROP CONSTRAINT sessions_source_check;

  EXECUTE format(
    'ALTER TABLE public.sessions ADD CONSTRAINT sessions_source_check CHECK ((%s) OR source = ANY (%L::text[])) NOT VALID',
    current_check,
    missing_sources
  );

  ALTER TABLE public.sessions
    VALIDATE CONSTRAINT sessions_source_check;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
