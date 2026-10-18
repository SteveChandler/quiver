-- County advisory ingest: accept County module version 6389 and close the circuit.
--
-- Why: at 2026-10-02 01:30 UTC the County (sdbeachinfo, OutSystems) bumped its module version
-- 6304/Y3IareGcvkhpc7CILZGOzA -> 6389/7aN_koZhHSZzT3c9cAnpSg. The version guard opened the circuit,
-- the last completed run (00:30 UTC) went stale at 02:30 UTC (COUNTY_MAX_STALENESS_MS = 2 h), the
-- water-quality hold resolver returned "unresolved", and Week Scout / Home Best fail closed for every
-- user (recommendationAvailability = none / hold_state_unavailable).
--
-- Validation (runbook step 2-4, .planning/county-advisory-ingest-20260813.md): one bounded probe at
-- ~02:50 UTC with prod's unchanged client + normalizer parsed all three event types on 6389 and
-- produced 5 advisory / 8 closure / 0 warning, 9 unmatched, match rate 0.308 - identical to the last
-- two good runs on 6304. No parser change is needed, so the accepted version is reset now.
--
-- Guarded: updates only the expected mismatch state. Expect "UPDATE 1". The next :00/:30 cron tick
-- ingests a fresh run.

BEGIN;

UPDATE public.county_beach_advisory_ingest_state
SET accepted_version_token = '7aN_koZhHSZzT3c9cAnpSg',
    accepted_version_sequence = 6389,
    observed_version_token = '7aN_koZhHSZzT3c9cAnpSg',
    observed_version_sequence = 6389,
    consecutive_failures = 0,
    circuit_open = false,
    next_attempt_at = NULL,
    last_error = NULL,
    updated_at = now()
WHERE source_identifier = 'county-san-diego-dehq-sdbeachinfo'
  AND accepted_version_token = 'Y3IareGcvkhpc7CILZGOzA'
  AND accepted_version_sequence = 6304
  AND observed_version_token = '7aN_koZhHSZzT3c9cAnpSg'
  AND observed_version_sequence = 6389
  AND circuit_open;

COMMIT;
