-- NULL shoaling_factors for beaches that never receive CDIP buoy data.
--
-- These beaches are assigned to CDIP stations 198, 215, or 217 which are
-- not delivering data. Their calibrated shoaling factors never fire at
-- read-time (only applied when data_source = 'CDIP'), but their presence
-- causes the ML bias-correction pipeline (correct_forecasts.py) to skip
-- the beach entirely. Removing them re-enables ML correction — pure upside.
--
-- Also includes Tourmaline Beach (user-reported 3-4x over-prediction) and
-- Ocean Beach SF – Sloat (18.8% CDIP, barely any — same net effect).

BEGIN;

UPDATE beaches
SET    shoaling_factors = NULL,
       updated_at = NOW()
WHERE  name IN (
         -- 0% CDIP beaches (stations 198, 215, 217 not delivering data)
         '52nd Street',
         '54th Street',
         'Corona del Mar',
         'County Line',
         'Crystal Cove',
         'El Porto (Manhattan)',
         'El Segundo Beach Jetty',
         'HB Cliffs',
         'Hermosa Pier',
         'Huntington Beach Pier',
         'Huntington Beach Pier Northside',
         'Huntington Beach Pier Southside',
         'Huntington St.',
         'Huntington State Beach',
         'Malibu First Point (Surfrider)',
         'Manhattan Beach Pier',
         'Newport 56th St',
         'Newport Lower Jetties',
         'Newport Point',
         'Newport Upper Jetties',
         'North HB Streets',
         'Redondo Breakwall',
         'River Jetties',
         'Rockpile',
         'The Wedge',
         'Topanga',
         'Venice Breakwater',
         'Zuma Beach',
         -- User-reported over-prediction / negligible CDIP coverage
         'Tourmaline Beach',
         'Ocean Beach SF – Sloat'
       )
  AND  shoaling_factors IS NOT NULL;

COMMIT;
