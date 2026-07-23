-- Add NOAA station provenance and repair historical tide rows to one
-- authoritative source series per beach and UTC hour.
--
-- Production execution deletes duplicate/conflicting forecast rows and requires
-- the approval protocol in docs/MIGRATION_SAFETY.md. The private backup table
-- supports the separately approval-gated rollback.

BEGIN;

ALTER TABLE public.tide_forecasts
  ADD COLUMN IF NOT EXISTS station_id text;

COMMENT ON COLUMN public.tide_forecasts.station_id IS
  'NOAA CO-OPS station used to produce this tide forecast row.';

CREATE INDEX IF NOT EXISTS idx_tide_forecasts_station_ts
  ON public.tide_forecasts (station_id, ts)
  WHERE station_id IS NOT NULL;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.tide_forecasts_integrity_backup_20260723 AS
SELECT
  id,
  beach_id,
  ts,
  tide_height_m,
  tide_phase,
  source,
  created_at,
  station_id
FROM public.tide_forecasts
WITH NO DATA;

REVOKE ALL ON TABLE private.tide_forecasts_integrity_backup_20260723
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE private.tide_forecasts_integrity_backup_20260723 IS
  'Rows changed or removed by 20260723070000_add_tide_forecast_hourly_integrity.';

CREATE TEMP TABLE tide_forecast_cleanup_ranked ON COMMIT DROP AS
SELECT
  canonical_rows.*,
  ROW_NUMBER() OVER (
    PARTITION BY beach_id, canonical_hour, source
    ORDER BY created_at DESC, ts DESC, id DESC
  ) AS source_rank
FROM (
  SELECT
    id,
    beach_id,
    source,
    ts,
    created_at,
    date_bin(
      INTERVAL '1 hour',
      ts,
      TIMESTAMPTZ '1970-01-01 00:00:00+00'
    ) AS canonical_hour
  FROM public.tide_forecasts
) AS canonical_rows;

CREATE TEMP TABLE tide_forecast_cleanup_counts (
  duplicate_rows_before bigint NOT NULL,
  fallback_conflicts_before bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO tide_forecast_cleanup_counts (
  duplicate_rows_before,
  fallback_conflicts_before
)
SELECT
  COUNT(*) FILTER (WHERE ranked.source_rank > 1),
  COUNT(*) FILTER (
    WHERE ranked.source = 'noaa_hilo_interpolated'
      AND EXISTS (
        SELECT 1
        FROM tide_forecast_cleanup_ranked direct
        WHERE direct.beach_id = ranked.beach_id
          AND direct.canonical_hour = ranked.canonical_hour
          AND direct.source = 'noaa'
      )
  )
FROM tide_forecast_cleanup_ranked ranked;

INSERT INTO private.tide_forecasts_integrity_backup_20260723 (
  id,
  beach_id,
  ts,
  tide_height_m,
  tide_phase,
  source,
  created_at,
  station_id
)
SELECT
  forecasts.id,
  forecasts.beach_id,
  forecasts.ts,
  forecasts.tide_height_m,
  forecasts.tide_phase,
  forecasts.source,
  forecasts.created_at,
  forecasts.station_id
FROM public.tide_forecasts forecasts
JOIN tide_forecast_cleanup_ranked ranked
  ON ranked.id = forecasts.id
WHERE ranked.source_rank > 1
  OR forecasts.ts IS DISTINCT FROM ranked.canonical_hour
  OR (
    ranked.source = 'noaa_hilo_interpolated'
    AND EXISTS (
      SELECT 1
      FROM tide_forecast_cleanup_ranked direct
      WHERE direct.beach_id = ranked.beach_id
        AND direct.canonical_hour = ranked.canonical_hour
        AND direct.source = 'noaa'
    )
  );

DELETE FROM public.tide_forecasts forecasts
USING tide_forecast_cleanup_ranked ranked
WHERE forecasts.id = ranked.id
  AND ranked.source = 'noaa_hilo_interpolated'
  AND EXISTS (
    SELECT 1
    FROM tide_forecast_cleanup_ranked direct
    WHERE direct.beach_id = ranked.beach_id
      AND direct.canonical_hour = ranked.canonical_hour
      AND direct.source = 'noaa'
  );

DELETE FROM public.tide_forecasts forecasts
USING tide_forecast_cleanup_ranked ranked
WHERE forecasts.id = ranked.id
  AND ranked.source_rank > 1;

UPDATE public.tide_forecasts forecasts
SET ts = ranked.canonical_hour
FROM tide_forecast_cleanup_ranked ranked
WHERE forecasts.id = ranked.id
  AND ranked.source_rank = 1
  AND forecasts.ts IS DISTINCT FROM ranked.canonical_hour;

DO $$
DECLARE
  duplicate_rows_before bigint;
  fallback_conflicts_before bigint;
  duplicate_rows_after bigint;
  fallback_conflicts_after bigint;
BEGIN
  SELECT
    counts.duplicate_rows_before,
    counts.fallback_conflicts_before
  INTO
    duplicate_rows_before,
    fallback_conflicts_before
  FROM tide_forecast_cleanup_counts counts;

  SELECT COALESCE(SUM(grouped.row_count - 1), 0)
  INTO duplicate_rows_after
  FROM (
    SELECT COUNT(*) AS row_count
    FROM public.tide_forecasts
    GROUP BY
      beach_id,
      date_bin(
        INTERVAL '1 hour',
        ts,
        TIMESTAMPTZ '1970-01-01 00:00:00+00'
      ),
      source
    HAVING COUNT(*) > 1
  ) grouped;

  SELECT COUNT(*)
  INTO fallback_conflicts_after
  FROM public.tide_forecasts fallback
  WHERE fallback.source = 'noaa_hilo_interpolated'
    AND EXISTS (
      SELECT 1
      FROM public.tide_forecasts direct
      WHERE direct.beach_id = fallback.beach_id
        AND date_bin(
          INTERVAL '1 hour',
          direct.ts,
          TIMESTAMPTZ '1970-01-01 00:00:00+00'
        ) = date_bin(
          INTERVAL '1 hour',
          fallback.ts,
          TIMESTAMPTZ '1970-01-01 00:00:00+00'
        )
        AND direct.source = 'noaa'
    );

  RAISE NOTICE
    'Tide duplicate rows before=% after=%',
    duplicate_rows_before,
    duplicate_rows_after;
  RAISE NOTICE
    'Tide fallback conflicts before=% after=%',
    fallback_conflicts_before,
    fallback_conflicts_after;

  IF duplicate_rows_after <> 0 OR fallback_conflicts_after <> 0 THEN
    RAISE EXCEPTION
      'Tide integrity cleanup incomplete: duplicate rows=%, fallback conflicts=%',
      duplicate_rows_after,
      fallback_conflicts_after;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tide_forecasts_unique'
      AND conrelid = 'public.tide_forecasts'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) =
        'UNIQUE (beach_id, ts, source)'
  ) THEN
    RAISE EXCEPTION
      'Expected tide_forecasts_unique on (beach_id, ts, source)';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
