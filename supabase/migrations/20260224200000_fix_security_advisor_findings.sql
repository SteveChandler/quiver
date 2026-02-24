BEGIN;

-- ============================================================================
-- Fix Supabase Security Advisor Findings
--
-- Resolves:
--   - 4 security_definer_view warnings (add security_invoker = true)
--   - 3 rls_disabled_in_public warnings (enable RLS or revoke access)
--
-- Views already compliant (no changes needed):
--   - ten_day_enhanced_forecasts (has security_invoker = true)
--   - profiles_with_home_beach (has security_invoker = true)
-- ============================================================================

-- ============================================================================
-- PART 1: Views — add security_invoker = true
-- ============================================================================

-- 1a. beach_location_audit (audit-only, not client-facing)
CREATE OR REPLACE VIEW beach_location_audit
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  slug,
  city,
  state,
  country,
  created_at,
  CASE
    WHEN (city IS NULL OR TRIM(city) = '') AND (state IS NULL OR TRIM(state) = '') THEN 'BOTH_MISSING'
    WHEN city IS NULL OR TRIM(city) = '' THEN 'CITY_MISSING'
    WHEN state IS NULL OR TRIM(state) = '' THEN 'STATE_MISSING'
    ELSE 'COMPLETE'
  END as location_status
FROM beaches
WHERE slug IS NOT NULL
  AND (is_private IS NULL OR is_private = false);

-- 1b. beach_location_audit_summary (depends on above view)
CREATE OR REPLACE VIEW beach_location_audit_summary
WITH (security_invoker = true)
AS
SELECT
  location_status,
  COUNT(*) as beach_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM beach_location_audit
GROUP BY location_status
ORDER BY
  CASE location_status
    WHEN 'BOTH_MISSING' THEN 1
    WHEN 'CITY_MISSING' THEN 2
    WHEN 'STATE_MISSING' THEN 3
    WHEN 'COMPLETE' THEN 4
  END;

-- 1c. unified_wave_observations (server-only ML pipeline)
CREATE OR REPLACE VIEW public.unified_wave_observations
WITH (security_invoker = true)
AS
SELECT
  'ioos' AS source,
  o.station_id,
  o.observed_at,
  o.wave_height_m,
  o.wave_period_s,
  o.wave_direction_deg,
  o.water_temp_c,
  s.latitude,
  s.longitude,
  s.nearest_beach_id,
  s.distance_to_beach_km,
  s.source_network
FROM public.ioos_observations o
JOIN public.ioos_stations s USING (station_id)
WHERE s.active = true
  AND o.wave_height_m IS NOT NULL;

-- 1d. beach_photos_featured (not directly queried by app code)
CREATE OR REPLACE VIEW public.beach_photos_featured
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (beach_id)
  beach_id,
  image_url,
  thumb_url,
  attribution_html
FROM public.beach_photos
WHERE approved = true
  AND deleted_at IS NULL
ORDER BY beach_id, fetched_at DESC;

-- ============================================================================
-- PART 2: Tables — enable RLS
-- ============================================================================

-- 2a. storage_bucket_docs — non-sensitive bucket metadata docs
ALTER TABLE public.storage_bucket_docs ENABLE ROW LEVEL SECURITY;

-- Allow public read access (non-sensitive documentation)
CREATE POLICY "storage_bucket_docs_public_read"
  ON public.storage_bucket_docs
  FOR SELECT
  USING (true);

-- 2b. data_cleanup_audit — contains sensitive backup data of deleted records
ALTER TABLE public.data_cleanup_audit ENABLE ROW LEVEL SECURITY;

-- Revoke direct access from anon and authenticated roles
REVOKE ALL ON public.data_cleanup_audit FROM anon;
REVOKE ALL ON public.data_cleanup_audit FROM authenticated;

-- Only service_role (used by server-side operations) can access
-- No RLS policy needed since anon/authenticated are revoked;
-- service_role bypasses RLS by default

-- 2c. spatial_ref_sys — PostGIS system table
-- This table is owned by the postgres superuser and prior migrations
-- have failed with insufficient_privilege. Wrap in exception handler.
DO $$
BEGIN
  -- Attempt to revoke unnecessary access
  EXECUTE 'REVOKE ALL ON public.spatial_ref_sys FROM anon';
  EXECUTE 'REVOKE ALL ON public.spatial_ref_sys FROM authenticated';
  RAISE NOTICE 'Revoked anon/authenticated access to spatial_ref_sys';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not revoke spatial_ref_sys privileges (insufficient_privilege) — this is expected for PostGIS system tables';
  WHEN undefined_table THEN
    RAISE NOTICE 'spatial_ref_sys does not exist — skipping';
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
  RAISE NOTICE 'Enabled RLS on spatial_ref_sys';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not enable RLS on spatial_ref_sys (insufficient_privilege) — this is expected for PostGIS system tables';
  WHEN undefined_table THEN
    RAISE NOTICE 'spatial_ref_sys does not exist — skipping';
END $$;

COMMIT;
