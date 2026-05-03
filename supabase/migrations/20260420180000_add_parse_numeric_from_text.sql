BEGIN;

CREATE OR REPLACE FUNCTION public.parse_numeric_from_text(input text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE((regexp_match(input, '(-?\d+\.?\d*)'))[1]::numeric, 0);
$function$;

COMMIT;
