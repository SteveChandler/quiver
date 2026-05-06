-- Disable similarity_match alert rules for users whose learning profile is
-- still below the runtime match-score signal contract.
--
-- This intentionally disables rows instead of deleting them:
--   - disabled/user-created rows remain as user history
--   - deleted/manual opt-out history remains respected by the runtime helper
--   - alert_rules.auto_created_at remains available for audit
--
-- Shared policy with lib/alerts/auto-enable-similarity.ts:
--   - at least 5 completed rated sessions with forecast snapshots
--   - at least 3 positive rated sessions (rating >= 4) with forecast snapshots

BEGIN;

WITH learned_signal AS (
  SELECT
    s.user_id,
    COUNT(DISTINCT s.id)::integer AS profile_session_count,
    COUNT(DISTINCT s.id) FILTER (WHERE s.rating >= 4)::integer AS positive_session_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs
    ON sfs.session_id = s.id
  WHERE s.status = 'completed'
    AND s.rating IS NOT NULL
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL
  GROUP BY s.user_id
),
to_disable AS (
  SELECT r.id
  FROM public.alert_rules r
  LEFT JOIN learned_signal ls
    ON ls.user_id = r.user_id
  WHERE r.preset_type = 'similarity_match'
    AND r.enabled = true
    AND (
      COALESCE(ls.profile_session_count, 0) < 5
      OR COALESCE(ls.positive_session_count, 0) < 3
    )
)
UPDATE public.alert_rules r
SET
  enabled = false,
  updated_at = now()
FROM to_disable td
WHERE r.id = td.id;

COMMIT;
