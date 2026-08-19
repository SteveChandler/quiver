\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-4000-8000-00000000a101';
  v_event_id uuid := '00000000-0000-4000-8000-00000000e101';
  v_claim_id uuid := '00000000-0000-4000-8000-00000000c101';
  v_target_id uuid;
  v_target public.notification_delivery_targets;
  v_device public.user_devices;
BEGIN
  INSERT INTO auth.users (id, email, created_at, updated_at)
  VALUES (v_user_id, 'surf-alert-trust-integration@example.com', now(), now());

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM public.register_device_installation(
    v_user_id,
    'integration-installation',
    'ios',
    'integration-token-1',
    jsonb_build_object(
      'app_version', '1.0.2',
      'build_number', '16',
      'os_version', '18.6',
      'expo_sdk', '53',
      'timezone', 'America/Los_Angeles',
      'expo_update_id', 'update-1',
      'expo_channel', 'production',
      'expo_runtime_version', '1.0.2',
      'expo_is_embedded_launch', false,
      'expo_is_emergency_launch', true
    )
  );

  SELECT * INTO STRICT v_device
  FROM public.user_devices
  WHERE installation_id = 'integration-installation' AND retired_at IS NULL;
  IF v_device.expo_update_id <> 'update-1'
    OR v_device.expo_channel <> 'production'
    OR v_device.expo_runtime_version <> '1.0.2'
    OR v_device.expo_is_embedded_launch IS DISTINCT FROM false
    OR v_device.expo_is_emergency_launch IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'identified registration did not persist Expo metadata';
  END IF;

  PERFORM public.register_device_installation(
    v_user_id,
    'integration-installation',
    'ios',
    'integration-token-2',
    '{}'::jsonb
  );
  SELECT * INTO STRICT v_device
  FROM public.user_devices
  WHERE installation_id = 'integration-installation' AND retired_at IS NULL;
  IF v_device.app_version <> '1.0.2'
    OR v_device.expo_update_id <> 'update-1'
    OR v_device.device_token <> 'integration-token-2' THEN
    RAISE EXCEPTION 'identified registration erased omitted metadata';
  END IF;

  PERFORM public.register_legacy_device_token(
    v_user_id,
    'ios',
    'integration-legacy-token',
    jsonb_build_object('app_version', '1.0.1', 'expo_update_id', 'legacy-update')
  );
  PERFORM public.register_legacy_device_token(
    v_user_id,
    'ios',
    'integration-legacy-token',
    '{}'::jsonb
  );
  SELECT * INTO STRICT v_device
  FROM public.user_devices
  WHERE user_id = v_user_id
    AND device_token = 'integration-legacy-token'
    AND installation_id IS NULL
    AND retired_at IS NULL;
  IF v_device.app_version <> '1.0.1' OR v_device.expo_update_id <> 'legacy-update' THEN
    RAISE EXCEPTION 'legacy registration erased omitted metadata';
  END IF;

  INSERT INTO public.notification_events (id, recipient_user_id, type, payload)
  VALUES (v_event_id, v_user_id, 'forecast_alert', '{}'::jsonb);
  INSERT INTO public.notification_delivery_targets (
    notification_event_id,
    installation_id,
    token_fingerprint
  ) VALUES (v_event_id, 'integration-installation', 'fingerprint')
  RETURNING id INTO v_target_id;

  PERFORM public.claim_notification_delivery_targets(
    v_event_id,
    ARRAY['integration-installation'],
    v_claim_id
  );
  SELECT * INTO STRICT v_target
  FROM public.notification_delivery_targets
  WHERE id = v_target_id;
  IF v_target.status <> 'sending' OR v_target.claim_version <> 1 THEN
    RAISE EXCEPTION 'target claim did not acquire pending target';
  END IF;

  PERFORM public.finalize_notification_delivery_target(
    v_target_id,
    v_claim_id,
    0,
    'sent'
  );
  SELECT * INTO STRICT v_target
  FROM public.notification_delivery_targets
  WHERE id = v_target_id;
  IF v_target.status <> 'sending' THEN
    RAISE EXCEPTION 'stale claim version finalized target';
  END IF;

  PERFORM public.finalize_notification_delivery_target(
    v_target_id,
    v_claim_id,
    1,
    'sent'
  );
  SELECT * INTO STRICT v_target
  FROM public.notification_delivery_targets
  WHERE id = v_target_id;
  IF v_target.status <> 'sent' THEN
    RAISE EXCEPTION 'current claim could not finalize target';
  END IF;

  IF has_function_privilege(
    'public',
    'public.claim_notification_delivery_targets(uuid,text[],uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC can execute delivery target claim RPC';
  END IF;
END $$;

ROLLBACK;
