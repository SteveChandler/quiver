BEGIN;

CREATE SCHEMA IF NOT EXISTS posthog_export;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'posthog_readonly'
  ) THEN
    CREATE ROLE posthog_readonly
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT;
  ELSE
    ALTER ROLE posthog_readonly
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT;
  END IF;
END
$$;

REVOKE ALL ON SCHEMA posthog_export FROM PUBLIC;
GRANT USAGE ON SCHEMA posthog_export TO posthog_readonly;

CREATE OR REPLACE VIEW posthog_export.profiles AS
SELECT
  profiles.id,
  profiles.created_at,
  profiles.updated_at,
  profiles.home_beach_id,
  profiles.onboarding_completed_at,
  profiles.is_mock,
  profiles.allow_implicit_tracking,
  profiles.experience_level,
  profiles.preferred_session_time,
  profiles.notif_push_enabled,
  profiles.notif_email_enabled,
  profiles.notif_inapp_enabled,
  profiles.notif_forecast_alerts,
  profiles.notif_water_quality,
  profiles.notif_similarity_alerts,
  profiles.followers_count,
  profiles.following_count
FROM public.profiles
WHERE profiles.deleted_at IS NULL
  AND COALESCE(profiles.is_mock, false) = false;

CREATE OR REPLACE VIEW posthog_export.sessions AS
SELECT
  s.id,
  s.user_id,
  s.beach_id,
  s.board_id,
  s.arrival_time,
  s.duration_minutes,
  s.created_at,
  s.status,
  s.rating,
  s.crowd_level,
  s.wave_quality,
  s.water_temp,
  s.parking_ease,
  s.is_public,
  s.likes_count,
  s.comments_count,
  s.share_count,
  s.wave_height_ft,
  s.wind_speed_mph,
  s.wind_direction,
  s.forecast_accuracy,
  s.tide_height_ft,
  s.tide_status,
  s.source,
  s.custom_spot_id
FROM public.sessions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.deleted_at IS NULL
  AND COALESCE(p.is_mock, false) = false;

CREATE OR REPLACE VIEW posthog_export.beaches AS
SELECT
  beaches.id,
  beaches.name,
  beaches.city,
  beaches.state,
  beaches.country,
  beaches.region,
  beaches.slug,
  beaches.lat,
  beaches.lon,
  beaches.break_type,
  beaches.skill_level,
  beaches.crowd_level,
  beaches.average_rating,
  beaches.review_count,
  beaches.is_private,
  beaches.created_at,
  beaches.timezone
FROM public.beaches
WHERE beaches.deleted_at IS NULL
  AND COALESCE(beaches.is_private, false) = false;

CREATE OR REPLACE VIEW posthog_export.user_follows AS
SELECT
  uf.id,
  uf.follower_id,
  uf.following_id,
  uf.created_at
FROM public.user_follows uf
JOIN public.profiles follower ON follower.id = uf.follower_id
JOIN public.profiles following ON following.id = uf.following_id
WHERE COALESCE(follower.is_mock, false) = false
  AND COALESCE(following.is_mock, false) = false;

CREATE OR REPLACE VIEW posthog_export.user_events AS
SELECT
  ue.id,
  ue.user_id,
  ue.session_id,
  ue.event_type,
  ue.beach_id,
  ue.metadata - 'email'::text - 'token'::text - 'secret'::text - 'password'::text AS metadata,
  ue.created_at,
  ue.expires_at,
  ue.bot_flagged
FROM public.user_events ue
LEFT JOIN public.profiles p ON p.id = ue.user_id
WHERE ue.user_id IS NULL
  OR COALESCE(p.is_mock, false) = false;

CREATE OR REPLACE VIEW posthog_export.email_send_log AS
SELECT
  esl.id,
  esl.user_id,
  esl.email_type,
  esl.local_date,
  esl.sent_at,
  esl.best_score,
  esl.best_beach_id,
  esl.delivered_at,
  esl.opened_at,
  esl.clicked_at,
  esl.bounced_at
FROM public.email_send_log esl
JOIN public.profiles p ON p.id = esl.user_id
WHERE COALESCE(p.is_mock, false) = false;

GRANT SELECT ON ALL TABLES IN SCHEMA posthog_export TO posthog_readonly;

COMMIT;
