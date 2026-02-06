-- Rollback migration for 20260204170000_add_la_beaches.sql
-- Removes the 18 LA beaches added and reverts Venice Breakwater city fix
-- Run this only if you need to undo the LA beaches migration

BEGIN;

-- Remove the 18 beaches added by the migration
DELETE FROM public.beaches WHERE id IN (
  'afbd3aaf-099f-4147-b845-443590f0e148',  -- Malibu Surfrider (First Point)
  '005b0ba6-a2d9-4069-adbb-6571baffa698',  -- Malibu Second Point
  'abd3b0fa-6de6-480a-a6cc-c5c83143a707',  -- Malibu Third Point
  'bba95994-b2a3-4505-8e6f-1f85ccfbb0dc',  -- Point Dume
  'a13f108b-ad2a-43fa-8ea7-40577ebce66c',  -- Leo Carrillo State Beach
  'ca9f0f1b-f4f5-4601-91c5-5e972c5f1a41',  -- Latigo Point
  '29fefd13-7472-4ce8-9c3c-be3dabcbb233',  -- Santa Monica Beach
  '6c4b160d-8aba-4078-aca7-9bde1bf81738',  -- Bay Street
  '3f1eeb72-41c1-4f58-9621-fd13df129c1a',  -- Will Rogers State Beach
  '11467f21-5a69-430d-9eb9-05a46cd39990',  -- Venice Beach
  '1376c3e3-d7b2-408d-b1d4-e6e004cbe063',  -- Dockweiler State Beach
  '0bad04fb-2c2e-4d6f-b47d-ac77f7ce5836',  -- El Porto
  '326941d7-6c39-4e82-b045-941b156f7897',  -- Hermosa Beach Pier
  '110a87b2-cb2c-4bb7-8e83-b895fb2f4940',  -- Hermosa Beach South
  'a3e9d10c-92e9-4302-b808-a3de0c2eca22',  -- Torrance Beach (RAT Beach)
  '9a3da3b5-e25b-45a4-b9dd-3ba6bc75a9fa',  -- Palos Verdes Cove
  '6932c9a6-bc1f-46b7-9493-51c587bf7eb0',  -- 72nd Place
  'e6602d4e-7b5a-456d-b675-230ca5501cde'   -- Seal Beach Pier
);

-- Revert Venice Breakwater city back to 'Los Angeles' if needed
-- Note: Only run this if you also want to undo the Venice Breakwater fix
UPDATE public.beaches
SET city = 'Los Angeles'
WHERE name = 'Venice Breakwater' AND city = 'Venice';

COMMIT;

-- IMPORTANT: After running this rollback, you must also manually update
-- lib/data/forecast-regions.ts to remove: Torrance, Palos Verdes, Long Beach, Seal Beach
-- from the los-angeles cities array.
