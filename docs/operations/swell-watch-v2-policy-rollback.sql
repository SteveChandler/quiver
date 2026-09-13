-- DRAFT: owner execution only after shadow evaluation is disabled and final rollback approval is recorded.
-- Append-only restoration of the exact v1 evaluation policy; no data deletion, flag mutation, or push authority.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $operation$
DECLARE
  v_count bigint;
  v_control_state text;
  v_epoch1 public.swell_watch_evaluation_policies%ROWTYPE;
  v_epoch2 public.swell_watch_evaluation_policies%ROWTYPE;
  v_epoch3 public.swell_watch_evaluation_policies%ROWTYPE;
  v_old_values jsonb := $policy${
  "local_significance": { "minimum_height_rise_ft": 1, "minimum_energy_ratio": 1.25 },
  "local_impact": { "minimum_impact_score": 1 },
  "partition_matching": {
    "maximum_direction_delta_deg": 25,
    "maximum_period_delta_s": 2,
    "maximum_arrival_delta_hours": 6
  },
  "missing_or_disagreement": {
    "suppress_on_missing_partition": true,
    "suppress_on_material_source_disagreement": true
  },
  "actionability": { "minimum_days_before_arrival": 2, "maximum_days_before_arrival": 5 },
  "stability": { "minimum_genuine_evaluations": 2 },
  "volume_caps": {
    "maximum_candidates_per_region": 50,
    "maximum_recipients_per_event": 1000,
    "maximum_projected_sends_per_window": 1000,
    "projected_send_window_hours": 24
  },
  "provider_failure_hold": { "window_minutes": 60, "maximum_failure_rate": 0.05, "minimum_samples": 20 },
  "staleness": { "maximum_forecast_age_hours": 12 },
  "cadence": { "evaluation_interval_minutes": 60 }
}$policy$::jsonb;
  v_v2_values jsonb := $policy${
  "local_significance": { "minimum_height_rise_ft": 1, "minimum_energy_ratio": 1.25 },
  "local_impact": { "minimum_impact_score": 1 },
  "partition_matching": {
    "maximum_direction_delta_deg": 25,
    "maximum_period_delta_s": 2,
    "maximum_arrival_delta_hours": 6,
    "trajectory_assignment": "max-cardinality-minimax-normalized.v1"
  },
  "missing_or_disagreement": {
    "suppress_on_missing_partition": true,
    "suppress_on_material_source_disagreement": true
  },
  "actionability": { "minimum_days_before_arrival": 2, "maximum_days_before_arrival": 5 },
  "stability": { "minimum_genuine_evaluations": 2 },
  "volume_caps": {
    "maximum_candidates_per_region": 50,
    "maximum_recipients_per_event": 1000,
    "maximum_projected_sends_per_window": 1000,
    "projected_send_window_hours": 24
  },
  "provider_failure_hold": { "window_minutes": 60, "maximum_failure_rate": 0.05, "minimum_samples": 20 },
  "staleness": { "maximum_forecast_age_hours": 12 },
  "cadence": { "evaluation_interval_minutes": 60 }
}$policy$::jsonb;
  v_old_not_before constant timestamptz := timestamptz '2026-09-10T02:45:47.591003Z';
  v_original_expiry constant timestamptz := timestamptz '2026-10-25T02:45:47.591003Z';
  v_old_hash constant text := '4c9ec372e9dff824039956ef5d2f46e6d3445b9d0d80d6626cac9932de436ecd';
  v_old_evidence constant text := 'f8d3549aec17646288a8a00bb174075973f2ab461b7506315c5c5aab5784d977';
  v_v2_hash constant text := '86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f';
  v_v2_evidence constant text := '6ac158d19ffd55505609efae9ce6b634bea9d92342c133333fdc91fe29471403';
  v_old_reviewer constant text := 'Steven Chandler';
  v_v2_reviewer constant text := 'Steven Chandler (v2 operator approval)';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control', 0));
  LOCK TABLE public.swell_watch_evaluation_policies IN SHARE ROW EXCLUSIVE MODE;

  SELECT control.state INTO v_control_state FROM public.swell_watch_get_automation_control() control;
  IF v_control_state IS DISTINCT FROM 'disabled'
    OR EXISTS (SELECT 1 FROM public.swell_watch_get_production_authority()) THEN
    RAISE EXCEPTION 'Swell Watch control must be disabled and push authority absent';
  END IF;

  SELECT count(*) INTO v_count FROM public.swell_watch_evaluation_policies;
  SELECT * INTO v_epoch1 FROM public.swell_watch_evaluation_policies WHERE epoch = 1;
  SELECT * INTO v_epoch2 FROM public.swell_watch_evaluation_policies WHERE epoch = 2;
  IF v_epoch1.epoch IS DISTINCT FROM 1
    OR v_epoch1.state IS DISTINCT FROM 'active'
    OR v_epoch1.policy_hash IS DISTINCT FROM v_old_hash
    OR v_epoch1.policy_values IS DISTINCT FROM v_old_values
    OR v_epoch1.reviewer IS DISTINCT FROM v_old_reviewer
    OR v_epoch1.evidence_hash IS DISTINCT FROM v_old_evidence
    OR v_epoch1.not_before IS DISTINCT FROM v_old_not_before
    OR v_epoch1.expires_at IS DISTINCT FROM v_original_expiry
    OR v_epoch2.epoch IS DISTINCT FROM 2
    OR v_epoch2.state IS DISTINCT FROM 'active'
    OR v_epoch2.policy_hash IS DISTINCT FROM v_v2_hash
    OR v_epoch2.policy_values IS DISTINCT FROM v_v2_values
    OR v_epoch2.reviewer IS DISTINCT FROM v_v2_reviewer
    OR v_epoch2.evidence_hash IS DISTINCT FROM v_v2_evidence
    OR v_epoch2.not_before IS DISTINCT FROM v_old_not_before
    OR v_epoch2.expires_at IS DISTINCT FROM v_original_expiry
    OR v_epoch2.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Epoch 2 is not the reviewed, current v2 policy; do not roll back';
  END IF;

  IF v_count = 2 THEN
    INSERT INTO public.swell_watch_evaluation_policies
      (epoch, state, policy_hash, policy_values, reviewer, evidence_hash, not_before, expires_at)
    VALUES
      (3, 'active', v_old_hash, v_old_values, v_old_reviewer, v_old_evidence,
        v_old_not_before, v_original_expiry);
    RETURN;
  END IF;

  IF v_count = 3 THEN
    SELECT * INTO v_epoch3 FROM public.swell_watch_evaluation_policies WHERE epoch = 3;
    IF v_epoch3.epoch = 3
      AND v_epoch3.state = 'active'
      AND v_epoch3.policy_hash = v_old_hash
      AND v_epoch3.policy_values = v_old_values
      AND v_epoch3.reviewer = v_old_reviewer
      AND v_epoch3.evidence_hash = v_old_evidence
      AND v_epoch3.not_before = v_old_not_before
      AND v_epoch3.expires_at = v_original_expiry
      AND v_epoch3.expires_at > clock_timestamp() THEN
      RETURN;
    END IF;
  END IF;

  RAISE EXCEPTION 'Unexpected evaluation-policy ledger state; exact retry only';
END;
$operation$;

COMMIT;
