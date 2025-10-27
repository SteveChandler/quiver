-- Add Beach Review Aggregate Columns
-- Migration: 20251024000009
-- Description: Adds average_rating and review_count columns to beaches table
--              These columns will store aggregated review statistics for display
--              in the beach Overview tab.

BEGIN;

-- Add average_rating column (overall rating average)
ALTER TABLE public.beaches
ADD COLUMN IF NOT EXISTS average_rating NUMERIC;

-- Add review_count column (total number of reviews)
ALTER TABLE public.beaches
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.beaches.average_rating IS 'Average overall rating from beach reviews (1-5 scale)';
COMMENT ON COLUMN public.beaches.review_count IS 'Total number of reviews for this beach';

-- Backfill existing data from beach_reviews table
UPDATE public.beaches b
SET
  average_rating = stats.avg_rating,
  review_count = stats.count
FROM (
  SELECT
    beach_id,
    ROUND(AVG(overall_rating), 2) as avg_rating,
    COUNT(*) as count
  FROM public.beach_reviews
  GROUP BY beach_id
) stats
WHERE b.id = stats.beach_id;

-- Create index for efficient querying by rating
CREATE INDEX IF NOT EXISTS idx_beaches_average_rating
ON public.beaches(average_rating DESC NULLS LAST)
WHERE average_rating IS NOT NULL;

-- Create index for efficient querying by review count
CREATE INDEX IF NOT EXISTS idx_beaches_review_count
ON public.beaches(review_count DESC)
WHERE review_count > 0;

COMMIT;
