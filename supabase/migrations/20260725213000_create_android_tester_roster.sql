-- Private operational Android tester roster.
-- Raw Google identity exists only in AES-256-GCM envelopes for unjoined
-- members. All app-visible evidence stages remain independent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.android_tester_roster_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  eligibility_status text NOT NULL DEFAULT 'eligible'
    CHECK (eligibility_status IN ('eligible', 'ineligible')),
  group_membership_status text NOT NULL DEFAULT 'active'
    CHECK (group_membership_status IN ('active', 'left')),
  eligibility_source text NOT NULL DEFAULT 'google_directory'
    CHECK (eligibility_source IN ('google_directory', 'manual')),
  eligibility_observed_at timestamptz NOT NULL,
  eligibility_confidence text NOT NULL DEFAULT 'verified'
    CHECK (eligibility_confidence IN ('verified', 'manual', 'unknown')),
  purge_after timestamptz,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (eligibility_status = 'eligible' AND purge_after IS NULL)
    OR eligibility_status = 'ineligible'
  )
);

CREATE TABLE IF NOT EXISTS public.android_tester_roster_identities (
  entry_id uuid PRIMARY KEY
    REFERENCES public.android_tester_roster_entries(id) ON DELETE CASCADE,
  key_version integer NOT NULL CHECK (key_version > 0),
  iv text NOT NULL CHECK (iv ~ '^[A-Za-z0-9_-]{16}$'),
  ciphertext text NOT NULL CHECK (ciphertext ~ '^[A-Za-z0-9_-]+$'),
  auth_tag text NOT NULL CHECK (auth_tag ~ '^[A-Za-z0-9_-]{22}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.android_tester_roster_stages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id uuid NOT NULL
    REFERENCES public.android_tester_roster_entries(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (
    stage IN (
      'group_eligibility',
      'play_opt_in',
      'install',
      'first_open',
      'account_join'
    )
  ),
  status text NOT NULL CHECK (
    status IN (
      'eligible',
      'ineligible',
      'unknown',
      'observed',
      'linked',
      'not_observed'
    )
  ),
  source text NOT NULL,
  observed_at timestamptz NOT NULL,
  confidence text NOT NULL CHECK (
    confidence IN ('verified', 'manual', 'attributed', 'unknown')
  ),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(evidence) = 'object'
    AND NOT (evidence ?| ARRAY[
      'email',
      'memberId',
      'member_id',
      'externalMemberId',
      'external_member_id'
    ])
    AND evidence::text !~ '@'
    AND (
      stage <> 'play_opt_in'
      OR source <> 'manual_google_play_console'
      OR (
        evidence ? 'code'
        AND evidence ? 'referenceId'
        AND evidence - ARRAY['code', 'referenceId'] = '{}'::jsonb
        AND evidence->>'code' = 'play_console_membership_review'
        AND COALESCE(evidence->>'referenceId', '') ~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      )
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.android_tester_roster_join_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL
    REFERENCES public.android_tester_roster_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  native_install_id uuid NOT NULL,
  idempotency_key_hash text NOT NULL UNIQUE CHECK (
    idempotency_key_hash ~ '^[a-f0-9]{64}$'
  ),
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, native_install_id)
);

CREATE TABLE IF NOT EXISTS public.android_tester_roster_install_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL
    REFERENCES public.android_tester_roster_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  native_install_id uuid NOT NULL,
  idempotency_key_hash text NOT NULL UNIQUE CHECK (
    idempotency_key_hash ~ '^[a-f0-9]{64}$'
  ),
  source text NOT NULL CONSTRAINT install_evidence_source_check CHECK (
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
  surface text NOT NULL CONSTRAINT install_evidence_surface_check CHECK (
    surface IN (
      'android_beta', 'landing-page', 'landing', 'download', 'features-page',
      'plans-page', 'partner_landing', 'invite_landing',
      'session_log_success', 'session_detail_fallback', 'app_handoff',
      'pbsc-page', 'og_session_card', 'og_surf_call_card', 'map'
    )
  ),
  placement text NOT NULL CONSTRAINT install_evidence_placement_check CHECK (
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
  campaign text NOT NULL CONSTRAINT install_evidence_campaign_check CHECK (
    campaign IN (
      'app_first_v1', 'pbsc_2026', 'partner_access', 'invite_access'
    )
  ),
  created_on date NOT NULL,
  expires_on date NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on >= created_on AND expires_on <= created_on + 30),
  UNIQUE (entry_id, native_install_id)
);

CREATE TABLE IF NOT EXISTS public.android_tester_roster_first_open_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL
    REFERENCES public.android_tester_roster_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  native_install_id uuid NOT NULL,
  idempotency_key_hash text NOT NULL UNIQUE CHECK (
    idempotency_key_hash ~ '^[a-f0-9]{64}$'
  ),
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, native_install_id)
);

CREATE TABLE IF NOT EXISTS public.android_tester_roster_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source = 'google_directory'),
  complete boolean NOT NULL,
  observed_at timestamptz NOT NULL,
  direct_user_count integer NOT NULL DEFAULT 0 CHECK (direct_user_count >= 0),
  added_count integer NOT NULL DEFAULT 0 CHECK (added_count >= 0),
  rejoined_count integer NOT NULL DEFAULT 0 CHECK (rejoined_count >= 0),
  refreshed_count integer NOT NULL DEFAULT 0 CHECK (refreshed_count >= 0),
  left_count integer NOT NULL DEFAULT 0 CHECK (left_count >= 0),
  purged_count integer NOT NULL DEFAULT 0 CHECK (purged_count >= 0),
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.android_tester_roster_sync_claims (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  claim_token uuid NOT NULL UNIQUE,
  claimed_at timestamptz NOT NULL,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.android_tester_roster_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entry_id uuid REFERENCES public.android_tester_roster_entries(id)
    ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN (
      'read_summary',
      'reveal_identity',
      'export_non_pii',
      'sync',
      'record_play_evidence',
      'record_install_evidence',
      'record_first_open',
      'join',
      'purge'
    )
  ),
  outcome text NOT NULL CHECK (
    outcome IN (
      'attempted',
      'succeeded',
      'failed',
      'linked',
      'same_key_retry',
      'pending',
      'terminal_invalid'
    )
  ),
  observed_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(evidence) = 'object'
    AND NOT (evidence ?| ARRAY[
      'email',
      'memberId',
      'member_id',
      'externalMemberId',
      'external_member_id',
      'ciphertext'
    ])
    AND evidence::text !~ '@'
  )
);

CREATE INDEX IF NOT EXISTS idx_android_tester_roster_entries_status
  ON public.android_tester_roster_entries(
    eligibility_status,
    eligibility_observed_at DESC
  );
CREATE INDEX IF NOT EXISTS idx_android_tester_roster_entries_purge
  ON public.android_tester_roster_entries(purge_after)
  WHERE purge_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_android_tester_roster_stages_entry_observed
  ON public.android_tester_roster_stages(entry_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_android_tester_roster_install_user
  ON public.android_tester_roster_install_evidence(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_android_tester_roster_join_user
  ON public.android_tester_roster_join_evidence(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_android_tester_roster_first_open_user
  ON public.android_tester_roster_first_open_evidence(
    user_id,
    observed_at DESC
  );
CREATE INDEX IF NOT EXISTS idx_android_tester_roster_sync_observed
  ON public.android_tester_roster_sync_runs(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_android_tester_roster_audit_observed
  ON public.android_tester_roster_audit(observed_at DESC);

ALTER TABLE public.android_tester_roster_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_tester_roster_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_tester_roster_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_tester_roster_join_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_tester_roster_install_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_tester_roster_first_open_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_tester_roster_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_tester_roster_sync_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.android_tester_roster_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.android_tester_roster_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_tester_roster_identities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_tester_roster_stages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_tester_roster_join_evidence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_tester_roster_install_evidence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_tester_roster_first_open_evidence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_tester_roster_sync_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_tester_roster_sync_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.android_tester_roster_audit FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.android_tester_roster_entries TO service_role;
GRANT ALL ON TABLE public.android_tester_roster_identities TO service_role;
GRANT SELECT, INSERT ON TABLE public.android_tester_roster_stages TO service_role;
GRANT ALL ON TABLE public.android_tester_roster_join_evidence TO service_role;
GRANT ALL ON TABLE public.android_tester_roster_install_evidence TO service_role;
GRANT ALL ON TABLE public.android_tester_roster_first_open_evidence TO service_role;
GRANT ALL ON TABLE public.android_tester_roster_sync_runs TO service_role;
GRANT ALL ON TABLE public.android_tester_roster_sync_claims TO service_role;
GRANT SELECT, INSERT ON TABLE public.android_tester_roster_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.android_tester_roster_stages_id_seq
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.android_tester_roster_audit_id_seq
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_android_tester_roster_audit(
  p_actor_user_id uuid,
  p_entry_id uuid,
  p_action text,
  p_outcome text,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF p_evidence ?| ARRAY[
      'email',
      'memberId',
      'member_id',
      'externalMemberId',
      'external_member_id',
      'ciphertext'
    ]
    OR p_evidence::text ~ '@' THEN
    RAISE EXCEPTION 'PII is not permitted in roster audit evidence';
  END IF;

  INSERT INTO public.android_tester_roster_audit (
    actor_user_id,
    entry_id,
    action,
    outcome,
    evidence
  ) VALUES (
    p_actor_user_id,
    p_entry_id,
    p_action,
    p_outcome,
    COALESCE(p_evidence, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_android_tester_roster_join_context(
  p_user_id uuid,
  p_idempotency_key_hash text
)
RETURNS TABLE (
  snapshot_complete boolean,
  already_linked boolean,
  candidates jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot_complete boolean := false;
  v_already_linked boolean := false;
  v_linked_entry_id uuid;
  v_candidates jsonb := '[]'::jsonb;
BEGIN
  IF p_idempotency_key_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;

  SELECT run.complete
  INTO v_snapshot_complete
  FROM public.android_tester_roster_sync_runs AS run
  ORDER BY run.observed_at DESC, run.created_at DESC
  LIMIT 1;

  SELECT join_evidence.entry_id
  INTO v_linked_entry_id
  FROM public.android_tester_roster_join_evidence AS join_evidence
  WHERE join_evidence.user_id = p_user_id
    AND join_evidence.idempotency_key_hash = p_idempotency_key_hash
  LIMIT 1;

  v_already_linked := v_linked_entry_id IS NOT NULL;
  IF v_already_linked THEN
    INSERT INTO public.android_tester_roster_audit (
      actor_user_id,
      entry_id,
      action,
      outcome
    ) VALUES (
      NULL,
      v_linked_entry_id,
      'join',
      'same_key_retry'
    );
  END IF;

  IF COALESCE(v_snapshot_complete, false) AND NOT v_already_linked THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'entry_id', entry.id,
          'key_version', identity.key_version,
          'iv', identity.iv,
          'ciphertext', identity.ciphertext,
          'auth_tag', identity.auth_tag
        )
        ORDER BY entry.created_at
      ),
      '[]'::jsonb
    )
    INTO v_candidates
    FROM public.android_tester_roster_entries AS entry
    JOIN public.android_tester_roster_identities AS identity
      ON identity.entry_id = entry.id
    WHERE entry.eligibility_status = 'eligible'
      AND entry.group_membership_status = 'active'
      AND entry.user_id IS NULL;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_snapshot_complete, false),
    v_already_linked,
    v_candidates;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_android_tester_roster_account(
  p_entry_id uuid,
  p_user_id uuid,
  p_native_install_id uuid,
  p_idempotency_key_hash text
)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry public.android_tester_roster_entries%ROWTYPE;
BEGIN
  IF p_idempotency_key_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN QUERY SELECT 'terminal_invalid'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_join_evidence AS join_evidence
    WHERE join_evidence.user_id = p_user_id
      AND join_evidence.idempotency_key_hash = p_idempotency_key_hash
  ) THEN
    INSERT INTO public.android_tester_roster_audit (
      actor_user_id,
      entry_id,
      action,
      outcome
    ) VALUES (
      NULL,
      p_entry_id,
      'join',
      'same_key_retry'
    );
    RETURN QUERY SELECT 'same_key_retry'::text;
    RETURN;
  END IF;

  SELECT entry.*
  INTO v_entry
  FROM public.android_tester_roster_entries AS entry
  WHERE entry.id = p_entry_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_join_evidence AS join_evidence
    WHERE join_evidence.user_id = p_user_id
      AND join_evidence.idempotency_key_hash = p_idempotency_key_hash
  ) THEN
    INSERT INTO public.android_tester_roster_audit (
      actor_user_id,
      entry_id,
      action,
      outcome
    ) VALUES (
      NULL,
      p_entry_id,
      'join',
      'same_key_retry'
    );
    RETURN QUERY SELECT 'same_key_retry'::text;
    RETURN;
  END IF;

  IF v_entry.id IS NULL
     OR v_entry.eligibility_status <> 'eligible'
     OR v_entry.group_membership_status <> 'active'
     OR (v_entry.user_id IS NOT NULL AND v_entry.user_id <> p_user_id)
     OR NOT EXISTS (
       SELECT 1
       FROM public.android_tester_roster_identities AS identity
       WHERE identity.entry_id = p_entry_id
     ) THEN
    RETURN QUERY SELECT 'pending_retryable'::text;
    RETURN;
  END IF;

  UPDATE public.android_tester_roster_entries
  SET
    user_id = p_user_id,
    linked_at = COALESCE(linked_at, now()),
    purge_after = NULL,
    updated_at = now()
  WHERE id = p_entry_id;

  INSERT INTO public.android_tester_roster_join_evidence (
    entry_id,
    user_id,
    native_install_id,
    idempotency_key_hash
  ) VALUES (
    p_entry_id,
    p_user_id,
    p_native_install_id,
    p_idempotency_key_hash
  );

  INSERT INTO public.android_tester_roster_stages (
    entry_id,
    stage,
    status,
    source,
    observed_at,
    confidence,
    evidence
  ) VALUES (
    p_entry_id,
    'account_join',
    'linked',
    'authenticated_roster_join',
    now(),
    'verified',
    '{}'::jsonb
  );

  DELETE FROM public.android_tester_roster_identities
  WHERE entry_id = p_entry_id;

  INSERT INTO public.android_tester_roster_audit (
    actor_user_id,
    entry_id,
    action,
    outcome,
    evidence
  ) VALUES (
    NULL,
    p_entry_id,
    'join',
    'linked',
    '{}'::jsonb
  );

  RETURN QUERY SELECT 'linked'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_android_tester_roster_install(
  p_user_id uuid,
  p_native_install_id uuid,
  p_idempotency_key_hash text,
  p_source text,
  p_surface text,
  p_placement text,
  p_campaign text,
  p_created_on date,
  p_expires_on date
)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_id uuid;
BEGIN
  IF p_idempotency_key_hash !~ '^[a-f0-9]{64}$'
     OR p_expires_on < p_created_on
     OR p_expires_on > p_created_on + 30 THEN
    RETURN QUERY SELECT 'terminal_invalid'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_install_evidence AS install
    WHERE install.user_id = p_user_id
      AND install.idempotency_key_hash = p_idempotency_key_hash
  ) THEN
    RETURN QUERY SELECT 'same_key_retry'::text;
    RETURN;
  END IF;

  SELECT entry.id
  INTO v_entry_id
  FROM public.android_tester_roster_entries AS entry
  WHERE entry.user_id = p_user_id
  FOR UPDATE;

  IF v_entry_id IS NULL THEN
    RETURN QUERY SELECT 'pending_retryable'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_install_evidence AS install
    WHERE install.user_id = p_user_id
      AND install.idempotency_key_hash = p_idempotency_key_hash
  ) THEN
    RETURN QUERY SELECT 'same_key_retry'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_install_evidence AS install
    WHERE install.entry_id = v_entry_id
      AND install.native_install_id = p_native_install_id
  ) THEN
    RETURN QUERY SELECT 'terminal_invalid'::text;
    RETURN;
  END IF;

  INSERT INTO public.android_tester_roster_install_evidence (
    entry_id,
    user_id,
    native_install_id,
    idempotency_key_hash,
    source,
    surface,
    placement,
    campaign,
    created_on,
    expires_on
  ) VALUES (
    v_entry_id,
    p_user_id,
    p_native_install_id,
    p_idempotency_key_hash,
    p_source,
    p_surface,
    p_placement,
    p_campaign,
    p_created_on,
    p_expires_on
  );

  INSERT INTO public.android_tester_roster_stages (
    entry_id,
    stage,
    status,
    source,
    observed_at,
    confidence,
    evidence
  ) VALUES (
    v_entry_id,
    'install',
    'observed',
    'bounded_install_attribution',
    now(),
    'attributed',
    jsonb_build_object(
      'source', p_source,
      'surface', p_surface,
      'placement', p_placement,
      'campaign', p_campaign,
      'createdOn', p_created_on,
      'expiresOn', p_expires_on
    )
  );

  INSERT INTO public.android_tester_roster_audit (
    actor_user_id,
    entry_id,
    action,
    outcome,
    evidence
  ) VALUES (
    NULL,
    v_entry_id,
    'record_install_evidence',
    'succeeded',
    '{}'::jsonb
  );

  RETURN QUERY SELECT 'observed'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_android_tester_roster_first_open(
  p_user_id uuid,
  p_native_install_id uuid,
  p_idempotency_key_hash text
)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_id uuid;
BEGIN
  IF p_idempotency_key_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN QUERY SELECT 'terminal_invalid'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_first_open_evidence AS first_open
    WHERE first_open.user_id = p_user_id
      AND first_open.idempotency_key_hash = p_idempotency_key_hash
  ) THEN
    RETURN QUERY SELECT 'same_key_retry'::text;
    RETURN;
  END IF;

  SELECT entry.id
  INTO v_entry_id
  FROM public.android_tester_roster_entries AS entry
  WHERE entry.user_id = p_user_id
  FOR UPDATE;

  IF v_entry_id IS NULL THEN
    RETURN QUERY SELECT 'pending_retryable'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_first_open_evidence AS first_open
    WHERE first_open.user_id = p_user_id
      AND first_open.idempotency_key_hash = p_idempotency_key_hash
  ) THEN
    RETURN QUERY SELECT 'same_key_retry'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_first_open_evidence AS first_open
    WHERE first_open.entry_id = v_entry_id
      AND first_open.native_install_id = p_native_install_id
  ) THEN
    RETURN QUERY SELECT 'terminal_invalid'::text;
    RETURN;
  END IF;

  INSERT INTO public.android_tester_roster_first_open_evidence (
    entry_id,
    user_id,
    native_install_id,
    idempotency_key_hash
  ) VALUES (
    v_entry_id,
    p_user_id,
    p_native_install_id,
    p_idempotency_key_hash
  );

  INSERT INTO public.android_tester_roster_stages (
    entry_id,
    stage,
    status,
    source,
    observed_at,
    confidence,
    evidence
  ) VALUES (
    v_entry_id,
    'first_open',
    'observed',
    'native_first_open_explicit',
    now(),
    'verified',
    '{}'::jsonb
  );

  INSERT INTO public.android_tester_roster_audit (
    actor_user_id,
    entry_id,
    action,
    outcome,
    evidence
  ) VALUES (
    NULL,
    v_entry_id,
    'record_first_open',
    'succeeded',
    '{}'::jsonb
  );

  RETURN QUERY SELECT 'observed'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_android_tester_roster_sync(
  p_actor_user_id uuid,
  p_observed_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate_token uuid := gen_random_uuid();
  v_acquired_token uuid;
BEGIN
  INSERT INTO public.android_tester_roster_sync_claims (
    singleton,
    claim_token,
    claimed_at,
    claimed_by
  ) VALUES (
    true,
    v_candidate_token,
    p_observed_at,
    p_actor_user_id
  )
  ON CONFLICT (singleton) DO UPDATE SET
    claim_token = EXCLUDED.claim_token,
    claimed_at = EXCLUDED.claimed_at,
    claimed_by = EXCLUDED.claimed_by
  WHERE public.android_tester_roster_sync_claims.claimed_at
    <= p_observed_at - interval '15 minutes'
  RETURNING claim_token INTO v_acquired_token;

  RETURN v_acquired_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_android_tester_roster_sync_claim(
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.android_tester_roster_sync_claims
  WHERE singleton
    AND claim_token = p_claim_token;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_android_tester_roster_sync_identities()
RETURNS TABLE (
  entry_id uuid,
  user_id uuid,
  eligibility_status text,
  purge_after timestamptz,
  key_version integer,
  iv text,
  ciphertext text,
  auth_tag text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    entry.id,
    entry.user_id,
    entry.eligibility_status,
    entry.purge_after,
    identity.key_version,
    identity.iv,
    identity.ciphertext,
    identity.auth_tag
  FROM public.android_tester_roster_entries AS entry
  LEFT JOIN public.android_tester_roster_identities AS identity
    ON identity.entry_id = entry.id
  WHERE entry.user_id IS NOT NULL
    OR identity.entry_id IS NOT NULL
  ORDER BY entry.created_at;
$$;

CREATE OR REPLACE FUNCTION public.apply_android_tester_roster_snapshot(
  p_actor_user_id uuid,
  p_claim_token uuid,
  p_snapshot_complete boolean,
  p_observed_at timestamptz,
  p_observations jsonb,
  p_direct_user_count integer,
  p_failure_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  observation jsonb;
  v_entry_id uuid;
  v_claim_token uuid;
  v_sync_run_id uuid;
  v_changed integer := 0;
  v_added integer := 0;
  v_rejoined integer := 0;
  v_refreshed integer := 0;
  v_left integer := 0;
  v_purged integer := 0;
BEGIN
  SELECT claim.claim_token
  INTO v_claim_token
  FROM public.android_tester_roster_sync_claims AS claim
  WHERE claim.singleton
    AND claim.claim_token = p_claim_token
  FOR UPDATE;

  IF v_claim_token IS NULL THEN
    RAISE EXCEPTION 'Android tester roster sync claim unavailable';
  END IF;

  INSERT INTO public.android_tester_roster_sync_runs (
    source,
    complete,
    observed_at,
    direct_user_count,
    failure_code
  ) VALUES (
    'google_directory',
    p_snapshot_complete,
    p_observed_at,
    GREATEST(COALESCE(p_direct_user_count, 0), 0),
    p_failure_code
  )
  RETURNING id INTO v_sync_run_id;

  IF NOT p_snapshot_complete THEN
    INSERT INTO public.android_tester_roster_audit (
      actor_user_id,
      action,
      outcome,
      evidence
    ) VALUES (
      p_actor_user_id,
      'sync',
      'failed',
      jsonb_build_object('failureCode', COALESCE(p_failure_code, 'incomplete'))
    );
    DELETE FROM public.android_tester_roster_sync_claims
    WHERE singleton
      AND claim_token = p_claim_token;
    RETURN jsonb_build_object('complete', false);
  END IF;

  FOR observation IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_observations, '[]'::jsonb))
  LOOP
    IF observation->>'kind' = 'new' THEN
      INSERT INTO public.android_tester_roster_entries (
        eligibility_status,
        group_membership_status,
        eligibility_source,
        eligibility_observed_at,
        eligibility_confidence
      ) VALUES (
        'eligible',
        'active',
        'google_directory',
        p_observed_at,
        'verified'
      )
      RETURNING id INTO v_entry_id;

      INSERT INTO public.android_tester_roster_identities (
        entry_id,
        key_version,
        iv,
        ciphertext,
        auth_tag
      ) VALUES (
        v_entry_id,
        (observation->>'keyVersion')::integer,
        observation->>'iv',
        observation->>'ciphertext',
        observation->>'authTag'
      );

      INSERT INTO public.android_tester_roster_stages (
        entry_id,
        stage,
        status,
        source,
        observed_at,
        confidence,
        evidence
      ) VALUES
        (
          v_entry_id,
          'play_opt_in',
          'unknown',
          'roster_initial_state',
          p_observed_at,
          'unknown',
          '{}'::jsonb
        ),
        (
          v_entry_id,
          'install',
          'unknown',
          'roster_initial_state',
          p_observed_at,
          'unknown',
          '{}'::jsonb
        ),
        (
          v_entry_id,
          'first_open',
          'unknown',
          'roster_initial_state',
          p_observed_at,
          'unknown',
          '{}'::jsonb
        ),
        (
          v_entry_id,
          'account_join',
          'unknown',
          'roster_initial_state',
          p_observed_at,
          'unknown',
          '{}'::jsonb
        );
      v_added := v_added + 1;
    ELSIF observation->>'kind' = 'seen' THEN
      v_entry_id := (observation->>'entryId')::uuid;
      UPDATE public.android_tester_roster_entries
      SET
        eligibility_observed_at = p_observed_at,
        updated_at = now()
      WHERE id = v_entry_id
        AND eligibility_status = 'eligible';
    ELSIF observation->>'kind' = 'rejoined' THEN
      v_entry_id := (observation->>'entryId')::uuid;
      UPDATE public.android_tester_roster_entries
      SET
        eligibility_status = 'eligible',
        group_membership_status = 'active',
        eligibility_observed_at = p_observed_at,
        eligibility_confidence = 'verified',
        purge_after = NULL,
        updated_at = now()
      WHERE id = v_entry_id
        AND user_id IS NULL;

      INSERT INTO public.android_tester_roster_identities (
        entry_id,
        key_version,
        iv,
        ciphertext,
        auth_tag
      )
      SELECT
        v_entry_id,
        (observation->>'keyVersion')::integer,
        observation->>'iv',
        observation->>'ciphertext',
        observation->>'authTag'
      WHERE EXISTS (
        SELECT 1
        FROM public.android_tester_roster_entries AS entry
        WHERE entry.id = v_entry_id
          AND entry.user_id IS NULL
      )
      ON CONFLICT (entry_id) DO UPDATE SET
        key_version = EXCLUDED.key_version,
        iv = EXCLUDED.iv,
        ciphertext = EXCLUDED.ciphertext,
        auth_tag = EXCLUDED.auth_tag,
        updated_at = now();
      v_rejoined := v_rejoined + 1;
    ELSIF observation->>'kind' = 'identity_refresh' THEN
      v_entry_id := (observation->>'entryId')::uuid;
      UPDATE public.android_tester_roster_entries
      SET
        eligibility_observed_at = p_observed_at,
        updated_at = now()
      WHERE id = v_entry_id
        AND eligibility_status = 'eligible'
        AND user_id IS NULL;

      INSERT INTO public.android_tester_roster_identities (
        entry_id,
        key_version,
        iv,
        ciphertext,
        auth_tag
      )
      SELECT
        v_entry_id,
        (observation->>'keyVersion')::integer,
        observation->>'iv',
        observation->>'ciphertext',
        observation->>'authTag'
      WHERE EXISTS (
        SELECT 1
        FROM public.android_tester_roster_entries AS entry
        WHERE entry.id = v_entry_id
          AND entry.user_id IS NULL
      )
      ON CONFLICT (entry_id) DO UPDATE SET
        key_version = EXCLUDED.key_version,
        iv = EXCLUDED.iv,
        ciphertext = EXCLUDED.ciphertext,
        auth_tag = EXCLUDED.auth_tag,
        updated_at = now();
      GET DIAGNOSTICS v_changed = ROW_COUNT;
      v_refreshed := v_refreshed + v_changed;
    ELSIF observation->>'kind' = 'rejoined_linked' THEN
      v_entry_id := (observation->>'entryId')::uuid;
      UPDATE public.android_tester_roster_entries
      SET
        eligibility_status = 'eligible',
        group_membership_status = 'active',
        eligibility_observed_at = p_observed_at,
        eligibility_confidence = 'verified',
        purge_after = NULL,
        updated_at = now()
      WHERE id = v_entry_id
        AND user_id IS NOT NULL;
      v_rejoined := v_rejoined + 1;
    ELSIF observation->>'kind' = 'left' THEN
      v_entry_id := (observation->>'entryId')::uuid;
      PERFORM 1
      FROM public.android_tester_roster_entries AS entry
      WHERE entry.id = v_entry_id
      FOR UPDATE;

      UPDATE public.android_tester_roster_entries
      SET
        eligibility_status = 'ineligible',
        group_membership_status = 'left',
        eligibility_observed_at = p_observed_at,
        purge_after = p_observed_at + interval '30 days',
        updated_at = now()
      WHERE id = v_entry_id
        AND user_id IS NULL;
      GET DIAGNOSTICS v_changed = ROW_COUNT;
      v_left := v_left + v_changed;
      IF v_changed = 0 THEN
        CONTINUE;
      END IF;
    ELSIF observation->>'kind' = 'left_linked' THEN
      v_entry_id := (observation->>'entryId')::uuid;
      UPDATE public.android_tester_roster_entries
      SET
        eligibility_status = 'ineligible',
        group_membership_status = 'left',
        eligibility_observed_at = p_observed_at,
        purge_after = NULL,
        updated_at = now()
      WHERE id = v_entry_id
        AND user_id IS NOT NULL;
      v_left := v_left + 1;
    ELSE
      RAISE EXCEPTION 'Unsupported roster observation';
    END IF;

    INSERT INTO public.android_tester_roster_stages (
      entry_id,
      stage,
      status,
      source,
      observed_at,
      confidence,
      evidence
    ) VALUES (
      v_entry_id,
      'group_eligibility',
      CASE
        WHEN observation->>'kind' IN ('left', 'left_linked')
          THEN 'ineligible'
        ELSE 'eligible'
      END,
      'google_directory',
      p_observed_at,
      'verified',
      '{}'::jsonb
    );
  END LOOP;

  DELETE FROM public.android_tester_roster_identities AS identity
  USING public.android_tester_roster_entries AS entry
  WHERE identity.entry_id = entry.id
    AND entry.user_id IS NULL
    AND entry.eligibility_status = 'ineligible'
    AND entry.purge_after <= p_observed_at;
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  UPDATE public.android_tester_roster_sync_runs
  SET
    added_count = v_added,
    rejoined_count = v_rejoined,
    refreshed_count = v_refreshed,
    left_count = v_left,
    purged_count = v_purged
  WHERE id = v_sync_run_id;

  INSERT INTO public.android_tester_roster_audit (
    actor_user_id,
    action,
    outcome,
    evidence
  ) VALUES (
    p_actor_user_id,
    'sync',
    'succeeded',
    jsonb_build_object(
      'directUserCount', p_direct_user_count,
      'addedCount', v_added,
      'rejoinedCount', v_rejoined,
      'refreshedCount', v_refreshed,
      'leftCount', v_left,
      'purgedCount', v_purged
    )
  );

  DELETE FROM public.android_tester_roster_sync_claims
  WHERE singleton
    AND claim_token = p_claim_token;

  RETURN jsonb_build_object(
    'complete', true,
    'addedCount', v_added,
    'rejoinedCount', v_rejoined,
    'refreshedCount', v_refreshed,
    'leftCount', v_left,
    'purgedCount', v_purged
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_android_tester_roster_identities(
  p_actor_user_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purged integer;
BEGIN
  DELETE FROM public.android_tester_roster_identities AS identity
  USING public.android_tester_roster_entries AS entry
  WHERE identity.entry_id = entry.id
    AND entry.user_id IS NULL
    AND entry.eligibility_status = 'ineligible'
    AND entry.purge_after <= p_now;
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  INSERT INTO public.android_tester_roster_audit (
    actor_user_id,
    action,
    outcome,
    evidence
  ) VALUES (
    p_actor_user_id,
    'purge',
    'succeeded',
    jsonb_build_object('purgedCount', v_purged)
  );

  RETURN v_purged;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_android_tester_roster_stage(
  p_actor_user_id uuid,
  p_entry_id uuid,
  p_stage text,
  p_status text,
  p_source text,
  p_observed_at timestamptz,
  p_confidence text,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage_id bigint;
BEGIN
  IF p_stage <> 'play_opt_in'
     OR p_status NOT IN ('observed', 'not_observed')
     OR p_source <> 'manual_google_play_console'
     OR p_confidence <> 'manual'
     OR jsonb_typeof(COALESCE(p_evidence, 'null'::jsonb)) <> 'object'
     OR NOT p_evidence ? 'code'
     OR NOT p_evidence ? 'referenceId'
     OR p_evidence - ARRAY['code', 'referenceId'] <> '{}'::jsonb
     OR p_evidence->>'code' <> 'play_console_membership_review'
     OR COALESCE(p_evidence->>'referenceId', '') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN
    RAISE EXCEPTION 'Invalid Play evidence';
  END IF;

  INSERT INTO public.android_tester_roster_stages (
    entry_id,
    stage,
    status,
    source,
    observed_at,
    confidence,
    evidence
  ) VALUES (
    p_entry_id,
    p_stage,
    p_status,
    p_source,
    p_observed_at,
    p_confidence,
    COALESCE(p_evidence, '{}'::jsonb)
  )
  RETURNING id INTO v_stage_id;

  INSERT INTO public.android_tester_roster_audit (
    actor_user_id,
    entry_id,
    action,
    outcome,
    evidence
  ) VALUES (
    p_actor_user_id,
    p_entry_id,
    'record_play_evidence',
    'succeeded',
    jsonb_build_object('stageId', v_stage_id)
  );

  RETURN v_stage_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_android_tester_roster_summary()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH latest_stage AS (
    SELECT DISTINCT ON (entry_id, stage)
      entry_id,
      stage,
      status
    FROM public.android_tester_roster_stages
    ORDER BY entry_id, stage, observed_at DESC, id DESC
  )
  SELECT jsonb_build_object(
    'eligible', (
      SELECT count(*)
      FROM public.android_tester_roster_entries
      WHERE eligibility_status = 'eligible'
    ),
    'ineligible', (
      SELECT count(*)
      FROM public.android_tester_roster_entries
      WHERE eligibility_status = 'ineligible'
    ),
    'linkedAccounts', (
      SELECT count(*)
      FROM public.android_tester_roster_entries
      WHERE user_id IS NOT NULL
    ),
    'unjoinedIdentities', (
      SELECT count(*)
      FROM public.android_tester_roster_entries AS entry
      WHERE entry.user_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.android_tester_roster_identities AS identity
          WHERE identity.entry_id = entry.id
        )
    ),
    'purgeScheduled', (
      SELECT count(*)
      FROM public.android_tester_roster_entries
      WHERE purge_after IS NOT NULL
    ),
    'stageCounts', jsonb_build_object(
      'group_eligibility', jsonb_build_object(
        'eligible', count(*) FILTER (
          WHERE stage = 'group_eligibility' AND status = 'eligible'
        ),
        'ineligible', count(*) FILTER (
          WHERE stage = 'group_eligibility' AND status = 'ineligible'
        ),
        'unknown', count(*) FILTER (
          WHERE stage = 'group_eligibility' AND status = 'unknown'
        )
      ),
      'play_opt_in', jsonb_build_object(
        'observed', count(*) FILTER (
          WHERE stage = 'play_opt_in' AND status = 'observed'
        ),
        'notObserved', count(*) FILTER (
          WHERE stage = 'play_opt_in' AND status = 'not_observed'
        ),
        'unknown', count(*) FILTER (
          WHERE stage = 'play_opt_in' AND status = 'unknown'
        )
      ),
      'install', jsonb_build_object(
        'observed', count(*) FILTER (
          WHERE stage = 'install' AND status = 'observed'
        ),
        'unknown', count(*) FILTER (
          WHERE stage = 'install' AND status = 'unknown'
        )
      ),
      'first_open', jsonb_build_object(
        'observed', count(*) FILTER (
          WHERE stage = 'first_open' AND status = 'observed'
        ),
        'unknown', count(*) FILTER (
          WHERE stage = 'first_open' AND status = 'unknown'
        )
      ),
      'account_join', jsonb_build_object(
        'linked', count(*) FILTER (
          WHERE stage = 'account_join' AND status = 'linked'
        ),
        'unknown', count(*) FILTER (
          WHERE stage = 'account_join' AND status = 'unknown'
        )
      )
    )
  )
  FROM latest_stage;
$$;

CREATE OR REPLACE FUNCTION public.export_android_tester_roster_non_pii()
RETURNS TABLE (
  entry_id uuid,
  eligibility_status text,
  group_membership_status text,
  eligibility_source text,
  eligibility_observed_at timestamptz,
  eligibility_confidence text,
  purge_after timestamptz,
  linked boolean,
  stage text,
  stage_status text,
  stage_source text,
  stage_observed_at timestamptz,
  stage_confidence text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    entry.id,
    entry.eligibility_status,
    entry.group_membership_status,
    entry.eligibility_source,
    entry.eligibility_observed_at,
    entry.eligibility_confidence,
    entry.purge_after,
    entry.user_id IS NOT NULL,
    stage.stage,
    stage.status,
    stage.source,
    stage.observed_at,
    stage.confidence
  FROM public.android_tester_roster_entries AS entry
  LEFT JOIN public.android_tester_roster_stages AS stage
    ON stage.entry_id = entry.id
  ORDER BY entry.created_at, stage.observed_at;
$$;

CREATE OR REPLACE FUNCTION public.delete_android_tester_roster_for_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.android_tester_roster_audit
  SET
    actor_user_id = NULL,
    evidence = '{}'::jsonb
  WHERE actor_user_id = NEW.id
    OR entry_id IN (
      SELECT entry.id
      FROM public.android_tester_roster_entries AS entry
      WHERE entry.user_id = NEW.id
    );

  DELETE FROM public.android_tester_roster_entries
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_android_tester_roster_for_account
  ON public.profiles;
CREATE TRIGGER trg_delete_android_tester_roster_for_account
  AFTER UPDATE OF deleted_at ON public.profiles
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION public.delete_android_tester_roster_for_account();

REVOKE ALL ON FUNCTION public.record_android_tester_roster_audit(uuid, uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_android_tester_roster_audit(uuid, uuid, text, text, jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.get_android_tester_roster_join_context(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_android_tester_roster_join_context(uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.link_android_tester_roster_account(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_android_tester_roster_account(uuid, uuid, uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.record_android_tester_roster_install(uuid, uuid, text, text, text, text, text, date, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_android_tester_roster_install(uuid, uuid, text, text, text, text, text, date, date)
  TO service_role;
REVOKE ALL ON FUNCTION public.record_android_tester_roster_first_open(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_android_tester_roster_first_open(uuid, uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.claim_android_tester_roster_sync(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_android_tester_roster_sync(uuid, timestamptz)
  TO service_role;
REVOKE ALL ON FUNCTION public.release_android_tester_roster_sync_claim(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_android_tester_roster_sync_claim(uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.get_android_tester_roster_sync_identities()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_android_tester_roster_sync_identities()
  TO service_role;
REVOKE ALL ON FUNCTION public.apply_android_tester_roster_snapshot(uuid, uuid, boolean, timestamptz, jsonb, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_android_tester_roster_snapshot(uuid, uuid, boolean, timestamptz, jsonb, integer, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.purge_android_tester_roster_identities(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_android_tester_roster_identities(uuid, timestamptz)
  TO service_role;
REVOKE ALL ON FUNCTION public.record_android_tester_roster_stage(uuid, uuid, text, text, text, timestamptz, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_android_tester_roster_stage(uuid, uuid, text, text, text, timestamptz, text, jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.get_android_tester_roster_summary()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_android_tester_roster_summary()
  TO service_role;
REVOKE ALL ON FUNCTION public.export_android_tester_roster_non_pii()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_android_tester_roster_non_pii()
  TO service_role;
REVOKE ALL ON FUNCTION public.delete_android_tester_roster_for_account()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.android_tester_roster_entries IS
  'Private operational Android tester eligibility records. Linked rows retain only Quiver user linkage and non-PII evidence.';
COMMENT ON TABLE public.android_tester_roster_identities IS
  'AES-256-GCM identity envelopes for eligible unjoined direct Google Group users. Deleted immediately on account join or when retention expires.';
COMMENT ON TABLE public.android_tester_roster_stages IS
  'Append-only independent roster evidence stages. No stage implies another.';
COMMENT ON TABLE public.android_tester_roster_join_evidence IS
  'Idempotent authenticated account-join receipts, deleted with the linked account.';
COMMENT ON TABLE public.android_tester_roster_install_evidence IS
  'Idempotent bounded install-attribution receipts, independent of account join.';
COMMENT ON TABLE public.android_tester_roster_first_open_evidence IS
  'Idempotent explicit native first-open receipts, independent of install attribution.';
COMMENT ON TABLE public.android_tester_roster_audit IS
  'Append-only mandatory admin and join audit without raw external identity.';

NOTIFY pgrst, 'reload schema';

COMMIT;
