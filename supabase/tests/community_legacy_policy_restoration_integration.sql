\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE SCHEMA storage;

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.beaches (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT false $$;

\ir ../migrations/20260701205008_beach_photo_submissions.sql

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.beach_photo_submissions
  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.beach_photo_submission_votes
  TO anon, authenticated;

INSERT INTO public.beaches (id)
VALUES
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
INSERT INTO public.profiles (id)
VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
INSERT INTO public.beach_photo_submissions (
  id,
  beach_id,
  submitted_by,
  storage_path,
  image_url,
  status
)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'beach-submissions/legacy.webp',
  'https://example.invalid/legacy.webp',
  'pending'
);
INSERT INTO public.beach_photo_submission_votes (
  id,
  submission_id,
  voter_id,
  vote
)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'useful'
);

CREATE TABLE public.community_spot_photos (
  id uuid PRIMARY KEY,
  status text NOT NULL
);
CREATE TABLE public.community_photo_votes (
  id uuid PRIMARY KEY,
  vote text NOT NULL
);
CREATE TABLE public.community_photo_moderation_events (
  id uuid PRIMARY KEY,
  action text NOT NULL
);
CREATE TABLE public.community_photo_investigation_holds (
  id uuid PRIMARY KEY,
  active boolean NOT NULL
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY,
  bucket_id text NOT NULL,
  name text NOT NULL
);

INSERT INTO public.community_spot_photos
VALUES ('50000000-0000-4000-8000-000000000001', 'visible');
INSERT INTO public.community_photo_votes
VALUES ('60000000-0000-4000-8000-000000000001', 'up');
INSERT INTO public.community_photo_moderation_events
VALUES ('70000000-0000-4000-8000-000000000001', 'pin');
INSERT INTO public.community_photo_investigation_holds
VALUES ('80000000-0000-4000-8000-000000000001', true);
INSERT INTO storage.objects
VALUES (
  '90000000-0000-4000-8000-000000000001',
  'community-spot-photos',
  'opaque-object'
);

CREATE TEMP TABLE pre_freeze_policies AS
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'bps_insert_own',
    'bps_update_own',
    'bpsv_insert_own',
    'bpsv_delete_own'
  );

CREATE TEMP TABLE pre_freeze_grants AS
SELECT
  c.relname AS table_name,
  pg_get_userbyid(acl.grantee) AS grantee,
  acl.privilege_type
FROM pg_class c
CROSS JOIN LATERAL aclexplode(c.relacl) acl
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'beach_photo_submissions',
    'beach_photo_submission_votes'
  )
  AND pg_get_userbyid(acl.grantee) IN ('anon', 'authenticated');

CREATE TEMP TABLE pre_freeze_rows AS
SELECT 'beach_photo_submissions' AS object_name,
       md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]')) AS digest
FROM public.beach_photo_submissions row_value
UNION ALL
SELECT 'beach_photo_submission_votes',
       md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
FROM public.beach_photo_submission_votes row_value
UNION ALL
SELECT 'community_spot_photos',
       md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
FROM public.community_spot_photos row_value
UNION ALL
SELECT 'community_photo_votes',
       md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
FROM public.community_photo_votes row_value
UNION ALL
SELECT 'community_photo_moderation_events',
       md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
FROM public.community_photo_moderation_events row_value
UNION ALL
SELECT 'community_photo_investigation_holds',
       md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
FROM public.community_photo_investigation_holds row_value
UNION ALL
SELECT 'storage.objects',
       md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
FROM storage.objects row_value;

DROP POLICY IF EXISTS bps_insert_own ON public.beach_photo_submissions;
DROP POLICY IF EXISTS bps_update_own ON public.beach_photo_submissions;
REVOKE INSERT, UPDATE, DELETE ON public.beach_photo_submissions FROM anon, authenticated;
DROP POLICY IF EXISTS bpsv_insert_own ON public.beach_photo_submission_votes;
DROP POLICY IF EXISTS bpsv_delete_own ON public.beach_photo_submission_votes;
REVOKE INSERT, UPDATE, DELETE ON public.beach_photo_submission_votes FROM anon, authenticated;

\ir ../../scripts/db/restore-community-legacy-photo-writes.sql

DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM pre_freeze_policies
     EXCEPT
     SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname IN (
         'bps_insert_own',
         'bps_update_own',
         'bpsv_insert_own',
         'bpsv_delete_own'
       ))
    UNION ALL
    (SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname IN (
         'bps_insert_own',
         'bps_update_own',
         'bpsv_insert_own',
         'bpsv_delete_own'
       )
     EXCEPT
     SELECT * FROM pre_freeze_policies)
  ) THEN
    RAISE EXCEPTION 'legacy policy restoration mismatch';
  END IF;

  IF EXISTS (
    (SELECT * FROM pre_freeze_grants
     EXCEPT
     SELECT c.relname, pg_get_userbyid(acl.grantee), acl.privilege_type
     FROM pg_class c
     CROSS JOIN LATERAL aclexplode(c.relacl) acl
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relname IN (
         'beach_photo_submissions',
         'beach_photo_submission_votes'
       )
       AND pg_get_userbyid(acl.grantee) IN ('anon', 'authenticated'))
    UNION ALL
    (SELECT c.relname, pg_get_userbyid(acl.grantee), acl.privilege_type
     FROM pg_class c
     CROSS JOIN LATERAL aclexplode(c.relacl) acl
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relname IN (
         'beach_photo_submissions',
         'beach_photo_submission_votes'
       )
       AND pg_get_userbyid(acl.grantee) IN ('anon', 'authenticated')
     EXCEPT
     SELECT * FROM pre_freeze_grants)
  ) THEN
    RAISE EXCEPTION 'legacy grant restoration mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pre_freeze_rows expected
    FULL JOIN (
      SELECT 'beach_photo_submissions' AS object_name,
             md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]')) AS digest
      FROM public.beach_photo_submissions row_value
      UNION ALL
      SELECT 'beach_photo_submission_votes',
             md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
      FROM public.beach_photo_submission_votes row_value
      UNION ALL
      SELECT 'community_spot_photos',
             md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
      FROM public.community_spot_photos row_value
      UNION ALL
      SELECT 'community_photo_votes',
             md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
      FROM public.community_photo_votes row_value
      UNION ALL
      SELECT 'community_photo_moderation_events',
             md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
      FROM public.community_photo_moderation_events row_value
      UNION ALL
      SELECT 'community_photo_investigation_holds',
             md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
      FROM public.community_photo_investigation_holds row_value
      UNION ALL
      SELECT 'storage.objects',
             md5(coalesce(jsonb_agg(to_jsonb(row_value) ORDER BY id)::text, '[]'))
      FROM storage.objects row_value
    ) actual USING (object_name)
    WHERE expected.object_name IS NULL
       OR actual.object_name IS NULL
       OR expected.digest IS DISTINCT FROM actual.digest
  ) THEN
    RAISE EXCEPTION 'restoration changed protected rows or storage objects';
  END IF;
END
$$;

CREATE FUNCTION public.non_owner_submission_write_rejected()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    INSERT INTO public.beach_photo_submissions (
      beach_id,
      submitted_by,
      storage_path,
      image_url,
      status
    )
    VALUES (
      '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      'beach-submissions/non-owner.webp',
      'https://example.invalid/non-owner.webp',
      'pending'
    );
    RETURN false;
  EXCEPTION
    WHEN insufficient_privilege THEN RETURN true;
  END;
END
$$;
GRANT EXECUTE ON FUNCTION public.non_owner_submission_write_rejected()
  TO anon, authenticated;

SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  false
);

DO $$
BEGIN
  IF NOT public.non_owner_submission_write_rejected() THEN
    RAISE EXCEPTION 'non-owner submission insert unexpectedly succeeded';
  END IF;
END
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
DO $$
BEGIN
  IF NOT public.non_owner_submission_write_rejected() THEN
    RAISE EXCEPTION 'anonymous submission insert unexpectedly succeeded';
  END IF;
END
$$;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  false
);
INSERT INTO public.beach_photo_submissions (
  id,
  beach_id,
  submitted_by,
  storage_path,
  image_url,
  status
)
VALUES (
  '30000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'beach-submissions/restored.webp',
  'https://example.invalid/restored.webp',
  'pending'
);
UPDATE public.beach_photo_submissions
SET caption = 'restored'
WHERE id = '30000000-0000-4000-8000-000000000002';

INSERT INTO public.beach_photo_submission_votes (
  id,
  submission_id,
  voter_id,
  vote
)
VALUES (
  '40000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'useful'
);
DELETE FROM public.beach_photo_submission_votes
WHERE id = '40000000-0000-4000-8000-000000000002';
RESET ROLE;
