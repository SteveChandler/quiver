BEGIN;

-- Producer idempotency is permanent for home calls. Do not archive/delete old
-- events to make this pass: duplicate history is an explicit migration
-- failure requiring operator reconciliation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notification_events
    WHERE type = 'home_morning_call' AND dedupe_key IS NOT NULL
    GROUP BY recipient_user_id, type, dedupe_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'home_morning_call dedupe duplicates exist; reconcile before applying trust invariant';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_home_morning_call_dedupe
  ON public.notification_events (recipient_user_id, type, dedupe_key)
  WHERE type = 'home_morning_call' AND dedupe_key IS NOT NULL;

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS installation_id text,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_reason text;

-- The original table-level (user_id, device_token) constraint includes
-- retired audit rows and blocks installing a new identified row after a
-- legacy row is retired. Replace it with an active-legacy compatibility index;
-- identified installations use the separate active-installation index below.
ALTER TABLE public.user_devices
  DROP CONSTRAINT IF EXISTS user_devices_user_id_device_token_key;
DROP INDEX IF EXISTS public.user_devices_user_id_device_token_key;

COMMENT ON COLUMN public.user_devices.installation_id IS
  'Stable app-install identity. NULL legacy rows are intentionally not grouped or guessed.';
COMMENT ON COLUMN public.user_devices.retired_at IS
  'Retired rows remain immutable history and are excluded from delivery.';
COMMENT ON TABLE public.user_devices IS
  'Legacy rows with NULL installation_id remain additive compatibility data; the hard physical-install delivery invariant applies after explicit installation adoption/retirement.';

DROP INDEX IF EXISTS public.user_devices_active_installation;
CREATE UNIQUE INDEX IF NOT EXISTS user_devices_active_installation
  ON public.user_devices (installation_id)
  WHERE installation_id IS NOT NULL AND retired_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_devices_active_legacy_token
  ON public.user_devices (user_id, device_token)
  WHERE installation_id IS NULL AND retired_at IS NULL;

CREATE OR REPLACE FUNCTION public.register_device_installation(
  p_user_id uuid,
  p_installation_id text,
  p_platform text,
  p_device_token text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.user_devices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.user_devices;
  v_installation_lock bigint;
  v_token_lock bigint;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'device registration requires authenticated owner';
  END IF;
  IF p_installation_id IS NULL OR length(trim(p_installation_id)) = 0
    OR p_device_token IS NULL OR length(trim(p_device_token)) = 0 THEN
    RAISE EXCEPTION 'installation_id and device_token are required';
  END IF;
  -- Every registration takes the same two lock classes in numeric order.
  -- Sorting prevents crossed installation/token transfers from deadlocking.
  v_installation_lock := hashtextextended('installation:' || p_installation_id, 0);
  v_token_lock := hashtextextended('token:' || p_device_token, 0);
  PERFORM pg_advisory_xact_lock(LEAST(v_installation_lock, v_token_lock));
  IF v_installation_lock <> v_token_lock THEN
    PERFORM pg_advisory_xact_lock(GREATEST(v_installation_lock, v_token_lock));
  END IF;
  -- Exact identity is known for an installation. A caller authenticated for
  -- the account that possesses this provider token may safely retire every
  -- other active row holding that exact token, including legacy NULL-
  -- installation rows. This preserves audit history without guessing which
  -- legacy rows belong to another physical installation.
  UPDATE public.user_devices
  SET retired_at = now(), retired_reason = 'installation_transferred'
  WHERE retired_at IS NULL
    AND (installation_id = p_installation_id OR device_token = p_device_token)
    -- IS NOT DISTINCT FROM avoids SQL NULL turning the exclusion into
    -- UNKNOWN: same-user legacy NULL-install rows holding this token retire.
    AND NOT (
      user_id IS NOT DISTINCT FROM p_user_id
      AND installation_id IS NOT DISTINCT FROM p_installation_id
      AND p_installation_id IS NOT NULL
    );
  INSERT INTO public.user_devices (user_id, installation_id, platform, device_token,
    app_version, build_number, os_version, expo_sdk, timezone,
    expo_update_id, expo_channel, expo_runtime_version,
    expo_is_embedded_launch, expo_is_emergency_launch, updated_at)
  VALUES (p_user_id, p_installation_id, p_platform, p_device_token,
    p_metadata->>'app_version', p_metadata->>'build_number', p_metadata->>'os_version',
    p_metadata->>'expo_sdk', p_metadata->>'timezone',
    p_metadata->>'expo_update_id', p_metadata->>'expo_channel',
    p_metadata->>'expo_runtime_version',
    (p_metadata->>'expo_is_embedded_launch')::boolean,
    (p_metadata->>'expo_is_emergency_launch')::boolean, now())
  ON CONFLICT (installation_id) WHERE installation_id IS NOT NULL AND retired_at IS NULL
  DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform,
    device_token = excluded.device_token,
    app_version = CASE WHEN p_metadata ? 'app_version' THEN excluded.app_version ELSE user_devices.app_version END,
    build_number = CASE WHEN p_metadata ? 'build_number' THEN excluded.build_number ELSE user_devices.build_number END,
    os_version = CASE WHEN p_metadata ? 'os_version' THEN excluded.os_version ELSE user_devices.os_version END,
    expo_sdk = CASE WHEN p_metadata ? 'expo_sdk' THEN excluded.expo_sdk ELSE user_devices.expo_sdk END,
    timezone = CASE WHEN p_metadata ? 'timezone' THEN excluded.timezone ELSE user_devices.timezone END,
    expo_update_id = CASE WHEN p_metadata ? 'expo_update_id' THEN excluded.expo_update_id ELSE user_devices.expo_update_id END,
    expo_channel = CASE WHEN p_metadata ? 'expo_channel' THEN excluded.expo_channel ELSE user_devices.expo_channel END,
    expo_runtime_version = CASE WHEN p_metadata ? 'expo_runtime_version' THEN excluded.expo_runtime_version ELSE user_devices.expo_runtime_version END,
    expo_is_embedded_launch = CASE WHEN p_metadata ? 'expo_is_embedded_launch' THEN excluded.expo_is_embedded_launch ELSE user_devices.expo_is_embedded_launch END,
    expo_is_emergency_launch = CASE WHEN p_metadata ? 'expo_is_emergency_launch' THEN excluded.expo_is_emergency_launch ELSE user_devices.expo_is_emergency_launch END,
    retired_at = NULL, retired_reason = NULL, updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.register_device_installation(uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_device_installation(uuid,text,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_legacy_device_token(
  p_user_id uuid,
  p_platform text,
  p_device_token text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.user_devices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.user_devices;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'device registration requires authenticated owner';
  END IF;
  IF p_device_token IS NULL OR length(trim(p_device_token)) = 0 THEN
    RAISE EXCEPTION 'device_token is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('token:' || p_device_token, 0));

  -- Preserve any retired row as audit history. Re-activate/update only an
  -- already-active row owned by this user; otherwise insert a fresh legacy
  -- compatibility row under the active partial index.
  UPDATE public.user_devices
  SET platform = p_platform,
    app_version = CASE WHEN p_metadata ? 'app_version' THEN p_metadata->>'app_version' ELSE app_version END,
    build_number = CASE WHEN p_metadata ? 'build_number' THEN p_metadata->>'build_number' ELSE build_number END,
    os_version = CASE WHEN p_metadata ? 'os_version' THEN p_metadata->>'os_version' ELSE os_version END,
    expo_sdk = CASE WHEN p_metadata ? 'expo_sdk' THEN p_metadata->>'expo_sdk' ELSE expo_sdk END,
    timezone = CASE WHEN p_metadata ? 'timezone' THEN p_metadata->>'timezone' ELSE timezone END,
    expo_update_id = CASE WHEN p_metadata ? 'expo_update_id' THEN p_metadata->>'expo_update_id' ELSE expo_update_id END,
    expo_channel = CASE WHEN p_metadata ? 'expo_channel' THEN p_metadata->>'expo_channel' ELSE expo_channel END,
    expo_runtime_version = CASE WHEN p_metadata ? 'expo_runtime_version' THEN p_metadata->>'expo_runtime_version' ELSE expo_runtime_version END,
    expo_is_embedded_launch = CASE WHEN p_metadata ? 'expo_is_embedded_launch' THEN (p_metadata->>'expo_is_embedded_launch')::boolean ELSE expo_is_embedded_launch END,
    expo_is_emergency_launch = CASE WHEN p_metadata ? 'expo_is_emergency_launch' THEN (p_metadata->>'expo_is_emergency_launch')::boolean ELSE expo_is_emergency_launch END,
    updated_at = now()
  WHERE user_id = p_user_id
    AND device_token = p_device_token
    AND installation_id IS NULL
    AND retired_at IS NULL
  RETURNING * INTO v_row;
  IF FOUND THEN RETURN v_row; END IF;

  INSERT INTO public.user_devices (user_id, platform, device_token,
    app_version, build_number, os_version, expo_sdk, timezone,
    expo_update_id, expo_channel, expo_runtime_version,
    expo_is_embedded_launch, expo_is_emergency_launch, updated_at)
  VALUES (p_user_id, p_platform, p_device_token,
    p_metadata->>'app_version', p_metadata->>'build_number',
    p_metadata->>'os_version', p_metadata->>'expo_sdk',
    p_metadata->>'timezone', p_metadata->>'expo_update_id',
    p_metadata->>'expo_channel', p_metadata->>'expo_runtime_version',
    (p_metadata->>'expo_is_embedded_launch')::boolean,
    (p_metadata->>'expo_is_emergency_launch')::boolean, now())
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.register_legacy_device_token(uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_legacy_device_token(uuid,text,text,jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS public.notification_delivery_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  installation_id text NOT NULL,
  token_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','unknown')),
  provider_response jsonb,
  error_message text,
  claimed_at timestamptz,
  claim_id uuid,
  claim_version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_event_id, installation_id)
);
CREATE INDEX IF NOT EXISTS notification_delivery_targets_claim_idx
  ON public.notification_delivery_targets (status, claimed_at);
ALTER TABLE public.notification_delivery_targets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_notification_delivery_targets(
  p_event_id uuid, p_installation_ids text[], p_claim_id uuid
) RETURNS SETOF public.notification_delivery_targets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Ambiguous stale sends are terminal. They are never automatically retried.
  UPDATE public.notification_delivery_targets
  SET status = 'unknown', error_message = 'stale sending claim; provider outcome ambiguous', updated_at = now()
  WHERE notification_event_id = p_event_id
    AND status = 'sending'
    AND claimed_at < now() - interval '5 minutes';
  RETURN QUERY
  UPDATE public.notification_delivery_targets
  SET status = 'sending', claimed_at = now(), claim_id = p_claim_id,
    claim_version = claim_version + 1, updated_at = now()
  WHERE notification_event_id = p_event_id
    AND installation_id = ANY(p_installation_ids)
    -- Known provider failures may retry. Sent and ambiguous unknown targets
    -- are intentionally never eligible again.
    AND status IN ('pending', 'failed')
  RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_notification_delivery_target(
  p_target_id uuid, p_claim_id uuid, p_claim_version bigint, p_status text,
  p_provider_response jsonb DEFAULT NULL, p_error_message text DEFAULT NULL
) RETURNS public.notification_delivery_targets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.notification_delivery_targets;
BEGIN
  IF p_status NOT IN ('sent','failed','unknown') THEN RAISE EXCEPTION 'invalid target status'; END IF;
  UPDATE public.notification_delivery_targets SET status = p_status,
    provider_response = p_provider_response, error_message = p_error_message,
    updated_at = now() WHERE id = p_target_id AND claim_id = p_claim_id
    AND claim_version = p_claim_version AND status = 'sending'
    RETURNING * INTO v_row;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.claim_notification_delivery_targets(uuid,text[],uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notification_delivery_targets(uuid,text[],uuid) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_notification_delivery_target(uuid,uuid,bigint,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_notification_delivery_target(uuid,uuid,bigint,text,jsonb,text) TO service_role;

COMMIT;
