Query Quiver application metrics from Supabase and present a formatted dashboard.

**Exclusion filter** (applied to all queries joining profiles):

```
p.is_mock = false
AND (p.email IS NULL OR (
  p.email NOT ILIKE '%test%'
  AND p.email NOT LIKE '%@local.test'
  AND p.email NOT LIKE '%@example.invalid'
))
```

This filters out:

- Mock/NPC profiles of every kind via `p.is_mock = false` (includes `morning.intel@quiversurf.app`, the NPC review authors at `@example.invalid`, and any future seed script that sets the flag).
- Test accounts and local-dev accounts via the email substring guards.
- But explicitly INCLUDES real profiles with `email IS NULL` (Apple relay accounts, social logins that didn't surface an email). Without the `OR p.email IS NULL` branch, `NULL NOT ILIKE '%test%'` returns NULL and those rows silently drop out of every dashboard count.

Run these 27 SQL queries **in parallel** against project `vawdnbbgawichorsjiwe` using the Supabase MCP `execute_sql` tool directly from the main session (do NOT delegate to subagents — they cannot access MCP tools).

**Design principle:** at pre-PMF scale (single-digit signups/week, handful of real active users), daily granularity is noise. Prefer lifetime/7d/monthly aggregates. The dashboard should surface _archetypes and who's using it_, not per-day swings on tiny samples. Lead with anomalies + real-user behavior.

**Founder exclusion note:** Query 32 and Query 33 exclude Steven's real user account (`73040cff-afe9-4fa0-a874-2016203fc015` / `omg.its.thefuture@gmail.com`) because his founder-power-user behavior distorts real-user aggregates. His test/QA identity accounts are already handled via `is_mock=true` (see `reference_is_mock_flagged_accounts_apr24.md`). Do NOT flip `is_mock` on the founder account — it's used for genuine session logging.

### Query 1: Users

```sql
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_users_24h
FROM profiles
WHERE is_mock = false
  AND (email IS NULL OR (
    email NOT ILIKE '%test%'
    AND email NOT LIKE '%@local.test'
    AND email NOT LIKE '%@example.invalid'
  ));
```

### Query 2: Sessions

```sql
SELECT
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE s.created_at >= NOW() - INTERVAL '7 days') AS sessions_7d,
  COUNT(*) FILTER (WHERE s.created_at >= NOW() - INTERVAL '24 hours') AS sessions_24h,
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '7 days') AS active_surfers_7d,
  ROUND(AVG(s.rating) FILTER (WHERE s.rating IS NOT NULL), 2) AS avg_rating,
  ROUND(AVG(s.duration_minutes) FILTER (WHERE s.duration_minutes IS NOT NULL), 0) AS avg_duration_min
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE s.deleted_at IS NULL
  AND p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ));
```

### Query 3: Content

```sql
SELECT
  (SELECT COUNT(*) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.deleted_at IS NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS total_reviews,
  (SELECT COUNT(*) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS reviews_7d,
  (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS total_intel,
  (SELECT COUNT(*) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE ip.created_at >= NOW() - INTERVAL '7 days' AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS intel_7d,
  (SELECT COUNT(*) FROM boards b JOIN profiles p ON b.user_id = p.id WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS total_boards,
  (SELECT COUNT(*) FROM beaches) AS total_beaches;
```

### Query 4: Delivery (7d)

```sql
SELECT
  COUNT(*) AS emails_7d,
  COUNT(*) FILTER (WHERE esl.email_type = 'welcome') AS welcome_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'forecast_digest') AS forecast_digest_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'reengagement') AS reengagement_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'weekly_recap') AS weekly_recap_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'conditions_alert') AS conditions_alert_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'session_prompt') AS session_prompt_emails,
  COUNT(*) FILTER (WHERE esl.email_type = 'first_session_nudge') AS first_session_nudge_emails
FROM email_send_log esl
JOIN profiles p ON esl.user_id = p.id
WHERE esl.sent_at >= NOW() - INTERVAL '7 days'
  AND p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ));
```

### Query 5: User Behavior Events (7d) — includes anonymous visitors

```sql
SELECT
  COUNT(*) AS total_events_7d,
  COUNT(*) FILTER (WHERE ue.user_id IS NULL) AS anonymous_events_7d,
  COUNT(*) FILTER (WHERE ue.user_id IS NOT NULL) AS authenticated_events_7d,
  COUNT(DISTINCT ue.user_id) FILTER (WHERE ue.user_id IS NOT NULL) AS users_with_events_7d,
  COUNT(DISTINCT ue.session_id) FILTER (WHERE ue.user_id IS NULL) AS anonymous_visitors_7d,
  COUNT(*) FILTER (WHERE event_type = 'page_view') AS page_views,
  COUNT(*) FILTER (WHERE event_type = 'beach_view') AS beach_views,
  COUNT(*) FILTER (WHERE event_type = 'discovery_click') AS discovery_clicks,
  COUNT(*) FILTER (WHERE event_type = 'discovery_skip') AS discovery_skips,
  COUNT(*) FILTER (WHERE event_type = 'forecast_check') AS forecast_checks,
  COUNT(*) FILTER (WHERE event_type = 'session_action') AS session_actions,
  COUNT(*) FILTER (WHERE event_type = 'tab_view') AS tab_views,
  COUNT(*) FILTER (WHERE event_type = 'map_interaction') AS map_interactions,
  COUNT(*) FILTER (WHERE event_type LIKE 'forecast_%') AS forecast_interactions,
  COUNT(*) FILTER (WHERE event_type LIKE 'onboarding_%') AS onboarding_events,
  COUNT(*) FILTER (WHERE event_type IN ('share_started', 'share_completed', 'share_link_copied', 'share_image_saved', 'cam_share', 'share_intel_button_clicked', 'surf_plan_share')) AS share_events,
  COUNT(*) FILTER (WHERE event_type IN ('session_log_start', 'session_log_submit')) AS session_log_events,
  COUNT(*) FILTER (WHERE event_type IN ('intel_post_created', 'intel_post_confirmed', 'local_intel_tab_viewed', 'plan_session_from_intel')) AS intel_events,
  COUNT(*) FILTER (WHERE event_type = 'beach_search') AS beach_searches,
  COUNT(*) FILTER (WHERE event_type IN ('product_tour_started', 'product_tour_completed', 'product_tour_skipped', 'product_tour_step_viewed')) AS tour_events,
  COUNT(*) FILTER (WHERE event_type IN ('cta_click', 'signup_cta_click', 'signup_cta_view', 'signin_cta_click')) AS cta_events,
  COUNT(*) FILTER (WHERE event_type IN ('review_form_open', 'review_form_abandon', 'review_validation_error')) AS review_form_events,
  (SELECT COUNT(*) FROM user_events WHERE created_at >= NOW() - INTERVAL '7 days' AND bot_flagged = true) AS bot_flagged_events
FROM user_events ue
LEFT JOIN profiles p ON ue.user_id = p.id
WHERE ue.created_at >= NOW() - INTERVAL '7 days'
  AND (ue.bot_flagged IS NULL OR ue.bot_flagged = false)
  AND (ue.user_id IS NULL OR (
    p.is_mock = false
    AND (p.email IS NULL OR (
      p.email NOT ILIKE '%test%'
      AND p.email NOT LIKE '%@local.test'
      AND p.email NOT LIKE '%@example.invalid'
    ))
  ));
```

### Query 7: Top Beaches by Activity (7d)

```sql
SELECT beach_name, total_activity FROM (
  SELECT b.name AS beach_name, COUNT(*) AS total_activity
  FROM (
    SELECT s.beach_id FROM sessions s JOIN profiles p ON s.user_id = p.id WHERE s.created_at >= NOW() - INTERVAL '7 days' AND s.deleted_at IS NULL AND s.beach_id IS NOT NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
    UNION ALL
    SELECT br.beach_id FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL AND br.beach_id IS NOT NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
    UNION ALL
    SELECT ip.beach_id FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE ip.created_at >= NOW() - INTERVAL '7 days' AND ip.beach_id IS NOT NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
    UNION ALL
    SELECT ue.beach_id FROM user_events ue LEFT JOIN profiles p ON ue.user_id = p.id WHERE ue.created_at >= NOW() - INTERVAL '7 days' AND ue.event_type = 'beach_view' AND ue.beach_id IS NOT NULL AND (ue.user_id IS NULL OR (p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))))
  ) activity
  JOIN beaches b ON activity.beach_id = b.id
  GROUP BY b.id, b.name
  ORDER BY total_activity DESC
  LIMIT 5
) top_beaches;
```

### Query 9: Data Freshness Check

```sql
SELECT
  (SELECT MAX(p.created_at) FROM profiles p WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS latest_signup,
  (SELECT MAX(s.created_at) FROM sessions s JOIN profiles p ON s.user_id = p.id WHERE s.deleted_at IS NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS latest_session,
  (SELECT MAX(ue.created_at) FROM user_events ue LEFT JOIN profiles p ON ue.user_id = p.id WHERE ue.user_id IS NULL OR (p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid')))) AS latest_event,
  (SELECT MAX(esl.sent_at) FROM email_send_log esl JOIN profiles p ON esl.user_id = p.id WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS latest_email,
  (SELECT MAX(br.created_at) FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.deleted_at IS NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS latest_review,
  (SELECT MAX(ip.created_at) FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS latest_intel,
  NOW() AS current_time;
```

### Query 10: Activity Source Health (7d)

```sql
SELECT source, unique_users_7d, rows_7d, latest FROM (
  SELECT 'sessions' AS source, COUNT(DISTINCT s.user_id) AS unique_users_7d, COUNT(*) AS rows_7d, MAX(s.created_at) AS latest
  FROM sessions s JOIN profiles p ON s.user_id = p.id WHERE s.created_at >= NOW() - INTERVAL '7 days' AND s.deleted_at IS NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
  UNION ALL
  SELECT 'beach_reviews', COUNT(DISTINCT br.user_id), COUNT(*), MAX(br.created_at)
  FROM beach_reviews br JOIN profiles p ON br.user_id = p.id WHERE br.created_at >= NOW() - INTERVAL '7 days' AND br.deleted_at IS NULL AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
  UNION ALL
  SELECT 'intel_posts', COUNT(DISTINCT ip.user_id), COUNT(*), MAX(ip.created_at)
  FROM intel_posts ip JOIN profiles p ON ip.user_id = p.id WHERE ip.created_at >= NOW() - INTERVAL '7 days' AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
  UNION ALL
  SELECT 'user_events', COUNT(DISTINCT ue.user_id) FILTER (WHERE ue.user_id IS NOT NULL), COUNT(*), MAX(ue.created_at)
  FROM user_events ue LEFT JOIN profiles p ON ue.user_id = p.id WHERE ue.created_at >= NOW() - INTERVAL '7 days' AND (ue.user_id IS NULL OR (p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))))
  UNION ALL
  SELECT 'boards', COUNT(DISTINCT b.user_id), COUNT(*), MAX(b.created_at)
  FROM boards b JOIN profiles p ON b.user_id = p.id WHERE b.created_at >= NOW() - INTERVAL '7 days' AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
  UNION ALL
  SELECT 'email_send_log', COUNT(DISTINCT esl.user_id), COUNT(*), MAX(esl.sent_at)
  FROM email_send_log esl JOIN profiles p ON esl.user_id = p.id WHERE esl.sent_at >= NOW() - INTERVAL '7 days' AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
) sources
ORDER BY unique_users_7d DESC;
```

### Query 12: Fallback Health — Top Offenders (7d)

```sql
SELECT
  domain,
  field,
  severity,
  fallback_value,
  COUNT(*) AS occurrences_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS occurrences_24h,
  MAX(created_at) AS last_seen
FROM fallback_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY domain, field, severity, fallback_value
ORDER BY
  CASE severity WHEN 'dangerous' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
  occurrences_7d DESC
LIMIT 15;
```

If the `fallback_events` table doesn't exist yet (query returns error), skip the fallback sections silently.

### Query 13: Forecast Pipeline Health (Per-Source)

```sql
SELECT
  source,
  beaches_with_data,
  ROUND(100.0 * beaches_with_data / total_beaches, 1) AS coverage_pct,
  critical_stale,
  warning_stale,
  ROUND(avg_age_hours, 1) AS avg_age_hours,
  ROUND(max_age_hours, 1) AS max_age_hours,
  latest_update
FROM (
  SELECT
    'enhanced' AS source,
    COUNT(*) AS beaches_with_data,
    (SELECT COUNT(*) FROM beaches) AS total_beaches,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 > 24) AS critical_stale,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 BETWEEN 16 AND 24) AS warning_stale,
    AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS avg_age_hours,
    MAX(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS max_age_hours,
    MAX(updated_at) AS latest_update
  FROM v_enhanced_forecast_latest
  UNION ALL
  SELECT
    'marine',
    COUNT(*),
    (SELECT COUNT(*) FROM beaches),
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > 6),
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 BETWEEN 3 AND 6),
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600),
    MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600),
    MAX(created_at)
  FROM v_marine_forecast_latest
) sources;
```

### Query 14: Enhanced Forecast Data Source Breakdown

```sql
SELECT
  COALESCE(data_source, 'UNKNOWN') AS data_source,
  COUNT(*) AS beach_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600), 1) AS avg_age_hours,
  COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 > 24) AS critical_count
FROM v_enhanced_forecast_latest
GROUP BY data_source
ORDER BY beach_count DESC;
```

### Query 15: Signup Funnel Breakdown (7d) — with computed conversion rates

```sql
-- THREE mode-conflating events are split in the CTE because they fire for both
-- signup + login intent. Comparing raw totals against signup_cta_click gives
-- nonsense ratios (e.g. 1816% "auth_modal_opened conversion" or "95% drop-off
-- between signup_form_submitted and signup_started" — both artifacts, not bugs).
--   auth_modal_opened      → split by metadata.mode into _signup / _login / _auto
--   auth_provider_selected → split by metadata.mode into _signup / _login
--   signup_form_submitted  → split by metadata.mode into _signup / _login
-- After the splits, every denominator is mode-matched to its numerator, so both
-- the signup funnel and the parallel login funnel read cleanly.
-- Upstream emitter bug: `trackSignupFormSubmitted` (unified-auth-modal.tsx:471)
-- fires for both login AND signup email-form submits regardless of the event's
-- name. Same pattern on `trackAuthProviderSelected` — both take a `mode` arg
-- but emit under a single event type. Fix at the emitter is tracked in F3(B).
WITH funnel AS (
  SELECT
    CASE
      WHEN event_type = 'auth_modal_opened' AND metadata->>'mode' = 'signup' THEN 'auth_modal_opened_signup'
      WHEN event_type = 'auth_modal_opened' AND metadata->>'mode' = 'login'  THEN 'auth_modal_opened_login'
      WHEN event_type = 'auth_modal_opened'                                  THEN 'auth_modal_opened_auto'
      WHEN event_type = 'auth_provider_selected' AND metadata->>'mode' = 'signup' THEN 'auth_provider_selected_signup'
      WHEN event_type = 'auth_provider_selected' AND metadata->>'mode' = 'login'  THEN 'auth_provider_selected_login'
      WHEN event_type = 'signup_form_submitted' AND metadata->>'mode' = 'signup' THEN 'signup_form_submitted_signup'
      -- `signup_form_submitted` with mode='login' is legacy pre-2026-04-20 data
      -- left for historical continuity; new login submits emit login_form_submitted.
      WHEN event_type = 'signup_form_submitted' AND metadata->>'mode' = 'login'  THEN 'login_form_submitted'
      WHEN event_type = 'login_form_submitted' THEN 'login_form_submitted'
      ELSE event_type
    END AS event_type,
    COUNT(*) AS count
  FROM user_events
  WHERE created_at >= NOW() - INTERVAL '7 days'
    AND (bot_flagged IS NULL OR bot_flagged = false)
    AND event_type IN (
      'signup_cta_view', 'signup_cta_click', 'signin_cta_click',
      'auth_modal_opened', 'auth_modal_closed_without_action',
      'auth_method_selected', 'auth_provider_selected',
      'signup_started', 'signup_success', 'signup_form_submitted',
      'login_form_submitted', 'login_success'
    )
  GROUP BY 1
)
SELECT
  event_type,
  count,
  CASE event_type
    WHEN 'signup_cta_click' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'signup_cta_view'), 0), 2)
    -- Signup funnel
    WHEN 'auth_modal_opened_signup' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'signup_cta_click'), 0), 1)
    WHEN 'auth_provider_selected_signup' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'auth_modal_opened_signup'), 0), 1)
    WHEN 'signup_form_submitted_signup' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'auth_provider_selected_signup'), 0), 1)
    WHEN 'signup_started' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'signup_form_submitted_signup'), 0), 1)
    WHEN 'signup_success' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'signup_started'), 0), 1)
    -- Parallel login funnel
    WHEN 'auth_modal_opened_login' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'signin_cta_click'), 0), 1)
    WHEN 'auth_provider_selected_login' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'auth_modal_opened_login'), 0), 1)
    WHEN 'login_form_submitted' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'auth_provider_selected_login'), 0), 1)
    WHEN 'login_success' THEN
      ROUND(100.0 * count / NULLIF((SELECT count FROM funnel WHERE event_type = 'login_form_submitted'), 0), 1)
    ELSE NULL
  END AS conv_from_prior_pct
FROM funnel
ORDER BY count DESC;
```

The `conv_from_prior_pct` column is the conversion rate from the immediately preceding funnel step, so you can see at a glance where the funnel leaks. Key watches:

- `signup_cta_click / signup_cta_view` — anything under 2% is a red alert; under 1% means the CTA copy, placement, or targeting is broken. Since Apr 2026, `trackSignupCtaView` (`lib/analytics/signup-conversion-tracking.ts`) requires a 500ms dwell + `document.visibilityState === "visible"` gate before firing, so the denominator already excludes fast-bouncers and background-tab prefetches. Post-gate views represent engaged users — the 1%/2% thresholds are the real click-to-engagement floors, not raw impression floors.
- `auth_modal_opened_signup / signup_cta_click` — should be ≈100%. If it's wildly higher, a surface is opening the modal without firing the upstream click event (instrumentation gap). If it's much lower, clicks are being tracked but the modal isn't actually opening (UI bug).
- `auth_modal_opened_login / signin_cta_click` — health check for the login path. TWO legitimate sources produce login modal opens without a preceding `signin_cta_click`: (a) the `/auth/sign-in` page fires `source='redirect'` when arriving via a protected-route redirect (middleware `RouteGuard.buildSignInRedirect` / `app/admin/layout.tsx`), and (b) the navbar's `autoOpenLogin` path (`components/landing-page/navbar.tsx:97-109`) fires `source='returning-user-auto'` when a returning user hits the landing page — AND the modal's own internal `useEffect` at `unified-auth-modal.tsx:241-245` double-fires `auth_modal_opened` with the modal's prop `source='landing-navbar'`, so each auto-open actually logs TWICE with two different source labels. Healthy equation: `auth_modal_opened_login ≈ signin_cta_click + redirect-sourced opens + (auto-opens × 2)`. To audit cleanly, split login opens by source: `SELECT metadata->>'source', COUNT(*) FROM user_events WHERE event_type='auth_modal_opened' AND metadata->>'mode'='login' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY 1`. If `source='redirect'` + `source='returning-user-auto'` + the `landing-navbar` ghost-duplicates of those auto-opens account for the gap, instrumentation is healthy; if a remaining slice is unaccounted-for, there's a new gap.

### Query 16: Onboarding Step Funnel (7d)

```sql
SELECT
  event_type,
  metadata->>'step' AS step,
  COUNT(*) AS count,
  COUNT(DISTINCT COALESCE(user_id::text, session_id::text)) AS unique_users
FROM user_events
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND (bot_flagged IS NULL OR bot_flagged = false)
  AND event_type LIKE 'onboarding_%'
GROUP BY event_type, metadata->>'step'
ORDER BY step, event_type;
```

### Query 17: Onboarding Completion Truth Check

```sql
SELECT
  COUNT(*) FILTER (WHERE onboarding_completed_at IS NOT NULL) AS completed_profiles,
  COUNT(*) FILTER (WHERE onboarding_completed_at IS NOT NULL AND home_beach_id IS NULL) AS false_completed_no_home_beach,
  COUNT(*) FILTER (WHERE home_beach_id IS NOT NULL) AS activated_home_beach
FROM profiles p
WHERE p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ));
```

`false_completed_no_home_beach` should stay at 0 after the May 2026 dismissal fix. If it is non-zero, prepare a read-only roster/count first; production repair requires explicit approval.

### Query 18: Gamification & XP

```sql
SELECT
  COUNT(DISTINCT ux.user_id) AS users_with_xp,
  ROUND(AVG(ux.level), 1) AS avg_level,
  MAX(ux.level) AS max_level,
  (SELECT COUNT(*) FROM xp_events xe JOIN profiles p2 ON xe.user_id = p2.id
   WHERE xe.created_at >= NOW() - INTERVAL '7 days'
   AND p2.is_mock = false AND (p2.email IS NULL OR (p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid'))) AS xp_events_7d,
  (SELECT COALESCE(SUM(xe.xp_amount), 0) FROM xp_events xe JOIN profiles p2 ON xe.user_id = p2.id
   WHERE xe.created_at >= NOW() - INTERVAL '7 days'
   AND p2.is_mock = false AND (p2.email IS NULL OR (p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid'))) AS xp_earned_7d,
  (SELECT COUNT(DISTINCT xe.user_id) FROM xp_events xe JOIN profiles p2 ON xe.user_id = p2.id
   WHERE xe.created_at >= NOW() - INTERVAL '7 days'
   AND p2.is_mock = false AND (p2.email IS NULL OR (p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid'))) AS xp_active_users_7d,
  (SELECT COUNT(*) FROM user_badges ub JOIN profiles p2 ON ub.user_id = p2.id
   WHERE p2.is_mock = false AND (p2.email IS NULL OR (p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid'))) AS total_badges_unlocked,
  (SELECT COUNT(*) FROM user_badges ub JOIN profiles p2 ON ub.user_id = p2.id
   WHERE ub.unlocked_at >= NOW() - INTERVAL '7 days'
   AND p2.is_mock = false AND (p2.email IS NULL OR (p2.email NOT ILIKE '%test%' AND p2.email NOT LIKE '%@local.test' AND p2.email NOT LIKE '%@example.invalid'))) AS badges_unlocked_7d,
  (SELECT COUNT(*) FROM badge_definitions) AS total_badge_types
FROM user_xp ux
JOIN profiles p ON ux.user_id = p.id
WHERE p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ));
```

### Query 19: Social Graph

```sql
SELECT
  (SELECT COUNT(*) FROM user_follows uf JOIN profiles p ON uf.follower_id = p.id
   WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS total_follows,
  (SELECT COUNT(*) FROM user_follows uf JOIN profiles p ON uf.follower_id = p.id
   WHERE uf.created_at >= NOW() - INTERVAL '7 days'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS new_follows_7d,
  (SELECT COUNT(DISTINCT uf.follower_id) FROM user_follows uf JOIN profiles p ON uf.follower_id = p.id
   WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS users_following_someone,
  (SELECT COUNT(DISTINCT uf.following_id) FROM user_follows uf JOIN profiles p ON uf.following_id = p.id
   WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS users_with_followers,
  (SELECT ROUND(AVG(fc), 1) FROM (SELECT COUNT(*) AS fc FROM user_follows GROUP BY follower_id) t) AS avg_following_per_user,
  (SELECT ROUND(AVG(fc), 1) FROM (SELECT COUNT(*) AS fc FROM user_follows GROUP BY following_id) t) AS avg_followers_per_user;
```

### Query 20: Session Engagement (likes, comments, shares, media)

```sql
SELECT
  (SELECT COUNT(*) FROM session_likes sl JOIN profiles p ON sl.user_id = p.id
   WHERE sl.created_at >= NOW() - INTERVAL '7 days'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS likes_7d,
  (SELECT COUNT(*) FROM session_likes sl JOIN profiles p ON sl.user_id = p.id
   WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS total_likes,
  (SELECT COUNT(*) FROM comments c JOIN profiles p ON c.user_id = p.id
   WHERE c.created_at >= NOW() - INTERVAL '7 days'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS comments_7d,
  (SELECT COUNT(*) FROM comments c JOIN profiles p ON c.user_id = p.id
   WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS total_comments,
  (SELECT COUNT(*) FROM session_shares ss JOIN profiles p ON ss.user_id = p.id
   WHERE ss.created_at >= NOW() - INTERVAL '7 days'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS shares_7d,
  (SELECT COUNT(*) FROM session_shares ss JOIN profiles p ON ss.user_id = p.id
   WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS total_shares,
  (SELECT COUNT(*) FROM session_media sm JOIN profiles p ON sm.user_id = p.id
   WHERE sm.created_at >= NOW() - INTERVAL '7 days' AND sm.deleted_at IS NULL
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS media_uploads_7d,
  (SELECT COUNT(*) FROM session_media sm JOIN profiles p ON sm.user_id = p.id
   WHERE sm.deleted_at IS NULL
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS total_media;
```

### Query 21: Referrals

```sql
SELECT
  COUNT(*) AS total_referrals,
  COUNT(*) FILTER (WHERE r.status = 'completed') AS completed_referrals,
  COUNT(*) FILTER (WHERE r.status = 'pending') AS pending_referrals,
  COUNT(*) FILTER (WHERE r.created_at >= NOW() - INTERVAL '7 days') AS referrals_7d,
  COUNT(*) FILTER (WHERE r.status = 'completed' AND r.completed_at >= NOW() - INTERVAL '7 days') AS completed_7d,
  COUNT(DISTINCT r.referrer_id) AS unique_referrers,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.status = 'completed') / NULLIF(COUNT(*), 0), 1) AS conversion_rate_pct
FROM referrals r
JOIN profiles p ON r.referrer_id = p.id
WHERE p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ));
```

### Query 22: Notifications & Devices

```sql
SELECT
  (SELECT COUNT(*) FROM notifications n JOIN profiles p ON n.user_id = p.id
   WHERE n.created_at >= NOW() - INTERVAL '7 days'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS notifications_7d,
  (SELECT COUNT(*) FROM notifications n JOIN profiles p ON n.user_id = p.id
   WHERE n.read_at IS NOT NULL AND n.created_at >= NOW() - INTERVAL '7 days'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS notifications_read_7d,
  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE n.read_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
   FROM notifications n JOIN profiles p ON n.user_id = p.id
   WHERE n.created_at >= NOW() - INTERVAL '7 days'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS read_rate_pct,
  (SELECT COUNT(DISTINCT ud.user_id) FROM user_devices ud JOIN profiles p ON ud.user_id = p.id
   WHERE p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS users_with_devices,
  (SELECT COUNT(*) FROM user_devices ud JOIN profiles p ON ud.user_id = p.id
   WHERE ud.platform = 'ios'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS ios_devices,
  (SELECT COUNT(*) FROM user_devices ud JOIN profiles p ON ud.user_id = p.id
   WHERE ud.platform = 'android'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS android_devices,
  (SELECT COUNT(*) FROM user_devices ud JOIN profiles p ON ud.user_id = p.id
   WHERE ud.platform = 'web'
   AND p.is_mock = false AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))) AS web_devices;
```

### Query 23: Email Engagement by Type and Template (7d)

```sql
SELECT
  esl.email_type,
  COALESCE(esl.meta->>'template', '(default)') AS template,
  COUNT(*) AS sent,
  COUNT(*) FILTER (WHERE esl.delivered_at IS NOT NULL) AS delivered,
  COUNT(*) FILTER (WHERE esl.opened_at IS NOT NULL) AS opened,
  COUNT(*) FILTER (WHERE esl.clicked_at IS NOT NULL) AS clicked,
  COUNT(*) FILTER (WHERE esl.bounced_at IS NOT NULL) AS bounced,
  ROUND(100.0 * COUNT(*) FILTER (WHERE esl.opened_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE esl.delivered_at IS NOT NULL), 0), 1) AS open_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE esl.clicked_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE esl.opened_at IS NOT NULL), 0), 1) AS click_to_open_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE esl.clicked_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE esl.delivered_at IS NOT NULL), 0), 1) AS click_to_delivered_pct
FROM email_send_log esl
JOIN profiles p ON esl.user_id = p.id
WHERE esl.sent_at >= NOW() - INTERVAL '7 days'
  AND p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ))
GROUP BY esl.email_type, COALESCE(esl.meta->>'template', '(default)')
ORDER BY sent DESC, clicked DESC;
```

### Query 25: Top Landing Pages — Anonymous Visitors (7d)

```sql
SELECT
  COALESCE(metadata->>'page', '(unknown)') AS landing_page,
  COUNT(DISTINCT session_id) AS unique_visitors_7d,
  COUNT(*) AS views_7d,
  COUNT(DISTINCT session_id) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS visitors_24h,
  MAX(created_at) AS last_seen
FROM user_events
WHERE event_type = 'page_view'
  AND created_at >= NOW() - INTERVAL '7 days'
  AND user_id IS NULL
  AND (bot_flagged IS NULL OR bot_flagged = false)
GROUP BY metadata->>'page'
ORDER BY unique_visitors_7d DESC
LIMIT 15;
```

Answers "where are anonymous visitors landing?" — the dominant traffic surface for an acquisition-stage product. Knowing whether people enter via `/tools`, `/about`, `/` (homepage), a beach detail page, or a region hub tells you which surface needs the strongest value-first CTAs. Sort by unique visitors, not page views, so a returning bot or auto-refresh can't inflate the ranking.

### Query 26: New Signups Roster (7d)

```sql
SELECT
  p.email,
  p.full_name,
  p.created_at AS signed_up_at,
  p.onboarding_completed_at IS NOT NULL AS onboarded,
  p.onboarding_completed_at - p.created_at AS onboarding_duration,
  hb.name AS home_beach,
  p.experience_level,
  p.signup_context->>'entrypoint' AS entrypoint,
  p.signup_context->>'landing_path' AS landing_path,
  p.signup_context->>'referrer' AS referrer,
  p.signup_context->'device'->>'kind' AS device,
  (SELECT MIN(ue.created_at) FROM user_events ue WHERE ue.user_id = p.id) AS first_event,
  (SELECT MAX(ue.created_at) FROM user_events ue WHERE ue.user_id = p.id) AS last_event,
  (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id) AS event_count,
  (SELECT COUNT(*) FROM sessions s WHERE s.user_id = p.id AND s.deleted_at IS NULL) AS sessions_logged,
  (SELECT COUNT(*) FROM intel_posts ip WHERE ip.user_id = p.id) AS intel_posts
FROM profiles p
LEFT JOIN beaches hb ON p.home_beach_id = hb.id
WHERE p.created_at >= NOW() - INTERVAL '7 days'
  AND p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ))
ORDER BY p.created_at DESC;
```

Per-user detail for every new signup in the window. When new-user volume is 1-5/week, this is where the real story lives: Who are they? Did they onboard? Where did they come from? Did they do anything after signup? Return this inline in the dashboard — don't make the reader re-query.

### Query 27: Onboarding Completion Rate (7d cohort)

```sql
SELECT
  COUNT(*) AS signups_7d,
  COUNT(*) FILTER (WHERE p.onboarding_completed_at IS NOT NULL) AS completed_onboarding,
  COUNT(*) FILTER (WHERE p.home_beach_id IS NOT NULL) AS set_home_beach,
  COUNT(*) FILTER (WHERE p.experience_level IS NOT NULL) AS set_experience,
  COUNT(*) FILTER (
    WHERE p.onboarding_completed_at IS NOT NULL
      AND p.onboarding_completed_at - p.created_at < INTERVAL '30 seconds'
  ) AS auto_skipped,
  COUNT(*) FILTER (
    WHERE NOT EXISTS (SELECT 1 FROM user_events ue WHERE ue.user_id = p.id)
  ) AS invisible_cohort,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.onboarding_completed_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS completion_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.home_beach_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS real_activation_pct,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE p.onboarding_completed_at IS NOT NULL
      AND p.onboarding_completed_at - p.created_at < INTERVAL '30 seconds'
  ) / NULLIF(COUNT(*) FILTER (WHERE p.onboarding_completed_at IS NOT NULL), 0), 1) AS auto_skip_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE NOT EXISTS (SELECT 1 FROM user_events ue WHERE ue.user_id = p.id)
  ) / NULLIF(COUNT(*), 0), 1) AS invisible_cohort_pct
FROM profiles p
WHERE p.created_at >= NOW() - INTERVAL '7 days'
  AND p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ));
```

**`real_activation_pct` (home_beach_id set) is the primary metric.** Since Apr 2026 the onboarding dialog no longer auto-opens — users now only see it if they click the Oracle home screen's "Set your home beach" CTA or the `/profile` `SetHomeBreakCta` banner. That means `home_beach_id` can now be set three ways: (a) explicitly via the dialog, (b) silently via `inferHomeBreakFromView()` when a logged-in user views any beach detail page, (c) explicit profile edit. `real_activation_pct` captures all three.

`completion_rate_pct` (did `onboarding_completed_at` get set?) is now a weaker signal — users who land on the home screen, view a beach page (which auto-infers home_beach_id), and never click the dialog CTA will show `real_activation=true` but `completion=false`. That's a success path, not a failure. A healthy week might show `real_activation_pct > completion_rate_pct`.

`auto_skip_rate_pct` (of the completed cohort, how many finished in <30s?) still surfaces "Maybe later reflex tap" after clicking the CTA. Less likely to spike now that the dialog isn't ambushing users, but keep as a safety check.

`invisible_cohort_pct` is the fraction of 7d signups with **zero lifetime user_events**. Server-side `signup_context` proves they existed, but the browser never successfully POSTed to `/api/events`. Two causal families, not one:

- **Client-drop (normal floor):** ad-blocker or Safari ITP blocks `/api/events`. Expected at ~15-25%; not a bug.
- **Ghost-bug (real bug):** prior to commit `2684eb03` (2026-04-19), a user opening the email-confirm link in a different browser than signup had `email_confirmed_at` set but session cookies never landed — the user could never authenticate, so they produced zero events by definition. When `invisible_cohort_pct` spikes, consult **Query 30 (Ghost-User Recurrence)** before blaming ad-blockers.

### Query 28: Monthly Signup Trend (12mo)

```sql
-- Correct lens for growth trajectory at small weekly sample size. Weekly numbers
-- are noise below ~10 signups/week; monthly reveals the real direction.
SELECT
  DATE_TRUNC('month', created_at)::date AS month,
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE home_beach_id IS NOT NULL) AS activated,
  SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at)) AS cumulative
FROM profiles
WHERE is_mock = false
  AND (email IS NULL OR (email NOT ILIKE '%test%' AND email NOT LIKE '%@local.test' AND email NOT LIKE '%@example.invalid'))
  AND created_at >= NOW() - INTERVAL '12 months'
GROUP BY 1
ORDER BY 1 DESC;
```

The current month is always partial — label it as such in the output. Compare the most recent 3-4 months to judge direction; ignore week-over-week entirely when weekly signups are single-digit.

### Query 30: Ghost-User Recurrence (post-`2684eb03`)

```sql
-- Detects the cross-browser email-confirm ghost bug (fixed 2026-04-19 via commit
-- 2684eb03, deployed 2026-04-19 19:13 UTC). Only flags users whose signup landed
-- AFTER the fix deployed — pre-fix victims (e.g. 2surftheworld@gmail.com, named
-- in the commit body) remain ghosts forever and are not fix regressions.
-- If this returns non-empty, the fix regressed or a new drop-off bug has landed.
-- Cross-reference with Sentry [confirm_session_lost].
SELECT
  au.id,
  au.email,
  au.created_at,
  au.email_confirmed_at,
  au.last_sign_in_at,
  (NOW() - au.created_at) AS age
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.created_at >= GREATEST(NOW() - INTERVAL '14 days', TIMESTAMPTZ '2026-04-19 19:13:00+00')
  AND au.email_confirmed_at IS NOT NULL
  AND au.last_sign_in_at IS NULL
  AND au.created_at < NOW() - INTERVAL '1 hour'
  AND (p.email IS NULL OR (p.is_mock = false AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
ORDER BY au.created_at DESC;
```

If rows return, raise a **dangerous** anomaly: "Ghost-user bug may have returned (`2684eb03` regression risk) — N post-fix users confirmed email but never authenticated. Check `[confirm_session_lost]` in Sentry + `app/auth/confirm/route.ts`." An empty result confirms the fix is holding; pre-fix historical ghosts are intentionally excluded from this query by the `2026-04-19 19:13:00+00` floor.

### Query 31: CTA CTR by Surface and Source (14d)

```sql
-- Post-commit 9d54fddb (2026-04-20), signup CTA events carry metadata.surface.
-- Split by surface, normalized source group, raw source, cta_type, and copy
-- variant. Do not judge landing-page or beach-detail from blended surface CTR;
-- find the placement dragging the average first.
WITH events AS (
  SELECT
    event_type,
    COALESCE(metadata->>'surface', '(unset)') AS surface,
    COALESCE(metadata->>'source', '(unset)') AS source,
    COALESCE(metadata->>'cta_type', '(unset)') AS cta_type,
    COALESCE(metadata->>'cta_copy_variant', '(unset)') AS cta_copy_variant
  FROM user_events
  WHERE created_at >= NOW() - INTERVAL '14 days'
    AND event_type IN ('signup_cta_view', 'signup_cta_click')
    AND (bot_flagged IS NULL OR bot_flagged = false)
), grouped AS (
  SELECT
    surface,
    CASE
      WHEN source IN ('hero-cta', 'landing-navbar', 'landing-navbar-mobile', 'landing-final-cta') THEN source
      WHEN source LIKE 'beach-detail-%-desktop-inline' THEN 'beach-detail-desktop-inline'
      WHEN source LIKE 'beach-detail-%' THEN 'beach-detail-sticky'
      WHEN source LIKE 'horizon-strip-gated-days-%' THEN 'horizon-strip-gated-days'
      WHEN source LIKE 'beach-hero-match-teaser-%' THEN 'beach-hero-match-teaser'
      WHEN source LIKE 'match-score-teaser-%' THEN 'match-score-teaser'
      ELSE source
    END AS source_group,
    source,
    cta_type,
    cta_copy_variant,
    COUNT(*) FILTER (WHERE event_type = 'signup_cta_view') AS views,
    COUNT(*) FILTER (WHERE event_type = 'signup_cta_click') AS clicks,
    ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 'signup_cta_click')
         / NULLIF(COUNT(*) FILTER (WHERE event_type = 'signup_cta_view'), 0), 2) AS ctr_pct
  FROM events
  GROUP BY 1,2,3,4,5
)
SELECT
  surface,
  source_group,
  source,
  cta_type,
  cta_copy_variant,
  views,
  clicks,
  ctr_pct
FROM grouped
WHERE views >= 10 OR clicks > 0
ORDER BY views DESC;
```

Placements with <10 views in 14d are suppressed unless they have clicks. For landing-page, read `hero-cta`, `landing-navbar`, `landing-navbar-mobile`, and `landing-final-cta` separately; blended educational-section CTR is not the KPI.

### Query 32: Real-User Engagement Signatures (lifetime, founder-excluded)

```sql
-- Per-user behavior signature for non-founder real users who have ANY events.
-- Steven's founder account (73040cff-afe9-4fa0-a874-2016203fc015 / omg.its.thefuture@gmail.com)
-- is excluded because his power-user behavior dominates and distorts every aggregate
-- (e.g. "forecast_interaction" looks like a core feature with 113 events / 8 users —
-- but 95 of those are Steven, leaving 17 events across 6 non-founder users).
-- His test-identity accounts are already handled via is_mock=true (see
-- reference_is_mock_flagged_accounts_apr24.md for the roster).
SELECT
  COALESCE(p.email, au.email) AS email,
  p.full_name,
  hb.name AS home_beach,
  p.experience_level AS xp,
  (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id) AS events,
  (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type = 'beach_view') AS beach_views,
  (SELECT COUNT(DISTINCT beach_id) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type = 'beach_view' AND beach_id IS NOT NULL) AS distinct_beaches,
  (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type = 'forecast_interaction') AS fcast,
  (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type = 'map_interaction') AS map_int,
  (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type = 'beach_search') AS searches,
  (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type LIKE 'onboarding_%') AS onboarding,
  (SELECT COUNT(*) FROM sessions s WHERE s.user_id = p.id AND s.deleted_at IS NULL) AS sess,
  (SELECT MAX(ue.created_at) FROM user_events ue WHERE ue.user_id = p.id) AS last_event,
  EXTRACT(DAY FROM NOW() - COALESCE(
    (SELECT MAX(ue.created_at) FROM user_events ue WHERE ue.user_id = p.id),
    p.created_at
  ))::int AS days_idle
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
LEFT JOIN beaches hb ON p.home_beach_id = hb.id
WHERE p.is_mock = false
  AND p.id != '73040cff-afe9-4fa0-a874-2016203fc015'
  AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
  AND EXISTS (SELECT 1 FROM user_events ue WHERE ue.user_id = p.id)
ORDER BY events DESC;
```

Use this to classify real users into behavioral archetypes (see Query 33). The founder exclusion is essential: with Steven in the aggregate, "forecast interactions" and "distinct beaches per user" both read 5–10× higher than what real users actually do, painting a false feature-adoption picture.

### Query 33: Behavioral Archetype Distribution (founder-excluded)

```sql
-- Classify non-founder real users into behavioral archetypes based on lifetime actions.
-- Same founder exclusion as Query 32.
WITH sig AS (
  SELECT
    p.id,
    COALESCE(p.email, au.email) AS email,
    (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id) AS events,
    (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type = 'beach_view') AS beach_views,
    (SELECT COUNT(DISTINCT beach_id) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type = 'beach_view' AND beach_id IS NOT NULL) AS distinct_beaches,
    (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type = 'map_interaction') AS map_int,
    (SELECT COUNT(*) FROM user_events ue WHERE ue.user_id = p.id AND ue.event_type LIKE 'onboarding_%') AS onboarding
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.is_mock = false
    AND p.id != '73040cff-afe9-4fa0-a874-2016203fc015'
    AND (p.email IS NULL OR (p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'))
),
classified AS (
  SELECT
    id, email,
    CASE
      WHEN events = 0 THEN 'E. Ghost (0 events)'
      WHEN events > 0 AND beach_views = 0 AND map_int >= 3 THEN 'C. Map-First Wanderer (never clicks into a beach)'
      WHEN distinct_beaches = 1 AND beach_views >= 3 THEN 'A. Single-Beach Loyalist'
      WHEN distinct_beaches BETWEEN 2 AND 5 THEN 'B. Small-Radius Explorer'
      WHEN distinct_beaches > 5 THEN 'F. Coast-Scanning Explorer'
      WHEN onboarding >= 10 AND beach_views <= 2 THEN 'D. New-Signup Bouncer (stuck in onboarding)'
      ELSE 'Z. Other / low-engagement'
    END AS archetype
  FROM sig
)
SELECT archetype, COUNT(*) AS users,
       STRING_AGG(email, ', ' ORDER BY email) FILTER (WHERE archetype != 'E. Ghost (0 events)') AS example_users
FROM classified
GROUP BY archetype
ORDER BY archetype;
```

Archetype heuristics (tune as the user base grows):

- **A. Single-Beach Loyalist** — 1 distinct beach, ≥3 views. Comes to check ONE break. Most common archetype; drives the "forecast for your home spot" positioning.
- **B. Small-Radius Explorer** — 2–5 distinct beaches. Home + a few backups. Core target for a surf-spot-compare pitch.
- **C. Map-First Wanderer** — 0 beach_views but ≥3 map_interactions. Visual discovery, never clicks into detail. Could be a successful "which way to drive" scan, or a broken handoff — worth qualitative checks.
- **D. New-Signup Bouncer** — 10+ onboarding events but ≤2 beach views. Got stuck or confused; didn't find value post-signup. Churn risk.
- **E. Ghost** — 0 events despite signup. Ad-blocker floor (~15–25% is expected) plus any ghost-bug regressions (see Query 30).
- **F. Coast-Scanning Explorer** — 6+ distinct beaches. Rare; typically means a traveler, a reviewer, or a founder account that slipped through.
- **Z. Other** — anyone the heuristics didn't catch; re-examine the data and add a new rule.

If the largest non-ghost archetype shifts between runs, that's a shift in who's finding the product. If one archetype's share is >60%, the product is being used like a one-trick tool — market accordingly rather than trying to broaden generically.

## Output Format

The dashboard answers four questions: what's broken, who uses it, did new signups stick, where does the funnel leak. Everything else is ops plumbing — surface it only when a threshold trips.

**Core rule:** `sections_rendered ≤ 5` + a one-line "everything else normal" footer. Tables below the fold are for drill-downs the user can ask for ("show landing pages", "show forecast pipeline"); don't print them in the default scan.

**Tone:** bolded numbers are the signal; captions are one short sentence; emoji section markers (🚨 👥 🆕 🔻 ✅) for fast scan.

```
## App Dashboard · {today}

### 🚨 What's broken
*(If nothing is broken, print "No anomalies detected.")*
- **{surface} CTA: 0 clicks / {views} views** (14d)
- **{surface} CTR: {ctr}%** — {views} views, {clicks} clicks (under 2% floor)
- **Signup modal → provider: {ratio}%** — {opens} opens, {selects} selected (users bailing)
- **Email clicks: {clicks}** / {opens} opens / {delivered} delivered + {bounced} bounced
- **{email} signed up {n}h ago, 0 events** — ad-block or silent drop
*(... plus any Anomaly Flags below that tripped)*

### 👥 Who's here ({total_users} users · {non_ghost_active} non-founder non-ghost active)
**{pct}% Single-Beach Loyalists** — {names}
**{pct}% Small-Radius Explorers** — {names}
**{n} Map-First Wanderers** ({names})
**{n} New-Signup Bouncers** ({names})
*(Ghost count: {n}, omit if zero)*

**Positioning:** "{one-line pitch derived from dominant archetype}" {one-line what-they-don't-use note}.

### 🆕 This week ({signups_7d} signups)
| User | Home | Events | Outcome |
|---|---|---|---|
| {full_name} ({hint}) | {home_beach} | {event_count} | {one-line assessment} |

**Activation: {set_home_beach}/{signups_7d} set a home beach. {sessions}/{signups_7d} logged a session. Retention: {"none" if zero else "..."}.**

### 🔻 Funnel (7d)
- **{views} views → {clicks} clicks ({ctr}% CTR)** — {"broken, driven by N dead surfaces above" | "healthy" | "weak"}
- **{opens} modal opens → {selects} provider selects ({pct}%)** — {"modal is the bigger leak" | "healthy"}
- **{started} → {submitted} → {success}** past that ({terminal_conv}% from provider onward)

### ✅ Everything else normal
Forecast pipeline {coverage}% coverage, {avg_age}h avg age · Ghost-user fix holding · {"No dangerous fallbacks" | "N fallback offenders — see Top Fallback"} · {sessions_7d} session{s} ({surfer_note}) · Zero real intel/reviews/follows/shares (pre-launch expected)
```

### Drill-down tables (render only if explicitly asked or anomaly requires)

Keep these query results on hand — they're always computed from Queries 1–33 — but do NOT print them by default. Render them when the user asks ("show funnel detail", "show landing pages", "show forecast pipeline", etc.) or when an anomaly below needs the evidence inline.

- **Real-User Engagement Signatures** (Q32) — full per-user table; render when user asks "who uses it" or when investigating a specific archetype.
- **New Signups Roster** (Q26) — full table with entrypoint/referrer; render when a new-signup anomaly fires or the user asks "who signed up this week."
- **Signup Funnel detail** (Q15) — full event-level funnel with conv% per step.
- **CTA CTR by Surface** (Q31) — surface-level breakdown; render whenever a CTA anomaly fires so the user sees which surface is dragging.
- **Monthly Signup Trend** (Q28) — quarterly/annual view; render when the user asks about growth direction or a monthly-trend anomaly fires.
- **Top Landing Pages** (Q25), **Top Beaches** (Q7), **User Behavior Events mix** (Q5), **Onboarding Steps** (Q16) — situational; render on request.
- **Forecast Pipeline Health** (Q13, Q14), **Top Fallback Offenders** (Q12) — render only if an ops anomaly fires.
- **Email Engagement** (Q23), **Data Freshness** (Q9), **Event Tracking Health** (Q10) — render only if a delivery or tracking anomaly fires.
- **Ghost-User Recurrence** (Q30) — render only if ≥1 row.
- **Onboarding / Activation cohort** (Q27) — render only if a new-signup anomaly fires; otherwise the "Activation" line in § 🆕 carries the signal.

The native-app metrics (Q2 sessions/session engagement, Q18 XP, Q19 follows, Q20 likes/comments/shares/media, Q21 referrals, Q22 devices/notifications) collapse into the single "✅ Everything else normal" footer line above. Don't print a separate pending-launch table — the one-liner is enough.

## Anomaly Flags

**Fix timeline context** (only use to suppress false flags, don't recite):

- `ba2291fc` (2026-04-16) dwell-gated `signup_cta_view` (500ms). Pre-date views aren't comparable.
- `2684eb03` (2026-04-19) fixed cross-browser email-confirm ghost bug.
- `9d54fddb` (2026-04-20) added `metadata.surface` on signup CTA events.

If a funnel anomaly traces to one of these, skip the flag.

**Web Acquisition Anomalies:**

- **No new users in 24h** — "Zero signups in last 24h"
- **Monthly signup trend down** (Query 28: most recent 3 full months trending down AND current month pace <50% of prior) — "Signups trending down over 3 months." Do NOT flag on weekly numbers.
- **Data source stale** (Query 9: any source >48h) — "{source} no activity in 48h+"
- **Email bounce spike** (Query 23: bounced > 5% of delivered) — "Bounce rate {n}% — check sender reputation"
- **Ghost-user recurrence** (Query 30 ≥1 row) — 🚨 "Ghost-user bug may have returned. Check `[confirm_session_lost]` + `app/auth/confirm/route.ts`."
- **Signup CTA broken** (Query 15 `signup_cta_click / signup_cta_view` < 1% AND views ≥ 200) — "CTA CTR {n}% — check Query 31 for which surface is dragging"
- **Signup CTA weak** (same ratio 1–2% AND views ≥ 200) — "CTA CTR {n}% — under 2% floor"
- **Signup surface broken** (Query 31: any surface with views ≥ 200 AND 0 clicks) — "{surface} has 0 clicks in 14d — broken CTA or event instrumentation"
- **Provider-selection collapse** (Query 15: `auth_provider_selected_signup / auth_modal_opened_signup` < 30% AND `auth_modal_opened_signup` ≥ 30) — "{n}% modal→provider — users bailing at provider step." Do NOT flag when sample <30; note "sample too small" instead.
- **Native analytics regressed** (Query 2 `sessions_7d > 0` AND Query 5 `session_log_events = 0`) — "Sessions in DB but no session_log events. Check `quiver-native/src/lib/analytics.ts`."
- **Onboarding Maybe-later reflex** (Query 27: `auto_skip_rate_pct` > 30) — "{n}% dialog-openers <30s; HomeBeachStep friction"
- **Real activation collapse** (Query 27: `real_activation_pct` < 50 AND `signups_7d` > 0) — "{n}% of new signups never set a home beach"
- **Completion > activation inverted** (Query 27: `completion_rate_pct` high AND `real_activation_pct` low) — "users dismissing onboarding without picking a beach"
- **New signups with zero events** (Query 26: any row `event_count = 0` AND `signed_up_at` > 1h ago) — "{email} signed up {n}h ago, 0 events. Causes: ad-block (expected ~15-25%), ghost-bug (cross-ref Query 30), or bounce."
- **New-Signup Bouncer archetype spike** (Query 33: >25% of non-ghost signups classified as Bouncer) — "Onboarding value-delivery broken — {n} users stuck in onboarding events without beach engagement"

**Forecast Pipeline Anomalies:**

- **Dangerous fallback active** (Query 12: any row with severity='dangerous' AND occurrences_24h > 0) — "{field} fallback fired {n}× in 24h — scoring may use fabricated data"
- **Synthetic NOAA data active** (Query 12: domain in ('noaa-coops','noaa-wavewatch') AND occurrences_24h > 0) — "NOAA fallback generator fired {n}× — possible API outage"
- **Enhanced forecasts critical** (Query 13: critical_stale > 35 for enhanced) — "{n} beaches >24h stale — cron pipeline may be down"
- **Enhanced forecasts all stale** (Query 13: avg_age_hours > 16 for enhanced) — "Avg {n}h old — discovery will show stale results"
- **Marine forecasts stale** (Query 13: critical_stale > 50 for marine) — "{n} beaches >6h stale"
- **Low forecast coverage** (Query 13: coverage_pct < 90 for enhanced) — "Coverage {n}% — {missing} beaches no data"

**Do NOT flag** (expected pre-launch):

- Zero social activity, likes, comments, shares, follows, referrals, notification reads, or session engagement.
- Zero sessions logged (only flag if `sessions_7d > 0` but `session_log_events = 0` — instrumentation regression).

If no anomalies, print "No anomalies detected."
