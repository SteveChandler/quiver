BEGIN;

CREATE TEMP TABLE apple_recovery_expected_dependencies (
  source_table text NOT NULL,
  constraint_name text NOT NULL,
  source_column text NOT NULL,
  PRIMARY KEY (source_table, constraint_name)
) ON COMMIT DROP;

INSERT INTO apple_recovery_expected_dependencies (
  source_table,
  constraint_name,
  source_column
) VALUES
  ('android_tester_roster_entries', 'android_tester_roster_entries_user_id_fkey', 'user_id'),
  ('android_tester_roster_join_evidence', 'android_tester_roster_join_evidence_user_id_fkey', 'user_id'),
  ('android_tester_roster_install_evidence', 'android_tester_roster_install_evidence_user_id_fkey', 'user_id'),
  ('android_tester_roster_first_open_evidence', 'android_tester_roster_first_open_evidence_user_id_fkey', 'user_id'),
  ('android_tester_roster_sync_claims', 'android_tester_roster_sync_claims_claimed_by_fkey', 'claimed_by'),
  ('android_tester_roster_audit', 'android_tester_roster_audit_actor_user_id_fkey', 'actor_user_id'),
  ('community_spot_photos', 'community_spot_photos_uploader_id_fkey', 'uploader_id'),
  ('community_photo_consents', 'community_photo_consents_contributor_id_fkey', 'contributor_id'),
  ('community_photo_votes', 'community_photo_votes_voter_id_fkey', 'voter_id'),
  ('community_photo_reports', 'community_photo_reports_reporter_id_fkey', 'reporter_id'),
  ('community_photo_moderation_events', 'community_photo_moderation_events_subject_user_id_fkey', 'subject_user_id'),
  ('community_photo_moderation_events', 'community_photo_moderation_events_actor_id_fkey', 'actor_id'),
  ('community_photo_feature_pins', 'community_photo_feature_pins_pinned_by_fkey', 'pinned_by'),
  ('community_photo_feature_pins', 'community_photo_feature_pins_revoked_by_fkey', 'revoked_by'),
  ('community_photo_investigation_holds', 'community_photo_investigation_holds_placed_by_fkey', 'placed_by'),
  ('community_photo_investigation_holds', 'community_photo_investigation_holds_released_by_fkey', 'released_by'),
  ('community_photo_contributor_restrictions', 'community_photo_contributor_restrictions_contributor_id_fkey', 'contributor_id'),
  ('community_photo_contributor_restrictions', 'community_photo_contributor_restrictions_applied_by_fkey', 'applied_by'),
  ('community_photo_contributor_restrictions', 'community_photo_contributor_restrictions_lifted_by_fkey', 'lifted_by'),
  ('community_photo_action_events', 'community_photo_action_events_actor_id_fkey', 'actor_id'),
  ('android_waitlist_entries', 'android_waitlist_entries_user_id_fkey', 'user_id');

DO $$
DECLARE
  v_expected_count constant integer := 21;
  v_listed_count integer;
BEGIN
  SELECT count(*)
  INTO v_listed_count
  FROM pg_temp.apple_recovery_expected_dependencies;

  IF v_listed_count <> v_expected_count THEN
    RAISE EXCEPTION
      'Expected % reviewed post-foundation Auth dependencies, listed %',
      v_expected_count,
      v_listed_count;
  END IF;
END $$;

INSERT INTO public.apple_recovery_dependency_registry (
  source_schema,
  source_table,
  constraint_name,
  target_schema,
  target_table,
  source_columns
)
SELECT
  source_ns.nspname,
  source_table.relname,
  constraint_row.conname,
  target_ns.nspname,
  target_table.relname,
  ARRAY(
    SELECT source_attribute.attname::text
    FROM unnest(constraint_row.conkey) WITH ORDINALITY
      AS key_column(attnum, ordinal)
    JOIN pg_attribute source_attribute
      ON source_attribute.attrelid = constraint_row.conrelid
     AND source_attribute.attnum = key_column.attnum
    ORDER BY key_column.ordinal
  )
FROM pg_temp.apple_recovery_expected_dependencies expected
JOIN pg_class source_table ON source_table.relname = expected.source_table
JOIN pg_namespace source_ns
  ON source_ns.oid = source_table.relnamespace
 AND source_ns.nspname = 'public'
JOIN pg_constraint constraint_row
  ON constraint_row.conrelid = source_table.oid
 AND constraint_row.conname = expected.constraint_name
 AND constraint_row.contype = 'f'
 AND constraint_row.confrelid = 'auth.users'::regclass
JOIN pg_class target_table ON target_table.oid = constraint_row.confrelid
JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace
WHERE ARRAY(
  SELECT source_attribute.attname::text
  FROM unnest(constraint_row.conkey) WITH ORDINALITY
    AS key_column(attnum, ordinal)
  JOIN pg_attribute source_attribute
    ON source_attribute.attrelid = constraint_row.conrelid
   AND source_attribute.attnum = key_column.attnum
  ORDER BY key_column.ordinal
) = ARRAY[expected.source_column]
ON CONFLICT (source_schema, source_table, constraint_name) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint current_constraint
    JOIN pg_class source_table ON source_table.oid = current_constraint.conrelid
    JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
    JOIN pg_class target_table ON target_table.oid = current_constraint.confrelid
    JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace
    WHERE current_constraint.contype = 'f'
      AND source_ns.nspname = 'public'
      AND current_constraint.confrelid IN (
        'auth.users'::regclass,
        'public.profiles'::regclass
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.apple_recovery_dependency_registry registry
        WHERE registry.source_schema = source_ns.nspname
          AND registry.source_table = source_table.relname
          AND registry.constraint_name = current_constraint.conname
          AND registry.target_schema = target_ns.nspname
          AND registry.target_table = target_table.relname
      )
  ) THEN
    RAISE EXCEPTION
      'Current Auth/Profile dependency coverage remains incomplete after reviewed registration';
  END IF;
END $$;

COMMIT;
