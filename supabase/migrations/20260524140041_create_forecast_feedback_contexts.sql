-- Forecast feedback context storage.
--
-- Phase 1 only defines storage and the server-owned contract. It does not
-- expose direct client writes and does not connect feedback to model-changing
-- paths.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.forecast_feedback_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NULL,
  session_id text NULL,
  anonymous_client_id text NULL,

  beach_id uuid NOT NULL,
  forecast_at timestamptz NOT NULL,
  window_start timestamptz NULL,
  window_end timestamptz NULL,
  issued_at timestamptz NULL,
  predicted_at timestamptz NULL,
  forecast_horizon_hours integer NULL
    CHECK (forecast_horizon_hours IS NULL OR forecast_horizon_hours BETWEEN 0 AND 168),

  feedback_kind text NOT NULL
    CHECK (feedback_kind IN ('forecast_accuracy', 'surf_call', 'condition_report', 'other')),
  feedback_value text NOT NULL,
  feedback_note text NULL,

  displayed_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_model_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  calibration_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  surf_call_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  client_source text NOT NULL,
  client_version text NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  contract_version text NOT NULL DEFAULT 'forecast-feedback-context.v1',
  ingest_path text NOT NULL,
  request_id text NULL,
  correlation_id text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT forecast_feedback_window_order
    CHECK (window_start IS NULL OR window_end IS NULL OR window_start <= window_end)
);

ALTER TABLE public.forecast_feedback_contexts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.forecast_feedback_contexts FROM anon;
REVOKE ALL ON TABLE public.forecast_feedback_contexts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.forecast_feedback_contexts TO service_role;

CREATE INDEX IF NOT EXISTS idx_forecast_feedback_contexts_beach_forecast_at
  ON public.forecast_feedback_contexts (beach_id, forecast_at);

CREATE INDEX IF NOT EXISTS idx_forecast_feedback_contexts_created_at
  ON public.forecast_feedback_contexts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forecast_feedback_contexts_user_id
  ON public.forecast_feedback_contexts (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forecast_feedback_contexts_session_id
  ON public.forecast_feedback_contexts (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forecast_feedback_contexts_contract_version
  ON public.forecast_feedback_contexts (contract_version);

COMMENT ON TABLE public.forecast_feedback_contexts IS
  'Forecast feedback context rows captured with displayed forecast, source/model, calibration, surf-call, missing-context, and audit metadata. Phase 1 storage only; not a training label source.';

COMMIT;
