-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wq_monitoring_stations (
    id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id           TEXT             UNIQUE NOT NULL,
    name                 TEXT             NOT NULL,
    org_id               TEXT,
    org_name             TEXT,
    lat                  DOUBLE PRECISION NOT NULL,
    lon                  DOUBLE PRECISION NOT NULL,
    geog                 geography(Point, 4326)
                             GENERATED ALWAYS AS (
                                 ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
                             ) STORED,
    county               TEXT,
    state                TEXT,
    nearest_beach_id     UUID             REFERENCES public.beaches(id) ON DELETE SET NULL,
    distance_to_beach_m  DOUBLE PRECISION,
    active               BOOLEAN          NOT NULL DEFAULT TRUE,
    last_sample_at       TIMESTAMPTZ,
    synced_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wq_monitoring_stations_geog_gist
    ON public.wq_monitoring_stations USING GIST (geog);

CREATE INDEX IF NOT EXISTS wq_monitoring_stations_nearest_beach_id_idx
    ON public.wq_monitoring_stations (nearest_beach_id);

CREATE INDEX IF NOT EXISTS wq_monitoring_stations_active_state_idx
    ON public.wq_monitoring_stations (active, state);

ALTER TABLE public.wq_monitoring_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wq_monitoring_stations_select_public" ON public.wq_monitoring_stations;
CREATE POLICY "wq_monitoring_stations_select_public"
    ON public.wq_monitoring_stations FOR SELECT USING (true);

DROP POLICY IF EXISTS "wq_monitoring_stations_insert_service_role" ON public.wq_monitoring_stations;
CREATE POLICY "wq_monitoring_stations_insert_service_role"
    ON public.wq_monitoring_stations FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "wq_monitoring_stations_update_service_role" ON public.wq_monitoring_stations;
CREATE POLICY "wq_monitoring_stations_update_service_role"
    ON public.wq_monitoring_stations FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wq_monitoring_stations_delete_service_role" ON public.wq_monitoring_stations;
CREATE POLICY "wq_monitoring_stations_delete_service_role"
    ON public.wq_monitoring_stations FOR DELETE TO service_role USING (true);

GRANT SELECT ON public.wq_monitoring_stations TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.wq_monitoring_stations TO service_role;

CREATE TABLE IF NOT EXISTS public.wq_samples (
    id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id           UUID             NOT NULL REFERENCES public.wq_monitoring_stations(id) ON DELETE CASCADE,
    sample_date          DATE             NOT NULL,
    characteristic       TEXT             NOT NULL,
    value                DOUBLE PRECISION,
    unit                 TEXT             DEFAULT 'MPN/100mL',
    detection_condition  TEXT,
    raw_data             JSONB,
    created_at           TIMESTAMPTZ      DEFAULT NOW(),
    UNIQUE (station_id, sample_date, characteristic)
);

CREATE INDEX IF NOT EXISTS wq_samples_station_id_sample_date_idx
    ON public.wq_samples (station_id, sample_date DESC);

ALTER TABLE public.wq_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wq_samples_select_public" ON public.wq_samples;
CREATE POLICY "wq_samples_select_public" ON public.wq_samples FOR SELECT USING (true);

DROP POLICY IF EXISTS "wq_samples_insert_service_role" ON public.wq_samples;
CREATE POLICY "wq_samples_insert_service_role" ON public.wq_samples FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "wq_samples_update_service_role" ON public.wq_samples;
CREATE POLICY "wq_samples_update_service_role" ON public.wq_samples FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wq_samples_delete_service_role" ON public.wq_samples;
CREATE POLICY "wq_samples_delete_service_role" ON public.wq_samples FOR DELETE TO service_role USING (true);

GRANT SELECT ON public.wq_samples TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.wq_samples TO service_role;

CREATE TABLE IF NOT EXISTS public.beach_water_quality (
    id                      UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    beach_id                UUID             UNIQUE NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
    status                  TEXT             NOT NULL DEFAULT 'unknown'
                                CHECK (status IN ('good', 'advisory', 'closure', 'unknown')),
    previous_status         TEXT
                                CHECK (previous_status IN ('good', 'advisory', 'closure', 'unknown')),
    latest_enterococcus     DOUBLE PRECISION,
    latest_fecal_coliform   DOUBLE PRECISION,
    latest_sample_date      DATE,
    exceedance_count_30d    INTEGER          NOT NULL DEFAULT 0,
    total_samples_30d       INTEGER          NOT NULL DEFAULT 0,
    monitoring_station_id   UUID             REFERENCES public.wq_monitoring_stations(id) ON DELETE SET NULL,
    status_changed_at       TIMESTAMPTZ,
    status_reason           TEXT,
    updated_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS beach_water_quality_active_status_idx
    ON public.beach_water_quality (status)
    WHERE status IN ('advisory', 'closure');

CREATE INDEX IF NOT EXISTS beach_water_quality_status_changed_at_idx
    ON public.beach_water_quality (status_changed_at);

ALTER TABLE public.beach_water_quality ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beach_water_quality_select_public" ON public.beach_water_quality;
CREATE POLICY "beach_water_quality_select_public" ON public.beach_water_quality FOR SELECT USING (true);

DROP POLICY IF EXISTS "beach_water_quality_insert_service_role" ON public.beach_water_quality;
CREATE POLICY "beach_water_quality_insert_service_role" ON public.beach_water_quality FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "beach_water_quality_update_service_role" ON public.beach_water_quality;
CREATE POLICY "beach_water_quality_update_service_role" ON public.beach_water_quality FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "beach_water_quality_delete_service_role" ON public.beach_water_quality;
CREATE POLICY "beach_water_quality_delete_service_role" ON public.beach_water_quality FOR DELETE TO service_role USING (true);

GRANT SELECT ON public.beach_water_quality TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.beach_water_quality TO service_role;

COMMIT;
