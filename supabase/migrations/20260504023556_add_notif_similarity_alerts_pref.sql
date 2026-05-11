-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_similarity_alerts boolean NOT NULL DEFAULT true; COMMENT ON COLUMN profiles.notif_similarity_alerts IS 'Per-type pref: gates similarity_match notifications across BOTH push and in_app channels. Default true — Pro flagship feature surfaces by default. Master gates (notif_push_enabled, notif_inapp_enabled) take priority.';
