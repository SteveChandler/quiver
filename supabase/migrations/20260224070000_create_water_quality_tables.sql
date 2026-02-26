BEGIN;

-- ============================================================
-- Water Quality Feature
--
-- Creates the monitoring station table, raw sample table, and
-- computed per-beach status table needed to surface CEDEN/PacIOOS
-- water quality advisories and closures on beach detail pages.
--
-- Objects created (in dependency order):
--   1. public.wq_monitoring_stations  — monitoring station registry (CEDEN/PacIOOS)
--   2. public.wq_samples              — raw bacteria measurements
--   3. public.beach_water_quality     — computed per-beach status
--   4. pg_cron job                    — monthly 1-year data retention cleanup
-- ============================================================

-- ============================================================
-- 1. wq_monitoring_stations
--    Registry of CEDEN (CA) and PacIOOS ERDDAP (HI) monitoring
--    stations. Written by the server-side sync service
--    (service_role only). Publicly readable so client queries
--    can display station attribution.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wq_monitoring_stations (
    id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id           TEXT             UNIQUE NOT NULL,  -- Source-prefixed ID (e.g. CEDEN-{code}, PACIOOS-{id})
    name                 TEXT             NOT NULL,
    org_id               TEXT,                              -- source organization ID
    org_name             TEXT,                              -- organization name
    lat                  DOUBLE PRECISION NOT NULL,
    lon                  DOUBLE PRECISION NOT NULL,
    geog                 geography(Point, 4326)
                             GENERATED ALWAYS AS (
                                 ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
                             ) STORED,
    county               TEXT,
    state                TEXT,
    -- Beach linkage — populated by spatial proximity matching after sync
    nearest_beach_id     UUID             REFERENCES public.beaches(id) ON DELETE SET NULL,
    distance_to_beach_m  DOUBLE PRECISION,
    active               BOOLEAN          NOT NULL DEFAULT TRUE,
    last_sample_at       TIMESTAMPTZ,
    synced_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Spatial index for proximity queries (beach linkage, nearby lookups)
CREATE INDEX IF NOT EXISTS wq_monitoring_stations_geog_gist
    ON public.wq_monitoring_stations USING GIST (geog);

CREATE INDEX IF NOT EXISTS wq_monitoring_stations_nearest_beach_id_idx
    ON public.wq_monitoring_stations (nearest_beach_id);

-- Composite index for cron/sync queries that filter by active status + state
CREATE INDEX IF NOT EXISTS wq_monitoring_stations_active_state_idx
    ON public.wq_monitoring_stations (active, state);

-- ============================================================
-- 2. RLS on wq_monitoring_stations
--    Public read, service_role write (sync service uses service_role).
-- ============================================================
ALTER TABLE public.wq_monitoring_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wq_monitoring_stations_select_public" ON public.wq_monitoring_stations;
CREATE POLICY "wq_monitoring_stations_select_public"
    ON public.wq_monitoring_stations
    FOR SELECT
    USING (true);

-- INSERT — service_role only (sync service writes new station records)
DROP POLICY IF EXISTS "wq_monitoring_stations_insert_service_role" ON public.wq_monitoring_stations;
CREATE POLICY "wq_monitoring_stations_insert_service_role"
    ON public.wq_monitoring_stations
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- UPDATE — service_role only (re-sync updates existing records)
DROP POLICY IF EXISTS "wq_monitoring_stations_update_service_role" ON public.wq_monitoring_stations;
CREATE POLICY "wq_monitoring_stations_update_service_role"
    ON public.wq_monitoring_stations
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- DELETE — service_role only (tombstone stale stations if needed)
DROP POLICY IF EXISTS "wq_monitoring_stations_delete_service_role" ON public.wq_monitoring_stations;
CREATE POLICY "wq_monitoring_stations_delete_service_role"
    ON public.wq_monitoring_stations
    FOR DELETE
    TO service_role
    USING (true);

-- Explicit grants: anon/authenticated may read; service_role has full access
GRANT SELECT ON public.wq_monitoring_stations TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.wq_monitoring_stations TO service_role;

COMMENT ON TABLE public.wq_monitoring_stations IS
    'Monitoring station registry (CEDEN for CA, PacIOOS ERDDAP for HI). '
    'Written by the server-side sync service; readable by all roles. '
    'Stations are linked to the nearest beach via spatial proximity matching.';

-- ============================================================
-- 3. wq_samples
--    Raw bacteria measurements pulled from CEDEN and PacIOOS
--    ERDDAP. One row per (station, date, characteristic)
--    combination. Non-detect results store NULL in value with a
--    detection_condition description instead.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wq_samples (
    id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id           UUID             NOT NULL REFERENCES public.wq_monitoring_stations(id) ON DELETE CASCADE,
    sample_date          DATE             NOT NULL,
    characteristic       TEXT             NOT NULL,  -- e.g. "Enterococcus", "Fecal Coliform"
    value                DOUBLE PRECISION,           -- CFU/100mL; NULL for non-detect results
    unit                 TEXT             DEFAULT 'CFU/100mL',
    detection_condition  TEXT,                       -- e.g. "Not Detected", "Present Above Quantification Limit"
    -- Full source activity response for forward compatibility
    raw_data             JSONB,
    created_at           TIMESTAMPTZ      DEFAULT NOW(),
    UNIQUE (station_id, sample_date, characteristic)
);

-- Primary access pattern: fetch recent samples for a station ordered by date
CREATE INDEX IF NOT EXISTS wq_samples_station_id_sample_date_idx
    ON public.wq_samples (station_id, sample_date DESC);

-- ============================================================
-- 4. RLS on wq_samples
--    Public read, service_role write (same rationale as parent table).
-- ============================================================
ALTER TABLE public.wq_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wq_samples_select_public" ON public.wq_samples;
CREATE POLICY "wq_samples_select_public"
    ON public.wq_samples
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "wq_samples_insert_service_role" ON public.wq_samples;
CREATE POLICY "wq_samples_insert_service_role"
    ON public.wq_samples
    FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "wq_samples_update_service_role" ON public.wq_samples;
CREATE POLICY "wq_samples_update_service_role"
    ON public.wq_samples
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "wq_samples_delete_service_role" ON public.wq_samples;
CREATE POLICY "wq_samples_delete_service_role"
    ON public.wq_samples
    FOR DELETE
    TO service_role
    USING (true);

GRANT SELECT ON public.wq_samples TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.wq_samples TO service_role;

COMMENT ON TABLE public.wq_samples IS
    'Raw bacteria measurements from CEDEN and PacIOOS ERDDAP. '
    'One row per (station, date, characteristic). value is CFU/100mL; '
    'NULL value with a detection_condition indicates a non-detect result. '
    'Rows older than 1 year are purged monthly by a pg_cron job.';

-- ============================================================
-- 5. beach_water_quality
--    Computed per-beach water quality status. One row per beach,
--    maintained by the CEDEN/PacIOOS sync service after each
--    sample ingest. status reflects the most recent
--    advisory/closure state derived from the linked monitoring
--    station samples.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.beach_water_quality (
    id                      UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    beach_id                UUID             UNIQUE NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
    status                  TEXT             NOT NULL DEFAULT 'unknown'
                                CHECK (status IN ('good', 'advisory', 'closure', 'unknown')),
    previous_status         TEXT
                                CHECK (previous_status IN ('good', 'advisory', 'closure', 'unknown')),
    -- Latest indicator values for display (NULL until first sample is ingested)
    latest_enterococcus     DOUBLE PRECISION,  -- latest Enterococcus value (CFU/100mL)
    latest_fecal_coliform   DOUBLE PRECISION,  -- latest Fecal Coliform value (CFU/100mL)
    latest_sample_date      DATE,
    -- Rolling 30-day exceedance statistics
    exceedance_count_30d    INTEGER          NOT NULL DEFAULT 0,
    total_samples_30d       INTEGER          NOT NULL DEFAULT 0,
    -- Station linkage — the primary station driving this beach's status
    monitoring_station_id   UUID             REFERENCES public.wq_monitoring_stations(id) ON DELETE SET NULL,
    status_changed_at       TIMESTAMPTZ,
    status_reason           TEXT,
    updated_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Partial index for fast advisory/closure dashboard queries
CREATE INDEX IF NOT EXISTS beach_water_quality_active_status_idx
    ON public.beach_water_quality (status)
    WHERE status IN ('advisory', 'closure');

-- Index for notification queries that scan recently changed statuses
CREATE INDEX IF NOT EXISTS beach_water_quality_status_changed_at_idx
    ON public.beach_water_quality (status_changed_at);

-- ============================================================
-- 6. RLS on beach_water_quality
--    Public read, service_role write (same rationale as other
--    water quality tables).
-- ============================================================
ALTER TABLE public.beach_water_quality ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beach_water_quality_select_public" ON public.beach_water_quality;
CREATE POLICY "beach_water_quality_select_public"
    ON public.beach_water_quality
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "beach_water_quality_insert_service_role" ON public.beach_water_quality;
CREATE POLICY "beach_water_quality_insert_service_role"
    ON public.beach_water_quality
    FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "beach_water_quality_update_service_role" ON public.beach_water_quality;
CREATE POLICY "beach_water_quality_update_service_role"
    ON public.beach_water_quality
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "beach_water_quality_delete_service_role" ON public.beach_water_quality;
CREATE POLICY "beach_water_quality_delete_service_role"
    ON public.beach_water_quality
    FOR DELETE
    TO service_role
    USING (true);

GRANT SELECT ON public.beach_water_quality TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.beach_water_quality TO service_role;

COMMENT ON TABLE public.beach_water_quality IS
    'Computed per-beach water quality status derived from CEDEN/PacIOOS sample data. '
    'One row per beach_id. Maintained by the CEDEN/PacIOOS sync service after each '
    'sample ingest cycle. status transitions trigger push notifications when '
    'notif_water_quality is enabled on the user profile.';

-- ============================================================
-- 7. pg_cron data retention job
--    Purges wq_samples rows older than 1 year on the first day
--    of each month at 03:00 UTC. Wrapped in a DO block so the
--    migration is a no-op on environments where pg_cron is not
--    installed (local dev without the extension enabled).
-- ============================================================
DO $outer$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        PERFORM cron.schedule(
            'wq-samples-cleanup',
            '0 3 1 * *',
            $$DELETE FROM public.wq_samples WHERE sample_date < CURRENT_DATE - INTERVAL '1 year'$$
        );
    END IF;
END;
$outer$;

COMMIT;
