-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Retire the Phase 1 compute_spot_similarity_score RPC. Replaced by
-- compute_user_match_score (two-stage scoring) shipped in Phase 2.
-- Code-side retirement in commits 68dc82a (native) + 3c999b97 (web).
-- Grep-verified zero callers remain in either repo; zero rows in
-- alert_rules/alert_queue on the paired similarity_alert preset.

DROP FUNCTION IF EXISTS public.compute_spot_similarity_score(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric
);
