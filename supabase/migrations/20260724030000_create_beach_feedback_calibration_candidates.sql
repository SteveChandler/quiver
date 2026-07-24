BEGIN;

CREATE TABLE IF NOT EXISTS public.beach_feedback_calibration_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'shadow'
    CHECK (status IN ('shadow', 'active_temp', 'expired', 'rejected', 'manual_hold')),
  offset_ft numeric(4,2) NOT NULL
    CHECK (offset_ft BETWEEN -0.50 AND 0.50),
  sample_count integer NOT NULL CHECK (sample_count >= 0),
  unique_user_count integer NOT NULL CHECK (unique_user_count >= 0),
  evidence_window_start timestamptz,
  evidence_window_end timestamptz,
  residual_direction text NOT NULL
    CHECK (residual_direction IN ('forecast_too_high', 'forecast_too_low', 'neutral')),
  mae_before_ft numeric(6,3) NOT NULL CHECK (mae_before_ft >= 0),
  mae_after_ft numeric(6,3) NOT NULL CHECK (mae_after_ft >= 0),
  decision_reason text NOT NULL,
  evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  shadow_started_at timestamptz,
  activated_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    status <> 'active_temp'
    OR (
      activated_at IS NOT NULL
      AND expires_at IS NOT NULL
      AND expires_at > activated_at
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_beach_feedback_calibration_active_temp
  ON public.beach_feedback_calibration_candidates (beach_id)
  WHERE status = 'active_temp';

CREATE INDEX IF NOT EXISTS idx_beach_feedback_calibration_status_updated
  ON public.beach_feedback_calibration_candidates (status, updated_at DESC);

ALTER TABLE public.beach_feedback_calibration_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.beach_feedback_calibration_candidates
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.beach_feedback_calibration_candidates TO service_role;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS feedback_height_calibration_candidate_id uuid,
  ADD COLUMN IF NOT EXISTS feedback_height_offset_ft numeric(4,2),
  ADD COLUMN IF NOT EXISTS feedback_height_calibration_applied boolean
    NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ml_predictions_log_feedback_height_candidate_fkey'
  ) THEN
    ALTER TABLE public.ml_predictions_log
      ADD CONSTRAINT ml_predictions_log_feedback_height_candidate_fkey
      FOREIGN KEY (feedback_height_calibration_candidate_id)
      REFERENCES public.beach_feedback_calibration_candidates(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE public.ml_predictions_log
  DROP CONSTRAINT IF EXISTS ml_predictions_log_feedback_height_offset_check;
ALTER TABLE public.ml_predictions_log
  ADD CONSTRAINT ml_predictions_log_feedback_height_offset_check
  CHECK (
    feedback_height_offset_ft IS NULL
    OR feedback_height_offset_ft BETWEEN -0.50 AND 0.50
  );

COMMENT ON TABLE public.beach_feedback_calibration_candidates IS
  'Service-role-only temporary display-height calibration candidates derived from completed numeric user sessions.';
COMMENT ON COLUMN public.ml_predictions_log.feedback_height_offset_ft IS
  'Temporary feedback residual offset in feet; final display subtracts this value after any beach height offset.';

COMMIT;
