# Session Conditions Expansion Deployment Record

Status: Completed
Deployed and validated: `2026-06-11`

## Current Scope

The session-conditions migrations were applied to the linked production Supabase
project and validated on `2026-06-11`. This document is now a historical
deployment record plus follow-up tracker. It is not an authorization-ready
production runbook and must not be used to request or approve a new production
mutation.

## Post-Prod Validation

`2026-06-11` prod release verification confirmed the session-condition feature path on
`www.quiversurf.app`:

- Session form smoke passed on prod with authenticated Playwright state.
- The expanded conditions panel rendered tide inputs, rip-current controls, and all
  12 wave-characteristic chips.
- A controlled prod write created a session with `wave_characteristics =
  ["fat","closeouts"]`, `rip_current_observed = "light"`, `tide_data_source =
  "noaa"`, populated tide height/status/rate, and `rip_current_risk = "high"`.
- The prod verification sessions created during retries were soft-deleted, and a
  final cleanup query found zero active matching verification sessions.

## Unresolved Follow-Up: `/sessions` Image Optimizer Noise

Known validation risk from the same run:

- `yarn test:e2e:prod:readonly` had 13 passing tests and 2 failing authenticated
  `/sessions` read-only checks.
- Both failures were caused by Next Image optimizer `400` responses for
  `https://auth.quiversurf.app/storage/v1/object...` image URLs on the sessions
  page.
- This appears unrelated to the session-conditions release because the
  feature-specific prod session-form E2E and controlled write verification passed,
  but it is real production noise and can mask future `/sessions` regressions.
- Follow-up: audit the `/sessions` image source path and either allow the
  `auth.quiversurf.app` storage host in image config or normalize stored image URLs
  to the configured Supabase storage host before rendering.

## Historical Deployment Plan

The following sections preserve the plan that was used for the completed
production rollout. Commands are historical and must not be rerun without a new
review, fresh backup, and maintainer approval under the current migration safety
protocol.

### Historical Target

- Supabase project: `vawdnbbgawichorsjiwe`
- Connection: production owner connection used by Supabase CLI migration tracking
- Required environment: `SUPABASE_DB_PASSWORD`
- `claude_migrator` was not used.

### Historical Preflight Evidence

- `2026-06-11` read-only production schema gate ran inside `BEGIN READ ONLY; ... ROLLBACK;`.
- `public.sessions_history` was absent in production.
- `public.sessions`, `public.beaches`, and `public.tide_forecasts` existed in production.
- Production `public.tide_forecasts` had `tide_height_m`, generated `tide_ft`, and `source`.
- Production `public.beaches` had `timezone`.
- Before apply, the new feature columns were not present yet:
  - `sessions.wave_characteristics`
  - `sessions.tide_rate_ft_per_hr`
  - `sessions.tide_data_source`
  - `sessions.rip_current_observed`
  - `sessions.rip_current_risk`
  - `beaches.nws_forecast_zone`
  - `beaches.nws_office`
- Latest production migration version observed before apply: `20260610014158`.
- `supabase migration list --linked` completed successfully.
- Local and remote migrations matched through `20260610014158`.
- Historical dry run command `supabase db push --dry-run --linked` completed
  without mutating production and listed exactly the four then-pending
  session-condition migrations.
- Historical local-only migration versions before apply:
  - `20260611090000`
  - `20260611091000`
  - `20260611092000`
  - `20260611093000`

### Historical Backup

A fresh backup was required within 24 hours before applying:

```bash
pg_dump "$SUPABASE_PROD_OWNER_DATABASE_URL" \
  --format=custom \
  --file="backups/prod-pre-session-conditions-$(date -u +%Y%m%d%H%M%S).dump"
```

Expected artifact name pattern:

```text
backups/prod-pre-session-conditions-YYYYMMDDHHMMSS.dump
```

### Historical Migration Files

These files were applied in order through the Supabase migration workflow:

1. `supabase/migrations/20260611090000_add_wave_characteristics_to_sessions.sql`
2. `supabase/migrations/20260611091000_add_session_tide_snapshot_trigger.sql`
3. `supabase/migrations/20260611092000_add_rip_current_observed_to_sessions.sql`
4. `supabase/migrations/20260611093000_add_rip_current_risk_pipeline.sql`

### Historical Objects Affected

- `sessions.wave_characteristics`
- `sessions.tide_rate_ft_per_hr`
- `sessions.tide_data_source`
- `sessions.rip_current_observed`
- `sessions.rip_current_risk`
- `beaches.nws_forecast_zone`
- `beaches.nws_office`
- `rip_current_risks` table, constraints, indexes, RLS policies, comments
- `compute_session_tide_snapshot(UUID, TIMESTAMPTZ)`
- `apply_session_tide_snapshot()`
- `trigger_apply_session_tide_snapshot`
- `update_rip_current_risks_updated_at()`
- `rip_current_risks_updated_at`
- `apply_session_rip_current_risk()`
- `trigger_apply_session_rip_current_risk`
- `GRANT EXECUTE ON FUNCTION compute_session_tide_snapshot(UUID, TIMESTAMPTZ) TO authenticated, service_role`

### Historical One-Off Backfill

After the schema migrations were applied, NWS forecast zone mapping was backfilled
for existing beaches:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
source ~/.nvm/nvm.sh
nvm use 22
export NEXT_PUBLIC_SUPABASE_URL='<production Supabase URL>'
export SUPABASE_SERVICE_ROLE_KEY='<production service role key>'
yarn tsx scripts/backfill-nws-zones.ts --dry-run
yarn tsx scripts/backfill-nws-zones.ts --write
```

This wrote only:

- `beaches.nws_forecast_zone`
- `beaches.nws_office`

The script read `beaches.lat` and `beaches.lon`, called
`api.weather.gov/points/{lat},{lon}` with the Quiver User-Agent, skipped
unmapped/non-US beaches, and rate-limited requests to one per second.

### Historical Apply Commands

These commands are retained for audit context only:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
source ~/.nvm/nvm.sh
nvm use 22
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f scripts/db/session-conditions-expansion-smoke.sql
export SUPABASE_DB_PASSWORD='<production database password>'
supabase db push --dry-run --linked
supabase db push --linked
yarn db:types
```

### Historical Post-Apply Verification

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
source ~/.nvm/nvm.sh
nvm use 22
yarn typecheck
yarn test:unit --bail=0
```

The local trigger smoke could be rerun after remote type generation to confirm
the checked-in migrations still behaved end-to-end on a migrated local database:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f scripts/db/session-conditions-expansion-smoke.sql
```

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
source ~/.nvm/nvm.sh
nvm use 22
npm test
npm run typecheck
```

```bash
cd /Users/stevenchandler/Desktop/dev/seaside
uv run --isolated --python 3.11 --with-requirements requirements.txt --with pytest pytest tests/ -v --tb=short
```

## Superseded Approval Protocol

The previous approval-token protocol in this file is superseded. The pre-repair
SHA-256 value
`c8b6c4e2673c963b884c8337297d8268ff72192d30b3b00d4ba6ba1e85bc4831` must not be
used for future production approval because this document has been repaired and
the migration is no longer pending.

Future production database mutations require a new plan, fresh SHA-256, and
maintainer approval under [Migration Safety](/Users/stevenchandler/Desktop/dev/quiver/docs/MIGRATION_SAFETY.md).
