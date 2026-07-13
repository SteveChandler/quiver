-- Set custom spot distance values for Pawleys Island and South Litchfield anchors.
-- The seed migration already remapped these spots to the closer beach anchors;
-- this follow-up avoids rewriting that already-tracked migration file.

BEGIN;

WITH target_spots (
  custom_spot_id,
  beach_slug
) AS (
  VALUES
    (
      'ea66c1be-ea12-4606-8430-d17271f053d3'::uuid,
      'pawleys-island-pier-pawleys-island-sc'
    ),
    (
      '7e65605a-d260-45d7-ba9b-59476ee1bfd8'::uuid,
      'pawleys-island-pier-pawleys-island-sc'
    ),
    (
      '99c8b745-a3d8-4248-be97-7691a31fafa3'::uuid,
      'south-litchfield-litchfield-beach-sc'
    )
),
computed_distances AS (
  SELECT
    cs.id AS custom_spot_id,
    round((
      public.ST_Distance(
        public.ST_SetSRID(
          public.ST_Point(cs.lon::double precision, cs.lat::double precision),
          4326
        )::public.geography,
        b.geog
      ) / 1609.344
    )::numeric, 2)::numeric(5,2) AS nearest_beach_distance_mi
  FROM target_spots AS target
  JOIN public.custom_spots AS cs
    ON cs.id = target.custom_spot_id
    AND cs.deleted_at IS NULL
    AND cs.lat IS NOT NULL
    AND cs.lon IS NOT NULL
  JOIN public.beaches AS b
    ON b.slug = target.beach_slug
    AND b.deleted_at IS NULL
    AND b.geog IS NOT NULL
    AND cs.nearest_beach_id = b.id
)
UPDATE public.custom_spots AS cs
SET
  nearest_beach_distance_mi = computed.nearest_beach_distance_mi,
  updated_at = NOW()
FROM computed_distances AS computed
WHERE cs.id = computed.custom_spot_id
  AND cs.nearest_beach_distance_mi IS DISTINCT FROM computed.nearest_beach_distance_mi;

COMMIT;
