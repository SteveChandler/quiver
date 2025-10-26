-- Restructure beaches table: rename location→city, region→state, and clean data
-- This migration parses combined location data (e.g., "Huntington Beach, CA")
-- into separate city and state columns

BEGIN;

-- Step 1: Parse the region data to populate location (city) and update region (state)
-- Pattern: "City Name, ST" where ST is 2-letter state code
-- Examples:
--   "Huntington Beach, CA" → location="Huntington Beach", region="CA"
--   "La Jolla, San Diego, CA" → location="La Jolla, San Diego", region="CA"
--   "Baja California" → location=NULL, region="Baja California"

UPDATE public.beaches
SET
  -- Extract city part: everything before the last comma followed by 2-letter code
  location = CASE
    WHEN region ~ ',\s+[A-Z]{2}$' THEN
      TRIM(substring(region from '^(.+),\s+[A-Z]{2}$'))
    ELSE NULL
  END,
  -- Extract state part: just the 2-letter code, or keep entire value if no match
  region = CASE
    WHEN region ~ ',\s+[A-Z]{2}$' THEN
      TRIM(substring(region from ',\s+([A-Z]{2})$'))
    ELSE region
  END
WHERE region IS NOT NULL;

-- Step 2: Rename the columns to their final names
ALTER TABLE public.beaches RENAME COLUMN location TO city;
ALTER TABLE public.beaches RENAME COLUMN region TO state;

-- Step 2.5: Add slug column if it doesn't exist
ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS slug TEXT;

-- Step 3: Populate slug column from beach names
-- Generate URL-friendly slugs: lowercase, spaces→hyphens, remove special chars
-- Ensure uniqueness by appending a number if needed
UPDATE public.beaches
SET slug = (
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(name),
        '[^a-z0-9\s-]', '', 'g'  -- Remove special characters
      ),
      '\s+', '-', 'g'  -- Replace spaces with hyphens
    ),
    '-+', '-', 'g'  -- Collapse multiple hyphens
  )
);

-- Handle duplicate slugs by appending incrementing numbers
DO $$
DECLARE
  r RECORD;
  new_slug TEXT;
  counter INT;
BEGIN
  FOR r IN
    SELECT slug, array_agg(id ORDER BY created_at) as ids
    FROM public.beaches
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING count(*) > 1
  LOOP
    counter := 2;
    FOR i IN 2..array_length(r.ids, 1) LOOP
      new_slug := r.slug || '-' || counter::TEXT;
      -- Ensure the new slug is also unique
      WHILE EXISTS (SELECT 1 FROM public.beaches WHERE slug = new_slug) LOOP
        counter := counter + 1;
        new_slug := r.slug || '-' || counter::TEXT;
      END LOOP;
      UPDATE public.beaches SET slug = new_slug WHERE id = r.ids[i];
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN public.beaches.city IS 'City or locality where the beach is located';
COMMENT ON COLUMN public.beaches.state IS 'State, province, or region (e.g., CA, Baja California)';
COMMENT ON COLUMN public.beaches.slug IS 'URL-friendly unique identifier for the beach';

COMMIT;
