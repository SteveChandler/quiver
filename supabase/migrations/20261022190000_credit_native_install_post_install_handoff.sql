BEGIN;

-- Credit a native install to the web handoff that brought it in when the
-- installed app opens that handoff link within 24 hours of first open.
-- Column list and order are unchanged, so CREATE OR REPLACE is safe.
CREATE OR REPLACE VIEW public.growth_native_install_activation_v1
WITH (security_invoker = true) AS
WITH product_activity_events AS (
  SELECT
    ue.user_id,
    ue.created_at
  FROM public.user_events ue
  WHERE ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND COALESCE(ue.metadata->>'is_emulator', 'false') NOT IN ('true', '1')
    AND COALESCE(ue.metadata->>'is_test', 'false') NOT IN ('true', '1')
    AND COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') IN (
      'ios',
      'android',
      'native-ios',
      'native-android'
    )
    AND ue.event_type IN (
      'beach_view',
      'forecast_check',
      'forecast_interaction',
      'home_beach_forecast_viewed',
      'home_hero_forecast_viewed',
      'home_viewed',
      'map_interaction',
      'map_marker_tapped',
      'map_viewed',
      'session_log_start',
      'session_log_submit',
      'set_home_beach',
      'tab_view'
    )
),
native_first_open_candidates AS (
  SELECT
    NULLIF(ue.metadata->>'native_install_id', '') AS native_install_id,
    ue.user_id AS linked_profile_id,
    ue.created_at AS cohort_anchor,
    COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') AS platform,
    NULLIF(ue.metadata->>'build', '') AS app_build,
    NULLIF(ue.metadata->>'source_group', '') AS reviewed_source_group,
    NULLIF(ue.metadata->>'utm_source', '') AS utm_source,
    NULLIF(ue.metadata->>'utm_medium', '') AS utm_medium,
    NULLIF(ue.metadata->>'utm_campaign', '') AS utm_campaign,
    NULLIF(ue.metadata->>'referrer_domain', '') AS referrer_domain,
    NULLIF(ue.metadata->>'source', '') AS entrypoint,
    NULLIF(ue.metadata->>'handoff_id', '') AS handoff_id,
    ROW_NUMBER() OVER (
      PARTITION BY NULLIF(ue.metadata->>'native_install_id', '')
      ORDER BY ue.created_at, ue.id
    ) AS install_rank
  FROM public.user_events ue
  WHERE ue.event_type = 'native_app_first_open'
    AND COALESCE(ue.bot_flagged, false) = false
    AND COALESCE(ue.metadata->>'is_emulator', 'false') NOT IN ('true', '1')
    AND COALESCE(ue.metadata->>'is_test', 'false') NOT IN ('true', '1')
    AND COALESCE(ue.metadata->>'_is_test', 'false') NOT IN ('true', '1')
    AND COALESCE(ue.metadata->>'environment', 'production') NOT IN (
      'test',
      'local',
      'development'
    )
    AND COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') IN (
      'ios',
      'android',
      'native-ios',
      'native-android'
    )
    AND NULLIF(ue.metadata->>'native_install_id', '') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
),
native_installs AS (
  SELECT nfc.*
  FROM native_first_open_candidates nfc
  LEFT JOIN public.profiles p ON p.id = nfc.linked_profile_id
  WHERE nfc.install_rank = 1
    AND (
      nfc.linked_profile_id IS NULL
      OR (
        p.analytics_is_real_user = true
        AND COALESCE(p.is_mock, false) = false
        AND COALESCE(p.is_system_account, false) = false
        AND p.deleted_at IS NULL
        AND p.id <> '73040cff-afe9-4fa0-a874-2016203fc015'::uuid
        AND p.id <> 'c15c2ab3-275c-49d1-ac4f-dcc493db0653'::uuid
      )
    )
),
native_installs_with_handoff AS (
  SELECT
    ni.native_install_id,
    ni.linked_profile_id,
    ni.cohort_anchor,
    ni.platform,
    ni.app_build,
    ni.reviewed_source_group,
    ni.utm_source,
    ni.utm_medium,
    ni.utm_campaign,
    ni.referrer_domain,
    ni.entrypoint,
    COALESCE(ni.handoff_id, post_install_handoff.handoff_id) AS handoff_id
  FROM native_installs ni
  -- iOS has no install referrer, so the first-open row never carries a
  -- handoff ID. A web handoff link opened in the installed app is the only
  -- per-install evidence; match it on the install ID within the first day.
  LEFT JOIN LATERAL (
    SELECT LOWER(ue.metadata->>'handoff_id') AS handoff_id
    FROM public.user_events ue
    WHERE ue.event_type = 'app_handoff_native_open'
      AND ue.metadata ? 'native_install_id'
      AND ue.metadata->>'native_install_id' = ni.native_install_id
      AND COALESCE(ue.bot_flagged, false) = false
      AND COALESCE(ue.metadata->>'is_emulator', 'false') NOT IN ('true', '1')
      AND COALESCE(ue.metadata->>'is_test', 'false') NOT IN ('true', '1')
      AND NULLIF(ue.metadata->>'handoff_id', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND ue.created_at < ni.cohort_anchor + interval '24 hours'
    ORDER BY ue.created_at, ue.id
    LIMIT 1
  ) post_install_handoff ON true
),
native_cohorts AS (
  SELECT
    ni.*,
    CASE
      WHEN ni.reviewed_source_group IS NOT NULL
        THEN ni.reviewed_source_group
      WHEN ni.utm_source IS NOT NULL
        THEN ni.utm_source
      WHEN ni.handoff_id IS NOT NULL
        THEN 'web_handoff'
      WHEN ni.referrer_domain IS NOT NULL
        THEN ni.referrer_domain
      WHEN ni.entrypoint = 'direct'
        THEN 'direct'
      ELSE 'unknown'
    END AS source_group,
    CASE
      WHEN COALESCE(
        ni.reviewed_source_group,
        ni.utm_source,
        ni.utm_medium,
        ni.utm_campaign,
        ni.handoff_id,
        ni.referrer_domain
      ) IS NOT NULL OR ni.entrypoint = 'direct'
        THEN 'captured'
      ELSE 'missing'
    END AS source_capture_status,
    'exact'::text AS evidence_level
  FROM native_installs_with_handoff ni
),
native_outcomes AS (
  SELECT
    nc.*,
    auth.first_auth_at,
    onboarding.first_onboarding_completed_at,
    high_intent.first_high_intent_native_at,
    session_start.first_session_log_start_at,
    persisted.first_persisted_session_at,
    d1.d1_return_at,
    d7.d7_return_at
  FROM native_cohorts nc
  LEFT JOIN LATERAL (
    SELECT MIN(ue.created_at) AS first_auth_at
    FROM public.user_events ue
    WHERE ue.user_id = nc.linked_profile_id
      AND nc.linked_profile_id IS NOT NULL
      AND COALESCE(ue.bot_flagged, false) = false
      AND ue.event_type IN ('signed_in', 'signup_success', 'login_success')
      AND COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') IN (
        'ios',
        'android',
        'native-ios',
        'native-android'
      )
      AND ue.created_at >= nc.cohort_anchor
      AND ue.created_at < nc.cohort_anchor + interval '24 hours'
  ) auth ON true
  LEFT JOIN LATERAL (
    SELECT MIN(ue.created_at) AS first_onboarding_completed_at
    FROM public.user_events ue
    WHERE ue.user_id = nc.linked_profile_id
      AND nc.linked_profile_id IS NOT NULL
      AND COALESCE(ue.bot_flagged, false) = false
      AND ue.event_type = 'onboarding_completed'
      AND COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') IN (
        'ios',
        'android',
        'native-ios',
        'native-android'
      )
      AND ue.created_at >= nc.cohort_anchor
  ) onboarding ON true
  LEFT JOIN LATERAL (
    SELECT MIN(ue.created_at) AS first_high_intent_native_at
    FROM public.user_events ue
    WHERE ue.user_id = nc.linked_profile_id
      AND nc.linked_profile_id IS NOT NULL
      AND COALESCE(ue.bot_flagged, false) = false
      AND COALESCE(ue.metadata->>'is_emulator', 'false') NOT IN ('true', '1')
      AND COALESCE(ue.metadata->>'is_test', 'false') NOT IN ('true', '1')
      AND COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') IN (
        'ios',
        'android',
        'native-ios',
        'native-android'
      )
      AND ue.event_type IN (
        'beach_view',
        'forecast_interaction',
        'home_beach_forecast_viewed',
        'home_hero_forecast_viewed',
        'home_viewed',
        'map_interaction',
        'map_marker_tapped',
        'map_viewed',
        'session_log_start'
      )
      AND ue.created_at >= nc.cohort_anchor
  ) high_intent ON true
  LEFT JOIN LATERAL (
    SELECT MIN(ue.created_at) AS first_session_log_start_at
    FROM public.user_events ue
    WHERE ue.user_id = nc.linked_profile_id
      AND nc.linked_profile_id IS NOT NULL
      AND COALESCE(ue.bot_flagged, false) = false
      AND ue.event_type = 'session_log_start'
      AND COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') IN (
        'ios',
        'android',
        'native-ios',
        'native-android'
      )
      AND ue.created_at >= nc.cohort_anchor
  ) session_start ON true
  LEFT JOIN LATERAL (
    SELECT MIN(s.created_at) AS first_persisted_session_at
    FROM public.sessions s
    WHERE s.user_id = nc.linked_profile_id
      AND nc.linked_profile_id IS NOT NULL
      AND s.status = 'completed'
      AND s.deleted_at IS NULL
      AND s.created_at >= nc.cohort_anchor
      AND s.created_at < nc.cohort_anchor + interval '7 days'
  ) persisted ON true
  LEFT JOIN LATERAL (
    SELECT MIN(pae.created_at) AS d1_return_at
    FROM product_activity_events pae
    WHERE pae.user_id = nc.linked_profile_id
      AND nc.linked_profile_id IS NOT NULL
      AND pae.created_at >= nc.cohort_anchor + interval '24 hours'
      AND pae.created_at < nc.cohort_anchor + interval '48 hours'
  ) d1 ON true
  LEFT JOIN LATERAL (
    SELECT MIN(pae.created_at) AS d7_return_at
    FROM product_activity_events pae
    WHERE pae.user_id = nc.linked_profile_id
      AND nc.linked_profile_id IS NOT NULL
      AND pae.created_at >= nc.cohort_anchor + interval '168 hours'
      AND pae.created_at < nc.cohort_anchor + interval '192 hours'
  ) d7 ON true
)
SELECT
  native_install_id,
  linked_profile_id,
  cohort_anchor,
  platform,
  app_build,
  evidence_level,
  source_capture_status,
  source_group,
  entrypoint,
  referrer_domain,
  utm_source,
  utm_medium,
  utm_campaign,
  handoff_id,
  now() >= cohort_anchor + interval '24 hours' AS eligible_24h,
  now() >= cohort_anchor + interval '7 days' AS eligible_7d,
  now() >= cohort_anchor + interval '48 hours' AS eligible_d1,
  now() >= cohort_anchor + interval '192 hours' AS eligible_d7,
  first_auth_at,
  first_onboarding_completed_at,
  first_high_intent_native_at,
  first_session_log_start_at,
  first_persisted_session_at,
  first_persisted_session_at IS NOT NULL AS persisted_session_within_7d,
  CASE
    WHEN now() >= cohort_anchor + interval '48 hours'
      THEN d1_return_at IS NOT NULL
    ELSE NULL
  END AS d1_returned,
  CASE
    WHEN now() >= cohort_anchor + interval '192 hours'
      THEN d7_return_at IS NOT NULL
    ELSE NULL
  END AS d7_returned
FROM native_outcomes;

COMMENT ON VIEW public.growth_native_install_activation_v1 IS
  'One row per real-device native install ID; install-grain activation denominator. handoff_id comes from first-open metadata or a handoff link opened in the installed app within 24 hours.';

REVOKE ALL ON public.growth_native_install_activation_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.growth_native_install_activation_v1 TO service_role;

COMMIT;
