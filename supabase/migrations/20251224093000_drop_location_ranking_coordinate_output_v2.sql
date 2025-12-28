-- Drop broken location ranking RPC v2 functions.
--
-- Why this exists:
-- - The v2 functions were introduced to standardize output field names, but they
--   referenced columns that do not exist on `public.beaches` in this schema.
-- - We keep the canonical DB/app convention as `lat/lon` and remove v2 to avoid
--   future confusion and runtime errors.
--
BEGIN;

DROP FUNCTION IF EXISTS get_beaches_by_location_with_scores_v2(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_beaches_by_metro_with_scores_v2(TEXT[], TEXT, TEXT);

COMMIT;



