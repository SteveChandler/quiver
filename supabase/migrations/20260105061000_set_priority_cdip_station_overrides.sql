BEGIN;

-- Ensure per-beach CDIP override column exists (additive, safe).
ALTER TABLE public.beaches
ADD COLUMN IF NOT EXISTS cdip_station text;

-- Priority beaches: pin CDIP station overrides to avoid nearest-station ambiguity.
-- Note: CDIP is primarily West Coast coverage; we only set overrides for priority CA beaches.

-- Zuma Beach (Malibu, CA) → San Pedro South (67)
UPDATE public.beaches
SET cdip_station = '67'
WHERE id = '836f218a-9471-46c9-b201-24da1dfe0f3a'
  AND (cdip_station IS DISTINCT FROM '67');

-- Ocean Beach SF – Sloat (San Francisco, CA) → Half Moon Bay (71)
UPDATE public.beaches
SET cdip_station = '71'
WHERE id = 'd9524c9d-8315-4686-9d35-24ceb6db2a82'
  AND (cdip_station IS DISTINCT FROM '71');

COMMIT;


