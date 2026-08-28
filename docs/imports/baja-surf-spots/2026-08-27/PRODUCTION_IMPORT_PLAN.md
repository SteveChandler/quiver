# Baja surf spots production import plan

## Exact artifact

- Migration: `supabase/migrations/20260827190000_import_baja_surf_spots.sql`
- Migration SHA-256: `a859cdd81e97ffe9ccf2675abb47126f1a4ccf4ad15c045d035d5cf9982d2aef`
- Dataset: `baja-surf-spots-production-enrichment-v2-2026-08-27`

## Target

- Quiver production Supabase database
- Production owner connection through the Supabase CLI migration-tracking path
- No service-role application write and no untracked SQL-editor execution

## Required preflight

1. Commit the migration and its supporting dataset/assets locally on the isolated branch. Do not push or merge as part of this plan.
2. Create a fresh production dump named `quiver-prod-pre-baja-import-2026-08-27.dump` and verify that it is readable.
3. Compare local and production `supabase_migrations.schema_migrations` state. Stop on drift.
4. Confirm this migration is the only pending migration selected for the push. Stop if another pending migration would also execute.
5. Read-only checks must confirm all seven `update_existing_preserve_uuid` beach UUIDs exist and no staged lower-cased beach name belongs to another UUID.

## Mutations

- `public.beaches`: insert 105 rows and update seven rows while preserving their UUIDs.
- `public.beach_photos`: insert or update 112 approved hero-photo rows.
- `public._backup_baja_beaches_20260827`: first-capture backup of the seven updated beach rows.
- `public._backup_baja_beach_photos_20260827`: first-capture backup of any genuinely replaced photo rows.
- `supabase_migrations.schema_migrations`: normal CLI tracking entry for version `20260827190000`.

The transaction imports only the 112 rankable surf spots. It excludes the two parent-area metadata records, keeps all imported beaches public and active, preserves Baja timezones, and forces `seo_indexable = false`. Recommendation readiness does not waive the separate review contract in [`docs/seo/BEACH_INDEXING_ELIGIBILITY.md`](../../../seo/BEACH_INDEXING_ELIGIBILITY.md).

## Verification

After the tracked migration succeeds, verify:

- 112 active target beach UUIDs exist.
- 112 matching approved, non-deleted hero photos exist.
- 67 target beaches use `America/Tijuana` and 45 use `America/Mazatlan`.
- Zero target beaches have `seo_indexable = true`.
- Seven beach backup rows exist.
- The migration tracking row exists exactly once.

Stop and restore from the dump if any invariant fails. Do not delete inserted beaches after user, session, forecast, or other dependent data begins referencing them; rollback then requires a separately reviewed dependency-aware plan.
