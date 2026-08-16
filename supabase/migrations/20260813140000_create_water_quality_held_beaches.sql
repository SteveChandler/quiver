-- UNAPPLIED FORWARD MIGRATION (2026-08-13)

BEGIN;

CREATE TABLE public.water_quality_held_beaches (
  beach_id uuid PRIMARY KEY REFERENCES public.beaches(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.water_quality_held_beaches (beach_id, reason)
SELECT held.beach_id, 'owner-directed chronic water-quality hold'
FROM (
  VALUES
    ('9e94759c-d531-4e5c-9bc2-d022acea9dcd'::uuid),
    ('d9f93c82-7f4b-440a-865a-55cdbb821f74'::uuid),
    ('94f1010b-c71f-4025-bda1-c26ed9467c85'::uuid),
    ('b29821f9-c91a-486f-981b-7085c6d86b68'::uuid),
    ('84d3468b-c1ec-46ad-8621-d8507e5f167a'::uuid)
) AS held(beach_id)
-- Replay tolerance: on a rebuilt or local database many beaches are absent or carry freshly
-- generated UUIDs, so seeding by hardcoded production id would violate the FK above and abort
-- the entire migration chain. Stage only rows whose beach actually exists here.
WHERE EXISTS (
  SELECT 1
  FROM public.beaches b
  WHERE b.id = held.beach_id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.water_quality_held_beaches existing
  WHERE existing.beach_id = held.beach_id
);

-- Never seed nothing silently. An empty hold list is a safety-relevant no-op that looks
-- identical to success, so make any shortfall observable at apply time.
DO $$
DECLARE
  seeded integer;
BEGIN
  SELECT count(*) INTO seeded FROM public.water_quality_held_beaches;
  IF seeded < 5 THEN
    RAISE WARNING
      'water_quality_held_beaches seeded % of 5 expected beaches; the rest are absent from this database and are NOT held here',
      seeded;
  END IF;
END
$$;

ALTER TABLE public.water_quality_held_beaches ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.water_quality_held_beaches
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
