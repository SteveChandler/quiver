-- Fix Hawaii beaches showing Score 0 on Conditions tab
-- Hawaii trade winds (E/ENE) blow persistently at 10-22 mph.
-- The default wind_onshore_bad_kt=8 (9.2 mph) causes every forecast
-- to trigger the skip condition, resulting in Score: 0 for all days.
-- Raising to 18kt (~20.7 mph) allows normal trade wind days to score
-- while still penalizing unusually strong trades (20+ kt).

BEGIN;

UPDATE beaches
SET wind_onshore_bad_kt = 18
WHERE state = 'HI'
  AND wind_onshore_bad_kt = 8;

COMMIT;
