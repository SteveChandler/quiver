-- Fix intel confirmations not incrementing due to RLS blocking trigger updates
-- Make the trigger function SECURITY DEFINER so it bypasses RLS when updating intel_posts

-- Recreate function with SECURITY DEFINER and stable search_path
CREATE OR REPLACE FUNCTION public.update_intel_post_confirmations_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts 
        SET confirmations_count = confirmations_count + 1 
        WHERE id = NEW.intel_post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts 
        SET confirmations_count = GREATEST(confirmations_count - 1, 0)
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.intel_post_confirmations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS intel_post_confirmations_count_trigger ON public.intel_post_confirmations;
    CREATE TRIGGER intel_post_confirmations_count_trigger
        AFTER INSERT OR DELETE ON public.intel_post_confirmations
        FOR EACH ROW
        EXECUTE FUNCTION public.update_intel_post_confirmations_count();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL AND to_regclass('public.intel_post_confirmations') IS NOT NULL THEN
    UPDATE public.intel_posts p
    SET confirmations_count = COALESCE(c.cnt, 0)
    FROM (
      SELECT intel_post_id, COUNT(*)::int AS cnt
      FROM public.intel_post_confirmations
      GROUP BY intel_post_id
    ) c
    WHERE p.id = c.intel_post_id OR NOT EXISTS (
      SELECT 1 FROM public.intel_post_confirmations x WHERE x.intel_post_id = p.id
    );
  END IF;
END $$;

COMMENT ON FUNCTION public.update_intel_post_confirmations_count IS 'SECURITY DEFINER trigger to maintain intel_posts.confirmations_count despite RLS';

