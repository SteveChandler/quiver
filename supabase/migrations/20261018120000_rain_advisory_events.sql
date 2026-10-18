-- One durable rain advisory per region, shared by County and METAR readers.
-- Rollback: DROP TABLE public.rain_advisory_events;
BEGIN;

CREATE TABLE IF NOT EXISTS public.rain_advisory_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    region       TEXT        NOT NULL,
    source       TEXT        NOT NULL CHECK (source IN ('county_general', 'metar_runoff')),
    status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    started_at   TIMESTAMPTZ NOT NULL,
    last_rain_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ NOT NULL,
    ended_at     TIMESTAMPTZ,
    end_reason   TEXT        CHECK (end_reason IN ('dry_72h', 'county_lifted')),
    sources      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (region, started_at),
    CHECK (source <> 'metar_runoff' OR last_rain_at IS NOT NULL),
    CHECK (expires_at >= COALESCE(last_rain_at, started_at) + INTERVAL '72 hours'),
    CHECK ((status = 'ended') = (ended_at IS NOT NULL AND end_reason IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS rain_advisory_events_one_active_region_idx
    ON public.rain_advisory_events (region) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS rain_advisory_events_region_started_at_idx
    ON public.rain_advisory_events (region, started_at DESC);

ALTER TABLE public.rain_advisory_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rain_advisory_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rain_advisory_events TO service_role;

COMMIT;
