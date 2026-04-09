# Migration Safety

Rules and protocols for database migrations in the Quiver project.

## Migration File Convention

All migrations go in `supabase/migrations/` with naming `YYYYMMDDHHMMSS_descriptive_name.sql`.

## PROHIBITED in Migrations

- `DELETE FROM auth.users` without WHERE clause
- `DELETE FROM profiles` based on name/email matching
- `TRUNCATE` on user tables
- `DROP TABLE` for core user tables
- Deleting by user-provided strings (names, emails)

## REQUIRED for All Migrations

1. Wrap in `BEGIN;` ... `COMMIT;`
2. Add `WHERE NOT EXISTS` for inserts
3. Create rollback migrations for destructive changes
4. Test locally first: `supabase db reset`
5. Document schema changes in migration comments
6. When recreating views (`DROP VIEW` + `CREATE VIEW`), carry forward `WITH (security_invoker = true)` if the view previously had it — this option is silently lost on `DROP`

## Before Applying to Production

1. Fresh `pg_dump` backup within 24 hours
2. Review SQL for any DELETE/TRUNCATE/DROP
3. Test on a branch database if available

## Production Execution Protocol

- **Role:** Use `claude_migrator` role only
- **Default:** Read-only. Mutations require two-step protocol:
  1. **PLAN** - Output: exact SQL, target role, tables affected, backup artifact name
  2. **APPROVAL** - Maintainer replies with `APPROVE: <sha>` of the plan text
- **No approval = no changes.** Refuse mutations without the approval token.

## Drift Repair Protocol

**Drift** = the set of migrations in `supabase/migrations/` does not match the set of versions in `supabase_migrations.schema_migrations` on prod. This happens when:

- Someone runs `mcp__supabase__apply_migration` against prod without committing the SQL file first — the remote gets a tracking row but the repo never gets a file.
- A parallel branch is built locally, applied to prod via the Supabase dashboard's SQL editor, and then merged into `main` with the file at a different timestamp than the tracking row — so both the file and the tracking row exist but point at different versions of the same work.
- A migration file exists in `main`, the DDL effects are present on prod (because someone ran the SQL directly), but the tracking row was never inserted — a "phantom applied" migration that `supabase db push` will try to re-run and fail.

Left unfixed, the next `supabase db push` against prod will either skip migrations that should apply, fail loudly on non-idempotent statements (e.g., `CREATE POLICY`), or silently overwrite newer production values with older file contents.

### Detect

```sql
-- Versions on prod that have no local file (remote-only → file backfill needed)
-- and local files that aren't in remote (local-only → either phantom or genuine new)
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version >= '<window_start>'
ORDER BY version;
```

Then `ls supabase/migrations/ | grep <window>` and diff the two lists by version.

### Classify each mismatch

For every version that's in exactly one side:

1. **Local-only, genuine new work** → apply via `supabase db push` (or `mcp__supabase__execute_sql` if the CLI pooler is flaky).
2. **Local-only, effects already on prod ("phantom applied")** → insert a tracking row into `supabase_migrations.schema_migrations` with `ON CONFLICT (version) DO NOTHING`. Do **not** re-run the SQL. Verify by querying prod for the specific table/column/function/policy before deciding.
3. **Local-only, duplicates a remote-tracked migration under a different timestamp** → delete the local file. The remote version is canonical because it's the one tracked as applied.
4. **Remote-only, no local file** → backfill the SQL content from `schema_migrations.statements[]` into a new local file at the remote timestamp.

### Verify before repairing

For any "phantom applied" determination, query prod for every object the migration creates (tables, columns, indexes, constraints, policies, functions, grants, comments). A spot-check of one or two objects is not sufficient — check everything the migration would create. Also hash-compare any data-migration values (not just a couple sample rows) against the file content to prove they match.

### Never

- **Don't `git merge main` into `prod`** to resolve drift — the merge just papers over the ordering problem and creates non-idempotent re-runs. Drift lives in `schema_migrations`, not in git history.
- **Don't rewrite an already-applied migration file** without also updating the tracking row. Future `db reset` on a local or branch DB will apply the new content against a fresh schema, and the two states diverge.
- **Don't use `apply_migration` until the file is committed locally.** That's the pattern that creates drift in the first place.

### After repair

- Regenerate `types/database.generated.ts` via `yarn db:types:remote` — drift often means the types file is also stale.
- Update any stale references in code comments, CHANGELOG, and planning docs that point at the old (pre-rename) timestamps.
- Note that `statements[]` placeholder values on repaired rows will cause `supabase db diff --linked` to report noise for those versions — the diff engine sees a comment string where it expects the real SQL. This is known and harmless; the on-disk file remains the canonical record.

### Canonical example

Commit `454803c9 fix(migrations): reconcile drift with prod schema_migrations` repaired 9 migrations in the 2026-04-06 → 2026-04-08 window using the protocol above: 4 local duplicates deleted, 6 remote-only migrations backfilled into local files at their prod timestamps, 2 phantom-applied migrations marked via direct `INSERT ... ON CONFLICT DO NOTHING` into `schema_migrations`, and 1 genuinely-new idempotent data migration applied via raw SQL + tracking row insert. Used `mcp__supabase__execute_sql` throughout because the CLI pooler was repeatedly timing out mid-session.
