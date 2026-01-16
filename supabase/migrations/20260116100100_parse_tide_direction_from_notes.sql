-- Parse tide direction preferences from best_conditions notes field
-- Keywords: incoming/rising/push -> 'rising', outgoing/falling/dropping/pull -> 'falling'

UPDATE public.beaches
SET preferred_tide_direction = 'rising'
WHERE preferred_tide_direction IS NULL
  AND best_conditions IS NOT NULL
  AND (
    best_conditions->>'notes' ~* '\bincoming\b'
    OR best_conditions->>'notes' ~* '\brising\b'
    OR best_conditions->>'notes' ~* '\bpush\b'
    OR best_conditions->>'notes' ~* '\bincoming tide\b'
    OR best_conditions->>'notes' ~* '\brising water\b'
  );

UPDATE public.beaches
SET preferred_tide_direction = 'falling'
WHERE preferred_tide_direction IS NULL
  AND best_conditions IS NOT NULL
  AND (
    best_conditions->>'notes' ~* '\boutgoing\b'
    OR best_conditions->>'notes' ~* '\bfalling\b'
    OR best_conditions->>'notes' ~* '\bdropping\b'
    OR best_conditions->>'notes' ~* '\bpull\b'
    OR best_conditions->>'notes' ~* '\boutgoing tide\b'
  );

-- Log how many were updated
DO $$
DECLARE
  rising_count INTEGER;
  falling_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rising_count FROM public.beaches WHERE preferred_tide_direction = 'rising';
  SELECT COUNT(*) INTO falling_count FROM public.beaches WHERE preferred_tide_direction = 'falling';
  RAISE NOTICE 'Tide direction parsed: % rising, % falling', rising_count, falling_count;
END $$;
