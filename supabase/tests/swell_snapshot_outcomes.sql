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

-- Historical backlog: 600 events, 30 beaches, 80 run dates, 2,100 snapshots.
INSERT INTO public.beaches (id, timezone)
SELECT ('10000000-0000-4000-8000-' || lpad(b::text, 12, '0'))::uuid, 'America/Los_Angeles'
FROM generate_series(1, 30) b;

CREATE TEMP TABLE bulk_events AS
SELECT ('10000000-0000-4000-8000-' || lpad(b::text, 12, '0'))::uuid AS beach_id,
  'bulk:' || e::text AS event_key,
  timestamptz '2026-01-01 14:30+00' + (e * 8) * interval '1 day' AS first_run,
  timestamptz '2026-01-05 20:00+00' + (e * 8) * interval '1 day' AS peak_at,
  CASE WHEN (b + e) % 2 = 0 THEN 'held' ELSE 'vanished' END AS expected_outcome
FROM generate_series(1, 30) b CROSS JOIN generate_series(1, 20) e;

INSERT INTO public.swell_event_forecast_snapshots
  (beach_id, event_key, detector_version, run_date, detected_at, direction_deg, direction_band, period_s,
   peak_offshore_height_ft, peak_face_height_ft, exposure, energy_ratio, arrival_at, peak_at)
SELECT e.beach_id, e.event_key, 'swell-events.v1', (e.first_run + r * interval '1 day')::date,
  e.first_run + r * interval '1 day', 270, 'W', 14, 4, 5, 1, 5, e.peak_at, e.peak_at
FROM bulk_events e
CROSS JOIN LATERAL generate_series(0, CASE WHEN e.expected_outcome = 'held' THEN 3 ELSE 2 END) r;

CREATE TEMP TABLE previously_resolved AS
SELECT id, outcome, outcome_resolved_at FROM public.swell_event_forecast_snapshots WHERE outcome IS NOT NULL;

-- Capture the original rule independently before the optimized resolver runs.
CREATE TEMP TABLE expected_bulk_rows AS
WITH latest AS (
  SELECT DISTINCT ON (beach_id, event_key, detector_version)
    beach_id, event_key, detector_version, peak_at, detected_at
  FROM public.swell_event_forecast_snapshots
  WHERE outcome IS NULL
  ORDER BY beach_id, event_key, detector_version, detected_at DESC
), due AS (
  SELECT l.*, (SELECT max(s.detected_at) FROM public.swell_event_forecast_snapshots s WHERE s.detected_at < l.peak_at) AS last_run
  FROM latest l WHERE l.peak_at < timestamptz '2026-10-05 12:00+00' - interval '12 hours'
)
SELECT s.id,
  CASE WHEN d.last_run IS NULL OR d.detected_at >= d.last_run THEN 'held' ELSE 'vanished' END AS outcome
FROM public.swell_event_forecast_snapshots s
JOIN due d USING (beach_id, event_key, detector_version)
WHERE s.outcome IS NULL;

DO $$
DECLARE
  resolved integer;
BEGIN
  ASSERT (SELECT count(*) FROM bulk_events) = 600, '600 backlog events';
  ASSERT (SELECT count(DISTINCT beach_id) FROM bulk_events) = 30, '30 backlog beaches';
  ASSERT (SELECT count(DISTINCT run_date) FROM public.swell_event_forecast_snapshots WHERE event_key LIKE 'bulk:%') = 80, '80 backlog run dates';
  ASSERT (SELECT count(*) FROM expected_bulk_rows) = 2100, '2100 due backlog rows';
  resolved := public.resolve_swell_event_outcomes('2026-10-05 12:00+00');
  ASSERT resolved = 2100, 'backlog row count matches';
  ASSERT NOT EXISTS (
    SELECT 1 FROM expected_bulk_rows e LEFT JOIN public.swell_event_forecast_snapshots s USING (id)
    WHERE s.outcome IS DISTINCT FROM e.outcome OR s.outcome_resolved_at IS DISTINCT FROM timestamptz '2026-10-05 12:00+00'
  ), 'every backlog row matches the original rule';
  ASSERT NOT EXISTS (
    SELECT 1 FROM bulk_events e JOIN public.swell_event_forecast_snapshots s USING (beach_id, event_key)
    WHERE s.outcome IS DISTINCT FROM e.expected_outcome
  ), '300 held and 300 vanished events match fixture intent';
  ASSERT public.resolve_swell_event_outcomes('2026-10-05 13:00+00') = 0, 'backlog repeat updates nothing';
  ASSERT NOT EXISTS (
    SELECT 1 FROM previously_resolved p LEFT JOIN public.swell_event_forecast_snapshots s USING (id)
    WHERE s.outcome IS DISTINCT FROM p.outcome OR s.outcome_resolved_at IS DISTINCT FROM p.outcome_resolved_at
  ), 'previously resolved rows never change';
  ASSERT (SELECT NOT prosecdef AND proconfig @> ARRAY['search_path=public'] FROM pg_proc WHERE oid = 'public.resolve_swell_event_outcomes(timestamptz)'::regprocedure) IS TRUE, 'resolver stays invoker with pinned search path';
END $$;
SELECT 'swell snapshot backlog equivalence OK: 600 events, 30 beaches, 80 run dates, 2100 rows';

-- A run exactly at the peak is excluded, including already resolved history.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'strict-before', '2026-01-11', '2026-01-11 14:30+00', '2026-01-12 14:30+00');
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.swell_event_forecast_snapshots WHERE detected_at = timestamptz '2026-01-12 14:30+00'), 'run exists exactly at peak';
  ASSERT public.resolve_swell_event_outcomes('2026-10-05 12:00+00') = 1, 'strict-before fixture resolves';
  ASSERT (SELECT outcome = 'held' FROM public.swell_event_forecast_snapshots WHERE event_key = 'strict-before') IS TRUE, 'equal peak timestamp is excluded from earlier runs';
END $$;
SELECT 'swell snapshot strict run-boundary assertions passed';
