BEGIN;

-- Fix HRRR rows that stored wind_direction as numeric degrees instead of cardinal strings.
-- Converts using the same 16-point compass logic as degreeToCardinal() in geo-utils.ts.
UPDATE enhanced_forecasts
SET wind_direction = (
  SELECT (ARRAY['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'])[
    (ROUND(wind_direction_deg::numeric / 22.5)::int % 16) + 1
  ]
)
WHERE wind_source = 'HRRR'
  AND wind_direction_deg IS NOT NULL
  AND wind_direction ~ '^\d+\.?\d*$';

COMMIT;
