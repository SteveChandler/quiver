-- DRAFT: execute only after exact production-plan approval. No provider attestation or send authority.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $operation$
DECLARE
  existing public.swell_watch_evaluation_policies;
  expected_values jsonb := $policy${
  "local_significance": {
    "minimum_height_rise_ft": 1,
    "minimum_energy_ratio": 1.25
  },
  "local_impact": {
    "minimum_impact_score": 1
  },
  "partition_matching": {
    "maximum_direction_delta_deg": 25,
    "maximum_period_delta_s": 2,
    "maximum_arrival_delta_hours": 6
  },
  "missing_or_disagreement": {
    "suppress_on_missing_partition": true,
    "suppress_on_material_source_disagreement": true
  },
  "actionability": {
    "minimum_days_before_arrival": 2,
    "maximum_days_before_arrival": 5
  },
  "stability": {
    "minimum_genuine_evaluations": 2
  },
  "volume_caps": {
    "maximum_candidates_per_region": 50,
    "maximum_recipients_per_event": 1000,
    "maximum_projected_sends_per_window": 1000,
    "projected_send_window_hours": 24
  },
  "provider_failure_hold": {
    "window_minutes": 60,
    "maximum_failure_rate": 0.05,
    "minimum_samples": 20
  },
  "staleness": {
    "maximum_forecast_age_hours": 12
  },
  "cadence": {
    "evaluation_interval_minutes": 60
  }
}$policy$::jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO existing FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No installed policy to revoke'; END IF;
  IF existing.policy_hash IS DISTINCT FROM '4c9ec372e9dff824039956ef5d2f46e6d3445b9d0d80d6626cac9932de436ecd'
    OR existing.policy_values IS DISTINCT FROM expected_values
    OR existing.evidence_hash IS DISTINCT FROM 'f8d3549aec17646288a8a00bb174075973f2ab461b7506315c5c5aab5784d977'
    OR existing.reviewer IS DISTINCT FROM 'Steven Chandler' THEN
    RAISE EXCEPTION 'Unexpected evaluation policy; require a new reviewed plan';
  END IF;
  IF existing.epoch=2 AND existing.state='revoked' THEN RETURN; END IF;
  IF existing.epoch<>1 OR existing.state<>'active' THEN
    RAISE EXCEPTION 'Unexpected policy epoch/state; do not revoke unrelated policy';
  END IF;
  INSERT INTO public.swell_watch_evaluation_policies
    (epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
  VALUES (2,'revoked',existing.policy_hash,existing.policy_values,existing.reviewer,
    existing.evidence_hash,existing.not_before,existing.expires_at);
END;
$operation$;
COMMIT;
