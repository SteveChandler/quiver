-- Add optional profile context collected after a completed game heat.
BEGIN;

ALTER TABLE public.play_leads
  ADD COLUMN IF NOT EXISTS home_break text,
  ADD COLUMN IF NOT EXISTS surf_frequency text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.play_leads'::regclass
      AND conname = 'play_leads_surf_frequency_check'
  ) THEN
    ALTER TABLE public.play_leads
      ADD CONSTRAINT play_leads_surf_frequency_check
      CHECK (surf_frequency IS NULL OR surf_frequency IN (
        'a few times a year',
        'monthly',
        'weekly',
        'every chance I get'
      ));
  END IF;
END $$;

COMMIT;
