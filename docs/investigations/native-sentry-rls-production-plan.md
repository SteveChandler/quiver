# Native Sentry RLS Production Plan And Execution Record

Date: 2026-05-31

## Purpose

Document the policy-only migration that unblocked Quiver native session photo uploads in the shipped release and direct native analytics writes.

## Production Evidence

- Sentry release/dist: `app.quiversurf.mobile@1.0.0`, dist `10`
- Last 24h: 2 native error events / 2 users, both `JAVASCRIPT-NEXTJS-29`
- Last 7d top native issues still include:
  - `JAVASCRIPT-NEXTJS-1S` / `7453261922`: `user_events` RLS insert failures
  - `JAVASCRIPT-NEXTJS-29` / `7466130849`: pending-session photo/storage RLS failures
- Location issues now have native code changes pending release
- The patched native client now avoids storage upsert for future photo uploads, but the production release `app.quiversurf.mobile@1.0.0` still uses the upsert path and needs this policy.
- Remote migration state: `20260531165652_native_sentry_rls_fixes.sql` is applied to production.
- Supabase Storage access-control docs confirm storage upsert requires `SELECT` and `UPDATE` in addition to `INSERT`: https://supabase.com/docs/guides/storage/security/access-control

## Backup Artifacts

Read-only artifacts created before mutation:

- `/tmp/quiver_native_sentry_rls_schema_backup_20260531.sql`
  - Type: schema-only `pg_dump` for `public` and `storage`
  - SHA-256: `cb1810b596d0f05532a4b254a5015a9e019edfa3a4fe2815e87fb8b9dbd5e57a`
- `/tmp/quiver_native_sentry_rls_preflight_policies_20260531.tsv`
  - Type: `pg_policies` snapshot for affected policies
  - SHA-256: `398d41d72ea62687eb8fb849dd9fbb011ddc7b10cb25618533c01098a7d5bc96`

## Target

- Supabase project: `vawdnbbgawichorsjiwe`
- Target role: `claude_migrator`
- Affected objects:
  - `storage.objects`
    - Drop/create policy: `Users can read their own session media objects`
  - `public.user_events`
    - Drop/create policy: `Users can insert their own events`

## Post-Approval Role Check

The maintainer approved this plan on 2026-05-31, but the target role cannot execute it in the current production database state.

Read-only checks after approval showed:

- `claude_migrator` can log in as `current_user=claude_migrator`.
- `claude_migrator` cannot read `supabase_migrations.schema_migrations`; `supabase db push --db-url <claude_migrator>` fails with `permission denied for schema supabase_migrations`.
- `claude_migrator` has no `USAGE` on schema `storage` and no table privileges on `storage.objects`, `public.user_events`, or `supabase_migrations.schema_migrations`.
- Table owners are:
  - `storage.objects`: `supabase_storage_admin`
  - `public.user_events`: `postgres`
  - `supabase_migrations.schema_migrations`: `postgres`
- A rollback-only probe confirmed `claude_migrator` cannot create the storage policy.

Because policy DDL requires table ownership and migration tracking requires access to `supabase_migrations`, this migration cannot be applied as `claude_migrator` without first granting broader production privileges or changing ownership. That privilege repair is broader than this incident fix.

Amended execution, explicitly approved by the maintainer, used the existing production `postgres` pooler connection only for this policy-only migration:

```bash
supabase db push --db-url "$POSTGRES_URL_NON_POOLING"
```

Dry-run output confirmed this would push only:

```text
20260531165652_native_sentry_rls_fixes.sql
```

This was a deliberate deviation from the normal `claude_migrator` role requirement and required a new approval hash before execution.

## Exact SQL

```sql
BEGIN;

-- The shipped native release retries session photo uploads with storage upsert
-- against deterministic object paths. Supabase Storage requires SELECT in
-- addition to INSERT/UPDATE for upsert; the 2026-05-21 advisor cleanup removed
-- the broad public SELECT policy, so restore a narrow owner-scoped SELECT
-- policy for session-media objects.
DROP POLICY IF EXISTS "Users can read their own session media objects" ON storage.objects;
CREATE POLICY "Users can read their own session media objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'session-media'
    AND (select auth.uid())::text = (storage.foldername(name))[2]
  );

-- Keep native direct Supabase analytics aligned with /api/events: tracking is
-- allowed by default and blocked only when the profile explicitly opts out.
-- This avoids RLS failures during short profile/bootstrap race windows and for
-- users whose preference row was created without an explicit true value.
DROP POLICY IF EXISTS "Users can insert their own events" ON public.user_events;
CREATE POLICY "Users can insert their own events"
  ON public.user_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND allow_implicit_tracking = false
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
```

## Verification After Approval And Apply

Applied on 2026-05-31 after maintainer approval:

```text
APPROVE: 0120fa070d7e8bb60b29b32530933ba45e27fd96d7e338dfc3e04e6e0785da89
```

Completed verification:

- Remote migration list includes `20260531165652`.
- `supabase db push --dry-run` reports the remote database is up to date.
- `storage.objects` has owner-scoped SELECT for `session-media`.
- `public.user_events` has the default-allow authenticated INSERT policy unless `allow_implicit_tracking = false`.
- The gated production native RLS probe passed for session insert, storage upload/upsert, `session_media` insert, session hero-photo update, and `user_events` insert.
- Probe cleanup was verified with zero remaining rows/objects for the probe session and storage path.

Ongoing monitoring:

- Watch Sentry issue ids `7466130849` and `7453261922` for new production events.

## Verification Procedure

1. Confirm remote migration list includes `20260531165652`.
2. Confirm `storage.objects` has owner SELECT for `session-media`.
3. Confirm `public.user_events` INSERT policy is default-allow unless `allow_implicit_tracking = false`.
4. Run the gated native RLS probe:

```bash
CONFIRM_TARGET=PROD \
CONFIRM_PROD_RLS_PROBE=YES_I_HAVE_PRODUCTION_APPROVAL \
RLS_PROBE_EMAIL=... \
RLS_PROBE_PASSWORD=... \
node scripts/verify-native-sentry-rls.mjs
```

5. Monitor Sentry issue ids `7466130849` and `7453261922` for new production events.

## Approval Protocol

Future production mutations are not authorized until the maintainer replies with the latest hash of the proposed plan:

```text
APPROVE: <sha256-of-this-plan-file>
```
