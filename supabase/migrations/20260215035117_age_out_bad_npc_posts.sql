-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- 1. Re-tag mistagged parking posts from 'conditions' to 'parking'
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
UPDATE intel_posts
SET expires_at = created_at + interval '24 hours',
    is_active = CASE WHEN created_at + interval '24 hours' < now() THEN false ELSE is_active END,
    updated_at = now()
WHERE id IN (
  SELECT ip.id FROM intel_posts ip
  JOIN profiles p ON ip.user_id = p.id
  WHERE p.is_mock = true AND ip.expires_at IS NULL
);
