-- Ensure public (anon) can execute intel/reviews RPCs used by unauthenticated users
-- Safe and idempotent across environments

BEGIN;

GRANT EXECUTE ON FUNCTION public.get_nearby_intel_posts(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, DOUBLE PRECISION, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_beach_reviews(UUID, INTEGER, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_beach_review_stats(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_intel_confirmations(UUID) TO anon;

COMMIT;


