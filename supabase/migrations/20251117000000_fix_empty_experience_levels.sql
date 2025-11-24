-- Migration: Fix invalid experience_level values
-- Date: 2025-11-17
-- Issue: ZodError in browser console and CHECK constraint violations
--
-- The Zod schema uses:
--   z.enum(["beginner", "intermediate", "advanced", "expert"]).nullable().optional()
-- Which accepts: "beginner" | "intermediate" | "advanced" | "expert" | null | undefined
-- But does NOT accept: "" (empty string) or "Advanced" (wrong case)
--
-- Production database state (queried 2025-11-18):
--   - 63 profiles with NULL (valid)
--   - 1 profile with "advanced" (valid)
--   - 2 profiles with "" (empty string) - INVALID
--   - 1 profile with "Advanced" (capitalized) - INVALID
--
-- Fix: Convert ALL invalid values to NULL for consistency

-- Log invalid values before conversion (for audit trail)
DO $$
DECLARE
  invalid_values TEXT;
BEGIN
  SELECT STRING_AGG(DISTINCT
    CASE
      WHEN experience_level = '' THEN 'empty_string'
      WHEN experience_level IS NOT NULL THEN experience_level
    END,
    ', '
  ) INTO invalid_values
  FROM public.profiles
  WHERE experience_level IS NOT NULL
    AND experience_level NOT IN ('beginner', 'intermediate', 'advanced', 'expert');

  IF invalid_values IS NOT NULL THEN
    RAISE NOTICE 'Converting invalid experience_level values to NULL: %', invalid_values;
  END IF;
END $$;

-- Update ALL invalid experience_level values to NULL
-- This includes: empty strings, wrong case (e.g., "Advanced"), or any other invalid values
UPDATE public.profiles
SET experience_level = NULL
WHERE experience_level IS NOT NULL
  AND experience_level NOT IN ('beginner', 'intermediate', 'advanced', 'expert');

-- Verify the fix
DO $$
DECLARE
  invalid_count INTEGER;
  invalid_values TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(DISTINCT experience_level, ', ')
  INTO invalid_count, invalid_values
  FROM public.profiles
  WHERE experience_level IS NOT NULL
    AND experience_level NOT IN ('beginner', 'intermediate', 'advanced', 'expert');

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % profiles still have invalid experience_level values: %',
      invalid_count, invalid_values;
  ELSE
    RAISE NOTICE 'Migration successful: All invalid experience_level values converted to NULL';
  END IF;
END $$;

-- Optional: Add a constraint to prevent empty strings in the future
-- This ensures that experience_level can only be one of the valid enum values or NULL
ALTER TABLE public.profiles
ADD CONSTRAINT experience_level_check
CHECK (
  experience_level IS NULL OR
  experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')
);

COMMENT ON CONSTRAINT experience_level_check ON public.profiles IS
  'Ensures experience_level is either NULL or one of the valid enum values: beginner, intermediate, advanced, expert. Empty strings are not allowed.';
