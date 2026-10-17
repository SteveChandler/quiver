BEGIN;

-- Imported track files and derived wave data remain private to their owner.
CREATE TABLE IF NOT EXISTS public.session_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text,
  sha256 text,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'needs_beach', 'completed', 'failed')),
  error text,
  session_id uuid REFERENCES public.sessions ON DELETE SET NULL,
  summary jsonb,
  purge_requested_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, sha256)
);

CREATE TABLE IF NOT EXISTS public.session_tracks (
  session_id uuid PRIMARY KEY REFERENCES public.sessions ON DELETE CASCADE,
  user_id uuid NOT NULL,
  import_id uuid REFERENCES public.session_imports ON DELETE SET NULL,
  storage_path text NOT NULL,
  format text NOT NULL CHECK (format IN ('fit', 'gpx')),
  sha256 text NOT NULL,
  recorded_by text,
  sport text,
  sub_sport text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  sample_count int NOT NULL,
  gps_coverage real NOT NULL,
  max_gap_s int NOT NULL,
  speed_reliable boolean NOT NULL DEFAULT true,
  user_wave_count int CHECK (user_wave_count BETWEEN 0 AND 200),
  timing_from_track boolean NOT NULL DEFAULT true,
  user_arrival_time timestamptz,
  user_duration_minutes int,
  track_geojson jsonb NOT NULL,
  speed_series jsonb NOT NULL,
  water_temp_c real,
  purge_requested_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_waves (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions ON DELETE CASCADE,
  user_id uuid NOT NULL,
  detection_version text NOT NULL,
  wave_index int NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_s real NOT NULL,
  distance_m real NOT NULL,
  max_speed_mps real,
  avg_speed_mps real,
  start_lat double precision NOT NULL,
  start_lon double precision NOT NULL,
  end_lat double precision NOT NULL,
  end_lon double precision NOT NULL,
  heading_deg real,
  confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  created_at timestamptz DEFAULT now(),
  UNIQUE (session_id, detection_version, wave_index)
);

CREATE INDEX IF NOT EXISTS session_waves_current_session_idx
  ON public.session_waves (session_id) WHERE is_current;

CREATE TABLE IF NOT EXISTS public.session_wave_corrections (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  action text NOT NULL CHECK (action = 'exclude'),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_wave_corrections_session_id_idx
  ON public.session_wave_corrections (session_id);
CREATE INDEX IF NOT EXISTS session_imports_session_id_idx
  ON public.session_imports (session_id);
CREATE INDEX IF NOT EXISTS session_tracks_import_id_idx
  ON public.session_tracks (import_id);
CREATE INDEX IF NOT EXISTS session_tracks_user_id_idx
  ON public.session_tracks (user_id);

DROP TRIGGER IF EXISTS set_session_imports_updated_at ON public.session_imports;
CREATE TRIGGER set_session_imports_updated_at
  BEFORE UPDATE ON public.session_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.session_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_wave_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_imports_select_own ON public.session_imports;
CREATE POLICY session_imports_select_own ON public.session_imports
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS session_imports_insert_own ON public.session_imports;
CREATE POLICY session_imports_insert_own ON public.session_imports
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
    AND status = 'uploaded'
    AND session_id IS NULL
    AND summary IS NULL
    AND error IS NULL
    AND purge_requested_at IS NULL
    AND sha256 IS NULL
  );

DROP POLICY IF EXISTS session_tracks_select_own ON public.session_tracks;
CREATE POLICY session_tracks_select_own ON public.session_tracks
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS session_waves_select_own ON public.session_waves;
CREATE POLICY session_waves_select_own ON public.session_waves
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS session_wave_corrections_select_own ON public.session_wave_corrections;
CREATE POLICY session_wave_corrections_select_own ON public.session_wave_corrections
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS session_wave_corrections_insert_own ON public.session_wave_corrections;
CREATE POLICY session_wave_corrections_insert_own ON public.session_wave_corrections
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_wave_corrections.session_id
        AND s.user_id = (select auth.uid())
    )
  );
DROP POLICY IF EXISTS session_wave_corrections_delete_own ON public.session_wave_corrections;
CREATE POLICY session_wave_corrections_delete_own ON public.session_wave_corrections
  FOR DELETE TO authenticated USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_wave_corrections.session_id
        AND s.user_id = (select auth.uid())
    )
  );

-- Table grants also protect operations such as TRUNCATE that bypass RLS.
REVOKE ALL ON public.session_imports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.session_tracks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.session_waves FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.session_wave_corrections FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.session_imports TO authenticated;
GRANT INSERT (user_id, storage_path, original_filename) ON public.session_imports TO authenticated;
GRANT SELECT ON public.session_tracks TO authenticated;
GRANT SELECT ON public.session_waves TO authenticated;
GRANT SELECT ON public.session_wave_corrections TO authenticated;
GRANT INSERT, DELETE ON public.session_wave_corrections TO authenticated;

GRANT ALL ON public.session_imports TO service_role;
GRANT ALL ON public.session_tracks TO service_role;
GRANT ALL ON public.session_waves TO service_role;
GRANT ALL ON public.session_wave_corrections TO service_role;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS water_temp_source text CHECK (water_temp_source IN ('user', 'watch'));

-- Preserve all source values already accepted by the live CHECK.
DO $$
DECLARE
  current_check text;
  -- string_to_array keeps __tests__/api/events-allowlist-db-sync.test.ts from parsing file_import as an event.
  candidate_sources text[] := string_to_array('file_import', ',');
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

  IF missing_sources IS NOT NULL THEN
    ALTER TABLE public.sessions DROP CONSTRAINT sessions_source_check;
    EXECUTE format(
      'ALTER TABLE public.sessions ADD CONSTRAINT sessions_source_check CHECK ((%s) OR source = ANY (%L::text[])) NOT VALID',
      current_check,
      missing_sources
    );
    ALTER TABLE public.sessions VALIDATE CONSTRAINT sessions_source_check;
  END IF;
END $$;

-- Preserve the current condition provenance values while appending hindcast.
DO $$
DECLARE
  current_check text;
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.sessions'::regclass
    AND conname = 'sessions_conditions_source_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'sessions_conditions_source_check constraint not found';
  END IF;

  IF current_check NOT LIKE '%hindcast_open_meteo%' THEN
    ALTER TABLE public.sessions DROP CONSTRAINT sessions_conditions_source_check;
    EXECUTE format(
      'ALTER TABLE public.sessions ADD CONSTRAINT sessions_conditions_source_check CHECK ((%s) OR conditions_source = %L) NOT VALID',
      current_check,
      'hindcast_open_meteo'
    );
    ALTER TABLE public.sessions VALIDATE CONSTRAINT sessions_conditions_source_check;
  END IF;
END $$;

-- Keep the API event allowlist and the database constraint in sync.
DO $$
DECLARE
  current_check text;
  candidate_events text[] := ARRAY[
    'session_import_failed',
    'session_waves_viewed',
    'session_wave_excluded',
    'session_wave_count_reported'
  ];
  missing_events text[];
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  SELECT array_agg(event_name ORDER BY ord)
    INTO missing_events
  FROM unnest(candidate_events) WITH ORDINALITY AS candidate(event_name, ord)
  WHERE current_check !~ ('(^|[^[:alnum:]_])' || event_name || '([^[:alnum:]_]|$)');

  IF missing_events IS NOT NULL THEN
    ALTER TABLE public.user_events DROP CONSTRAINT user_events_event_type_check;
    EXECUTE format(
      'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
      current_check,
      missing_events
    );
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-tracks', 'session-tracks', false, 10485760,
  ARRAY['application/octet-stream', 'application/gpx+xml', 'text/xml', 'application/xml', 'application/zip', 'application/x-zip-compressed']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/octet-stream', 'application/gpx+xml', 'text/xml', 'application/xml', 'application/zip', 'application/x-zip-compressed'];

DROP POLICY IF EXISTS "Users can upload their own session tracks" ON storage.objects;
CREATE POLICY "Users can upload their own session tracks" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'session-tracks' AND (storage.foldername(name))[2] = (select auth.uid())::text
);
DROP POLICY IF EXISTS "Users can read their own session tracks" ON storage.objects;
CREATE POLICY "Users can read their own session tracks" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'session-tracks' AND (storage.foldername(name))[2] = (select auth.uid())::text
);

NOTIFY pgrst, 'reload schema';

COMMIT;
