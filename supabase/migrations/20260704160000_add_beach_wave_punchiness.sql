BEGIN;

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS wave_punchiness numeric;

UPDATE public.beaches
SET wave_punchiness = 0.9
WHERE id = '01330afc-00d3-461b-88f3-b173774766f4'
  OR (state = 'CA' AND slug = 'blacks')
  OR (state = 'CA' AND name IN ('Blacks', 'Blacks Beach'));

UPDATE public.beaches
SET wave_punchiness = -0.8
WHERE state = 'CA'
  AND (
    slug IN ('old-mans-sano', 'san-onofre-state-beach')
    OR name IN ('Old Man''s (SanO)', 'Old Man''s', 'San Onofre State Beach')
  );

UPDATE public.beaches
SET wave_punchiness = -0.6
WHERE state = 'CA'
  AND (
    slug IN ('tourmaline', 'cardiff-reef')
    OR name IN ('Tourmaline Beach', 'Tourmaline', 'Tourmaline Surf Park', 'Cardiff Reef', 'Cardiff')
  );

COMMIT;
