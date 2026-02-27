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
