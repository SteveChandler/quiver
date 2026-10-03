-- Allow the overlapping 3-5ft bucket on conditions reports. Additive: every
-- existing value stays valid.
-- Rollback: recreate the check without '3-5ft' after confirming no rows use it.
BEGIN;

ALTER TABLE public.intel_posts
  DROP CONSTRAINT IF EXISTS intel_posts_wave_size_range_check;

ALTER TABLE public.intel_posts
  ADD CONSTRAINT intel_posts_wave_size_range_check
  CHECK (wave_size_range IS NULL OR wave_size_range IN ('1-2ft', '2-3ft', '3-4ft', '3-5ft', '4-5ft', '5+ft'));

COMMIT;
