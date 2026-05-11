-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Backfill one default alert_rules row for existing 30-day-active users who
-- finished onboarding before the auto-seed hook shipped (see
-- lib/alerts/seed-default-rule.ts + actions/onboarding-actions.ts).
--
-- New signups get beach-tuned conditions via the TypeScript helper (which
-- pulls preferred_tide_ft_min/max for mellow_session and
-- swell_window_center_deg +/- halfwidth_deg for clean_groundswell). This
-- backfill intentionally uses simpler broad conditions rather than
-- duplicating the preset build logic in SQL — a wider window matches more
-- hours and is acceptable for the one-time catch-up cohort. Users can edit
-- their rule via /api/alerts/rules or it will naturally match when a
-- qualifying window hits, which is the retention outcome we want.
--
-- Conservative cohort rules:
--   - auth.users.last_sign_in_at within 30 days (protect sender reputation)
--   - home_beach_id IS NOT NULL (nothing to attach the rule to otherwise)
--   - experience_level IS NOT NULL (we don't guess; mirrors the helper)
--   - user has zero existing alert_rules (idempotent)
-- Channel flags mirror the user's onboarding choices via
-- profiles.notif_email_enabled / notif_push_enabled so no fabricated
-- preferences leak through.

INSERT INTO alert_rules (
  user_id,
  beach_id,
  name,
  preset_type,
  conditions,
  notify_email,
  notify_push,
  enabled
)
SELECT
  p.id,
  p.home_beach_id,
  CASE
    WHEN p.experience_level IN ('advanced', 'expert')
      THEN 'Clean groundswell at your home break'
    ELSE 'Mellow session at your home break'
  END,
  CASE
    WHEN p.experience_level IN ('advanced', 'expert')
      THEN 'clean_groundswell'
    ELSE 'mellow_session'
  END,
  CASE
    WHEN p.experience_level IN ('advanced', 'expert')
      THEN '{"swell_period_min": 12, "wind_speed_max_kt": 10}'::jsonb
    ELSE '{"swell_height_min": 1, "swell_height_max": 4, "wind_speed_max_kt": 8}'::jsonb
  END,
  COALESCE(p.notif_email_enabled, true),
  COALESCE(p.notif_push_enabled, false),
  true
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.home_beach_id IS NOT NULL
  AND p.experience_level IS NOT NULL
  AND u.last_sign_in_at > now() - interval '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM alert_rules r WHERE r.user_id = p.id
  );
