-- =============================================================================
-- Onboarding funnel analysis
-- =============================================================================
-- Instrumentation shipped alongside the quiver-native onboarding CRO PR
-- (plan: plan-out-1-2-3-we-glimmering-mitten).
--
-- Events referenced:
--   onboarding_video_started, onboarding_video_completed, onboarding_video_skipped
--   location_permission_granted, location_permission_denied
--   onboarding_step_viewed       {step: 'home_beach' | 'level_and_time' | 'payoff'}
--   onboarding_step_completed    {step, skipped: bool, has_home_beach?: bool}
--   onboarding_step_auto_skipped {step: 'home_beach', reason: 'location_cached'}
--   onboarding_completed         {experience_level, preferred_time, home_beach_id}
--   home_hero_forecast_viewed    {beach_id, is_home_beach: bool, forecast_confidence, discovery_score}
--     Renamed 2026-05-03 from 'home_beach_forecast_viewed' — the event fires
--     for the home-screen HERO card (top discovery rec for current location),
--     not the user's home beach. Both names are valid event_types; queries
--     below match either to bridge pre/post-rename history.
--
-- Activation definition (D0): hero forecast viewed at least once on signup day
-- D1 retention: hero forecast viewed on calendar day + 1 (separate query)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Query 1: Cohort-level drop-off
-- -----------------------------------------------------------------------------
-- Replace :since and :until with your cohort window.
-- Example: signups from the last 14 days
--   :since = now() - interval '14 days'
--   :until = now()

WITH cohort AS (
  SELECT id AS user_id, created_at
  FROM profiles
  WHERE created_at >= :since AND created_at < :until
),
steps AS (
  SELECT
    c.user_id,
    MAX((e.event_type = 'onboarding_video_started')::int)                  AS step_video_view,
    MAX((e.event_type IN ('onboarding_video_completed',
                          'onboarding_video_skipped'))::int)               AS step_video_done,
    MAX((e.event_type IN ('location_permission_granted',
                          'location_permission_denied'))::int)             AS step_location_done,
    MAX((e.event_type = 'onboarding_step_viewed'
         AND e.metadata->>'step' = 'home_beach')::int)                     AS step_home_beach_view,
    MAX((e.event_type = 'onboarding_step_completed'
         AND e.metadata->>'step' = 'home_beach')::int)                     AS step_home_beach_done,
    MAX((e.event_type = 'onboarding_step_auto_skipped'
         AND e.metadata->>'step' = 'home_beach')::int)                     AS step_home_beach_auto,
    MAX((e.event_type = 'onboarding_step_completed'
         AND e.metadata->>'step' = 'home_beach'
         AND (e.metadata->>'skipped')::boolean IS TRUE)::int)              AS step_home_beach_skip,
    MAX((e.event_type = 'onboarding_step_viewed'
         AND e.metadata->>'step' = 'level_and_time')::int)                 AS step_level_view,
    MAX((e.event_type = 'onboarding_step_completed'
         AND e.metadata->>'step' = 'level_and_time')::int)                 AS step_level_done,
    MAX((e.event_type = 'onboarding_step_completed'
         AND e.metadata->>'step' = 'level_and_time'
         AND (e.metadata->>'skipped')::boolean IS TRUE)::int)              AS step_level_skip,
    MAX((e.event_type = 'onboarding_step_viewed'
         AND e.metadata->>'step' = 'payoff')::int)                         AS step_payoff_view,
    MAX((e.event_type = 'onboarding_completed')::int)                      AS completed,
    MAX((e.event_type IN ('home_hero_forecast_viewed',
                          'home_beach_forecast_viewed'))::int)             AS activated
  FROM cohort c
  LEFT JOIN user_events e
    ON e.user_id = c.user_id
   AND e.created_at >= c.created_at
  GROUP BY c.user_id
),
counts AS (
  SELECT
    COUNT(*)                                             AS signups,
    SUM(step_video_view)                                 AS reached_video,
    SUM(step_video_done)                                 AS finished_video,
    SUM(step_location_done)                              AS finished_location,
    SUM(step_home_beach_view + step_home_beach_auto)     AS reached_home_beach,
    SUM(step_home_beach_done + step_home_beach_auto)     AS finished_home_beach,
    SUM(step_home_beach_skip)                            AS skipped_home_beach,
    SUM(step_level_view)                                 AS reached_level,
    SUM(step_level_done)                                 AS finished_level,
    SUM(step_level_skip)                                 AS skipped_level,
    SUM(step_payoff_view)                                AS reached_payoff,
    SUM(completed)                                       AS completed_onboarding,
    SUM(activated)                                       AS activated_d0
  FROM steps
)
SELECT
  signups,
  reached_video,
  finished_video,
  finished_location,
  reached_home_beach,
  finished_home_beach,
  skipped_home_beach,
  reached_level,
  finished_level,
  skipped_level,
  reached_payoff,
  completed_onboarding,
  activated_d0,
  ROUND(100.0 * reached_video         / NULLIF(signups, 0), 1) AS pct_reached_video,
  ROUND(100.0 * finished_location     / NULLIF(signups, 0), 1) AS pct_finished_location,
  ROUND(100.0 * reached_home_beach    / NULLIF(signups, 0), 1) AS pct_reached_home_beach,
  ROUND(100.0 * finished_home_beach   / NULLIF(signups, 0), 1) AS pct_finished_home_beach,
  ROUND(100.0 * reached_level         / NULLIF(signups, 0), 1) AS pct_reached_level,
  ROUND(100.0 * finished_level        / NULLIF(signups, 0), 1) AS pct_finished_level,
  ROUND(100.0 * reached_payoff        / NULLIF(signups, 0), 1) AS pct_reached_payoff,
  ROUND(100.0 * completed_onboarding  / NULLIF(signups, 0), 1) AS pct_completed,
  ROUND(100.0 * activated_d0          / NULLIF(signups, 0), 1) AS pct_activated_d0
FROM counts;


-- -----------------------------------------------------------------------------
-- Query 2: Per-user drop-off (who stalled where)
-- -----------------------------------------------------------------------------
-- Returns one row per signup in the window, labeled with the furthest step
-- reached. Useful for qualitative follow-up (email, targeted re-engagement).

WITH cohort AS (
  SELECT id AS user_id, email, created_at
  FROM profiles
  WHERE created_at >= :since AND created_at < :until
),
events AS (
  SELECT
    c.user_id,
    c.email,
    c.created_at AS signed_up_at,
    BOOL_OR(e.event_type IN ('home_hero_forecast_viewed',
                             'home_beach_forecast_viewed'))                    AS activated,
    BOOL_OR(e.event_type = 'onboarding_completed')                             AS completed_onboarding,
    BOOL_OR(e.event_type = 'onboarding_step_viewed'
            AND e.metadata->>'step' = 'payoff')                                AS reached_payoff,
    BOOL_OR(e.event_type = 'onboarding_step_viewed'
            AND e.metadata->>'step' = 'level_and_time')                        AS reached_level,
    BOOL_OR(e.event_type = 'onboarding_step_viewed'
            AND e.metadata->>'step' = 'home_beach')                            AS reached_home_beach,
    BOOL_OR(e.event_type IN ('location_permission_granted',
                             'location_permission_denied'))                    AS decided_location,
    BOOL_OR(e.event_type = 'onboarding_video_started')                         AS reached_video
  FROM cohort c
  LEFT JOIN user_events e
    ON e.user_id = c.user_id
   AND e.created_at >= c.created_at
  GROUP BY c.user_id, c.email, c.created_at
)
SELECT
  user_id,
  email,
  signed_up_at,
  CASE
    WHEN activated              THEN '8_activated'
    WHEN completed_onboarding   THEN '7_completed_not_activated'
    WHEN reached_payoff         THEN '6_stalled_payoff'
    WHEN reached_level          THEN '5_stalled_level_and_time'
    WHEN reached_home_beach     THEN '4_stalled_home_beach'
    WHEN decided_location       THEN '3_stalled_after_location'
    WHEN reached_video          THEN '2_stalled_at_video'
    ELSE                             '1_never_started_onboarding'
  END AS furthest_step,
  activated
FROM events
ORDER BY signed_up_at DESC;


-- -----------------------------------------------------------------------------
-- Query 3: D1 retention (requires activation baseline)
-- -----------------------------------------------------------------------------
-- Among users who activated on D0, how many came back the next calendar day?

WITH cohort AS (
  SELECT id AS user_id, created_at::date AS signup_date
  FROM profiles
  WHERE created_at >= :since AND created_at < :until
),
d0 AS (
  SELECT DISTINCT c.user_id, c.signup_date
  FROM cohort c
  JOIN user_events e
    ON e.user_id = c.user_id
   AND e.event_type IN ('home_hero_forecast_viewed', 'home_beach_forecast_viewed')
   AND e.created_at::date = c.signup_date
),
d1 AS (
  SELECT DISTINCT d0.user_id
  FROM d0
  JOIN user_events e
    ON e.user_id = d0.user_id
   AND e.event_type IN ('home_hero_forecast_viewed', 'home_beach_forecast_viewed')
   AND e.created_at::date = d0.signup_date + 1
)
SELECT
  (SELECT COUNT(*) FROM cohort)                          AS signups,
  (SELECT COUNT(*) FROM d0)                              AS activated_d0,
  (SELECT COUNT(*) FROM d1)                              AS returned_d1,
  ROUND(100.0 * (SELECT COUNT(*) FROM d1)
              / NULLIF((SELECT COUNT(*) FROM d0), 0), 1) AS d1_return_rate_pct,
  ROUND(100.0 * (SELECT COUNT(*) FROM d1)
              / NULLIF((SELECT COUNT(*) FROM cohort), 0), 1) AS d1_rate_of_all_signups_pct;


-- -----------------------------------------------------------------------------
-- Notes
-- -----------------------------------------------------------------------------
-- 1. :since / :until are PostgreSQL psql-style parameters. In the Supabase SQL
--    editor, paste literal timestamps instead:
--      WHERE created_at >= '2026-04-05'::timestamptz AND created_at < now()
--
-- 2. `e.created_at >= c.created_at` guards against matching stale events from
--    pre-signup device state (shouldn't happen post-auth, but belt-and-suspenders).
--
-- 3. The home_beach step has TWO happy paths: manual completion (step_completed)
--    and auto-skip when location was pre-cached (step_auto_skipped). Both count
--    as "finished" for funnel purposes.
--
-- 4. `skipped_home_beach` and `skipped_level` are SUBSETS of `finished_*` — users
--    who tapped Skip still progressed past the step, they just didn't provide data.
--    Watch the ratio — high skip rates are a signal the step needs rework.
--
-- 5. If activated_d0 > completed_onboarding, something is wrong with the event
--    order — activation should only happen on the home screen, which is only
--    reachable after onboarding completes.
--
-- 6. onboarding_step_viewed may fire MULTIPLE TIMES per user per step if the
--    user navigates back-and-forth during a single session (useRef guard
--    resets on unmount — intended). The cohort funnel above uses MAX()/BOOL_OR
--    which dedups per user_id, so counts are correct. Raw event counts will
--    NOT match 1:1 with distinct users who reached each step.
