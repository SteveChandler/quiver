BEGIN;

-- One row per real web-signup profile. Profile outcomes and install outcomes
-- intentionally remain separate denominators.
CREATE OR REPLACE VIEW public.growth_web_signup_activation_v1
WITH (security_invoker = true) AS
WITH product_activity_events AS (
  SELECT
    ue.user_id,
    ue.created_at,
    COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') AS platform
  FROM public.user_events ue
  WHERE ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND ue.event_type IN (
      'beach_view',
      'forecast_check',
      'forecast_interaction',
      'home_beach_forecast_viewed',
      'home_hero_forecast_viewed',
      'home_viewed',
      'map_interaction',
      'map_marker_click',
      'map_marker_tapped',
      'map_viewed',
      'session_log_start',
      'session_log_submit',
      'set_home_beach',
      'tab_view'
    )
),
web_signup_candidates AS (
  SELECT
    p.id AS profile_id,
    p.created_at AS cohort_anchor,
    p.signup_context,
    p.referral_code IS NOT NULL AS has_partner_referral,
    signup_event.created_at AS exact_web_signup_at,
    signup_event.metadata AS signup_event_metadata,
    ROW_NUMBER() OVER (
      PARTITION BY p.id
      ORDER BY
        CASE WHEN signup_event.created_at IS NOT NULL THEN 0 ELSE 1 END,
        signup_event.created_at NULLS LAST
    ) AS evidence_rank
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT ue.created_at, ue.metadata
    FROM public.user_events ue
    WHERE ue.user_id = p.id
      AND ue.event_type = 'signup_success'
      AND COALESCE(ue.bot_flagged, false) = false
      AND ue.created_at >= p.created_at - interval '24 hours'
      AND ue.created_at < p.created_at + interval '24 hours'
      AND COALESCE(
        ue.metadata->>'signup_surface',
        ue.metadata->>'surface',
        'web'
      ) = 'web'
      AND COALESCE(
        ue.metadata->>'platform',
        ue.metadata->>'_platform',
        'web'
      ) NOT IN ('ios', 'android', 'native-ios', 'native-android')
    ORDER BY
      ABS(EXTRACT(EPOCH FROM (ue.created_at - p.created_at))),
      ue.created_at
    LIMIT 1
  ) signup_event ON true
  WHERE p.analytics_is_real_user = true
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.deleted_at IS NULL
    AND p.id <> '73040cff-afe9-4fa0-a874-2016203fc015'::uuid
    AND p.id <> 'c15c2ab3-275c-49d1-ac4f-dcc493db0653'::uuid
    AND (
      p.signup_context->>'signup_surface' = 'web'
      OR signup_event.created_at IS NOT NULL
    )
),
web_signups AS (
  SELECT
    wsc.*,
    COALESCE(
      NULLIF(wsc.signup_context->>'entrypoint', ''),
      NULLIF(wsc.signup_event_metadata->>'entrypoint', ''),
      NULLIF(wsc.signup_event_metadata->>'source', '')
    ) AS entrypoint,
    COALESCE(
      NULLIF(wsc.signup_context->>'referrer_domain', ''),
      NULLIF(wsc.signup_event_metadata->>'referrer_domain', '')
    ) AS referrer_domain,
    COALESCE(
      NULLIF(wsc.signup_context->'utm'->>'source', ''),
      NULLIF(wsc.signup_event_metadata->>'utm_source', '')
    ) AS utm_source,
    COALESCE(
      NULLIF(wsc.signup_context->'utm'->>'medium', ''),
      NULLIF(wsc.signup_event_metadata->>'utm_medium', '')
    ) AS utm_medium,
    COALESCE(
      NULLIF(wsc.signup_context->'utm'->>'campaign', ''),
      NULLIF(wsc.signup_event_metadata->>'utm_campaign', '')
    ) AS utm_campaign
  FROM web_signup_candidates wsc
  WHERE wsc.evidence_rank = 1
),
web_cohorts AS (
  SELECT
    ws.*,
    CASE
      WHEN ws.signup_context->>'source_capture_status' IN ('captured', 'missing')
        THEN ws.signup_context->>'source_capture_status'
      WHEN COALESCE(
        ws.utm_source,
        ws.utm_medium,
        ws.utm_campaign
      ) IS NOT NULL OR ws.has_partner_referral
        THEN 'captured'
      WHEN ws.referrer_domain IS NOT NULL
        AND ws.referrer_domain NOT IN (
          'quiversurf.app',
          'www.quiversurf.app',
          'dev.quiversurf.app',
          'localhost'
        )
        THEN 'captured'
      ELSE 'missing'
    END AS source_capture_status,
    CASE
      WHEN NULLIF(ws.signup_context->>'source_group', '') IS NOT NULL
        THEN ws.signup_context->>'source_group'
      WHEN ws.utm_source IS NOT NULL
        THEN ws.utm_source
      WHEN ws.has_partner_referral
        THEN 'partner_referral'
      WHEN ws.referrer_domain IS NOT NULL
        AND ws.referrer_domain NOT IN (
          'quiversurf.app',
          'www.quiversurf.app',
          'dev.quiversurf.app',
          'localhost'
        )
        THEN ws.referrer_domain
      WHEN ws.signup_context->>'referrer' = 'direct'
        OR ws.signup_context->>'source_group' = 'direct'
        THEN 'direct'
      ELSE 'unknown'
    END AS source_group,
    CASE
      WHEN ws.exact_web_signup_at IS NOT NULL THEN 'exact'
      WHEN ws.signup_context->>'schema_version' = '2' THEN 'linked'
      ELSE 'unknown'
    END AS evidence_level
  FROM web_signups ws
),
web_outcomes AS (
  SELECT
    wc.*,
    web_activation.first_web_product_activation_at,
    handoff.first_app_handoff_intent_at,
    native.first_linked_native_open_at,
    persisted.first_persisted_session_at,
    d1.d1_return_at,
    d7.d7_return_at
  FROM web_cohorts wc
  LEFT JOIN LATERAL (
    SELECT MIN(pae.created_at) AS first_web_product_activation_at
    FROM product_activity_events pae
    WHERE pae.user_id = wc.profile_id
      AND pae.created_at >= wc.cohort_anchor
      AND pae.created_at < wc.cohort_anchor + interval '24 hours'
      AND COALESCE(pae.platform, 'web') NOT IN (
        'ios',
        'android',
        'native-ios',
        'native-android'
      )
  ) web_activation ON true
  LEFT JOIN LATERAL (
    SELECT MIN(ue.created_at) AS first_app_handoff_intent_at
    FROM public.user_events ue
    WHERE ue.user_id = wc.profile_id
      AND COALESCE(ue.bot_flagged, false) = false
      AND ue.event_type IN (
        'app_handoff_qr_rendered',
        'app_handoff_email_submit',
        'app_handoff_link_opened'
      )
      AND ue.created_at >= wc.cohort_anchor
      AND ue.created_at < wc.cohort_anchor + interval '24 hours'
  ) handoff ON true
  LEFT JOIN LATERAL (
    SELECT MIN(ue.created_at) AS first_linked_native_open_at
    FROM public.user_events ue
    WHERE ue.user_id = wc.profile_id
      AND COALESCE(ue.bot_flagged, false) = false
      AND ue.event_type = 'native_app_first_open'
      AND COALESCE(ue.metadata->>'is_emulator', 'false') NOT IN ('true', '1')
      AND COALESCE(ue.metadata->>'is_test', 'false') NOT IN ('true', '1')
      AND COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') IN (
        'ios',
        'android',
        'native-ios',
        'native-android'
      )
      AND ue.created_at >= wc.cohort_anchor
      AND ue.created_at < wc.cohort_anchor + interval '7 days'
  ) native ON true
  LEFT JOIN LATERAL (
    SELECT MIN(s.created_at) AS first_persisted_session_at
    FROM public.sessions s
    WHERE s.user_id = wc.profile_id
      AND s.status = 'completed'
      AND s.deleted_at IS NULL
      AND s.created_at >= wc.cohort_anchor
      AND s.created_at < wc.cohort_anchor + interval '7 days'
  ) persisted ON true
  LEFT JOIN LATERAL (
    SELECT MIN(pae.created_at) AS d1_return_at
    FROM product_activity_events pae
    WHERE pae.user_id = wc.profile_id
      AND pae.created_at >= wc.cohort_anchor + interval '24 hours'
      AND pae.created_at < wc.cohort_anchor + interval '48 hours'
  ) d1 ON true
  LEFT JOIN LATERAL (
    SELECT MIN(pae.created_at) AS d7_return_at
    FROM product_activity_events pae
    WHERE pae.user_id = wc.profile_id
      AND pae.created_at >= wc.cohort_anchor + interval '168 hours'
      AND pae.created_at < wc.cohort_anchor + interval '192 hours'
  ) d7 ON true
)
SELECT
  profile_id,
  cohort_anchor,
  'web_signup'::text AS cohort_type,
  evidence_level,
  source_capture_status,
  source_group,
  entrypoint,
  referrer_domain,
  utm_source,
  utm_medium,
  utm_campaign,
  now() >= cohort_anchor + interval '24 hours' AS eligible_24h,
  now() >= cohort_anchor + interval '7 days' AS eligible_7d,
  now() >= cohort_anchor + interval '48 hours' AS eligible_d1,
  now() >= cohort_anchor + interval '192 hours' AS eligible_d7,
  first_web_product_activation_at,
  first_app_handoff_intent_at,
  first_linked_native_open_at,
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
FROM web_outcomes;

COMMENT ON VIEW public.growth_web_signup_activation_v1 IS
  'One row per real web-signup profile; profile-grain activation denominator.';

-- One row per real-device native install. Account outcomes are populated only
-- after the first-open row exact-links to a qualifying profile.
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
  FROM native_installs ni
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
  'One row per real-device native install ID; install-grain activation denominator.';

-- One row per controllable handoff ID. Store redirect is terminal unless a
-- later installed-app open carries the same ID.
CREATE OR REPLACE VIEW public.growth_app_handoff_v1
WITH (security_invoker = true) AS
WITH product_activity_events AS (
  SELECT
    ue.user_id,
    ue.created_at
  FROM public.user_events ue
  WHERE ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
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
handoff_events AS (
  SELECT
    LOWER(ue.metadata->>'handoff_id') AS handoff_id,
    ue.event_type,
    ue.created_at,
    ue.user_id,
    ue.metadata
  FROM public.user_events ue
  WHERE ue.event_type IN (
      'app_handoff_view',
      'app_handoff_qr_rendered',
      'app_handoff_email_submit',
      'app_handoff_email_sent',
      'app_handoff_email_failed',
      'app_handoff_link_opened',
      'app_handoff_native_open'
    )
    AND COALESCE(ue.bot_flagged, false) = false
    AND COALESCE(ue.metadata->>'is_test', 'false') NOT IN ('true', '1')
    AND NULLIF(ue.metadata->>'handoff_id', '') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
),
handoff_cohorts AS (
  SELECT
    he.handoff_id,
    MIN(he.created_at) AS cohort_anchor,
    MIN(he.created_at) FILTER (
      WHERE he.event_type = 'app_handoff_view'
    ) AS first_handoff_view_at,
    MIN(he.created_at) FILTER (
      WHERE he.event_type = 'app_handoff_qr_rendered'
    ) AS first_qr_action_at,
    MIN(he.created_at) FILTER (
      WHERE he.event_type IN (
        'app_handoff_email_submit',
        'app_handoff_email_sent'
      )
    ) AS first_email_action_at,
    MIN(he.created_at) FILTER (
      WHERE he.event_type = 'app_handoff_link_opened'
    ) AS first_phone_link_open_at,
    MIN(he.created_at) FILTER (
      WHERE he.event_type = 'app_handoff_link_opened'
        AND he.metadata->>'destination_type' IN ('app_store', 'android_beta')
    ) AS first_store_redirect_at,
    MIN(he.created_at) FILTER (
      WHERE he.event_type = 'app_handoff_native_open'
    ) AS first_native_open_at,
    (ARRAY_AGG(he.user_id ORDER BY he.created_at) FILTER (
      WHERE he.event_type = 'app_handoff_native_open'
        AND he.user_id IS NOT NULL
    ))[1] AS linked_profile_id,
    (ARRAY_AGG(NULLIF(he.metadata->>'handoff_channel', '') ORDER BY he.created_at)
      FILTER (WHERE NULLIF(he.metadata->>'handoff_channel', '') IS NOT NULL)
    )[1] AS handoff_channel,
    (ARRAY_AGG(NULLIF(he.metadata->>'source', '') ORDER BY he.created_at)
      FILTER (WHERE NULLIF(he.metadata->>'source', '') IS NOT NULL)
    )[1] AS entrypoint,
    (ARRAY_AGG(NULLIF(he.metadata->>'surface', '') ORDER BY he.created_at)
      FILTER (WHERE NULLIF(he.metadata->>'surface', '') IS NOT NULL)
    )[1] AS surface,
    (ARRAY_AGG(NULLIF(he.metadata->>'placement', '') ORDER BY he.created_at)
      FILTER (WHERE NULLIF(he.metadata->>'placement', '') IS NOT NULL)
    )[1] AS placement,
    (ARRAY_AGG(NULLIF(he.metadata->>'utm_source', '') ORDER BY he.created_at)
      FILTER (WHERE NULLIF(he.metadata->>'utm_source', '') IS NOT NULL)
    )[1] AS utm_source,
    (ARRAY_AGG(NULLIF(he.metadata->>'utm_medium', '') ORDER BY he.created_at)
      FILTER (WHERE NULLIF(he.metadata->>'utm_medium', '') IS NOT NULL)
    )[1] AS utm_medium,
    (ARRAY_AGG(NULLIF(he.metadata->>'utm_campaign', '') ORDER BY he.created_at)
      FILTER (WHERE NULLIF(he.metadata->>'utm_campaign', '') IS NOT NULL)
    )[1] AS utm_campaign
  FROM handoff_events he
  GROUP BY he.handoff_id
),
eligible_handoff_cohorts AS (
  SELECT hc.*
  FROM handoff_cohorts hc
  LEFT JOIN public.profiles p ON p.id = hc.linked_profile_id
  WHERE hc.linked_profile_id IS NULL
    OR (
      p.analytics_is_real_user = true
      AND COALESCE(p.is_mock, false) = false
      AND COALESCE(p.is_system_account, false) = false
      AND p.deleted_at IS NULL
      AND p.id <> '73040cff-afe9-4fa0-a874-2016203fc015'::uuid
      AND p.id <> 'c15c2ab3-275c-49d1-ac4f-dcc493db0653'::uuid
    )
),
handoff_outcomes AS (
  SELECT
    hc.*,
    native_activation.first_native_activation_at,
    persisted.first_persisted_session_at,
    d1.d1_return_at,
    d7.d7_return_at
  FROM eligible_handoff_cohorts hc
  LEFT JOIN LATERAL (
    SELECT MIN(ue.created_at) AS first_native_activation_at
    FROM public.user_events ue
    WHERE ue.user_id = hc.linked_profile_id
      AND hc.linked_profile_id IS NOT NULL
      AND COALESCE(ue.bot_flagged, false) = false
      AND COALESCE(ue.metadata->>'is_emulator', 'false') NOT IN ('true', '1')
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
      AND ue.created_at >= hc.cohort_anchor
  ) native_activation ON true
  LEFT JOIN LATERAL (
    SELECT MIN(s.created_at) AS first_persisted_session_at
    FROM public.sessions s
    WHERE s.user_id = hc.linked_profile_id
      AND hc.linked_profile_id IS NOT NULL
      AND s.status = 'completed'
      AND s.deleted_at IS NULL
      AND s.created_at >= hc.cohort_anchor
      AND s.created_at < hc.cohort_anchor + interval '7 days'
  ) persisted ON true
  LEFT JOIN LATERAL (
    SELECT MIN(pae.created_at) AS d1_return_at
    FROM product_activity_events pae
    WHERE pae.user_id = hc.linked_profile_id
      AND hc.linked_profile_id IS NOT NULL
      AND pae.created_at >= hc.cohort_anchor + interval '24 hours'
      AND pae.created_at < hc.cohort_anchor + interval '48 hours'
  ) d1 ON true
  LEFT JOIN LATERAL (
    SELECT MIN(pae.created_at) AS d7_return_at
    FROM product_activity_events pae
    WHERE pae.user_id = hc.linked_profile_id
      AND hc.linked_profile_id IS NOT NULL
      AND pae.created_at >= hc.cohort_anchor + interval '168 hours'
      AND pae.created_at < hc.cohort_anchor + interval '192 hours'
  ) d7 ON true
)
SELECT
  handoff_id,
  linked_profile_id,
  cohort_anchor,
  CASE
    WHEN first_native_open_at IS NOT NULL THEN 'exact'
    WHEN first_phone_link_open_at IS NOT NULL THEN 'linked'
    ELSE 'unknown'
  END AS evidence_level,
  CASE
    WHEN COALESCE(utm_source, utm_medium, utm_campaign, entrypoint) IS NOT NULL
      THEN 'captured'
    ELSE 'missing'
  END AS source_capture_status,
  CASE
    WHEN utm_source IS NOT NULL THEN utm_source
    WHEN entrypoint = 'direct' THEN 'direct'
    WHEN entrypoint IS NOT NULL THEN entrypoint
    ELSE 'unknown'
  END AS source_group,
  handoff_channel,
  entrypoint,
  surface,
  placement,
  utm_source,
  utm_medium,
  utm_campaign,
  now() >= cohort_anchor + interval '24 hours' AS eligible_24h,
  now() >= cohort_anchor + interval '7 days' AS eligible_7d,
  now() >= cohort_anchor + interval '48 hours' AS eligible_d1,
  now() >= cohort_anchor + interval '192 hours' AS eligible_d7,
  first_handoff_view_at,
  first_qr_action_at,
  first_email_action_at,
  first_phone_link_open_at,
  first_store_redirect_at,
  first_native_open_at,
  first_native_activation_at,
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
FROM handoff_outcomes;

COMMENT ON VIEW public.growth_app_handoff_v1 IS
  'One row per valid handoff ID; exact only when installed-app open preserves the ID.';

REVOKE ALL ON public.growth_web_signup_activation_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.growth_web_signup_activation_v1 TO service_role;

REVOKE ALL ON public.growth_native_install_activation_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.growth_native_install_activation_v1 TO service_role;

REVOKE ALL ON public.growth_app_handoff_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.growth_app_handoff_v1 TO service_role;

COMMIT;
