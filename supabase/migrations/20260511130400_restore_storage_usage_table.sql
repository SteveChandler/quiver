BEGIN;

CREATE TABLE IF NOT EXISTS public.storage_usage (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_bytes bigint NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  image_count integer NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  last_updated timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storage_usage_user_id
  ON public.storage_usage(user_id);

CREATE INDEX IF NOT EXISTS idx_storage_usage_last_updated
  ON public.storage_usage(last_updated DESC);

ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'storage_usage'
      AND policyname = 'Users can view own storage usage'
  ) THEN
    CREATE POLICY "Users can view own storage usage"
      ON public.storage_usage
      FOR SELECT
      TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'storage_usage'
      AND policyname = 'Users can insert own storage usage'
  ) THEN
    CREATE POLICY "Users can insert own storage usage"
      ON public.storage_usage
      FOR INSERT
      TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'storage_usage'
      AND policyname = 'Users can update own storage usage'
  ) THEN
    CREATE POLICY "Users can update own storage usage"
      ON public.storage_usage
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_user_storage_usage(
  p_user_id uuid,
  p_bytes_to_add integer,
  p_images_to_add integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.storage_usage (user_id, total_bytes, image_count, last_updated)
  VALUES (
    p_user_id,
    GREATEST(0, p_bytes_to_add),
    GREATEST(0, p_images_to_add),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_bytes = GREATEST(0, public.storage_usage.total_bytes + p_bytes_to_add),
    image_count = GREATEST(0, public.storage_usage.image_count + p_images_to_add),
    last_updated = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_storage_usage(uuid, integer, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.track_session_media_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.update_user_storage_usage(NEW.user_id, NEW.file_size, 1);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_user_storage_usage(OLD.user_id, -OLD.file_size, -1);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

INSERT INTO public.storage_usage (user_id, total_bytes, image_count, last_updated)
SELECT
  sm.user_id,
  COALESCE(SUM(sm.file_size), 0)::bigint,
  COUNT(*)::integer,
  NOW()
FROM public.session_media sm
WHERE sm.deleted_at IS NULL
GROUP BY sm.user_id
ON CONFLICT (user_id)
DO UPDATE SET
  total_bytes = EXCLUDED.total_bytes,
  image_count = EXCLUDED.image_count,
  last_updated = NOW();

DO $$
BEGIN
  IF to_regclass('public.session_media') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_track_session_media_upload ON public.session_media;
    CREATE TRIGGER trigger_track_session_media_upload
      AFTER INSERT OR DELETE ON public.session_media
      FOR EACH ROW
      EXECUTE FUNCTION public.track_session_media_upload();
  END IF;
END $$;

COMMIT;
