-- Parse tide direction preferences from best_conditions_prose notes field
-- Keywords: incoming/rising/push -> 'rising', outgoing/falling/dropping/pull -> 'falling'

UPDATE public.beaches
SET preferred_tide_direction = 'rising'
WHERE preferred_tide_direction IS NULL
  AND best_conditions_prose IS NOT NULL
  AND (
    best_conditions_prose ~* '\bincoming\b'
    OR best_conditions_prose ~* '\brising\b'
    OR best_conditions_prose ~* '\bpush\b'
    OR best_conditions_prose ~* '\bincoming tide\b'
    OR best_conditions_prose ~* '\brising water\b'
  );

UPDATE public.beaches
SET preferred_tide_direction = 'falling'
WHERE preferred_tide_direction IS NULL
  AND best_conditions_prose IS NOT NULL
  AND (
    best_conditions_prose ~* '\boutgoing\b'
    OR best_conditions_prose ~* '\bfalling\b'
    OR best_conditions_prose ~* '\bdropping\b'
    OR best_conditions_prose ~* '\bpull\b'
    OR best_conditions_prose ~* '\boutgoing tide\b'
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
