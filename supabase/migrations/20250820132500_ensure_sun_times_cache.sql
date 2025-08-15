-- Ensure sun_times cache exists with desired columns and key

BEGIN;

-- Create table if missing
CREATE TABLE IF NOT EXISTS public.sun_times (
  beach_id uuid NOT NULL,
  date date NOT NULL,
  sunrise_utc timestamptz,
  sunset_utc timestamptz,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns if they don't exist (for existing deployments)
ALTER TABLE public.sun_times
  ADD COLUMN IF NOT EXISTS sunrise_utc timestamptz,
  ADD COLUMN IF NOT EXISTS sunset_utc timestamptz,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Prefer primary key (beach_id,date) when possible; otherwise add a unique index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sun_times'::regclass
      AND contype = 'p'
  ) THEN
    -- Try to set primary key on (beach_id,date) if not already set
    BEGIN
      ALTER TABLE public.sun_times
        ADD CONSTRAINT sun_times_pkey PRIMARY KEY (beach_id, date);
    EXCEPTION WHEN duplicate_table THEN
      -- ignore
    WHEN duplicate_object THEN
      -- ignore
    WHEN others THEN
      -- Fall back to unique index if PK cannot be set due to existing PK or duplicates
      CREATE UNIQUE INDEX IF NOT EXISTS sun_times_beach_date_unique
        ON public.sun_times (beach_id, date);
    END;
  END IF;
END$$;

COMMIT;


