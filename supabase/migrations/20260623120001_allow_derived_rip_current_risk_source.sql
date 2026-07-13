BEGIN;

-- Allow Seaside to write v1 estimated rip-current risk for beaches outside
-- official NWS SRF/alert coverage.
ALTER TABLE public.rip_current_risks
  DROP CONSTRAINT IF EXISTS rip_current_risks_source_check;

ALTER TABLE public.rip_current_risks
  ADD CONSTRAINT rip_current_risks_source_check
  CHECK (source IN ('srf', 'alert', 'derived'));

COMMIT;
