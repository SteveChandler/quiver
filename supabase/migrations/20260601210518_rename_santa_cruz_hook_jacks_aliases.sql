BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.beaches
    WHERE slug = 'the-hook-santa-cruz-ca'
      AND id <> 'f3e1216f-2a17-47be-8c2e-67d8588ab065'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot rename Rockview to The Hook: slug the-hook-santa-cruz-ca is already used by another active beach';
  END IF;
END $$;

UPDATE public.beaches
SET
  name = 'The Hook',
  slug = 'the-hook-santa-cruz-ca',
  description = 'The Hook is the canonical East Cliff/41st Avenue reef break historically tied to Rockview. This punchy right reef sits between Pleasure Point and 38th Avenue, works on south and west swells, and is best suited to intermediate surfers comfortable with rocks, crowds, and a tighter takeoff.'
WHERE id = 'f3e1216f-2a17-47be-8c2e-67d8588ab065'
  AND deleted_at IS NULL;

UPDATE public.beaches
SET description = '38th Avenue, also called Jack''s by some surf reports and locals, is a user-friendly right reef that handles south and west swells. It offers long rides at lower tide and is popular with longboarders and groms.'
WHERE id = '36a2d39e-64f1-4c7e-9618-ac8cc695af62'
  AND deleted_at IS NULL;

COMMIT;
