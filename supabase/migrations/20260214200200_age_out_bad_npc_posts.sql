-- Age out bad NPC bot posts:
-- 1. Fix mistagged parking posts (tagged as 'conditions' but contain parking content)
-- 2. Set expires_at on all NPC intel posts that lack it
BEGIN;

-- 1. Re-tag mistagged parking posts from 'conditions' to 'parking'
-- These are identifiable because they have surf_conditions = NULL (conditions posts always have it)
-- and contain parking-related keywords
UPDATE intel_posts
SET tag = 'parking', updated_at = now()
WHERE id IN (
  SELECT ip.id FROM intel_posts ip
  JOIN profiles p ON ip.user_id = p.id
  WHERE p.is_mock = true
    AND ip.tag = 'conditions'
    AND ip.surf_conditions IS NULL
    AND (ip.description ILIKE '%parking%' OR ip.description ILIKE '%lot is%'
         OR ip.description ILIKE '%lot was%' OR ip.description ILIKE 'Found parking%')
);

-- 2. Expire all NPC intel posts that have no expiry set
-- Posts older than 24h from creation are marked inactive
UPDATE intel_posts
SET expires_at = created_at + interval '24 hours',
    is_active = CASE WHEN created_at + interval '24 hours' < now() THEN false ELSE is_active END,
    updated_at = now()
WHERE id IN (
  SELECT ip.id FROM intel_posts ip
  JOIN profiles p ON ip.user_id = p.id
  WHERE p.is_mock = true AND ip.expires_at IS NULL
);

COMMIT;
