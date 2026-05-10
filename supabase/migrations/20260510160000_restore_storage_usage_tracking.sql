BEGIN;

CREATE TABLE IF NOT EXISTS public.storage_usage (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_bytes BIGINT NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  image_count INTEGER NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      USING (auth.uid() = user_id);
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
      WITH CHECK (auth.uid() = user_id);
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
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_user_storage_usage(
  p_user_id UUID,
  p_bytes_to_add INTEGER,
  p_images_to_add INTEGER DEFAULT 1
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

GRANT EXECUTE ON FUNCTION public.update_user_storage_usage(UUID, INTEGER, INTEGER)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.track_session_media_upload()
RETURNS TRIGGER
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
