BEGIN;

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.beaches'::regclass
      AND conname = 'beaches_seo_title_length_check'
  ) THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT beaches_seo_title_length_check
      CHECK (seo_title IS NULL OR char_length(seo_title) BETWEEN 10 AND 60);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.beaches'::regclass
      AND conname = 'beaches_seo_description_length_check'
  ) THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT beaches_seo_description_length_check
      CHECK (seo_description IS NULL OR char_length(seo_description) BETWEEN 50 AND 160);
  END IF;
END;
$$;

COMMIT;
