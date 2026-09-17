-- DRAFT awaiting approval. No production database action has been taken.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

UPDATE public.beaches SET wind_offshore_deg = 60
WHERE slug = '52nd-street-newport-beach-ca' AND wind_offshore_deg = 90;

UPDATE public.beaches SET wind_offshore_deg = 65
WHERE slug = 'cardiff-reef' AND wind_offshore_deg = 90;

COMMIT;

/* MEDIUM only; intentionally not executable.
UPDATE public.beaches SET wind_offshore_deg = 30
WHERE slug = '204s' AND wind_offshore_deg = 45;
*/

/* Rollback for approved HIGH rows:
BEGIN;
UPDATE public.beaches SET wind_offshore_deg = 90
WHERE slug = '52nd-street-newport-beach-ca' AND wind_offshore_deg = 60;
UPDATE public.beaches SET wind_offshore_deg = 90
WHERE slug = 'cardiff-reef' AND wind_offshore_deg = 65;
COMMIT;
*/
