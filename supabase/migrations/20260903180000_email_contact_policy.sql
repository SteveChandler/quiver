BEGIN;

-- Private execution state. No client policies: only service_role may access it.
CREATE TABLE public.email_contact_controls (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  daily_cap integer NOT NULL DEFAULT 15 CHECK (daily_cap BETWEEN 1 AND 15)
);
INSERT INTO public.email_contact_controls (singleton) VALUES (true);

CREATE TABLE public.email_contact_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_campaign text,
  marketing_consent_at timestamptz,
  consent_reference text,
  history_reviewed_at timestamptz,
  trial_eligible_until timestamptz,
  trial_eligibility_reference text,
  paused_at timestamptz,
  reply_received_at timestamptz
);

CREATE TABLE public.email_contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  provider_id text UNIQUE,
  sent_at timestamptz,
  CHECK ((provider_id IS NULL) = (sent_at IS NULL))
);
CREATE INDEX email_contact_attempts_user_time ON public.email_contact_attempts(user_id, claimed_at DESC);
CREATE INDEX email_contact_attempts_time ON public.email_contact_attempts(claimed_at);

CREATE TABLE public.email_reply_events (
  provider_id text PRIMARY KEY,
  webhook_id text NOT NULL,
  sender text NOT NULL,
  received_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_reply_events_sender ON public.email_reply_events(sender);

ALTER TABLE public.email_contact_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_contact_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_reply_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_contact_controls, public.email_contact_state,
  public.email_contact_attempts, public.email_reply_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_contact_controls, public.email_contact_state,
  public.email_contact_attempts, public.email_reply_events TO service_role;

CREATE FUNCTION public.claim_email_contact(p_user_id uuid, p_email text, p_email_type text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_state public.email_contact_state%ROWTYPE;
  v_attempt uuid;
  v_acquisition boolean;
  v_cap integer;
BEGIN
  IF p_email_type IS NULL OR p_email_type NOT IN ('trial_invitation', 'founder_story', 'first_session_nudge', 'weekly_recap', 'session_prompt', 'trial_started', 'trial_ended') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unsupported_email_type');
  END IF;
  -- ponytail: serialize this small campaign; shard only if send volume requires it.
  PERFORM pg_advisory_xact_lock(739301);
  SELECT daily_cap INTO v_cap FROM public.email_contact_controls WHERE singleton AND enabled;
  IF v_cap IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'disabled');
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR lower(trim(v_profile.email)) IS DISTINCT FROM lower(trim(p_email))
    OR v_profile.analytics_is_real_user IS DISTINCT FROM true
    OR v_profile.notif_email_enabled IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'ineligible_profile');
  END IF;
  IF (SELECT count(*) FROM public.profiles WHERE lower(trim(email)) = lower(trim(p_email))) <> 1 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'ambiguous_recipient');
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_suppression_list WHERE lower(email) = lower(trim(p_email)))
    OR EXISTS (SELECT 1 FROM public.user_email_prefs WHERE user_id = p_user_id AND email_frequency = 'off') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'suppressed');
  END IF;
  v_acquisition := p_email_type IN ('trial_invitation', 'founder_story');
  SELECT * INTO v_state FROM public.email_contact_state WHERE user_id = p_user_id;
  IF v_state.paused_at IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'reply_paused');
  END IF;
  IF v_acquisition THEN
    IF v_state.marketing_consent_at IS NULL OR v_state.marketing_consent_at > now() OR nullif(trim(v_state.consent_reference), '') IS NULL
      OR nullif(trim(v_state.approved_campaign), '') IS NULL OR v_state.history_reviewed_at IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'missing_consent_or_review');
    END IF;
    IF v_state.trial_eligible_until IS NULL OR v_state.trial_eligible_until <= now()
      OR nullif(trim(v_state.trial_eligibility_reference), '') IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'trial_eligibility_unverified');
    END IF;
    IF v_profile.onboarding_completed_at IS NULL OR v_profile.home_beach_id IS NULL
      OR v_profile.created_at IS NULL OR v_profile.created_at > now() - interval '3 days' THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'ineligible_profile');
    END IF;
    -- Conservative: prior trials and promo access also prevent repeat acquisition.
    IF EXISTS (SELECT 1 FROM public.user_entitlements WHERE user_id = p_user_id) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'entitlement');
    END IF;
    IF EXISTS (SELECT 1 FROM public.email_reply_events WHERE sender = lower(trim(p_email))) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'reply_paused');
    END IF;
    IF EXISTS (SELECT 1 FROM public.email_send_log WHERE user_id = p_user_id
      AND email_type = p_email_type AND resend_message_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.email_contact_attempts WHERE user_id = p_user_id AND email_type = p_email_type) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'already_attempted');
    END IF;
  END IF;
  IF p_email_type = 'trial_started' AND NOT EXISTS (SELECT 1 FROM public.user_entitlements
    WHERE user_id = p_user_id AND is_trialing AND trial_ends_at > now()) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'trial_not_active');
  END IF;
  IF p_email_type = 'trial_ended' AND NOT EXISTS (SELECT 1 FROM public.user_entitlements
    WHERE user_id = p_user_id AND NOT is_pro AND NOT is_trialing AND lapsed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'trial_not_lapsed');
  END IF;
  -- A timeout is unresolved, not permission to retry tomorrow with a new key.
  IF EXISTS (SELECT 1 FROM public.email_contact_attempts WHERE user_id = p_user_id AND provider_id IS NULL) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unresolved_attempt');
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_contact_attempts WHERE user_id = p_user_id AND claimed_at > now() - interval '72 hours')
    OR EXISTS (SELECT 1 FROM public.email_send_log WHERE user_id = p_user_id AND resend_message_id IS NOT NULL
      AND sent_at > now() - CASE WHEN v_acquisition THEN interval '7 days' ELSE interval '72 hours' END) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'contact_cooldown');
  END IF;
  IF (SELECT count(*) FROM public.email_contact_attempts
      WHERE claimed_at >= date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles')
    + (SELECT count(*) FROM public.email_send_log l WHERE l.resend_message_id IS NOT NULL
      AND l.email_type IN ('trial_invitation', 'founder_story', 'first_session_nudge', 'weekly_recap', 'session_prompt', 'trial_started', 'trial_ended')
      AND l.sent_at >= date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'
      AND NOT EXISTS (SELECT 1 FROM public.email_contact_attempts a WHERE a.provider_id = l.resend_message_id)) >= v_cap THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_cap');
  END IF;
  INSERT INTO public.email_contact_attempts(user_id, email_type) VALUES (p_user_id, p_email_type) RETURNING id INTO v_attempt;
  RETURN jsonb_build_object('allowed', true, 'attempt_id', v_attempt);
END;
$$;

CREATE FUNCTION public.finish_email_contact(p_attempt_id uuid, p_provider_id text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF nullif(trim(p_provider_id), '') IS NULL THEN RAISE EXCEPTION 'Missing provider ID'; END IF;
  UPDATE public.email_contact_attempts SET provider_id = p_provider_id, sent_at = coalesce(sent_at, now())
    WHERE id = p_attempt_id AND (provider_id IS NULL OR provider_id = p_provider_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing or conflicting email attempt'; END IF;
END;
$$;

CREATE FUNCTION public.record_email_reply(p_event_id text, p_webhook_id text, p_sender text, p_received_at timestamptz)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_sender text;
  v_received_at timestamptz;
BEGIN
  IF nullif(trim(p_event_id), '') IS NULL OR nullif(trim(p_sender), '') IS NULL
    OR p_received_at IS NULL THEN RAISE EXCEPTION 'Invalid inbound metadata'; END IF;
  PERFORM pg_advisory_xact_lock(739301);
  INSERT INTO public.email_reply_events(provider_id, webhook_id, sender, received_at)
    VALUES (p_event_id, p_webhook_id, lower(trim(p_sender)), p_received_at)
    ON CONFLICT (provider_id) DO NOTHING;
  SELECT sender, received_at INTO v_sender, v_received_at FROM public.email_reply_events WHERE provider_id = p_event_id;
  -- Exact email matching only; no fuzzy names or model-based identity inference.
  INSERT INTO public.email_contact_state(user_id, paused_at, reply_received_at)
    SELECT id, now(), v_received_at FROM public.profiles WHERE lower(trim(email)) = v_sender
    ON CONFLICT (user_id) DO UPDATE SET paused_at = coalesce(email_contact_state.paused_at, now()),
      reply_received_at = greatest(email_contact_state.reply_received_at, EXCLUDED.reply_received_at);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_contact(uuid, text, text),
  public.finish_email_contact(uuid, text), public.record_email_reply(text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_contact(uuid, text, text),
  public.finish_email_contact(uuid, text), public.record_email_reply(text, text, text, timestamptz) TO service_role;
COMMIT;
