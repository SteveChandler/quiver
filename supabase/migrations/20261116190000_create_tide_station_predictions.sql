BEGIN;

CREATE TABLE IF NOT EXISTS public.tide_station_predictions (
  station_id text NOT NULL REFERENCES public.tide_stations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('high', 'low', 'hourly')),
  ts timestamptz NOT NULL,
  height_m double precision NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (station_id, ts, kind)
);

ALTER TABLE public.tide_station_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tide_station_predictions_public_read ON public.tide_station_predictions;
CREATE POLICY tide_station_predictions_public_read
  ON public.tide_station_predictions
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tide_stations
    WHERE id = station_id AND active
  ));

REVOKE ALL ON public.tide_station_predictions FROM anon, authenticated;
GRANT SELECT ON public.tide_station_predictions TO anon, authenticated;
GRANT ALL ON public.tide_station_predictions TO service_role;

-- Service-role-only queue: an indexed latest-row lookup keeps the cron bounded.
CREATE OR REPLACE VIEW public.tide_station_prediction_coverage
WITH (security_invoker = true) AS
SELECT s.id, s.source_station_id, s.station_kind, latest.ts AS coverage_end
FROM public.tide_stations AS s
LEFT JOIN LATERAL (
  SELECT p.ts FROM public.tide_station_predictions AS p
  WHERE p.station_id = s.id
  ORDER BY p.ts DESC LIMIT 1
) AS latest ON true
WHERE s.source = 'noaa' AND s.active;

REVOKE ALL ON public.tide_station_prediction_coverage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tide_station_prediction_coverage TO service_role;

COMMENT ON COLUMN public.tide_station_predictions.height_m IS
  'NOAA MLLW metres as returned, without Quiver sea-level adjustment.';

COMMIT;
