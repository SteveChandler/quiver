-- Drop the STABLE volatility marker on compute_user_match_score_batch.
--
-- Background: the original migration (20260503230003) declared the wrapper
-- STABLE, but compute_user_match_score (the inner function it loops) is
-- plpgsql with no explicit volatility — which defaults to VOLATILE in
-- PostgreSQL. A STABLE wrapper around a VOLATILE callee is unsafe: the
-- planner is free to dedupe, reorder, or cache the wrapper's outputs based
-- on a stability assumption the callee violates.
--
-- Today's call sites invoke the wrapper from supabase-js (a single RPC
-- per round-trip), not nested in a query tree, so the planner can't
-- exercise the footgun yet. But if a future caller embeds this in a
-- SELECT (e.g. SELECT compute_user_match_score_batch(...) FROM beaches
-- WHERE ...), the planner could elide repeat calls. Cheap to fix now.
--
-- Code reviewer flagged 2026-05-03 (review of feat/auto-enable-similarity-pro).
--
-- Idempotent: CREATE OR REPLACE keeps the same body; the ALTER FUNCTION
-- below removes the STABLE marker. Replays on prod are no-ops once landed.

BEGIN;

ALTER FUNCTION public.compute_user_match_score_batch(uuid, uuid, jsonb)
  VOLATILE;

COMMENT ON FUNCTION public.compute_user_match_score_batch(uuid, uuid, jsonb) IS
  'Batched form of compute_user_match_score. Takes p_slots as a jsonb array of {forecast_at, wave_height, wave_period, wind_speed, wind_direction, tide_height} and returns one row per slot with (slot_idx, forecast_at, result). The result jsonb is the verbatim output of compute_user_match_score for that slot — preserving every possible shape (state=onboarding, state=ready, neutral fallback). Saves N-1 round-trips when scoring a forecast horizon. Declared VOLATILE to match the inner function''s default volatility — do not re-mark STABLE without first making compute_user_match_score STABLE-safe (its reads of sessions / session_forecast_snapshots / boards may not qualify under your data model).';

COMMIT;
