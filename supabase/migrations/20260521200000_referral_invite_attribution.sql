BEGIN;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS source text;

UPDATE public.referrals
SET source = 'referral_code'
WHERE source IS NULL;

ALTER TABLE public.referrals
  ALTER COLUMN source SET DEFAULT 'referral_code',
  ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.referrals'::regclass
      AND conname = 'referrals_source_check'
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_source_check
      CHECK (source IN ('referral_code', 'invite_token'))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.referrals VALIDATE CONSTRAINT referrals_source_check;

CREATE INDEX IF NOT EXISTS idx_referrals_source
  ON public.referrals (source);

COMMENT ON COLUMN public.referrals.source IS
  'Attribution source for the referral row: referral_code for explicit code claims, invite_token for accepted invite links.';

DROP FUNCTION IF EXISTS public.accept_invite_for_user(uuid, uuid);
DROP FUNCTION IF EXISTS public.record_referral_attribution(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.record_referral_attribution(
  referrer uuid,
  referee uuid,
  source text,
  referral_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_code text;
  v_attribution_code text;
  v_inserted_id uuid;
  v_existing_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM $2 THEN
    RAISE EXCEPTION 'referee mismatch: must match auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  IF $1 IS NULL OR $2 IS NULL THEN
    RAISE EXCEPTION 'referrer and referee are required'
      USING ERRCODE = '22023';
  END IF;

  IF $1 = $2 THEN
    RAISE EXCEPTION 'cannot refer yourself'
      USING ERRCODE = '22023';
  END IF;

  IF $3 NOT IN ('referral_code', 'invite_token') THEN
    RAISE EXCEPTION 'invalid referral source: %', $3
      USING ERRCODE = '22023';
  END IF;

  SELECT p.referral_code
    INTO v_referrer_code
    FROM public.profiles p
    WHERE p.id = $1
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'referrer profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_referrer_code IS NULL THEN
    v_referrer_code := public.generate_referral_code();

    UPDATE public.profiles p
      SET referral_code = v_referrer_code
      WHERE p.id = $1
        AND p.referral_code IS NULL
      RETURNING p.referral_code
      INTO v_referrer_code;
  END IF;

  v_attribution_code := COALESCE(NULLIF(upper(trim($4)), ''), v_referrer_code);

  INSERT INTO public.referrals (
    referrer_id,
    referee_id,
    referral_code,
    status,
    source
  ) VALUES (
    $1,
    $2,
    v_attribution_code,
    'pending',
    $3
  )
  ON CONFLICT (referee_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'created', true,
      'existing', false,
      'referral_id', v_inserted_id,
      'source', $3
    );
  END IF;

  SELECT r.id
    INTO v_existing_id
    FROM public.referrals r
    WHERE r.referee_id = $2;

  RETURN jsonb_build_object(
    'created', false,
    'existing', true,
    'referral_id', v_existing_id,
    'source', $3
  );
END;
$$;

COMMENT ON FUNCTION public.record_referral_attribution(uuid, uuid, text, text) IS
  'Creates one idempotent referral attribution row for the authenticated referee.';

CREATE OR REPLACE FUNCTION public.accept_invite_for_user(
  inviter uuid,
  invitee uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follow_id uuid;
  v_follow_created boolean;
  v_referral_result jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM $2 THEN
    RAISE EXCEPTION 'invitee mismatch: must match auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  IF $1 IS NULL OR $2 IS NULL THEN
    RAISE EXCEPTION 'inviter and invitee are required'
      USING ERRCODE = '22023';
  END IF;

  IF $1 = $2 THEN
    RAISE EXCEPTION 'cannot accept your own invite'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES ($2, $1)
  ON CONFLICT (follower_id, following_id) DO NOTHING
  RETURNING id INTO v_follow_id;

  v_follow_created := v_follow_id IS NOT NULL;

  v_referral_result := public.record_referral_attribution(
    $1,
    $2,
    'invite_token',
    NULL
  );

  RETURN jsonb_build_object(
    'follow_created', v_follow_created,
    'follow_existing', NOT v_follow_created,
    'referral_created', COALESCE((v_referral_result->>'created')::boolean, false),
    'referral_existing', COALESCE((v_referral_result->>'existing')::boolean, false)
  );
END;
$$;

COMMENT ON FUNCTION public.accept_invite_for_user(uuid, uuid) IS
  'Accepts an invite for the authenticated invitee by creating the follow edge and referral attribution idempotently.';

GRANT EXECUTE ON FUNCTION public.record_referral_attribution(uuid, uuid, text, text)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.accept_invite_for_user(uuid, uuid)
  TO authenticated, service_role;

COMMIT;
