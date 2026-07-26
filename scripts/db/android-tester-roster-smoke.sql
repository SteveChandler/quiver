\set ON_ERROR_STOP on

-- Executed only by run-android-tester-roster-smoke.sh against a disposable
-- local database that is dropped after the run.
BEGIN;

DO $$
DECLARE
  v_actor_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_linked_user_id constant uuid := '10000000-0000-4000-8000-000000000002';
  v_unlinked_user_id constant uuid := '10000000-0000-4000-8000-000000000003';
  v_native_install_id constant uuid := '20000000-0000-4000-8000-000000000002';
  v_claim uuid;
  v_entry_id uuid;
  v_purge_entry_id uuid;
  v_result jsonb;
  v_summary jsonb;
  v_outcome text;
  v_count integer;
BEGIN
  INSERT INTO auth.users (
    id,
    email
  ) VALUES
    (
      v_actor_id,
      'roster-smoke-actor@example.test'
    ),
    (
      v_linked_user_id,
      'roster-smoke-linked@example.test'
    ),
    (
      v_unlinked_user_id,
      'roster-smoke-unlinked@example.test'
    );

  INSERT INTO public.profiles (id)
  VALUES (v_actor_id), (v_linked_user_id), (v_unlinked_user_id);

  IF has_table_privilege(
    'anon',
    'public.android_tester_roster_entries',
    'SELECT'
  ) OR has_table_privilege(
    'authenticated',
    'public.android_tester_roster_entries',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'roster tables are exposed to app roles';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.link_android_tester_roster_account(uuid,uuid,uuid,text)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'service_role',
    'public.link_android_tester_roster_account(uuid,uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'roster RPC grants are incorrect';
  END IF;

  v_claim := public.claim_android_tester_roster_sync(
    v_actor_id,
    '2026-07-25T12:00:00Z'
  );
  IF v_claim IS NULL THEN
    RAISE EXCEPTION 'initial roster sync claim was not acquired';
  END IF;

  v_result := public.apply_android_tester_roster_snapshot(
    v_actor_id,
    v_claim,
    true,
    '2026-07-25T12:00:00Z',
    jsonb_build_array(jsonb_build_object(
      'kind', 'new',
      'keyVersion', 1,
      'iv', repeat('A', 16),
      'ciphertext', repeat('B', 32),
      'authTag', repeat('C', 22)
    )),
    1,
    NULL
  );
  IF v_result->>'complete' <> 'true'
     OR (v_result->>'addedCount')::integer <> 1 THEN
    RAISE EXCEPTION 'complete snapshot did not add one roster entry: %', v_result;
  END IF;

  SELECT entry.id
  INTO v_entry_id
  FROM public.android_tester_roster_entries AS entry
  ORDER BY entry.created_at DESC
  LIMIT 1;

  SELECT count(*)
  INTO v_count
  FROM (
    SELECT DISTINCT ON (stage)
      stage,
      status
    FROM public.android_tester_roster_stages
    WHERE entry_id = v_entry_id
    ORDER BY stage, observed_at DESC, id DESC
  ) AS latest
  WHERE (stage = 'group_eligibility' AND status = 'eligible')
    OR (
      stage IN ('play_opt_in', 'install', 'first_open', 'account_join')
      AND status = 'unknown'
    );
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'new roster entry does not have five explicit stages';
  END IF;

  SELECT outcome
  INTO v_outcome
  FROM public.record_android_tester_roster_first_open(
    v_linked_user_id,
    v_native_install_id,
    repeat('f', 64)
  );
  IF v_outcome <> 'pending_retryable' THEN
    RAISE EXCEPTION 'first-open evidence linked before account join';
  END IF;

  SELECT outcome
  INTO v_outcome
  FROM public.link_android_tester_roster_account(
    v_entry_id,
    v_linked_user_id,
    v_native_install_id,
    repeat('a', 64)
  );
  IF v_outcome <> 'linked' THEN
    RAISE EXCEPTION 'account join failed: %', v_outcome;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_identities
    WHERE entry_id = v_entry_id
  ) THEN
    RAISE EXCEPTION 'join retained encrypted external identity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_audit
    WHERE entry_id = v_entry_id
      AND action = 'join'
      AND (
        actor_user_id IS NOT NULL
        OR evidence <> '{}'::jsonb
      )
  ) THEN
    RAISE EXCEPTION 'join audit retained user or install residue';
  END IF;

  SELECT outcome
  INTO v_outcome
  FROM public.link_android_tester_roster_account(
    v_entry_id,
    v_linked_user_id,
    v_native_install_id,
    repeat('a', 64)
  );
  IF v_outcome <> 'same_key_retry' THEN
    RAISE EXCEPTION 'join idempotency replay failed';
  END IF;

  SELECT outcome
  INTO v_outcome
  FROM public.record_android_tester_roster_first_open(
    v_linked_user_id,
    v_native_install_id,
    repeat('f', 64)
  );
  IF v_outcome <> 'observed' THEN
    RAISE EXCEPTION 'first-open evidence failed: %', v_outcome;
  END IF;

  SELECT outcome
  INTO v_outcome
  FROM public.record_android_tester_roster_first_open(
    v_linked_user_id,
    v_native_install_id,
    repeat('f', 64)
  );
  IF v_outcome <> 'same_key_retry' THEN
    RAISE EXCEPTION 'first-open idempotency replay failed';
  END IF;

  SELECT outcome
  INTO v_outcome
  FROM public.record_android_tester_roster_install(
    v_linked_user_id,
    v_native_install_id,
    repeat('e', 64),
    'android_beta_page',
    'android_beta',
    'direct',
    'app_first_v1',
    '2026-07-25',
    '2026-08-24'
  );
  IF v_outcome <> 'observed' THEN
    RAISE EXCEPTION 'install evidence failed: %', v_outcome;
  END IF;

  SELECT outcome
  INTO v_outcome
  FROM public.record_android_tester_roster_install(
    v_linked_user_id,
    v_native_install_id,
    repeat('e', 64),
    'android_beta_page',
    'android_beta',
    'direct',
    'app_first_v1',
    '2026-07-25',
    '2026-08-24'
  );
  IF v_outcome <> 'same_key_retry' THEN
    RAISE EXCEPTION 'install idempotency replay failed';
  END IF;

  PERFORM public.record_android_tester_roster_stage(
    v_actor_id,
    v_entry_id,
    'play_opt_in',
    'observed',
    'manual_google_play_console',
    '2026-07-25T13:00:00Z',
    'manual',
    jsonb_build_object(
      'code', 'play_console_membership_review',
      'referenceId', '30000000-0000-4000-8000-000000000003'
    )
  );

  v_summary := public.get_android_tester_roster_summary();
  IF v_summary->'stageCounts'->'account_join'->>'linked' <> '1'
     OR v_summary->'stageCounts'->'install'->>'observed' <> '1'
     OR v_summary->'stageCounts'->'first_open'->>'observed' <> '1'
     OR v_summary->'stageCounts'->'play_opt_in'->>'observed' <> '1' THEN
    RAISE EXCEPTION 'latest-stage summary is incorrect: %', v_summary;
  END IF;

  v_claim := public.claim_android_tester_roster_sync(
    v_actor_id,
    '2026-07-26T12:00:00Z'
  );
  v_result := public.apply_android_tester_roster_snapshot(
    v_actor_id,
    v_claim,
    true,
    '2026-07-26T12:00:00Z',
    jsonb_build_array(jsonb_build_object(
      'kind', 'left',
      'entryId', v_entry_id
    )),
    0,
    NULL
  );
  IF (v_result->>'leftCount')::integer <> 0
     OR EXISTS (
       SELECT 1
       FROM public.android_tester_roster_entries
       WHERE id = v_entry_id
         AND eligibility_status <> 'eligible'
     ) THEN
    RAISE EXCEPTION 'stale unlinked leave observation changed linked entry';
  END IF;

  v_claim := public.claim_android_tester_roster_sync(
    v_actor_id,
    '2026-07-27T12:00:00Z'
  );
  v_result := public.apply_android_tester_roster_snapshot(
    v_actor_id,
    v_claim,
    true,
    '2026-07-27T12:00:00Z',
    jsonb_build_array(jsonb_build_object(
      'kind', 'new',
      'keyVersion', 1,
      'iv', repeat('D', 16),
      'ciphertext', repeat('E', 32),
      'authTag', repeat('F', 22)
    )),
    1,
    NULL
  );

  SELECT entry.id
  INTO v_purge_entry_id
  FROM public.android_tester_roster_entries AS entry
  WHERE entry.id <> v_entry_id
  ORDER BY entry.created_at DESC
  LIMIT 1;

  v_claim := public.claim_android_tester_roster_sync(
    v_actor_id,
    '2026-07-28T12:00:00Z'
  );
  PERFORM public.apply_android_tester_roster_snapshot(
    v_actor_id,
    v_claim,
    true,
    '2026-07-28T12:00:00Z',
    jsonb_build_array(jsonb_build_object(
      'kind', 'left',
      'entryId', v_purge_entry_id
    )),
    0,
    NULL
  );

  IF public.purge_android_tester_roster_identities(
    v_actor_id,
    '2026-08-28T12:00:00Z'
  ) <> 1 THEN
    RAISE EXCEPTION 'retention purge did not remove due identity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_identities
    WHERE entry_id = v_purge_entry_id
  ) THEN
    RAISE EXCEPTION 'retention purge left identity envelope';
  END IF;

  PERFORM public.record_android_tester_roster_audit(
    v_linked_user_id,
    v_entry_id,
    'read_summary',
    'succeeded',
    jsonb_build_object('nativeInstallId', v_native_install_id)
  );

  UPDATE public.profiles
  SET deleted_at = now()
  WHERE id = v_linked_user_id;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_entries
    WHERE user_id = v_linked_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.android_tester_roster_join_evidence
    WHERE user_id = v_linked_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.android_tester_roster_install_evidence
    WHERE user_id = v_linked_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.android_tester_roster_first_open_evidence
    WHERE user_id = v_linked_user_id
  ) THEN
    RAISE EXCEPTION 'account deletion retained roster evidence';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.android_tester_roster_audit
    WHERE actor_user_id = v_linked_user_id
      OR evidence ? 'nativeInstallId'
  ) THEN
    RAISE EXCEPTION 'account deletion retained audit identity residue';
  END IF;

  PERFORM *
  FROM public.export_android_tester_roster_non_pii();
END;
$$;

ROLLBACK;
