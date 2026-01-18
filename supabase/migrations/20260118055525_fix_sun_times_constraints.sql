-- Fix sun_times table constraint conflicts
-- Issue: Migration 20250820132500 tried to add PRIMARY KEY on (beach_id,date)
--        but existing UNIQUE constraint on (beach_id,date,source) conflicts
--        This prevents upserts from working correctly
--
-- Solution:
-- 1. Ensure table has correct structure with id PK
-- 2. Ensure sun_times_unique constraint on (beach_id,date,source) exists
-- 3. Remove any conflicting PK on (beach_id,date) if it was added
-- 4. Verify source check constraint allows 'computed'

BEGIN;

-- Step 1: Verify table structure
-- The table should have an 'id' column as primary key (from original migration)
DO $$
BEGIN
  -- If table doesn't have id column, add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sun_times'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE public.sun_times ADD COLUMN id UUID DEFAULT gen_random_uuid();
    RAISE NOTICE 'Added id column to sun_times';
  END IF;
END $$;

-- Step 2: Remove any conflicting PRIMARY KEY on (beach_id,date)
-- This PK prevents multiple sources per beach/date combination
DO $$
DECLARE
  pk_constraint_name TEXT;
BEGIN
  -- Find if there's a PK on (beach_id,date) specifically
  SELECT conname INTO pk_constraint_name
  FROM pg_constraint c
  JOIN pg_index i ON i.indexrelid = c.conindid
  WHERE c.conrelid = 'public.sun_times'::regclass
    AND c.contype = 'p'
    AND array_length(c.conkey, 1) = 2
    AND EXISTS (
      SELECT 1 FROM unnest(c.conkey) AS col
      JOIN pg_attribute a ON a.attnum = col AND a.attrelid = c.conrelid
      WHERE a.attname IN ('beach_id', 'date')
    );

  IF pk_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sun_times DROP CONSTRAINT %I', pk_constraint_name);
    RAISE NOTICE 'Dropped conflicting primary key constraint: %', pk_constraint_name;
  END IF;
END $$;

-- Step 3: Ensure id is the primary key
DO $$
BEGIN
  -- Check if there's already a primary key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sun_times'::regclass
      AND contype = 'p'
  ) THEN
    -- No PK exists, add it on id
    ALTER TABLE public.sun_times ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added PRIMARY KEY on id column';
  ELSE
    -- Check if existing PK is on id
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.conrelid = 'public.sun_times'::regclass
        AND c.contype = 'p'
        AND a.attname = 'id'
        AND array_length(c.conkey, 1) = 1
    ) THEN
      RAISE NOTICE 'Existing PK is not on id column - manual intervention needed';
    ELSE
      RAISE NOTICE 'PRIMARY KEY on id already exists';
    END IF;
  END IF;
END $$;

-- Step 4: Ensure unique constraint on (beach_id,date,source) exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sun_times_unique'
      AND conrelid = 'public.sun_times'::regclass
  ) THEN
    ALTER TABLE public.sun_times
      ADD CONSTRAINT sun_times_unique UNIQUE (beach_id, date, source);
    RAISE NOTICE 'Added sun_times_unique constraint';
  ELSE
    RAISE NOTICE 'sun_times_unique constraint already exists';
  END IF;
END $$;

-- Step 5: Verify source check constraint allows 'computed'
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sun_times_source_check'
      AND conrelid = 'public.sun_times'::regclass
  ) THEN
    ALTER TABLE public.sun_times DROP CONSTRAINT sun_times_source_check;
    RAISE NOTICE 'Dropped old source check constraint';
  END IF;

  -- Recreate with correct values
  ALTER TABLE public.sun_times
    ADD CONSTRAINT sun_times_source_check
    CHECK (source IN ('open-meteo', 'computed'));

  RAISE NOTICE 'Added source check constraint allowing open-meteo and computed';
END $$;

-- Step 6: Remove any duplicate index on (beach_id,date)
DROP INDEX IF EXISTS public.sun_times_beach_date_unique;

-- Step 7: Verify required columns exist
DO $$
BEGIN
  -- Ensure beach_id column exists and has FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sun_times'
      AND column_name = 'beach_id'
  ) THEN
    RAISE EXCEPTION 'beach_id column missing - manual intervention needed';
  END IF;

  -- Ensure date column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sun_times'
      AND column_name = 'date'
  ) THEN
    RAISE EXCEPTION 'date column missing - manual intervention needed';
  END IF;

  -- Ensure source column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sun_times'
      AND column_name = 'source'
  ) THEN
    RAISE EXCEPTION 'source column missing - manual intervention needed';
  END IF;

  RAISE NOTICE 'All required columns exist';
END $$;

-- Step 8: Add helpful index for queries
CREATE INDEX IF NOT EXISTS idx_sun_times_beach_date
  ON public.sun_times (beach_id, date);

COMMIT;

-- Migration Summary:
-- ✓ Ensures id is PRIMARY KEY (not beach_id,date)
-- ✓ Ensures UNIQUE constraint on (beach_id,date,source) for upserts
-- ✓ Removes conflicting PK on (beach_id,date) if it exists
-- ✓ Verifies source check allows 'computed'
-- ✓ Adds index for efficient queries

-- Rollback SQL:
-- This migration is idempotent and safe to re-run
-- No explicit rollback needed as it fixes schema inconsistencies
