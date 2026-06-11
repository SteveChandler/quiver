# Session Conditions Expansion Migration Plan

## Scope

Apply the four pending session-conditions migrations to the linked production Supabase project after maintainer approval.

## Target

- Supabase project: `vawdnbbgawichorsjiwe`
- Connection: production owner connection used by Supabase CLI migration tracking
- Required environment: `SUPABASE_DB_PASSWORD`
- Do not use `claude_migrator`

## Preflight Evidence

- `2026-06-11` read-only production schema gate ran inside `BEGIN READ ONLY; ... ROLLBACK;`.
- `public.sessions_history` is absent in production.
- `public.sessions`, `public.beaches`, and `public.tide_forecasts` exist in production.
- Production `public.tide_forecasts` has `tide_height_m`, generated `tide_ft`, and `source`.
- Production `public.beaches` has `timezone`.
- The new feature columns are not present yet:
  - `sessions.wave_characteristics`
  - `sessions.tide_rate_ft_per_hr`
  - `sessions.tide_data_source`
  - `sessions.rip_current_observed`
  - `sessions.rip_current_risk`
  - `beaches.nws_forecast_zone`
  - `beaches.nws_office`
- Latest production migration version observed: `20260610014158`.
- `supabase migration list --linked` completed successfully.
- Local and remote migrations match through `20260610014158`.
- `supabase db push --dry-run --linked` completed without mutating production and listed exactly the four pending session-condition migrations.
- Pending local-only migrations:
  - `20260611090000`
  - `20260611091000`
  - `20260611092000`
  - `20260611093000`

## Backup

Create a fresh backup within 24 hours before applying:

```bash
pg_dump "$SUPABASE_PROD_OWNER_DATABASE_URL" \
  --format=custom \
  --file="backups/prod-pre-session-conditions-$(date -u +%Y%m%d%H%M%S).dump"
```

Expected artifact name pattern:

```text
backups/prod-pre-session-conditions-YYYYMMDDHHMMSS.dump
```

## Migration Files

Apply these files in order via `supabase db push --linked`:

1. `supabase/migrations/20260611090000_add_wave_characteristics_to_sessions.sql`
2. `supabase/migrations/20260611091000_add_session_tide_snapshot_trigger.sql`
3. `supabase/migrations/20260611092000_add_rip_current_observed_to_sessions.sql`
4. `supabase/migrations/20260611093000_add_rip_current_risk_pipeline.sql`

## Objects Affected

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

## One-Off Backfill

After the schema migrations are applied, backfill NWS forecast zone mapping for existing beaches:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
source ~/.nvm/nvm.sh
nvm use 22
export NEXT_PUBLIC_SUPABASE_URL='<production Supabase URL>'
export SUPABASE_SERVICE_ROLE_KEY='<production service role key>'
yarn tsx scripts/backfill-nws-zones.ts --dry-run
yarn tsx scripts/backfill-nws-zones.ts --write
```

This writes only:

- `beaches.nws_forecast_zone`
- `beaches.nws_office`

The script reads `beaches.lat` and `beaches.lon`, calls `api.weather.gov/points/{lat},{lon}` with the Quiver User-Agent, skips unmapped/non-US beaches, and rate-limits requests to one per second.

## Apply Commands

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

## Post-Apply Verification

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
source ~/.nvm/nvm.sh
nvm use 22
yarn typecheck
yarn test:unit --bail=0
```

The local trigger smoke can be rerun after remote type generation to confirm the checked-in migrations still behave end-to-end on a migrated local database:

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

## Approval Protocol

No production mutation is authorized until a maintainer replies with:

```text
APPROVE: <sha>
```

where `<sha>` is the SHA-256 of this plan text after final review.
