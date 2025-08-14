-- Add cardinal_to_deg(text) function to convert compass cardinals to degrees

CREATE OR REPLACE FUNCTION public.cardinal_to_deg(card text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(trim($1))
    WHEN 'N'   THEN 0
    WHEN 'NNE' THEN 22
    WHEN 'NE'  THEN 45
    WHEN 'ENE' THEN 67
    WHEN 'E'   THEN 90
    WHEN 'ESE' THEN 112
    WHEN 'SE'  THEN 135
    WHEN 'SSE' THEN 157
    WHEN 'S'   THEN 180
    WHEN 'SSW' THEN 202
    WHEN 'SW'  THEN 225
    WHEN 'WSW' THEN 247
    WHEN 'W'   THEN 270
    WHEN 'WNW' THEN 292
    WHEN 'NW'  THEN 315
    WHEN 'NNW' THEN 337
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.cardinal_to_deg(text) IS 'Converts cardinal/ordinal wind/swell directions (e.g., N, ENE) to degrees.';

DO $$
BEGIN
  RAISE NOTICE 'Created/updated function public.cardinal_to_deg(text)';
END $$;


