-- UNAPPLIED FORWARD MIGRATION (2026-08-13)

BEGIN;

CREATE TABLE public.county_beach_advisory_ingest_state (
  source_identifier text PRIMARY KEY,
  accepted_version_token text,
  accepted_version_sequence integer,
  observed_version_token text,
  observed_version_sequence integer,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  circuit_open boolean NOT NULL DEFAULT false,
  next_attempt_at timestamptz,
  last_request_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.county_beach_advisory_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_identifier text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  version_token text NOT NULL,
  version_sequence integer NOT NULL,
  fetched_at timestamptz NOT NULL,
  completed_at timestamptz,
  advisory_count integer NOT NULL DEFAULT 0 CHECK (advisory_count >= 0),
  closure_count integer NOT NULL DEFAULT 0 CHECK (closure_count >= 0),
  warning_count integer NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  unmatched_site_count integer NOT NULL DEFAULT 0 CHECK (unmatched_site_count >= 0),
  match_rate numeric CHECK (match_rate IS NULL OR (match_rate >= 0 AND match_rate <= 1)),
  error_kind text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.county_beach_advisories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.county_beach_advisory_runs(id) ON DELETE CASCADE,
  source_identifier text NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  source_site_identifier text NOT NULL,
  advisory_type text NOT NULL CHECK (advisory_type IN ('advisory', 'closure', 'warning')),
  beach_id uuid REFERENCES public.beaches(id) ON DELETE SET NULL,
  county_latitude numeric(9, 6) NOT NULL CHECK (county_latitude >= -90 AND county_latitude <= 90),
  county_longitude numeric(10, 6) NOT NULL CHECK (county_longitude >= -180 AND county_longitude <= 180),
  match_distance_meters numeric,
  valid_from timestamptz,
  valid_until timestamptz,
  raw_payload jsonb NOT NULL,
  raw_payload_hash text NOT NULL,
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, source_site_identifier, advisory_type)
);

CREATE INDEX county_beach_advisory_runs_latest_idx
  ON public.county_beach_advisory_runs (source_identifier, status, fetched_at DESC);

CREATE INDEX county_beach_advisories_beach_idx
  ON public.county_beach_advisories (beach_id, advisory_type, fetched_at DESC);

CREATE INDEX county_beach_advisories_run_idx
  ON public.county_beach_advisories (run_id);

ALTER TABLE public.county_beach_advisory_ingest_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.county_beach_advisory_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.county_beach_advisories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.county_beach_advisory_ingest_state
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.county_beach_advisory_runs
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.county_beach_advisories
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
