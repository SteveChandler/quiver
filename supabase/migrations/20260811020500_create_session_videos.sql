BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('session-videos', 'session-videos', false, 62914560, ARRAY['video/mp4', 'video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 62914560,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime'];

DROP POLICY IF EXISTS "Users can upload their own session videos" ON storage.objects;
CREATE POLICY "Users can upload their own session videos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'session-videos' AND auth.uid()::text = (storage.foldername(name))[2]
);
DROP POLICY IF EXISTS "Users can read their own session videos" ON storage.objects;
CREATE POLICY "Users can read their own session videos" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'session-videos' AND auth.uid()::text = (storage.foldername(name))[2]
);

ALTER TABLE public.session_media ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved';
-- Shipped native binaries insert photo rows without this column; keep photos public by default after migration.
ALTER TABLE public.session_media ADD COLUMN IF NOT EXISTS thumbnail_path text;
ALTER TABLE public.session_media ADD COLUMN IF NOT EXISTS moderation_reason text;
DO $$ BEGIN
  ALTER TABLE public.session_media ADD CONSTRAINT session_media_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE public.session_media SET moderation_status = 'approved'
WHERE media_type = 'photo' AND moderation_status = 'pending';

DROP POLICY IF EXISTS "Public can view media from public sessions" ON public.session_media;
CREATE POLICY "Public can view approved media from public sessions" ON public.session_media
FOR SELECT USING (
  deleted_at IS NULL AND (
    user_id = auth.uid() OR
    (moderation_status = 'approved' AND EXISTS (
      SELECT 1 FROM public.sessions s WHERE s.id = session_media.session_id
        AND s.is_public = true AND s.deleted_at IS NULL
    ))
  )
);

-- Harness finding: the older OR'd policy also needs the moderation gate or pending videos leak publicly.
DROP POLICY IF EXISTS session_media_select_public_owner_or_admin ON public.session_media;
CREATE POLICY session_media_select_public_owner_or_admin
  ON public.session_media
  FOR SELECT
  USING (
    (
      deleted_at IS NULL
      AND moderation_status = 'approved'
      AND (
        session_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.sessions
          WHERE id = session_media.session_id
            AND COALESCE(is_public, false)
            AND deleted_at IS NULL
        )
      )
    )
    OR user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND is_admin = true
    )
  );

DO $$ BEGIN
  ALTER TYPE content_report_target ADD VALUE IF NOT EXISTS 'session_media';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

COMMIT;
