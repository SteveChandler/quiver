-- Fix beaches_history audit table - add missing columns
-- Migration: 20251207100003_fix_beaches_history_columns.sql
--
-- The beaches_history table is missing 4 columns that exist in beaches:
-- - average_rating (numeric)
-- - region (text)
-- - review_count (integer)
-- - slug (text)
--
-- This causes warnings during beach updates:
-- "Failed to log revision for public.beaches: column X of relation beaches_history does not exist"

ALTER TABLE beaches_history ADD COLUMN IF NOT EXISTS average_rating numeric;
ALTER TABLE beaches_history ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE beaches_history ADD COLUMN IF NOT EXISTS review_count integer;
ALTER TABLE beaches_history ADD COLUMN IF NOT EXISTS slug text;
