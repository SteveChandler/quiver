-- Migration: Immutable trusted external forecast storage, atomic build
-- persistence, and constrained alert acknowledgement.
--
-- Phase 21 (multi-forecaster forecast adjustment). Implements D-13, D-18
-- through D-23. Quiver owns the only production schema ledger for trusted
-- forecast data; Seaside carries no deployable migration copy.
--
-- Schema summary (all additive; no existing object is dropped or altered):
--   public.trusted_forecast_ingest_runs             append-only run health
--   public.trusted_forecast_ingest_source_results   append-only per-source outcome
--   public.trusted_forecast_issues                  append-only normalized revisions
--   public.trusted_forecast_decisions               append-only, 1 per beach/local day
--   public.trusted_forecast_applications            append-only, 1 per beach/forecast slot
--   public.trusted_forecast_alerts                  immutable evidence + RPC-only ack
--   public.trusted_forecast_build_receipts          immutable build receipts
--   public.persist_trusted_forecast_build(jsonb)    atomic commit, receipt last
--   public.get_trusted_forecast_build_receipt(text) D-21 reconciliation read
--   public.acknowledge_trusted_forecast_alert(jsonb)  D-22 constrained update
--
-- Deliberate omissions, each of which would break a shipped 21-01 contract:
--
--   1. NO foreign key from trusted_forecast_issues.ingest_run_id or
--      trusted_forecast_ingest_source_results.ingest_run_id to
--      trusted_forecast_ingest_runs. seaside/crons/fetch_trusted_forecasts.py
--      writes issues first, then source results, then the run row last, so a
--      referential constraint would reject every ingestion run.
--
--   2. NO CHECK constraining trusted_forecast_issues.region_key to a region
--      vocabulary. It carries WaveCast chart spot slugs ('trestles', 'malibu',
--      'huntington-beach', ...) whenever scope_type = 'spot'; 264 SoCal rows
--      per run would fail on the first insert.
--
--   3. NO enum/CHECK on trusted_forecast_issues.exposure. It is free text
--      across sources: 'kauai/NORTH' (NWS), 'NNW'/'SSW'/'primary'/'dominant'
--      (WaveCast), and a summaries[].type string (surf.institute).
--
-- Rollback: see the commented DROP block at the end of this file.

BEGIN;

-- =============================================================================
-- INGEST RUN HEALTH (append-only)
-- =============================================================================

CREATE TABLE public.trusted_forecast_ingest_runs (
  ingest_run_id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  source_count integer NOT NULL,
  ok_count integer NOT NULL,
  failed_count integer NOT NULL,
  issue_count integer NOT NULL,
  healthy boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_forecast_ingest_runs_window_check
    CHECK (finished_at >= started_at),
  CONSTRAINT trusted_forecast_ingest_runs_counts_check
    CHECK (
      source_count >= 0
      AND ok_count >= 0
      AND failed_count >= 0
      AND issue_count >= 0
      AND ok_count + failed_count = source_count
    ),
  CONSTRAINT trusted_forecast_ingest_runs_health_check
    CHECK (healthy = (failed_count = 0))
);

CREATE INDEX trusted_forecast_ingest_runs_started_idx
  ON public.trusted_forecast_ingest_runs (started_at DESC);

-- =============================================================================
-- PER-SOURCE OUTCOME (append-only)
-- =============================================================================

CREATE TABLE public.trusted_forecast_ingest_source_results (
  source_result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingest_run_id uuid NOT NULL,
  source_key text NOT NULL,
  provider_lineage text NOT NULL,
  parser_key text NOT NULL,
  parser_version text NOT NULL,
  status text NOT NULL,
  failure_code text,
  http_status integer,
  redirect_hops integer,
  attempts integer,
  issue_count integer NOT NULL DEFAULT 0,
  authority_issue_count integer NOT NULL DEFAULT 0,
  -- Carried forward from 21-01 round 3: an unresolvable item inside an
  -- otherwise healthy source is a partial loss, not a source failure.
  degraded_failure_code text,
  degraded_item_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_forecast_source_results_run_source_key
    UNIQUE (ingest_run_id, source_key),
  CONSTRAINT trusted_forecast_source_results_status_check
    CHECK (
      status IN (
        'ok',
        'no_issues',
        'transport_failed',
        'parser_failed',
        'skipped_disabled'
      )
    ),
  CONSTRAINT trusted_forecast_source_results_failure_code_check
    CHECK (
      CASE
        WHEN status IN ('ok', 'skipped_disabled') THEN failure_code IS NULL
        ELSE failure_code IS NOT NULL
      END
    ),
  CONSTRAINT trusted_forecast_source_results_counts_check
    CHECK (
      issue_count >= 0
      AND authority_issue_count >= 0
      AND authority_issue_count <= issue_count
      AND degraded_item_count >= 0
      AND (http_status IS NULL OR http_status BETWEEN 100 AND 599)
      AND (redirect_hops IS NULL OR redirect_hops >= 0)
      AND (attempts IS NULL OR attempts >= 0)
    ),
  -- Mirrors SourceResult.__post_init__ in seaside/trusted_forecasts/models.py:
  -- a degraded item is only meaningful on a source that otherwise succeeded,
  -- and the code and count must appear together.
  CONSTRAINT trusted_forecast_source_results_degraded_check
    CHECK (
      (degraded_failure_code IS NULL AND degraded_item_count = 0)
      OR (
        degraded_failure_code IS NOT NULL
        AND degraded_item_count > 0
        AND status = 'ok'
      )
    ),
  CONSTRAINT trusted_forecast_source_results_window_check
    CHECK (finished_at >= started_at)
);

CREATE INDEX trusted_forecast_source_results_run_idx
  ON public.trusted_forecast_ingest_source_results (ingest_run_id);
CREATE INDEX trusted_forecast_source_results_source_idx
  ON public.trusted_forecast_ingest_source_results (source_key, started_at DESC);
CREATE INDEX trusted_forecast_source_results_degraded_idx
  ON public.trusted_forecast_ingest_source_results (started_at DESC)
  WHERE degraded_item_count > 0;

-- =============================================================================
-- NORMALIZED ISSUE REVISIONS (append-only)
-- =============================================================================

CREATE TABLE public.trusted_forecast_issues (
  issue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_lineage text NOT NULL,
  source_key text NOT NULL,
  issued_at timestamptz NOT NULL,
  valid_local_date date NOT NULL,
  valid_timezone text NOT NULL,
  valid_start_at timestamptz NOT NULL,
  valid_end_at timestamptz NOT NULL,
  -- Carried forward from 21-01 round 2: provenance of the validity window.
  validity_basis text NOT NULL,
  scope_type text NOT NULL,
  -- Free text on purpose: chart spot slugs live here when scope_type='spot'.
  region_key text,
  beach_id uuid REFERENCES public.beaches (id) ON DELETE RESTRICT,
  -- Free text on purpose: exposure vocabulary differs per source family.
  exposure text NOT NULL,
  -- Carried forward from 21-01 round 2: sub-day window facet kept OUT of
  -- `exposure` so D-12 exposure-compatibility matching stays purely spatial.
  day_part text NOT NULL,
  measurement_basis text NOT NULL,
  min_face_ft numeric(8, 4),
  max_face_ft numeric(8, 4),
  direction_deg numeric(8, 4),
  period_seconds numeric(8, 4),
  parser_version text NOT NULL,
  source_hash text NOT NULL,
  issue_identity_key text NOT NULL,
  revision_hash text NOT NULL,
  supersedes_issue_id uuid
    REFERENCES public.trusted_forecast_issues (issue_id) ON DELETE RESTRICT,
  authority_eligible boolean NOT NULL,
  evidence_class text NOT NULL,
  ingest_run_id uuid,
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_forecast_issues_revision_hash_key UNIQUE (revision_hash),
  CONSTRAINT trusted_forecast_issues_identity_hex_check
    CHECK (issue_identity_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT trusted_forecast_issues_revision_hex_check
    CHECK (revision_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT trusted_forecast_issues_scope_type_check
    CHECK (scope_type IN ('spot', 'regional')),
  CONSTRAINT trusted_forecast_issues_day_part_check
    CHECK (day_part IN ('all_day', 'day', 'night')),
  CONSTRAINT trusted_forecast_issues_validity_basis_check
    CHECK (validity_basis IN ('stated', 'derived_publication_day')),
  CONSTRAINT trusted_forecast_issues_measurement_basis_check
    CHECK (measurement_basis IN ('breaking_face_ft', 'unspecified')),
  CONSTRAINT trusted_forecast_issues_evidence_class_check
    CHECK (
      evidence_class IN (
        'human_face_height_authority',
        'model_buoy_evidence',
        'evidence_only'
      )
    ),
  CONSTRAINT trusted_forecast_issues_window_check
    CHECK (valid_end_at > valid_start_at),
  CONSTRAINT trusted_forecast_issues_range_pairing_check
    CHECK ((min_face_ft IS NULL) = (max_face_ft IS NULL)),
  CONSTRAINT trusted_forecast_issues_range_bounds_check
    CHECK (
      (min_face_ft IS NULL OR (min_face_ft >= 0 AND min_face_ft <= 60))
      AND (max_face_ft IS NULL OR (max_face_ft >= 0 AND max_face_ft <= 60))
      AND (
        min_face_ft IS NULL
        OR max_face_ft IS NULL
        OR min_face_ft <= max_face_ft
      )
    ),
  CONSTRAINT trusted_forecast_issues_direction_check
    CHECK (direction_deg IS NULL OR (direction_deg >= 0 AND direction_deg < 360)),
  CONSTRAINT trusted_forecast_issues_period_check
    CHECK (period_seconds IS NULL OR (period_seconds > 0 AND period_seconds <= 120)),
  -- D-07/D-08: an authority row must carry a measured breaking-face range.
  CONSTRAINT trusted_forecast_issues_authority_check
    CHECK (
      authority_eligible = false
      OR (
        min_face_ft IS NOT NULL
        AND max_face_ft IS NOT NULL
        AND measurement_basis = 'breaking_face_ft'
        AND evidence_class = 'human_face_height_authority'
      )
    )
);

CREATE INDEX trusted_forecast_issues_identity_idx
  ON public.trusted_forecast_issues (issue_identity_key, issued_at DESC);
CREATE INDEX trusted_forecast_issues_local_date_idx
  ON public.trusted_forecast_issues (valid_local_date, region_key);
CREATE INDEX trusted_forecast_issues_run_idx
  ON public.trusted_forecast_issues (ingest_run_id);
CREATE INDEX trusted_forecast_issues_authority_idx
  ON public.trusted_forecast_issues (valid_local_date, provider_lineage)
  WHERE authority_eligible = true;
CREATE INDEX trusted_forecast_issues_beach_idx
  ON public.trusted_forecast_issues (beach_id, valid_local_date)
  WHERE beach_id IS NOT NULL;

-- =============================================================================
-- DAILY DECISIONS (append-only, exactly one per beach/local day per D-13)
-- =============================================================================

CREATE TABLE public.trusted_forecast_decisions (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id uuid NOT NULL REFERENCES public.beaches (id) ON DELETE RESTRICT,
  local_date date NOT NULL,
  local_timezone text NOT NULL,
  status text NOT NULL,
  primary_issue_id uuid
    REFERENCES public.trusted_forecast_issues (issue_id) ON DELETE RESTRICT,
  baseline_max_face_ft numeric(8, 4),
  trusted_min_face_ft numeric(8, 4),
  trusted_max_face_ft numeric(8, 4),
  signed_gap_ft numeric(8, 4),
  applied_delta_ft numeric(8, 4) NOT NULL DEFAULT 0,
  policy_version text NOT NULL,
  build_key text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_forecast_decisions_beach_day_key
    UNIQUE (beach_id, local_date),
  CONSTRAINT trusted_forecast_decisions_status_check
    CHECK (
      status IN (
        'applied',
        'no_adjustment',
        'no_authority',
        'blocked_conflict'
      )
    ),
  -- D-15: preserve sign, cap at +/- 0.50 ft, only the three approved bands.
  CONSTRAINT trusted_forecast_decisions_delta_band_check
    CHECK (applied_delta_ft IN (-0.5, -0.25, 0, 0.25, 0.5)),
  CONSTRAINT trusted_forecast_decisions_applied_requires_delta_check
    CHECK (
      (status = 'applied') = (applied_delta_ft <> 0)
    ),
  CONSTRAINT trusted_forecast_decisions_applied_requires_primary_check
    CHECK (
      status NOT IN ('applied', 'no_adjustment')
      OR (
        primary_issue_id IS NOT NULL
        AND trusted_min_face_ft IS NOT NULL
        AND trusted_max_face_ft IS NOT NULL
        AND baseline_max_face_ft IS NOT NULL
      )
    ),
  CONSTRAINT trusted_forecast_decisions_range_check
    CHECK (
      (trusted_min_face_ft IS NULL) = (trusted_max_face_ft IS NULL)
      AND (
        trusted_min_face_ft IS NULL
        OR (
          trusted_min_face_ft >= 0
          AND trusted_max_face_ft <= 60
          AND trusted_min_face_ft <= trusted_max_face_ft
        )
      )
    )
);

CREATE INDEX trusted_forecast_decisions_local_date_idx
  ON public.trusted_forecast_decisions (local_date, beach_id);
CREATE INDEX trusted_forecast_decisions_build_idx
  ON public.trusted_forecast_decisions (build_key);

-- =============================================================================
-- SLOT APPLICATIONS (append-only, one claim per beach/forecast slot per D-13)
-- =============================================================================

CREATE TABLE public.trusted_forecast_applications (
  application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL
    REFERENCES public.trusted_forecast_decisions (decision_id) ON DELETE RESTRICT,
  beach_id uuid NOT NULL REFERENCES public.beaches (id) ON DELETE RESTRICT,
  forecast_at timestamptz NOT NULL,
  prediction_snapshot_id uuid
    REFERENCES public.ml_predictions_log (id) ON DELETE RESTRICT,
  applied_delta_ft numeric(8, 4) NOT NULL,
  baseline_max_face_ft numeric(8, 4),
  adjusted_max_face_ft numeric(8, 4),
  build_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_forecast_applications_slot_key
    UNIQUE (beach_id, forecast_at),
  CONSTRAINT trusted_forecast_applications_delta_band_check
    CHECK (applied_delta_ft IN (-0.5, -0.25, 0.25, 0.5))
);

CREATE INDEX trusted_forecast_applications_decision_idx
  ON public.trusted_forecast_applications (decision_id);
CREATE INDEX trusted_forecast_applications_build_idx
  ON public.trusted_forecast_applications (build_key);

-- =============================================================================
-- CONFLICT ALERTS (immutable evidence; only the ack RPC may touch the three
-- acknowledgement columns per D-22)
-- =============================================================================

CREATE TABLE public.trusted_forecast_alerts (
  alert_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id uuid NOT NULL REFERENCES public.beaches (id) ON DELETE RESTRICT,
  local_date date NOT NULL,
  decision_id uuid
    REFERENCES public.trusted_forecast_decisions (decision_id) ON DELETE RESTRICT,
  alert_code text NOT NULL,
  separation_ft numeric(8, 4) NOT NULL,
  primary_issue_id uuid
    REFERENCES public.trusted_forecast_issues (issue_id) ON DELETE RESTRICT,
  conflicting_issue_id uuid
    REFERENCES public.trusted_forecast_issues (issue_id) ON DELETE RESTRICT,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  build_key text NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_forecast_alerts_build_slot_key
    UNIQUE (build_key, beach_id, local_date, alert_code),
  CONSTRAINT trusted_forecast_alerts_code_check
    CHECK (alert_code IN ('range_separation_exceeded')),
  CONSTRAINT trusted_forecast_alerts_separation_check
    CHECK (separation_ft > 1.0),
  CONSTRAINT trusted_forecast_alerts_evidence_object_check
    CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT trusted_forecast_alerts_acknowledgement_check
    CHECK (
      (
        acknowledged = false
        AND acknowledged_by IS NULL
        AND acknowledged_at IS NULL
      )
      OR (
        acknowledged = true
        AND acknowledged_by IS NOT NULL
        AND acknowledged_at IS NOT NULL
      )
    )
);

CREATE INDEX trusted_forecast_alerts_open_idx
  ON public.trusted_forecast_alerts (local_date DESC, beach_id)
  WHERE acknowledged = false;

-- =============================================================================
-- BUILD RECEIPTS (immutable, inserted last per D-19)
-- =============================================================================

CREATE TABLE public.trusted_forecast_build_receipts (
  receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_key text NOT NULL,
  payload_sha256 text NOT NULL,
  schema_version text NOT NULL,
  policy_version text NOT NULL,
  build_anchor_at timestamptz NOT NULL,
  expected_decision_count integer NOT NULL,
  expected_application_count integer NOT NULL,
  expected_alert_count integer NOT NULL,
  expected_snapshot_count integer NOT NULL,
  inserted_decision_count integer NOT NULL,
  reused_decision_count integer NOT NULL,
  inserted_application_count integer NOT NULL,
  reused_application_count integer NOT NULL,
  inserted_alert_count integer NOT NULL,
  reused_alert_count integer NOT NULL,
  inserted_snapshot_count integer NOT NULL,
  reused_snapshot_count integer NOT NULL,
  durable_alert_count integer NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_forecast_build_receipts_build_key_key UNIQUE (build_key),
  CONSTRAINT trusted_forecast_build_receipts_hash_check
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT trusted_forecast_build_receipts_counts_check
    CHECK (
      expected_decision_count >= 0
      AND expected_application_count >= 0
      AND expected_alert_count >= 0
      AND expected_snapshot_count >= 0
      AND inserted_decision_count >= 0
      AND reused_decision_count >= 0
      AND inserted_application_count >= 0
      AND reused_application_count >= 0
      AND inserted_alert_count >= 0
      AND reused_alert_count >= 0
      AND inserted_snapshot_count >= 0
      AND reused_snapshot_count >= 0
      AND durable_alert_count >= 0
      AND inserted_decision_count + reused_decision_count
        = expected_decision_count
      AND inserted_application_count + reused_application_count
        = expected_application_count
      AND inserted_alert_count + reused_alert_count = expected_alert_count
      AND inserted_snapshot_count + reused_snapshot_count
        = expected_snapshot_count
    )
);

CREATE INDEX trusted_forecast_build_receipts_committed_idx
  ON public.trusted_forecast_build_receipts (committed_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Every trusted table is private. RLS is enabled with no policy at all, so
-- even a role that somehow acquired table privileges reads nothing. The RPCs
-- below are SECURITY DEFINER and owned by the migration role, which bypasses
-- RLS for the trusted write path only.

ALTER TABLE public.trusted_forecast_ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_forecast_ingest_source_results
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_forecast_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_forecast_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_forecast_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_forecast_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_forecast_build_receipts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- APPEND-ONLY ENFORCEMENT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reject_trusted_forecast_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'trusted forecast history is append-only (%.%)',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trusted_forecast_ingest_runs_append_only
  BEFORE UPDATE OR DELETE ON public.trusted_forecast_ingest_runs
  FOR EACH ROW EXECUTE FUNCTION public.reject_trusted_forecast_mutation();

CREATE TRIGGER trusted_forecast_source_results_append_only
  BEFORE UPDATE OR DELETE ON public.trusted_forecast_ingest_source_results
  FOR EACH ROW EXECUTE FUNCTION public.reject_trusted_forecast_mutation();

CREATE TRIGGER trusted_forecast_issues_append_only
  BEFORE UPDATE OR DELETE ON public.trusted_forecast_issues
  FOR EACH ROW EXECUTE FUNCTION public.reject_trusted_forecast_mutation();

CREATE TRIGGER trusted_forecast_decisions_append_only
  BEFORE UPDATE OR DELETE ON public.trusted_forecast_decisions
  FOR EACH ROW EXECUTE FUNCTION public.reject_trusted_forecast_mutation();

CREATE TRIGGER trusted_forecast_applications_append_only
  BEFORE UPDATE OR DELETE ON public.trusted_forecast_applications
  FOR EACH ROW EXECUTE FUNCTION public.reject_trusted_forecast_mutation();

CREATE TRIGGER trusted_forecast_build_receipts_append_only
  BEFORE UPDATE OR DELETE ON public.trusted_forecast_build_receipts
  FOR EACH ROW EXECUTE FUNCTION public.reject_trusted_forecast_mutation();

-- D-22: alert evidence is immutable. DELETE is always rejected. UPDATE is
-- rejected unless the acknowledgement RPC has set the transaction-local flag
-- AND every column outside the three acknowledgement columns is unchanged.
CREATE OR REPLACE FUNCTION public.reject_trusted_forecast_alert_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'trusted forecast alert evidence is append-only'
      USING ERRCODE = '55000';
  END IF;

  IF coalesce(
       current_setting('app.trusted_forecast_alert_acknowledgement', true),
       'off'
     ) <> 'on' THEN
    RAISE EXCEPTION
      'trusted forecast alerts change only through acknowledge_trusted_forecast_alert'
      USING ERRCODE = '55000';
  END IF;

  v_old := to_jsonb(OLD) - 'acknowledged' - 'acknowledged_by'
    - 'acknowledged_at';
  v_new := to_jsonb(NEW) - 'acknowledged' - 'acknowledged_by'
    - 'acknowledged_at';

  IF v_old IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION
      'trusted forecast alert acknowledgement may change only acknowledgement status, actor, and timestamp'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trusted_forecast_alerts_acknowledgement_only
  BEFORE UPDATE OR DELETE ON public.trusted_forecast_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_trusted_forecast_alert_mutation();

-- =============================================================================
-- CANONICALIZATION (D-20: the database owns the content contract)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_number(
  p_value jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN 'null'::jsonb
    ELSE to_jsonb(
      to_char((p_value #>> '{}')::numeric, 'FM9999999990.0000')
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_timestamp(
  p_value jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN 'null'::jsonb
    ELSE to_jsonb(
      to_char(
        (p_value #>> '{}')::timestamptz AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_decision(
  p_row jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'appliedDeltaFt', public.trusted_forecast_canonical_number(
      p_row -> 'appliedDeltaFt'
    ),
    'baselineMaxFaceFt', public.trusted_forecast_canonical_number(
      p_row -> 'baselineMaxFaceFt'
    ),
    'beachId', p_row -> 'beachId',
    'localDate', p_row -> 'localDate',
    'localTimezone', p_row -> 'localTimezone',
    'primaryIssueId', p_row -> 'primaryIssueId',
    'signedGapFt', public.trusted_forecast_canonical_number(
      p_row -> 'signedGapFt'
    ),
    'status', p_row -> 'status',
    'trustedMaxFaceFt', public.trusted_forecast_canonical_number(
      p_row -> 'trustedMaxFaceFt'
    ),
    'trustedMinFaceFt', public.trusted_forecast_canonical_number(
      p_row -> 'trustedMinFaceFt'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_application(
  p_row jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'adjustedMaxFaceFt', public.trusted_forecast_canonical_number(
      p_row -> 'adjustedMaxFaceFt'
    ),
    'appliedDeltaFt', public.trusted_forecast_canonical_number(
      p_row -> 'appliedDeltaFt'
    ),
    'baselineMaxFaceFt', public.trusted_forecast_canonical_number(
      p_row -> 'baselineMaxFaceFt'
    ),
    'beachId', p_row -> 'beachId',
    'forecastAt', public.trusted_forecast_canonical_timestamp(
      p_row -> 'forecastAt'
    ),
    'localDate', p_row -> 'localDate'
  );
$$;

CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_alert(
  p_row jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'alertCode', p_row -> 'alertCode',
    'beachId', p_row -> 'beachId',
    'conflictingIssueId', p_row -> 'conflictingIssueId',
    'evidence', coalesce(p_row -> 'evidence', 'null'::jsonb),
    'localDate', p_row -> 'localDate',
    'primaryIssueId', p_row -> 'primaryIssueId',
    'separationFt', public.trusted_forecast_canonical_number(
      p_row -> 'separationFt'
    )
  );
$$;

-- The one place the accepted snapshot column set is written down. The strict
-- input validator and the canonicalizer both read it, so a column can never be
-- hashable-but-unvalidated or validated-but-unhashed.
CREATE OR REPLACE FUNCTION public.trusted_forecast_snapshot_columns()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY[
    'beach_id',
    'predicted_at',
    'forecast_horizon_hours',
    'forecast_horizon_bucket',
    'raw_display_height_m',
    'offset_corrected_display_height_m',
    'height_offset_m',
    'height_offset_sample_count',
    'feedback_height_calibration_candidate_id',
    'feedback_height_offset_ft',
    'feedback_height_calibration_applied',
    'display_source',
    'display_wave_source',
    'display_raw_input_height_m',
    'model_version',
    'wave_height_om',
    'noaa_swell_1_height_m',
    'noaa_swell_1_period_s',
    'noaa_swell_1_direction_deg',
    'noaa_swell_2_height_m',
    'noaa_swell_2_period_s',
    'noaa_swell_2_direction_deg',
    'noaa_wind_wave_height_m',
    'noaa_wind_wave_period_s',
    'noaa_wind_wave_direction_deg',
    'wave_period_s',
    'wave_direction_deg',
    'wave_period_om',
    'wave_direction_om',
    'wave_peak_period_om',
    'swell_height_om',
    'swell_period_om',
    'swell_direction_om',
    'swell_wave_peak_period_om',
    'wind_wave_height_om',
    'wind_wave_period_om',
    'wind_wave_direction_om',
    'wind_wave_peak_period_om',
    'secondary_swell_height_om',
    'secondary_swell_period_om',
    'secondary_swell_direction_om',
    'tertiary_swell_height_om',
    'tertiary_swell_period_om',
    'tertiary_swell_direction_om',
    'om_wind_wave_missing',
    'om_primary_swell_missing',
    'om_secondary_swell_missing',
    'om_tertiary_swell_missing',
    'om_partition_schema_version',
    'wind_speed_ms',
    'wind_direction_deg',
    'v5_shadow_height_m',
    'v5_model_version',
    'direction_bucket',
    'om_bucket'
  ]::text[];
$$;

-- Every accepted snapshot column reaches the hash, and an omitted column is
-- canonicalized to an explicit null so "absent" and "null" cannot diverge.
CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_snapshot(
  p_row jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    jsonb_object_agg(
      column_name,
      CASE
        WHEN column_name = 'predicted_at'
          THEN public.trusted_forecast_canonical_timestamp(p_row -> column_name)
        WHEN jsonb_typeof(p_row -> column_name) = 'number'
          THEN public.trusted_forecast_canonical_number(p_row -> column_name)
        ELSE coalesce(p_row -> column_name, 'null'::jsonb)
      END
    ),
    '{}'::jsonb
  )
  FROM unnest(public.trusted_forecast_snapshot_columns()) AS column_name;
$$;

CREATE OR REPLACE FUNCTION public.trusted_forecast_canonical_build_payload(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'alerts', (
      SELECT coalesce(jsonb_agg(entry ORDER BY entry::text), '[]'::jsonb)
      FROM (
        SELECT public.trusted_forecast_canonical_alert(element) AS entry
        FROM jsonb_array_elements(p_payload -> 'alerts') AS element
      ) AS canonical_alerts
    ),
    'applications', (
      SELECT coalesce(jsonb_agg(entry ORDER BY entry::text), '[]'::jsonb)
      FROM (
        SELECT public.trusted_forecast_canonical_application(element) AS entry
        FROM jsonb_array_elements(p_payload -> 'applications') AS element
      ) AS canonical_applications
    ),
    'buildAnchorAt', public.trusted_forecast_canonical_timestamp(
      p_payload -> 'buildAnchorAt'
    ),
    'buildKey', p_payload -> 'buildKey',
    'decisions', (
      SELECT coalesce(jsonb_agg(entry ORDER BY entry::text), '[]'::jsonb)
      FROM (
        SELECT public.trusted_forecast_canonical_decision(element) AS entry
        FROM jsonb_array_elements(p_payload -> 'decisions') AS element
      ) AS canonical_decisions
    ),
    'policyVersion', p_payload -> 'policyVersion',
    'schemaVersion', p_payload -> 'schemaVersion',
    'snapshots', (
      SELECT coalesce(jsonb_agg(entry ORDER BY entry::text), '[]'::jsonb)
      FROM (
        SELECT public.trusted_forecast_canonical_snapshot(element) AS entry
        FROM jsonb_array_elements(p_payload -> 'snapshots') AS element
      ) AS canonical_snapshots
    )
  );
$$;

-- =============================================================================
-- ATOMIC PERSISTENCE AND RECEIPT (D-19, D-20)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.persist_trusted_forecast_build(
  p_payload jsonb
)
RETURNS SETOF public.trusted_forecast_build_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_top_level_keys CONSTANT text[] := ARRAY[
    'schemaVersion',
    'policyVersion',
    'buildKey',
    'buildAnchorAt',
    'decisions',
    'applications',
    'alerts',
    'snapshots',
    'expectedDecisionCount',
    'expectedApplicationCount',
    'expectedAlertCount',
    'expectedSnapshotCount'
  ];
  c_decision_keys CONSTANT text[] := ARRAY[
    'beachId',
    'localDate',
    'localTimezone',
    'status',
    'primaryIssueId',
    'baselineMaxFaceFt',
    'trustedMinFaceFt',
    'trustedMaxFaceFt',
    'signedGapFt',
    'appliedDeltaFt'
  ];
  c_application_keys CONSTANT text[] := ARRAY[
    'beachId',
    'localDate',
    'forecastAt',
    'appliedDeltaFt',
    'baselineMaxFaceFt',
    'adjustedMaxFaceFt'
  ];
  c_alert_keys CONSTANT text[] := ARRAY[
    'beachId',
    'localDate',
    'alertCode',
    'separationFt',
    'primaryIssueId',
    'conflictingIssueId',
    'evidence'
  ];
  c_snapshot_keys CONSTANT text[] := public.trusted_forecast_snapshot_columns();

  v_build_key text;
  v_schema_version text;
  v_policy_version text;
  v_build_anchor_at timestamptz;
  v_expected_decision_count integer;
  v_expected_application_count integer;
  v_expected_alert_count integer;
  v_expected_snapshot_count integer;

  v_canonical jsonb;
  v_payload_sha256 text;
  v_existing public.trusted_forecast_build_receipts%ROWTYPE;
  v_receipt public.trusted_forecast_build_receipts%ROWTYPE;

  v_element jsonb;
  v_decision public.trusted_forecast_decisions%ROWTYPE;
  v_decision_id uuid;
  v_application public.trusted_forecast_applications%ROWTYPE;
  v_snapshot_id uuid;

  v_inserted_decision_count integer := 0;
  v_reused_decision_count integer := 0;
  v_inserted_application_count integer := 0;
  v_reused_application_count integer := 0;
  v_inserted_alert_count integer := 0;
  v_reused_alert_count integer := 0;
  v_inserted_snapshot_count integer := 0;
  v_reused_snapshot_count integer := 0;
  v_durable_alert_count integer := 0;
BEGIN
  -- ---------------------------------------------------------------------
  -- 1. Strict input contract. Everything here runs before any durable write.
  -- ---------------------------------------------------------------------
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'trusted forecast build payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_payload) AS supplied(key)
    WHERE supplied.key <> ALL (c_top_level_keys)
  ) THEN
    RAISE EXCEPTION 'trusted forecast build payload contains an unsupported field'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(c_top_level_keys) AS required(key)
    WHERE NOT (p_payload ? required.key)
  ) THEN
    RAISE EXCEPTION 'trusted forecast build payload is missing a required field'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'buildKey') <> 'string'
     OR length(p_payload ->> 'buildKey') = 0
     OR length(p_payload ->> 'buildKey') > 200 THEN
    RAISE EXCEPTION 'trusted forecast build key must be a non-empty string'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'schemaVersion') <> 'string'
     OR jsonb_typeof(p_payload -> 'policyVersion') <> 'string'
     OR jsonb_typeof(p_payload -> 'buildAnchorAt') <> 'string' THEN
    RAISE EXCEPTION
      'trusted forecast build versions and anchor must be strings'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'decisions') <> 'array'
     OR jsonb_typeof(p_payload -> 'applications') <> 'array'
     OR jsonb_typeof(p_payload -> 'alerts') <> 'array'
     OR jsonb_typeof(p_payload -> 'snapshots') <> 'array' THEN
    RAISE EXCEPTION 'trusted forecast build collections must be JSON arrays'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'expectedDecisionCount') <> 'number'
     OR jsonb_typeof(p_payload -> 'expectedApplicationCount') <> 'number'
     OR jsonb_typeof(p_payload -> 'expectedAlertCount') <> 'number'
     OR jsonb_typeof(p_payload -> 'expectedSnapshotCount') <> 'number' THEN
    RAISE EXCEPTION 'trusted forecast build counts must be numbers'
      USING ERRCODE = '22023';
  END IF;

  v_build_key := p_payload ->> 'buildKey';
  v_schema_version := p_payload ->> 'schemaVersion';
  v_policy_version := p_payload ->> 'policyVersion';
  v_build_anchor_at := (p_payload ->> 'buildAnchorAt')::timestamptz;
  v_expected_decision_count := (p_payload ->> 'expectedDecisionCount')::integer;
  v_expected_application_count :=
    (p_payload ->> 'expectedApplicationCount')::integer;
  v_expected_alert_count := (p_payload ->> 'expectedAlertCount')::integer;
  v_expected_snapshot_count := (p_payload ->> 'expectedSnapshotCount')::integer;

  IF v_expected_decision_count
       <> jsonb_array_length(p_payload -> 'decisions')
     OR v_expected_application_count
       <> jsonb_array_length(p_payload -> 'applications')
     OR v_expected_alert_count <> jsonb_array_length(p_payload -> 'alerts')
     OR v_expected_snapshot_count
       <> jsonb_array_length(p_payload -> 'snapshots') THEN
    RAISE EXCEPTION
      'trusted forecast build counts do not match the supplied collections'
      USING ERRCODE = '22023';
  END IF;

  FOR v_element IN
    SELECT element FROM jsonb_array_elements(p_payload -> 'decisions') AS element
  LOOP
    IF jsonb_typeof(v_element) <> 'object'
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(v_element) AS supplied(key)
         WHERE supplied.key <> ALL (c_decision_keys)
       )
       OR EXISTS (
         SELECT 1
         FROM unnest(c_decision_keys) AS required(key)
         WHERE NOT (v_element ? required.key)
       ) THEN
      RAISE EXCEPTION 'trusted forecast decision has an invalid field set'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOR v_element IN
    SELECT element
    FROM jsonb_array_elements(p_payload -> 'applications') AS element
  LOOP
    IF jsonb_typeof(v_element) <> 'object'
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(v_element) AS supplied(key)
         WHERE supplied.key <> ALL (c_application_keys)
       )
       OR EXISTS (
         SELECT 1
         FROM unnest(c_application_keys) AS required(key)
         WHERE NOT (v_element ? required.key)
       ) THEN
      RAISE EXCEPTION 'trusted forecast application has an invalid field set'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOR v_element IN
    SELECT element FROM jsonb_array_elements(p_payload -> 'alerts') AS element
  LOOP
    IF jsonb_typeof(v_element) <> 'object'
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(v_element) AS supplied(key)
         WHERE supplied.key <> ALL (c_alert_keys)
       )
       OR EXISTS (
         SELECT 1
         FROM unnest(c_alert_keys) AS required(key)
         WHERE NOT (v_element ? required.key)
       ) THEN
      RAISE EXCEPTION 'trusted forecast alert has an invalid field set'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOR v_element IN
    SELECT element FROM jsonb_array_elements(p_payload -> 'snapshots') AS element
  LOOP
    IF jsonb_typeof(v_element) <> 'object'
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(v_element) AS supplied(key)
         WHERE supplied.key <> ALL (c_snapshot_keys)
       )
       OR NOT (v_element ? 'beach_id')
       OR NOT (v_element ? 'predicted_at') THEN
      RAISE EXCEPTION 'trusted forecast snapshot has an invalid field set'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------
  -- 2. Serialize concurrent builds for this build key.
  -- ---------------------------------------------------------------------
  PERFORM pg_advisory_xact_lock(
    hashtextextended('trusted-forecast-build:' || v_build_key, 0)
  );

  -- ---------------------------------------------------------------------
  -- 3. Database-owned canonical content and SHA-256. A caller-supplied hash
  --    is impossible: 'payloadSha256' is not an accepted input key.
  -- ---------------------------------------------------------------------
  v_canonical := public.trusted_forecast_canonical_build_payload(p_payload);
  v_payload_sha256 := encode(
    pg_catalog.sha256(convert_to(v_canonical::text, 'UTF8')),
    'hex'
  );

  SELECT *
  INTO v_existing
  FROM public.trusted_forecast_build_receipts
  WHERE build_key = v_build_key;

  IF FOUND THEN
    IF v_existing.payload_sha256 <> v_payload_sha256
       OR v_existing.expected_decision_count <> v_expected_decision_count
       OR v_existing.expected_application_count <> v_expected_application_count
       OR v_existing.expected_alert_count <> v_expected_alert_count
       OR v_existing.expected_snapshot_count <> v_expected_snapshot_count THEN
      RAISE EXCEPTION 'trusted forecast build idempotency collision'
        USING ERRCODE = '23505';
    END IF;
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------
  -- 4. Daily decisions: insert once, otherwise reuse the existing row for
  --    that (beach, local day). Divergent content is a hard collision.
  -- ---------------------------------------------------------------------
  FOR v_element IN
    SELECT element FROM jsonb_array_elements(p_payload -> 'decisions') AS element
  LOOP
    SELECT *
    INTO v_decision
    FROM public.trusted_forecast_decisions
    WHERE beach_id = (v_element ->> 'beachId')::uuid
      AND local_date = (v_element ->> 'localDate')::date;

    IF FOUND THEN
      IF v_decision.local_timezone
           IS DISTINCT FROM (v_element ->> 'localTimezone')
         OR v_decision.status IS DISTINCT FROM (v_element ->> 'status')
         OR v_decision.primary_issue_id
           IS DISTINCT FROM (v_element ->> 'primaryIssueId')::uuid
         OR v_decision.baseline_max_face_ft
           IS DISTINCT FROM (v_element ->> 'baselineMaxFaceFt')::numeric
         OR v_decision.trusted_min_face_ft
           IS DISTINCT FROM (v_element ->> 'trustedMinFaceFt')::numeric
         OR v_decision.trusted_max_face_ft
           IS DISTINCT FROM (v_element ->> 'trustedMaxFaceFt')::numeric
         OR v_decision.signed_gap_ft
           IS DISTINCT FROM (v_element ->> 'signedGapFt')::numeric
         OR v_decision.applied_delta_ft
           IS DISTINCT FROM (v_element ->> 'appliedDeltaFt')::numeric THEN
        RAISE EXCEPTION
          'trusted forecast daily decision collision for beach % on %',
          v_element ->> 'beachId', v_element ->> 'localDate'
          USING ERRCODE = '23505';
      END IF;
      v_reused_decision_count := v_reused_decision_count + 1;
    ELSE
      INSERT INTO public.trusted_forecast_decisions (
        beach_id,
        local_date,
        local_timezone,
        status,
        primary_issue_id,
        baseline_max_face_ft,
        trusted_min_face_ft,
        trusted_max_face_ft,
        signed_gap_ft,
        applied_delta_ft,
        policy_version,
        build_key
      ) VALUES (
        (v_element ->> 'beachId')::uuid,
        (v_element ->> 'localDate')::date,
        v_element ->> 'localTimezone',
        v_element ->> 'status',
        (v_element ->> 'primaryIssueId')::uuid,
        (v_element ->> 'baselineMaxFaceFt')::numeric,
        (v_element ->> 'trustedMinFaceFt')::numeric,
        (v_element ->> 'trustedMaxFaceFt')::numeric,
        (v_element ->> 'signedGapFt')::numeric,
        (v_element ->> 'appliedDeltaFt')::numeric,
        v_policy_version,
        v_build_key
      );
      v_inserted_decision_count := v_inserted_decision_count + 1;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------
  -- 5. First-write snapshots. ON CONFLICT DO NOTHING against the live
  --    unique index (beach_id, predicted_at, forecast_horizon_bucket,
  --    display_source) NULLS NOT DISTINCT, so an existing row is never
  --    updated. D-18 first-write-wins.
  -- ---------------------------------------------------------------------
  IF v_expected_snapshot_count > 0 THEN
    WITH source AS (
      SELECT *
      FROM jsonb_to_recordset(p_payload -> 'snapshots') AS snapshot(
        beach_id uuid,
        predicted_at timestamptz,
        forecast_horizon_hours integer,
        forecast_horizon_bucket text,
        raw_display_height_m double precision,
        offset_corrected_display_height_m double precision,
        height_offset_m double precision,
        height_offset_sample_count integer,
        feedback_height_calibration_candidate_id uuid,
        feedback_height_offset_ft double precision,
        feedback_height_calibration_applied boolean,
        display_source text,
        display_wave_source text,
        display_raw_input_height_m double precision,
        model_version text,
        wave_height_om double precision,
        noaa_swell_1_height_m double precision,
        noaa_swell_1_period_s double precision,
        noaa_swell_1_direction_deg double precision,
        noaa_swell_2_height_m double precision,
        noaa_swell_2_period_s double precision,
        noaa_swell_2_direction_deg double precision,
        noaa_wind_wave_height_m double precision,
        noaa_wind_wave_period_s double precision,
        noaa_wind_wave_direction_deg double precision,
        wave_period_s double precision,
        wave_direction_deg double precision,
        wave_period_om double precision,
        wave_direction_om double precision,
        wave_peak_period_om double precision,
        swell_height_om double precision,
        swell_period_om double precision,
        swell_direction_om double precision,
        swell_wave_peak_period_om double precision,
        wind_wave_height_om double precision,
        wind_wave_period_om double precision,
        wind_wave_direction_om double precision,
        wind_wave_peak_period_om double precision,
        secondary_swell_height_om double precision,
        secondary_swell_period_om double precision,
        secondary_swell_direction_om double precision,
        tertiary_swell_height_om double precision,
        tertiary_swell_period_om double precision,
        tertiary_swell_direction_om double precision,
        om_wind_wave_missing boolean,
        om_primary_swell_missing boolean,
        om_secondary_swell_missing boolean,
        om_tertiary_swell_missing boolean,
        om_partition_schema_version integer,
        wind_speed_ms double precision,
        wind_direction_deg double precision,
        v5_shadow_height_m double precision,
        v5_model_version text,
        direction_bucket text,
        om_bucket text
      )
    ), inserted AS (
      INSERT INTO public.ml_predictions_log (
        beach_id,
        predicted_at,
        forecast_horizon_hours,
        forecast_horizon_bucket,
        raw_display_height_m,
        offset_corrected_display_height_m,
        height_offset_m,
        height_offset_sample_count,
        feedback_height_calibration_candidate_id,
        feedback_height_offset_ft,
        feedback_height_calibration_applied,
        display_source,
        display_wave_source,
        display_raw_input_height_m,
        model_version,
        wave_height_om,
        noaa_swell_1_height_m,
        noaa_swell_1_period_s,
        noaa_swell_1_direction_deg,
        noaa_swell_2_height_m,
        noaa_swell_2_period_s,
        noaa_swell_2_direction_deg,
        noaa_wind_wave_height_m,
        noaa_wind_wave_period_s,
        noaa_wind_wave_direction_deg,
        wave_period_s,
        wave_direction_deg,
        wave_period_om,
        wave_direction_om,
        wave_peak_period_om,
        swell_height_om,
        swell_period_om,
        swell_direction_om,
        swell_wave_peak_period_om,
        wind_wave_height_om,
        wind_wave_period_om,
        wind_wave_direction_om,
        wind_wave_peak_period_om,
        secondary_swell_height_om,
        secondary_swell_period_om,
        secondary_swell_direction_om,
        tertiary_swell_height_om,
        tertiary_swell_period_om,
        tertiary_swell_direction_om,
        om_wind_wave_missing,
        om_primary_swell_missing,
        om_secondary_swell_missing,
        om_tertiary_swell_missing,
        om_partition_schema_version,
        wind_speed_ms,
        wind_direction_deg,
        v5_shadow_height_m,
        v5_model_version,
        direction_bucket,
        om_bucket
      )
      SELECT
        source.beach_id,
        source.predicted_at,
        source.forecast_horizon_hours,
        source.forecast_horizon_bucket,
        source.raw_display_height_m,
        source.offset_corrected_display_height_m,
        source.height_offset_m,
        source.height_offset_sample_count,
        source.feedback_height_calibration_candidate_id,
        source.feedback_height_offset_ft,
        coalesce(source.feedback_height_calibration_applied, false),
        source.display_source,
        source.display_wave_source,
        source.display_raw_input_height_m,
        coalesce(source.model_version, source.display_source),
        source.wave_height_om,
        source.noaa_swell_1_height_m,
        source.noaa_swell_1_period_s,
        source.noaa_swell_1_direction_deg,
        source.noaa_swell_2_height_m,
        source.noaa_swell_2_period_s,
        source.noaa_swell_2_direction_deg,
        source.noaa_wind_wave_height_m,
        source.noaa_wind_wave_period_s,
        source.noaa_wind_wave_direction_deg,
        source.wave_period_s,
        source.wave_direction_deg,
        source.wave_period_om,
        source.wave_direction_om,
        source.wave_peak_period_om,
        source.swell_height_om,
        source.swell_period_om,
        source.swell_direction_om,
        source.swell_wave_peak_period_om,
        source.wind_wave_height_om,
        source.wind_wave_period_om,
        source.wind_wave_direction_om,
        source.wind_wave_peak_period_om,
        source.secondary_swell_height_om,
        source.secondary_swell_period_om,
        source.secondary_swell_direction_om,
        source.tertiary_swell_height_om,
        source.tertiary_swell_period_om,
        source.tertiary_swell_direction_om,
        source.om_wind_wave_missing,
        source.om_primary_swell_missing,
        source.om_secondary_swell_missing,
        source.om_tertiary_swell_missing,
        source.om_partition_schema_version,
        source.wind_speed_ms,
        source.wind_direction_deg,
        source.v5_shadow_height_m,
        source.v5_model_version,
        source.direction_bucket,
        source.om_bucket
      FROM source
      ON CONFLICT (
        beach_id,
        predicted_at,
        forecast_horizon_bucket,
        display_source
      ) DO NOTHING
      RETURNING 1
    )
    SELECT count(*)::integer INTO v_inserted_snapshot_count FROM inserted;

    v_reused_snapshot_count :=
      v_expected_snapshot_count - v_inserted_snapshot_count;
  END IF;

  -- ---------------------------------------------------------------------
  -- 6. Slot applications. Exactly one decision may claim a forecast slot.
  -- ---------------------------------------------------------------------
  FOR v_element IN
    SELECT element
    FROM jsonb_array_elements(p_payload -> 'applications') AS element
  LOOP
    SELECT decision_id
    INTO v_decision_id
    FROM public.trusted_forecast_decisions
    WHERE beach_id = (v_element ->> 'beachId')::uuid
      AND local_date = (v_element ->> 'localDate')::date;

    IF v_decision_id IS NULL THEN
      RAISE EXCEPTION
        'trusted forecast application has no daily decision for beach % on %',
        v_element ->> 'beachId', v_element ->> 'localDate'
        USING ERRCODE = '23503';
    END IF;

    SELECT id
    INTO v_snapshot_id
    FROM public.ml_predictions_log
    WHERE beach_id = (v_element ->> 'beachId')::uuid
      AND predicted_at = (v_element ->> 'forecastAt')::timestamptz
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    SELECT *
    INTO v_application
    FROM public.trusted_forecast_applications
    WHERE beach_id = (v_element ->> 'beachId')::uuid
      AND forecast_at = (v_element ->> 'forecastAt')::timestamptz;

    IF FOUND THEN
      IF v_application.decision_id IS DISTINCT FROM v_decision_id
         OR v_application.applied_delta_ft
           IS DISTINCT FROM (v_element ->> 'appliedDeltaFt')::numeric THEN
        RAISE EXCEPTION
          'trusted forecast slot collision for beach % at %',
          v_element ->> 'beachId', v_element ->> 'forecastAt'
          USING ERRCODE = '23505';
      END IF;
      v_reused_application_count := v_reused_application_count + 1;
    ELSE
      INSERT INTO public.trusted_forecast_applications (
        decision_id,
        beach_id,
        forecast_at,
        prediction_snapshot_id,
        applied_delta_ft,
        baseline_max_face_ft,
        adjusted_max_face_ft,
        build_key
      ) VALUES (
        v_decision_id,
        (v_element ->> 'beachId')::uuid,
        (v_element ->> 'forecastAt')::timestamptz,
        v_snapshot_id,
        (v_element ->> 'appliedDeltaFt')::numeric,
        (v_element ->> 'baselineMaxFaceFt')::numeric,
        (v_element ->> 'adjustedMaxFaceFt')::numeric,
        v_build_key
      );
      v_inserted_application_count := v_inserted_application_count + 1;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------
  -- 7. Durable conflict alerts.
  -- ---------------------------------------------------------------------
  FOR v_element IN
    SELECT element FROM jsonb_array_elements(p_payload -> 'alerts') AS element
  LOOP
    SELECT decision_id
    INTO v_decision_id
    FROM public.trusted_forecast_decisions
    WHERE beach_id = (v_element ->> 'beachId')::uuid
      AND local_date = (v_element ->> 'localDate')::date;

    IF EXISTS (
      SELECT 1
      FROM public.trusted_forecast_alerts
      WHERE build_key = v_build_key
        AND beach_id = (v_element ->> 'beachId')::uuid
        AND local_date = (v_element ->> 'localDate')::date
        AND alert_code = (v_element ->> 'alertCode')
    ) THEN
      v_reused_alert_count := v_reused_alert_count + 1;
    ELSE
      INSERT INTO public.trusted_forecast_alerts (
        beach_id,
        local_date,
        decision_id,
        alert_code,
        separation_ft,
        primary_issue_id,
        conflicting_issue_id,
        evidence,
        build_key
      ) VALUES (
        (v_element ->> 'beachId')::uuid,
        (v_element ->> 'localDate')::date,
        v_decision_id,
        v_element ->> 'alertCode',
        (v_element ->> 'separationFt')::numeric,
        (v_element ->> 'primaryIssueId')::uuid,
        (v_element ->> 'conflictingIssueId')::uuid,
        coalesce(
          NULLIF(v_element -> 'evidence', 'null'::jsonb),
          '{}'::jsonb
        ),
        v_build_key
      );
      v_inserted_alert_count := v_inserted_alert_count + 1;
    END IF;
  END LOOP;

  SELECT count(*)::integer
  INTO v_durable_alert_count
  FROM public.trusted_forecast_alerts
  WHERE build_key = v_build_key;

  -- ---------------------------------------------------------------------
  -- 8. Receipt last. Any error above rolls the whole build back with it.
  -- ---------------------------------------------------------------------
  INSERT INTO public.trusted_forecast_build_receipts (
    build_key,
    payload_sha256,
    schema_version,
    policy_version,
    build_anchor_at,
    expected_decision_count,
    expected_application_count,
    expected_alert_count,
    expected_snapshot_count,
    inserted_decision_count,
    reused_decision_count,
    inserted_application_count,
    reused_application_count,
    inserted_alert_count,
    reused_alert_count,
    inserted_snapshot_count,
    reused_snapshot_count,
    durable_alert_count
  ) VALUES (
    v_build_key,
    v_payload_sha256,
    v_schema_version,
    v_policy_version,
    v_build_anchor_at,
    v_expected_decision_count,
    v_expected_application_count,
    v_expected_alert_count,
    v_expected_snapshot_count,
    v_inserted_decision_count,
    v_reused_decision_count,
    v_inserted_application_count,
    v_reused_application_count,
    v_inserted_alert_count,
    v_reused_alert_count,
    v_inserted_snapshot_count,
    v_reused_snapshot_count,
    v_durable_alert_count
  )
  RETURNING * INTO v_receipt;

  RETURN NEXT v_receipt;
  RETURN;
END;
$$;

-- =============================================================================
-- RECEIPT LOOKUP (D-21 ambiguous-commit reconciliation)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_trusted_forecast_build_receipt(
  p_build_key text
)
RETURNS SETOF public.trusted_forecast_build_receipts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.trusted_forecast_build_receipts
  WHERE build_key = p_build_key;
$$;

-- =============================================================================
-- CONSTRAINED ACKNOWLEDGEMENT (D-22)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.acknowledge_trusted_forecast_alert(
  p_acknowledgement jsonb
)
RETURNS SETOF public.trusted_forecast_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_keys CONSTANT text[] := ARRAY['alertId', 'acknowledgedBy'];
  v_alert_id uuid;
  v_actor text;
  v_alert public.trusted_forecast_alerts%ROWTYPE;
BEGIN
  IF p_acknowledgement IS NULL
     OR jsonb_typeof(p_acknowledgement) <> 'object' THEN
    RAISE EXCEPTION 'alert acknowledgement must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_acknowledgement) AS supplied(key)
    WHERE supplied.key <> ALL (c_keys)
  ) OR EXISTS (
    SELECT 1
    FROM unnest(c_keys) AS required(key)
    WHERE NOT (p_acknowledgement ? required.key)
  ) THEN
    RAISE EXCEPTION 'alert acknowledgement has an invalid field set'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_acknowledgement -> 'acknowledgedBy') <> 'string'
     OR length(p_acknowledgement ->> 'acknowledgedBy') = 0 THEN
    RAISE EXCEPTION 'alert acknowledgement requires a non-empty actor'
      USING ERRCODE = '22023';
  END IF;

  v_alert_id := (p_acknowledgement ->> 'alertId')::uuid;
  v_actor := p_acknowledgement ->> 'acknowledgedBy';

  PERFORM set_config(
    'app.trusted_forecast_alert_acknowledgement',
    'on',
    true
  );

  UPDATE public.trusted_forecast_alerts
  SET acknowledged = true,
      acknowledged_by = v_actor,
      acknowledged_at = transaction_timestamp()
  WHERE alert_id = v_alert_id
    AND acknowledged = false
  RETURNING * INTO v_alert;

  PERFORM set_config(
    'app.trusted_forecast_alert_acknowledgement',
    'off',
    true
  );

  IF v_alert.alert_id IS NULL THEN
    SELECT *
    INTO v_alert
    FROM public.trusted_forecast_alerts
    WHERE alert_id = v_alert_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'trusted forecast alert % does not exist', v_alert_id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN NEXT v_alert;
  RETURN;
END;
$$;

-- =============================================================================
-- LEAST PRIVILEGE (MFA-07, D-23)
-- =============================================================================

REVOKE ALL ON public.trusted_forecast_ingest_runs
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.trusted_forecast_ingest_source_results
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.trusted_forecast_issues
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.trusted_forecast_decisions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.trusted_forecast_applications
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.trusted_forecast_alerts
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.trusted_forecast_build_receipts
  FROM PUBLIC, anon, authenticated;

-- Seaside ingestion writes runs, source results, and issues directly with the
-- service role. Decisions, applications, alerts, and receipts are written only
-- by the SECURITY DEFINER RPCs, so service_role gets SELECT there and nothing
-- more.
REVOKE ALL ON public.trusted_forecast_ingest_runs FROM service_role;
REVOKE ALL ON public.trusted_forecast_ingest_source_results FROM service_role;
REVOKE ALL ON public.trusted_forecast_issues FROM service_role;
REVOKE ALL ON public.trusted_forecast_decisions FROM service_role;
REVOKE ALL ON public.trusted_forecast_applications FROM service_role;
REVOKE ALL ON public.trusted_forecast_alerts FROM service_role;
REVOKE ALL ON public.trusted_forecast_build_receipts FROM service_role;

GRANT SELECT, INSERT ON public.trusted_forecast_ingest_runs TO service_role;
GRANT SELECT, INSERT ON public.trusted_forecast_ingest_source_results
  TO service_role;
GRANT SELECT, INSERT ON public.trusted_forecast_issues TO service_role;
GRANT SELECT ON public.trusted_forecast_decisions TO service_role;
GRANT SELECT ON public.trusted_forecast_applications TO service_role;
GRANT SELECT ON public.trusted_forecast_alerts TO service_role;
GRANT SELECT ON public.trusted_forecast_build_receipts TO service_role;

REVOKE ALL ON FUNCTION public.reject_trusted_forecast_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_trusted_forecast_alert_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_forecast_canonical_number(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_forecast_canonical_timestamp(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_forecast_canonical_decision(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_forecast_canonical_application(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_forecast_canonical_alert(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_forecast_snapshot_columns()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_forecast_canonical_snapshot(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_forecast_canonical_build_payload(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_trusted_forecast_build(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_trusted_forecast_build_receipt(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_trusted_forecast_alert(jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.persist_trusted_forecast_build(jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_trusted_forecast_build_receipt(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_trusted_forecast_alert(jsonb)
  TO service_role;

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.trusted_forecast_ingest_runs IS
  'Append-only health record for each six-hour trusted-forecast ingestion run (D-04, D-18).';
COMMENT ON TABLE public.trusted_forecast_ingest_source_results IS
  'Append-only per-source ingestion outcome. degraded_failure_code/degraded_item_count record partial item loss inside an otherwise healthy source. No FK to trusted_forecast_ingest_runs: the cron writes the run row last.';
COMMENT ON TABLE public.trusted_forecast_issues IS
  'Append-only normalized forecaster issue revisions (MFA-02, D-18). region_key carries chart spot slugs when scope_type=spot; exposure is free text across source families.';
COMMENT ON COLUMN public.trusted_forecast_issues.day_part IS
  'Sub-day window facet (all_day|day|night). Kept out of exposure so D-12 exposure compatibility stays spatial.';
COMMENT ON COLUMN public.trusted_forecast_issues.validity_basis IS
  'Whether the source stated the validity window or it was derived from the publication day (stated|derived_publication_day).';
COMMENT ON TABLE public.trusted_forecast_decisions IS
  'Append-only, exactly one decision per beach and IANA local day (D-13, D-18).';
COMMENT ON TABLE public.trusted_forecast_applications IS
  'Append-only, at most one decision claims each beach/forecast slot (D-13, D-18).';
COMMENT ON TABLE public.trusted_forecast_alerts IS
  'Immutable range-separation evidence. Only acknowledge_trusted_forecast_alert may change acknowledged, acknowledged_by, acknowledged_at (D-22).';
COMMENT ON TABLE public.trusted_forecast_build_receipts IS
  'Immutable build receipts with the database-computed canonical SHA-256 and exact durable counts (D-19, D-20).';
COMMENT ON FUNCTION public.persist_trusted_forecast_build(jsonb) IS
  'Atomically persists one trusted-forecast build and inserts the receipt last. Canonicalizes content and computes SHA-256 in the database; a repeated build key returns the existing receipt only when hash and every exact count match (D-19, D-20).';
COMMENT ON FUNCTION public.get_trusted_forecast_build_receipt(text) IS
  'Service-role-only receipt read used to reconcile transport-ambiguous persistence attempts (D-21).';
COMMENT ON FUNCTION public.acknowledge_trusted_forecast_alert(jsonb) IS
  'Service-role-only acknowledgement that may change only acknowledgement status, actor, and timestamp (D-22).';

COMMIT;

-- =============================================================================
-- ROLLBACK (additive migration; run as the owner to reverse it exactly)
-- =============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.acknowledge_trusted_forecast_alert(jsonb);
-- DROP FUNCTION IF EXISTS public.get_trusted_forecast_build_receipt(text);
-- DROP FUNCTION IF EXISTS public.persist_trusted_forecast_build(jsonb);
-- DROP FUNCTION IF EXISTS public.trusted_forecast_canonical_build_payload(jsonb);
-- DROP FUNCTION IF EXISTS public.trusted_forecast_canonical_snapshot(jsonb);
-- DROP FUNCTION IF EXISTS public.trusted_forecast_snapshot_columns();
-- DROP FUNCTION IF EXISTS public.trusted_forecast_canonical_alert(jsonb);
-- DROP FUNCTION IF EXISTS public.trusted_forecast_canonical_application(jsonb);
-- DROP FUNCTION IF EXISTS public.trusted_forecast_canonical_decision(jsonb);
-- DROP FUNCTION IF EXISTS public.trusted_forecast_canonical_timestamp(jsonb);
-- DROP FUNCTION IF EXISTS public.trusted_forecast_canonical_number(jsonb);
-- DROP TABLE IF EXISTS public.trusted_forecast_build_receipts;
-- DROP TABLE IF EXISTS public.trusted_forecast_alerts;
-- DROP TABLE IF EXISTS public.trusted_forecast_applications;
-- DROP TABLE IF EXISTS public.trusted_forecast_decisions;
-- DROP TABLE IF EXISTS public.trusted_forecast_issues;
-- DROP TABLE IF EXISTS public.trusted_forecast_ingest_source_results;
-- DROP TABLE IF EXISTS public.trusted_forecast_ingest_runs;
-- DROP FUNCTION IF EXISTS public.reject_trusted_forecast_alert_mutation();
-- DROP FUNCTION IF EXISTS public.reject_trusted_forecast_mutation();
-- COMMIT;
