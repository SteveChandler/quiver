\set ON_ERROR_STOP on
-- Disposable local cluster only; run scripts/test-swell-snapshot-outcomes-postgres.sh.
SET timezone = 'UTC';
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.beaches (id uuid PRIMARY KEY, timezone text);
\ir ../migrations/20260925150500_create_swell_event_forecast_snapshots.sql
\ir ../migrations/20261004200000_add_swell_snapshot_lead_and_outcome.sql

INSERT INTO public.beaches VALUES
  ('00000000-0000-4000-8000-000000000001', 'America/Los_Angeles'),
  ('00000000-0000-4000-8000-000000000002', 'America/Los_Angeles');

CREATE FUNCTION fixture_snapshot(p_beach uuid, p_key text, p_run date, p_detected timestamptz, p_peak timestamptz, p_version text DEFAULT 'swell-events.v1')
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.swell_event_forecast_snapshots
    (beach_id, event_key, detector_version, run_date, detected_at, direction_deg, direction_band, period_s,
     peak_offshore_height_ft, peak_face_height_ft, exposure, energy_ratio, arrival_at, peak_at)
  VALUES (p_beach, p_key, p_version, p_run, p_detected, 270, 'W', 14, 4, 5, 1, 5, p_peak, p_peak);
$$;

-- Runs on 10-01, 10-02, 10-03 (canary event on beach 2 is on all three).
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000002', 'canary', d::date, d + interval '14 hours 30 minutes', timestamptz '2026-10-04 20:00+00')
FROM generate_series(timestamptz '2026-10-01', timestamptz '2026-10-03', interval '1 day') d;
-- vanished: seen 10-01 and 10-02, absent on the last run before its 10-04 peak.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'gone', d::date, d + interval '14 hours 30 minutes', timestamptz '2026-10-04 20:00+00')
FROM generate_series(timestamptz '2026-10-01', timestamptz '2026-10-02', interval '1 day') d;
-- held: present on all three runs.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'stayed', d::date, d + interval '14 hours 30 minutes', timestamptz '2026-10-04 20:00+00')
FROM generate_series(timestamptz '2026-10-01', timestamptz '2026-10-03', interval '1 day') d;
-- not due: peaks in the future.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'later', '2026-10-03', timestamptz '2026-10-03 14:30+00', timestamptz '2026-10-20 20:00+00');

GRANT SELECT, UPDATE ON public.swell_event_forecast_snapshots TO service_role;
SET ROLE service_role;
SELECT public.resolve_swell_event_outcomes(timestamptz '2026-10-05 12:00+00') AS resolved \gset
RESET ROLE;
SELECT :resolved = 8 AS count_ok \gset
\if :count_ok
\else
  \quit 1
\endif

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.swell_event_forecast_snapshots WHERE outcome IS NOT NULL) = 8, 'eight rows resolve';
  ASSERT (SELECT bool_and(outcome_resolved_at = timestamptz '2026-10-05 12:00+00') FROM public.swell_event_forecast_snapshots WHERE outcome IS NOT NULL) IS TRUE, 'resolution timestamps match';
  ASSERT (SELECT bool_and(outcome = 'vanished') FROM public.swell_event_forecast_snapshots WHERE event_key = 'gone') IS TRUE, 'gone should be vanished';
  ASSERT (SELECT count(*) FROM public.swell_event_forecast_snapshots WHERE event_key = 'gone') = 2, 'gone keeps both rows';
  ASSERT (SELECT bool_and(outcome = 'held') FROM public.swell_event_forecast_snapshots WHERE event_key IN ('stayed', 'canary')) IS TRUE, 'stayed and canary should be held';
  ASSERT (SELECT outcome IS NULL FROM public.swell_event_forecast_snapshots WHERE event_key = 'later') IS TRUE, 'future peak stays unresolved';
END $$;

-- Idempotent: a second call resolves nothing.
DO $$ BEGIN ASSERT public.resolve_swell_event_outcomes(timestamptz '2026-10-05 12:00+00') = 0, 'repeat resolves nothing'; END $$;
SELECT 'swell snapshot outcomes OK: ' || :resolved || ' rows resolved';

-- A first observation after the peak has no earlier run and is held.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'first', '2026-10-01', '2026-10-01 14:30+00', '2026-09-30 20:00+00');
DO $$ BEGIN
  ASSERT public.resolve_swell_event_outcomes('2026-10-05 12:00+00') = 1, 'first observation resolves';
  ASSERT (SELECT outcome = 'held' FROM public.swell_event_forecast_snapshots WHERE event_key = 'first') IS TRUE, 'no earlier run is held';
END $$;

-- Strictly more than twelve hours; resolving again preserves older timestamps.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'boundary', '2026-10-03', '2026-10-03 14:30+00', '2026-10-05 00:00+00');
DO $$ BEGIN
  ASSERT public.resolve_swell_event_outcomes('2026-10-05 12:00+00') = 0, 'exactly twelve hours is not due';
  ASSERT (SELECT outcome IS NULL AND outcome_resolved_at IS NULL FROM public.swell_event_forecast_snapshots WHERE event_key = 'boundary') IS TRUE, 'boundary remains unresolved';
  ASSERT public.resolve_swell_event_outcomes('2026-10-05 12:00:01+00') = 1, 'past twelve hours resolves';
  ASSERT (SELECT bool_and(outcome_resolved_at = timestamptz '2026-10-05 12:00+00') FROM public.swell_event_forecast_snapshots WHERE event_key = 'gone') IS TRUE, 'earlier resolutions stay unchanged';
END $$;

-- The latest predicted peak controls eligibility, independently per version.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'drift', '2026-10-01', '2026-10-01 14:30+00', '2026-10-04 20:00+00');
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'drift', '2026-10-03', '2026-10-03 14:30+00', '2026-10-20 20:00+00');
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'versioned', '2026-10-01', '2026-10-01 14:30+00', '2026-10-04 20:00+00');
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'versioned', '2026-10-03', '2026-10-03 14:30+00', '2026-10-04 20:00+00', 'swell-outlook-pulse.v1');
DO $$ BEGIN
  ASSERT public.resolve_swell_event_outcomes('2026-10-05 12:00+00') = 2, 'both detector versions resolve';
  ASSERT (SELECT bool_and(outcome IS NULL) FROM public.swell_event_forecast_snapshots WHERE event_key = 'drift') IS TRUE, 'latest future peak keeps every row unresolved';
  ASSERT (SELECT outcome = 'vanished' FROM public.swell_event_forecast_snapshots WHERE event_key = 'versioned' AND detector_version = 'swell-events.v1') IS TRUE, 'older version vanished';
  ASSERT (SELECT outcome = 'held' FROM public.swell_event_forecast_snapshots WHERE event_key = 'versioned' AND detector_version = 'swell-outlook-pulse.v1') IS TRUE, 'latest version held';
  ASSERT NOT has_function_privilege('anon', 'public.resolve_swell_event_outcomes(timestamptz)', 'EXECUTE'), 'anon cannot resolve';
  ASSERT NOT has_function_privilege('authenticated', 'public.resolve_swell_event_outcomes(timestamptz)', 'EXECUTE'), 'authenticated cannot resolve';
  ASSERT has_function_privilege('service_role', 'public.resolve_swell_event_outcomes(timestamptz)', 'EXECUTE'), 'service role can resolve';
  BEGIN
    UPDATE public.swell_event_forecast_snapshots SET outcome = 'other' WHERE event_key = 'boundary';
    RAISE EXCEPTION 'invalid outcome accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Task 4 regression: real uniqueness preserves two components and isolates an upsert.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001:SW:2026-10-10:p', '2026-10-03', '2026-10-03 14:30+00', '2026-10-10 20:00+00', 'swell-outlook-pulse.v1');
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001:SW:2026-10-10:p:2', '2026-10-03', '2026-10-03 14:30+00', '2026-10-10 20:00+00', 'swell-outlook-pulse.v1');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.swell_event_forecast_snapshots WHERE event_key LIKE '%:SW:2026-10-10:p%') = 2, 'both pulse components persist';
END $$;

INSERT INTO public.swell_event_forecast_snapshots
  (beach_id, event_key, detector_version, run_date, detected_at, direction_deg, direction_band, period_s,
   peak_offshore_height_ft, peak_face_height_ft, exposure, energy_ratio, arrival_at, peak_at)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001:SW:2026-10-10:p',
  'swell-outlook-pulse.v1', '2026-10-03', '2026-10-03 15:30+00', 270, 'W', 18, 4, 5, 1, 5, '2026-10-10 20:00+00', '2026-10-10 20:00+00')
ON CONFLICT (beach_id, event_key, run_date) DO UPDATE
  SET period_s = EXCLUDED.period_s, detected_at = EXCLUDED.detected_at;

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.swell_event_forecast_snapshots WHERE event_key LIKE '%:SW:2026-10-10:p%') = 2, 'upsert preserves both components';
  ASSERT (SELECT period_s = 18 AND detected_at = timestamptz '2026-10-03 15:30+00' FROM public.swell_event_forecast_snapshots WHERE event_key = '00000000-0000-4000-8000-000000000001:SW:2026-10-10:p') IS TRUE, 'target component updated';
  ASSERT (SELECT period_s = 14 AND detected_at = timestamptz '2026-10-03 14:30+00' FROM public.swell_event_forecast_snapshots WHERE event_key = '00000000-0000-4000-8000-000000000001:SW:2026-10-10:p:2') IS TRUE, 'second component unchanged';
END $$;
SELECT 'swell snapshot outcomes: all assertions passed';
