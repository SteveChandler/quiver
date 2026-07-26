-- Add PII-free, single-use Android install attribution tokens.

BEGIN;

CREATE TABLE IF NOT EXISTS public.install_attribution_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  source text NOT NULL,
  surface text NOT NULL,
  placement text NOT NULL,
  campaign text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  redemption_key_hash text,
  CONSTRAINT install_attribution_tokens_token_hash_check
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT install_attribution_tokens_redemption_key_hash_check
    CHECK (
      redemption_key_hash IS NULL
      OR redemption_key_hash ~ '^[a-f0-9]{64}$'
    ),
  CONSTRAINT install_attribution_tokens_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT install_attribution_tokens_consumption_check
    CHECK (
      (consumed_at IS NULL AND redemption_key_hash IS NULL)
      OR (consumed_at IS NOT NULL AND redemption_key_hash IS NOT NULL)
    ),
  CONSTRAINT install_attribution_tokens_source_check CHECK (
    source IN (
      'android_beta_page', 'landing-navbar', 'landing_hero',
      'landing_platform_strip', 'landing_final_cta', 'landing_final',
      'download_hero', 'download_final', 'features-hero-android-waitlist',
      'features-final-android-waitlist', 'plans-android-waitlist',
      'partner_landing', 'invite_landing', 'post_session_log',
      'session_share', 'app_handoff_route', 'app_link_email', 'pbsc-flyer',
      'share_card', 'map_literacy_panel'
    )
  ),
  CONSTRAINT install_attribution_tokens_surface_check CHECK (
    surface IN (
      'android_beta', 'landing-page', 'landing', 'download', 'features-page',
      'plans-page', 'partner_landing', 'invite_landing',
      'session_log_success', 'session_detail_fallback', 'app_handoff',
      'pbsc-page', 'og_session_card', 'og_surf_call_card', 'map'
    )
  ),
  CONSTRAINT install_attribution_tokens_placement_check CHECK (
    placement IN (
      'direct', 'navbar_primary', 'navbar_mobile_primary', 'hero_primary',
      'hero_secondary', 'platform_strip', 'final_cta', 'final_secondary',
      'final', 'hero', 'plans_primary', 'plans_compact', 'plans_signed_in',
      'plans_compact_signed_in', 'primary_android', 'native_app_nudge',
      'primary_app_store', 'handoff_page', 'email', 'bottom_primary',
      'desktop_partner_qr', 'desktop_invite_qr', 'instructions_qr',
      'field_guide_qr', 'session_share_qr', 'surf_call_share_qr'
    )
  ),
  CONSTRAINT install_attribution_tokens_campaign_check CHECK (
    campaign IN (
      'app_first_v1', 'pbsc_2026', 'partner_access', 'invite_access'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.install_attribution_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_hash_prefix text NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT install_attribution_audit_hash_prefix_check
    CHECK (token_hash_prefix ~ '^[a-f0-9]{12}$'),
  CONSTRAINT install_attribution_audit_action_check
    CHECK (action IN ('issue', 'redeem')),
  CONSTRAINT install_attribution_audit_outcome_check
    CHECK (outcome IN ('issued', 'redeemed', 'same_key_retry', 'unavailable'))
);

CREATE INDEX IF NOT EXISTS idx_install_attribution_tokens_expires_at
  ON public.install_attribution_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_install_attribution_audit_created_at
  ON public.install_attribution_audit(created_at DESC);

ALTER TABLE public.install_attribution_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.install_attribution_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.install_attribution_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.install_attribution_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.install_attribution_tokens TO service_role;
GRANT ALL ON TABLE public.install_attribution_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.install_attribution_audit_id_seq
  TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_install_attribution_token(
  p_token_hash text,
  p_redemption_key_hash text
)
RETURNS TABLE (
  source text,
  surface text,
  placement text,
  campaign text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  matched_rows integer;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_redemption_key_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.install_attribution_tokens AS token
  SET
    consumed_at = now(),
    redemption_key_hash = p_redemption_key_hash
  WHERE token.token_hash = p_token_hash
    AND token.consumed_at IS NULL
    AND token.expires_at > now()
  RETURNING
    token.source,
    token.surface,
    token.placement,
    token.campaign,
    token.created_at,
    token.expires_at;

  GET DIAGNOSTICS matched_rows = ROW_COUNT;
  IF matched_rows > 0 THEN
    INSERT INTO public.install_attribution_audit (
      token_hash_prefix,
      action,
      outcome
    ) VALUES (
      left(p_token_hash, 12),
      'redeem',
      'redeemed'
    );
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    token.source,
    token.surface,
    token.placement,
    token.campaign,
    token.created_at,
    token.expires_at
  FROM public.install_attribution_tokens AS token
  WHERE token.token_hash = p_token_hash
    AND token.consumed_at IS NOT NULL
    AND token.redemption_key_hash = p_redemption_key_hash
    AND token.expires_at > now();

  GET DIAGNOSTICS matched_rows = ROW_COUNT;
  INSERT INTO public.install_attribution_audit (
    token_hash_prefix,
    action,
    outcome
  ) VALUES (
    left(p_token_hash, 12),
    'redeem',
    CASE WHEN matched_rows > 0 THEN 'same_key_retry' ELSE 'unavailable' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_install_attribution_token(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_install_attribution_token(text, text)
  TO service_role;

DO $$
DECLARE
  current_check text;
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  IF current_check LIKE '%native_install_attribution_joined%' THEN
    RETURN;
  END IF;

  ALTER TABLE public.user_events
    DROP CONSTRAINT user_events_event_type_check;

  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
    current_check,
    ARRAY['native_install_attribution_joined']
  );
END $$;

COMMENT ON TABLE public.install_attribution_tokens IS
  'Hashed, single-use Android install attribution tokens. Contains no account, device, location, or contact identity.';
COMMENT ON TABLE public.install_attribution_audit IS
  'Non-PII operational outcomes keyed only by a truncated token hash.';
COMMENT ON FUNCTION public.redeem_install_attribution_token(text, text) IS
  'Atomically consumes a valid token and lets the same hashed retry key recover a lost HTTP response.';

NOTIFY pgrst, 'reload schema';

COMMIT;
