-- Extend the existing single-use install token with bounded exact-call context.

BEGIN;

ALTER TABLE public.install_attribution_tokens
  ADD COLUMN IF NOT EXISTS handoff_id uuid,
  ADD COLUMN IF NOT EXISTS handoff_context jsonb;

ALTER TABLE public.install_attribution_tokens
  ADD CONSTRAINT install_attribution_tokens_handoff_pair_check CHECK (
    (handoff_id IS NULL AND handoff_context IS NULL)
    OR (
      handoff_id IS NOT NULL
      AND handoff_context IS NOT NULL
      AND jsonb_typeof(handoff_context) = 'object'
      AND pg_column_size(handoff_context) <= 4096
    )
  );

DROP FUNCTION public.redeem_install_attribution_token(text, text);

CREATE FUNCTION public.redeem_install_attribution_token(
  p_token_hash text,
  p_redemption_key_hash text
)
RETURNS TABLE (
  source text,
  surface text,
  placement text,
  campaign text,
  created_at timestamptz,
  expires_at timestamptz,
  handoff_id uuid,
  handoff_context jsonb
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
    token.expires_at,
    token.handoff_id,
    token.handoff_context;

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
    token.expires_at,
    token.handoff_id,
    token.handoff_context
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

COMMENT ON FUNCTION public.redeem_install_attribution_token(text, text) IS
  'Atomically consumes a valid token and returns optional bounded exact-call context to the same hashed retry key.';

NOTIFY pgrst, 'reload schema';

COMMIT;
