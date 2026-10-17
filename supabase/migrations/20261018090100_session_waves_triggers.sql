BEGIN;

CREATE OR REPLACE FUNCTION public.is_historical_file_import(p_source text, p_arrival timestamptz, p_duration_minutes int, p_as_of timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(
    p_source = 'file_import'
    AND p_arrival + make_interval(mins => coalesce(p_duration_minutes, 0)) < p_as_of - interval '48 hours',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.earn_five_session_offer(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE ids uuid[];
BEGIN
 -- ponytail: pilot-wide serialization prevents enrollment/completion races; shard by user when throughput warrants it.
 PERFORM pg_advisory_xact_lock(739302);
 IF NOT EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='five_sessions_month' AND earned_at IS NULL) THEN RETURN; END IF;
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.sessions s WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL AND NOT public.is_historical_file_import(s.source, s.arrival_time, s.duration_minutes, s.created_at) ORDER BY id LIMIT 5) completed;
 IF cardinality(ids)=5 THEN
  UPDATE public.pro_offer_awards SET earned_at=now(),session_ids=ids WHERE user_id=p_user_id AND program_id='five_sessions_month' AND earned_at IS NULL;
 END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.list_owned_pro_offers(p_user_id uuid) RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('contract_version',1,'user_id',p_user_id,'enrollment', (SELECT jsonb_build_object('terms_version',terms_version) FROM public.pro_offer_programs WHERE id='five_sessions_month' AND enabled AND automatic_enrollment AND approved_at<=now() AND expires_at>now() AND (max_awards IS NULL OR (SELECT count(*) FROM public.pro_offer_awards WHERE program_id='five_sessions_month')<max_awards) AND NOT EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='return_three_months' AND (state<>'verified' OR expires_at>now()))), 'offers',coalesce(jsonb_agg(jsonb_build_object(
 'award_id',a.id,'program_id',a.program_id,'months',p.months,'terms_version',a.terms_version,'state',a.state,
 'earned',a.earned_at IS NOT NULL,'claim_requested',a.claim_requested_at IS NOT NULL,
 'completed_sessions',(SELECT count(*) FROM public.sessions s WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL AND NOT public.is_historical_file_import(s.source, s.arrival_time, s.duration_minutes, s.created_at)),
 'expires_at',CASE WHEN a.state='verified' THEN a.expires_at END,'mirror_verified',a.mirror_verified_at IS NOT NULL) ORDER BY a.enrolled_at),'[]'))
 FROM public.pro_offer_awards a JOIN public.pro_offer_programs p ON p.id=a.program_id WHERE a.user_id=p_user_id
 AND (a.program_id='return_three_months' OR NOT EXISTS(SELECT 1 FROM public.pro_offer_awards other WHERE other.user_id=p_user_id AND other.program_id='return_three_months' AND (other.state<>'verified' OR other.expires_at>now())));
$$;

CREATE OR REPLACE FUNCTION public.preview_pro_offer(p_user_id uuid,p_code_hash text) RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT jsonb_build_object('status','preview','months',p.months,'terms_version',a.terms_version,'state',a.state,
 'completed_sessions',(SELECT count(*) FROM public.sessions s WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL AND NOT public.is_historical_file_import(s.source, s.arrival_time, s.duration_minutes, s.created_at)))
 FROM public.pro_offer_awards a JOIN public.pro_offer_programs p ON p.id=a.program_id WHERE a.user_id=p_user_id AND a.code_hash=p_code_hash),jsonb_build_object('status','not_found'));
$$;

CREATE OR REPLACE FUNCTION public.reserve_pro_offer(p_user_id uuid,p_code_hash text,p_entitlement_id text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.pro_offer_awards%ROWTYPE; p public.pro_offer_programs%ROWTYPE; ids uuid[]; token uuid; expiry timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 SELECT * INTO a FROM public.pro_offer_awards WHERE user_id=p_user_id AND code_hash=p_code_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
 IF a.state='verified' THEN RETURN jsonb_build_object('status','verified','expires_at',a.expires_at,'mirror_verified',a.mirror_verified_at IS NOT NULL); END IF;
 IF a.state IN ('handoff_started','unknown') THEN RETURN jsonb_build_object('status','reconciliation_required'); END IF;
 IF EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND state IN ('reserved','handoff_started','unknown') AND (id<>a.id OR reserved_at>now()-interval '2 minutes')) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO p FROM public.pro_offer_programs WHERE id=a.program_id;
 IF NOT p.enabled THEN RETURN jsonb_build_object('status','paused'); END IF;
 -- An issued/earned right survives campaign expiry and email opt-out.
 IF a.earned_at IS NULL THEN
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.sessions s WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL AND NOT public.is_historical_file_import(s.source, s.arrival_time, s.duration_minutes, s.created_at) ORDER BY id LIMIT 5) completed;
  IF coalesce(cardinality(ids),0)<5 THEN RETURN jsonb_build_object('status','not_earned','completed_sessions',coalesce(cardinality(ids),0)); END IF;
  UPDATE public.pro_offer_awards SET earned_at=now(),session_ids=ids WHERE id=a.id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.user_entitlements WHERE user_id=p_user_id AND (is_pro OR is_trialing) AND (expires_at IS NULL OR expires_at>now()))
 OR EXISTS(SELECT 1 FROM public.earned_pro_grants WHERE user_id=p_user_id AND revoked_at IS NULL AND expires_at>now()) THEN
  UPDATE public.pro_offer_awards SET state='held',reason='active_access' WHERE id=a.id;
  RETURN jsonb_build_object('status','held_active_access');
 END IF;
 IF nullif(trim(p_entitlement_id),'') IS NULL THEN RAISE EXCEPTION 'Missing entitlement'; END IF;
 token:=gen_random_uuid();
 -- UTC calendar arithmetic clamps month ends and avoids daylight-saving drift.
 expiry:=((date_trunc('second',now()) AT TIME ZONE 'UTC')+make_interval(months=>p.months)) AT TIME ZONE 'UTC';
 UPDATE public.pro_offer_awards SET state='reserved',reason=NULL,reservation_id=token,reserved_at=now(),expires_at=expiry,entitlement_id=p_entitlement_id WHERE id=a.id;
 RETURN jsonb_build_object('status','reserved','award_id',a.id,'reservation_id',token,'user_id',a.user_id,'expires_at',expiry,'entitlement_id',p_entitlement_id);
END; $$;

CREATE OR REPLACE FUNCTION public.earn_pro_offer_on_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status='completed' AND NEW.deleted_at IS NULL
 AND NOT public.is_historical_file_import(NEW.source, NEW.arrival_time, NEW.duration_minutes) THEN PERFORM public.earn_five_session_offer(NEW.user_id); END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.stamp_email_session_completion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.email_completed_at := CASE WHEN NEW.status = 'completed' AND NOT public.is_historical_file_import(NEW.source, NEW.arrival_time, NEW.duration_minutes) THEN now() END;
  ELSIF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.email_completed_at := now();
  ELSE
    NEW.email_completed_at := OLD.email_completed_at;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
  v_sessions_soft_deleted int := 0;
  v_comments_anonymized int := 0;
  v_personal_rows_deleted int := 0;
  v_count int;
BEGIN
  INSERT INTO account_deletions (user_id)
  VALUES (p_user_id)
  RETURNING id INTO v_audit_id;

  UPDATE sessions
  SET deleted_at = now(),
      notes = NULL,
      description = NULL,
      image_url = NULL,
      board_snapshot = NULL,
      muted = true
  WHERE user_id = p_user_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_sessions_soft_deleted = ROW_COUNT;

  UPDATE public.session_tracks SET purge_requested_at = now() WHERE user_id = p_user_id AND purge_requested_at IS NULL;
  UPDATE public.session_imports SET purge_requested_at = now() WHERE user_id = p_user_id AND purge_requested_at IS NULL;
  DELETE FROM public.session_wave_corrections WHERE user_id = p_user_id;

  UPDATE comments
  SET content = '[deleted]',
      updated_at = now()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_comments_anonymized = ROW_COUNT;

  UPDATE beach_reviews
  SET title = '[deleted]',
      content = '[deleted]',
      deleted_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  UPDATE intel_posts
  SET is_active = false,
      title = '[deleted]',
      description = '[deleted]',
      photo_url = NULL,
      photo_storage_path = NULL,
      vibe = NULL,
      updated_at = now()
  WHERE user_id = p_user_id;

  DELETE FROM intel_reports WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_email_prefs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_surf_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_implicit_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_beach_affinity WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM favorite_beaches WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_devices WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_badges WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_xp WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM xp_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_activities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM personalization_milestones WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM saved_windows WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_invitations
  WHERE inviter_id = p_user_id OR invitee_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM boards WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  UPDATE session_media
  SET deleted_at = now(),
      caption = NULL
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  DELETE FROM session_forecast_snapshots WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM spot_feedback WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM notifications WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_alert_deliveries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_follows
  WHERE follower_id = p_user_id OR following_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM beach_review_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_shares WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_accuracy_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_post_confirmations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  PERFORM public.erase_regional_recommendation_hold_operator_v1(p_user_id);

  UPDATE profiles
  SET deleted_at = now(),
      full_name = 'Deleted surfer',
      avatar_url = NULL,
      bio = NULL,
      location = NULL,
      instagram = NULL,
      home_beach_id = NULL,
      experience_level = NULL,
      preferred_session_time = NULL,
      surf_styles = NULL,
      followers_count = 0,
      following_count = 0,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE account_deletions
  SET completed_at = now(),
      sessions_soft_deleted = v_sessions_soft_deleted,
      comments_anonymized = v_comments_anonymized,
      personal_rows_deleted = v_personal_rows_deleted
  WHERE id = v_audit_id;

  RETURN jsonb_build_object(
    'audit_id', v_audit_id,
    'sessions_soft_deleted', v_sessions_soft_deleted,
    'comments_anonymized', v_comments_anonymized,
    'personal_rows_deleted', v_personal_rows_deleted
  );
EXCEPTION WHEN OTHERS THEN
  UPDATE account_deletions
  SET error = SQLERRM
  WHERE id = v_audit_id;
  RAISE;
END;
$$;

COMMIT;
