-- 72 h rainfall per SoCal coastal cluster, from airport METAR routine reports.
-- Written by /api/cron/rainfall-runoff; read at display time to post a
-- precautionary runoff notice where no County advisory feed exists.
-- Validation: docs/water-quality/2026-10-12-rainfall-source-validation.md
-- Rollback: DROP TABLE public.rainfall_runoff_readings;
BEGIN;

CREATE TABLE IF NOT EXISTS public.rainfall_runoff_readings (
    cluster_id      TEXT          NOT NULL,
    window_end      TIMESTAMPTZ   NOT NULL,
    total_in        NUMERIC(5,2)  NOT NULL CHECK (total_in >= 0),
    station_totals  JSONB         NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (cluster_id, window_end)
);

CREATE INDEX IF NOT EXISTS rainfall_runoff_readings_window_end_idx
    ON public.rainfall_runoff_readings (window_end DESC);

ALTER TABLE public.rainfall_runoff_readings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rainfall_runoff_readings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rainfall_runoff_readings TO service_role;

COMMIT;
