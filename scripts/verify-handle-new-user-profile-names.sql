-- Transaction-safe verification for handle_new_user() OAuth profile names.
-- Run after applying 20260505110000_harden_handle_new_user_profile_names.sql.

BEGIN;

DO $$
DECLARE
  display_only_id uuid := gen_random_uuid();
  full_only_id uuid := gen_random_uuid();
  name_only_id uuid := gen_random_uuid();
  blank_id uuid := gen_random_uuid();
  conflict_fill_id uuid := gen_random_uuid();
  preserve_id uuid := gen_random_uuid();
  profile_row public.profiles%ROWTYPE;
BEGIN
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change_token_current, email_change_token_new
  ) VALUES
    (
      display_only_id, 'verify-display-name@quiversurf.test', '', now(),
      jsonb_build_object('display_name', 'Display Only'),
      now(), now(), '', '', ''
    ),
    (
      full_only_id, 'verify-full-name@quiversurf.test', '', now(),
      jsonb_build_object('full_name', 'Full Only'),
      now(), now(), '', '', ''
    ),
    (
      name_only_id, 'verify-name-only@quiversurf.test', '', now(),
      jsonb_build_object('name', 'Name Only'),
      now(), now(), '', '', ''
    ),
    (
      blank_id, 'verify-blank-name@quiversurf.test', '', now(),
      '{}'::jsonb,
      now(), now(), '', '', ''
    );

  SELECT * INTO profile_row FROM public.profiles WHERE id = display_only_id;
  IF profile_row.full_name <> 'Display Only' OR profile_row.display_name <> 'Display Only' THEN
    RAISE EXCEPTION 'display_name-only metadata did not populate both profile names';
  END IF;

  SELECT * INTO profile_row FROM public.profiles WHERE id = full_only_id;
  IF profile_row.full_name <> 'Full Only' OR profile_row.display_name <> 'Full Only' THEN
    RAISE EXCEPTION 'full_name-only metadata did not populate both profile names';
  END IF;

  SELECT * INTO profile_row FROM public.profiles WHERE id = name_only_id;
  IF profile_row.full_name <> 'Name Only' OR profile_row.display_name <> 'Name Only' THEN
    RAISE EXCEPTION 'name-only metadata did not populate both profile names';
  END IF;

  SELECT * INTO profile_row FROM public.profiles WHERE id = blank_id;
  IF profile_row.full_name IS NOT NULL OR profile_row.display_name IS NOT NULL THEN
    RAISE EXCEPTION 'blank metadata should leave profile names null';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, display_name, created_at, updated_at)
  VALUES (conflict_fill_id, null, '   ', null, now(), now());

  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change_token_current, email_change_token_new
  ) VALUES (
    conflict_fill_id, 'verify-conflict-fill@quiversurf.test', '', now(),
    jsonb_build_object('name', 'Conflict Filled'),
    now(), now(), '', '', ''
  );

  SELECT * INTO profile_row FROM public.profiles WHERE id = conflict_fill_id;
  IF profile_row.email <> 'verify-conflict-fill@quiversurf.test'
     OR profile_row.full_name <> 'Conflict Filled'
     OR profile_row.display_name <> 'Conflict Filled' THEN
    RAISE EXCEPTION 'conflict path did not fill blank profile names/email';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, display_name, created_at, updated_at)
  VALUES (
    preserve_id,
    'existing@quiversurf.test',
    'Existing Full',
    'Existing Display',
    now(),
    now()
  );

  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change_token_current, email_change_token_new
  ) VALUES (
    preserve_id, 'new@quiversurf.test', '', now(),
    jsonb_build_object('name', 'New Name'),
    now(), now(), '', '', ''
  );

  SELECT * INTO profile_row FROM public.profiles WHERE id = preserve_id;
  IF profile_row.email <> 'existing@quiversurf.test'
     OR profile_row.full_name <> 'Existing Full'
     OR profile_row.display_name <> 'Existing Display' THEN
    RAISE EXCEPTION 'conflict path overwrote existing profile names/email';
  END IF;
END;
$$;

ROLLBACK;
