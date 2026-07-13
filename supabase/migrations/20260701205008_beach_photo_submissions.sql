-- Migration: Beach Photo Submissions + Votes (Lane 056, Slice 0)
-- Description: Community beach-level photo submission foundation. A surfer submits a
--              *pending* candidate beach photo that the public cannot see until an admin
--              approves it. Approved submissions are later (Slice 3) copied into the
--              admin-owned public.beach_photos table (source='user') so the existing read
--              path (beach_photos_featured view, native use-beach-detail, web zine hero)
--              surfaces them with zero read-path changes.
-- Date: 2026-07-01
-- Author: Lane 056 — beach-photo-community
--
-- STORAGE: Reuses the existing public `session-media` bucket. Uploads land under
--          `beach-submissions/<userId>/<uuid>.<ext>`, which satisfies the bucket's
--          existing authenticated-INSERT check
--          `auth.uid()::text = (storage.foldername(name))[2]`
--          (migration 20251102000001_create_session_media_bucket.sql). No storage-policy
--          changes are required by this migration.
--
-- PRIVACY: A beach photo submission is public-by-intent. It intentionally carries NO
--          lat/lon, custom_spot_id, or EXIF GPS — only beach_id + submitter + image.
--
-- DEPENDENCIES:
--   - public.beaches(id)  — baseline_core_tables
--   - public.profiles(id) — baseline_core_tables
--   - public.is_admin_user() — 20251024000005_add_admin_rls_policies.sql (SECURITY DEFINER)
--
-- SAFETY: Idempotent (IF NOT EXISTS tables/indexes; pg_policies-guarded CREATE POLICY).
--         Wrapped BEGIN; ... COMMIT;. Rollback block at the end.
--         SHARED prod/dev Supabase — do NOT apply to remote without the MIGRATION_SAFETY.md
--         PLAN -> `APPROVE: <sha>` two-step. Test locally with `supabase db reset` first.

BEGIN;

-- ================================================
-- 1. Table: beach_photo_submissions
-- ================================================

CREATE TABLE IF NOT EXISTS public.beach_photo_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id      uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  submitted_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,               -- session-media bucket: beach-submissions/<userId>/<uuid>.<ext>
  image_url     text NOT NULL,
  thumb_url     text,
  caption       text CHECK (caption IS NULL OR char_length(caption) <= 280),
  license_code  text NOT NULL DEFAULT 'user_contributed',
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  useful_count  integer NOT NULL DEFAULT 0,
  stale_count   integer NOT NULL DEFAULT 0,
  reviewed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

COMMENT ON TABLE public.beach_photo_submissions IS
  'Surfer-submitted candidate beach-level photos. Public-by-intent; carries no lat/lon or custom_spot_id. Public read is restricted to approved, non-deleted rows via RLS; approved rows are promoted into beach_photos in Slice 3.';

CREATE INDEX IF NOT EXISTS idx_bps_beach_status
  ON public.beach_photo_submissions (beach_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bps_submitted_by
  ON public.beach_photo_submissions (submitted_by);

-- Abuse control: cap active pending submissions to one per user per beach.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bps_one_pending_per_user_beach
  ON public.beach_photo_submissions (beach_id, submitted_by)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- ================================================
-- 2. Table: beach_photo_submission_votes
-- ================================================

CREATE TABLE IF NOT EXISTS public.beach_photo_submission_votes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.beach_photo_submissions(id) ON DELETE CASCADE,
  voter_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote          text NOT NULL CHECK (vote IN ('useful', 'stale')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, voter_id)            -- one vote per user per submission
);

COMMENT ON TABLE public.beach_photo_submission_votes IS
  'One useful/stale vote per user per beach photo submission. Counts are maintained on the submission row (Slice 2).';

CREATE INDEX IF NOT EXISTS idx_bpsv_submission
  ON public.beach_photo_submission_votes (submission_id);

CREATE INDEX IF NOT EXISTS idx_bpsv_voter
  ON public.beach_photo_submission_votes (voter_id);

-- ================================================
-- 3. Enable RLS
-- ================================================

ALTER TABLE public.beach_photo_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beach_photo_submission_votes ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 4. RLS policies: beach_photo_submissions
-- ================================================

-- Public/anon read: only approved, non-deleted (mirrors beach_photos_read_public).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submissions'
      AND policyname = 'bps_read_public'
  ) THEN
    CREATE POLICY bps_read_public ON public.beach_photo_submissions
      FOR SELECT
      USING (status = 'approved' AND deleted_at IS NULL);
  END IF;
END $$;

-- Owner reads own rows in any status (so they can see their pending submission).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submissions'
      AND policyname = 'bps_read_own'
  ) THEN
    CREATE POLICY bps_read_own ON public.beach_photo_submissions
      FOR SELECT
      USING (auth.uid() = submitted_by);
  END IF;
END $$;

-- Owner inserts a pending row for themselves only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submissions'
      AND policyname = 'bps_insert_own'
  ) THEN
    CREATE POLICY bps_insert_own ON public.beach_photo_submissions
      FOR INSERT
      WITH CHECK (auth.uid() = submitted_by AND status = 'pending');
  END IF;
END $$;

-- Owner may update own row only while still pending (e.g. soft-delete via deleted_at);
-- WITH CHECK keeps status pinned to 'pending' so a submitter cannot self-approve.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submissions'
      AND policyname = 'bps_update_own'
  ) THEN
    CREATE POLICY bps_update_own ON public.beach_photo_submissions
      FOR UPDATE
      USING (auth.uid() = submitted_by AND status = 'pending')
      WITH CHECK (auth.uid() = submitted_by AND status = 'pending');
  END IF;
END $$;

-- Admin full read (including pending/rejected/deleted for moderation).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submissions'
      AND policyname = 'bps_admin_select'
  ) THEN
    CREATE POLICY bps_admin_select ON public.beach_photo_submissions
      FOR SELECT
      USING (public.is_admin_user());
  END IF;
END $$;

-- Admin moderates: flip status, set reviewed_by/reviewed_at, adjust counts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submissions'
      AND policyname = 'bps_admin_update'
  ) THEN
    CREATE POLICY bps_admin_update ON public.beach_photo_submissions
      FOR UPDATE
      USING (public.is_admin_user())
      WITH CHECK (public.is_admin_user());
  END IF;
END $$;

-- Admin can delete (hard-delete) any submission.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submissions'
      AND policyname = 'bps_admin_delete'
  ) THEN
    CREATE POLICY bps_admin_delete ON public.beach_photo_submissions
      FOR DELETE
      USING (public.is_admin_user());
  END IF;
END $$;

-- ================================================
-- 5. RLS policies: beach_photo_submission_votes
-- ================================================

-- Authenticated users can read all votes (for aggregate display).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submission_votes'
      AND policyname = 'bpsv_read'
  ) THEN
    CREATE POLICY bpsv_read ON public.beach_photo_submission_votes
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Authenticated users insert their own vote (unique per submission enforces one vote).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submission_votes'
      AND policyname = 'bpsv_insert_own'
  ) THEN
    CREATE POLICY bpsv_insert_own ON public.beach_photo_submission_votes
      FOR INSERT
      WITH CHECK (auth.uid() = voter_id);
  END IF;
END $$;

-- Users can delete their own vote (toggle off).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submission_votes'
      AND policyname = 'bpsv_delete_own'
  ) THEN
    CREATE POLICY bpsv_delete_own ON public.beach_photo_submission_votes
      FOR DELETE
      USING (auth.uid() = voter_id);
  END IF;
END $$;

-- Admin full control over votes (moderation / abuse cleanup).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beach_photo_submission_votes'
      AND policyname = 'bpsv_admin_all'
  ) THEN
    CREATE POLICY bpsv_admin_all ON public.beach_photo_submission_votes
      FOR ALL
      USING (public.is_admin_user())
      WITH CHECK (public.is_admin_user());
  END IF;
END $$;

COMMIT;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP POLICY IF EXISTS bpsv_admin_all      ON public.beach_photo_submission_votes;
-- DROP POLICY IF EXISTS bpsv_delete_own     ON public.beach_photo_submission_votes;
-- DROP POLICY IF EXISTS bpsv_insert_own     ON public.beach_photo_submission_votes;
-- DROP POLICY IF EXISTS bpsv_read           ON public.beach_photo_submission_votes;
-- DROP POLICY IF EXISTS bps_admin_delete    ON public.beach_photo_submissions;
-- DROP POLICY IF EXISTS bps_admin_update    ON public.beach_photo_submissions;
-- DROP POLICY IF EXISTS bps_admin_select    ON public.beach_photo_submissions;
-- DROP POLICY IF EXISTS bps_update_own      ON public.beach_photo_submissions;
-- DROP POLICY IF EXISTS bps_insert_own      ON public.beach_photo_submissions;
-- DROP POLICY IF EXISTS bps_read_own        ON public.beach_photo_submissions;
-- DROP POLICY IF EXISTS bps_read_public     ON public.beach_photo_submissions;
-- DROP TABLE IF EXISTS public.beach_photo_submission_votes CASCADE;
-- DROP TABLE IF EXISTS public.beach_photo_submissions CASCADE;
-- COMMIT;

-- ================================================
-- VALIDATION QUERIES (run manually after apply; NOT executed by this migration)
-- ================================================
-- 1. Tables exist:
-- SELECT to_regclass('public.beach_photo_submissions');       -- not null
-- SELECT to_regclass('public.beach_photo_submission_votes');  -- not null
--
-- 2. Policy count (expect >= 7 on submissions, >= 4 on votes):
-- SELECT count(*) FROM pg_policies WHERE tablename = 'beach_photo_submissions';
-- SELECT count(*) FROM pg_policies WHERE tablename = 'beach_photo_submission_votes';
--
-- 3. RLS enabled:
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'beach_photo_submissions';       -- t
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'beach_photo_submission_votes';  -- t
--
-- 4. Simulated-role checks (as authenticated non-admin):
--    - An INSERT with status='pending' for auth.uid()=submitted_by succeeds.
--    - A SELECT of another user's pending row returns 0 rows.
--    - A SELECT of an approved row returns 1 row.
