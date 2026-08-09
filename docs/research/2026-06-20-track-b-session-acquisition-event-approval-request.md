# Track B Session Acquisition Event Approval Request

Date: 2026-06-20

## Decision Needed

Approve or reject applying:

- `supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql`

This is a production Supabase schema write. It must not be applied without explicit human approval.

## Purpose

Track B needs `session_log_conditions_set` stored in `public.user_events` so the session-acquisition funnel can measure whether surfers explicitly completed wave-height, wave-quality, and crowd feedback before save. Native code is prepared to emit the event, but the production `user_events_event_type_check` constraint rejects it until this migration is applied.

The migration widens the existing event-type CHECK constraint only. It does not insert, update, or delete user data.

## Required Order

1. Run the read-only preflight.
2. Reconfirm the preflight says `can_request_track_b_event_migration_approval = true`.
3. Get explicit human approval using the approval phrase below.
4. Apply the migration in the same database session that sets the migration approval token.
5. Run the read-only postflight.
6. Deploy or verify the native build that emits `session_log_conditions_set`.
7. Rerun the Track B funnel report with expected-build checks.

## Approval Plan

Approval phrase for this Track B event allowlist migration plan only:

```text
APPROVE: f20493762c71c54c71ba4eb6fe1bb396e706124c282f6775e11f9e1435540e8c
```

This approval phrase does not authorize Phase 0, Phase 1, Phase 2, Phase 3, Track B native deployment, rollback, or any other production mutation.

The SHA-256 above is computed over this exact plan text:

```text
TRACK_B_SESSION_ACQUISITION_EVENT_MIGRATION_PLAN_V1
migration: supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql
target: production Supabase quiverDB via POSTGRES_URL_NON_POOLING owner connection
preflight:
- psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-preflight.sql
preconditions:
- Read-only Track B event preflight passes.
- Preflight confirms public.user_events exists.
- Preflight confirms user_events_event_type_check exists.
- Preflight confirms can_request_track_b_event_migration_approval = true.
- Maintainer explicitly replies with the approval phrase for this plan hash.
command:
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.track_b_session_acquisition_event_approved = '2026-06-19-track-b-session-acquisition-event-approved';" -f supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql
objects_affected:
- public.user_events constraint user_events_event_type_check
post_apply:
- psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-postflight.sql
- rerun Track B session-acquisition funnel report with expected recent native client builds
not_authorized_by_this_plan:
- Phase 0 forecast accuracy migration
- Phase 1 shoaling factor production write
- Phase 2 terrain production write
- Phase 3 analog or bathymetry production write
- Native app deployment
- Any data backfill or data rewrite
```

## Migration Summary

The migration:

- Requires `app.track_b_session_acquisition_event_approved = '2026-06-19-track-b-session-acquisition-event-approved'` in the same database session before schema mutation.
- Reads the existing `user_events_event_type_check` expression with `pg_get_constraintdef`.
- No-ops if `session_log_conditions_set` is already present.
- Drops and recreates `user_events_event_type_check` by preserving the live CHECK expression and OR-ing the missing event list.
- Sends `NOTIFY pgrst, 'reload schema'`.

## Latest Read-Only Evidence

Command:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-preflight.sql
```

Result: PASS. Latest read-only preflight refreshed on 2026-06-20 at `2026-06-20T12:55:32Z`:

- `public.user_events` exists.
- `user_events_event_type_check` exists.
- `session_log_conditions_set` is not yet allowed.
- `migration_needed = true`.
- `can_request_track_b_event_migration_approval = true`.
- `track_b_event_preflight_blockers` is empty.
- Recent 7-day event counts: 67 `session_log_start`, 27 `session_log_abandon`, 24 `session_log_rating_set`, 23 `session_log_validation_failed`, 9 `first_session_logged`, 7 `session_log_submit`, 0 `session_log_beach_selected`, and 0 `session_log_conditions_set`.

Command:

```bash
set -a; source .env.production.local; set +a; psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-postflight.sql
```

Result: expected exit `3`. Latest pre-apply postflight from the same refresh:

- `session_log_conditions_set_not_allowed`.
- `0` stored `session_log_conditions_set` rows.
- Confirms the migration has not been applied yet.

## Verification

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:unit --runTestsByPath __tests__/migrations/track-b-session-acquisition-event.test.ts
```

Result: PASS. 1 suite, 4 tests.

Command:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/session-acquisition-funnel-report.ts --validate-output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --max-report-age-hours 24
```

Result: PASS. The saved Track B funnel artifact validates as schema version 2.

## Post-Approval Commands

Run only after explicit approval:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.track_b_session_acquisition_event_approved = '2026-06-19-track-b-session-acquisition-event-approved';" -f supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-postflight.sql
```

The migration itself fails before mutating schema unless `app.track_b_session_acquisition_event_approved` is set to the exact approval token above in the same database session.

## Remaining Gate

After an approved apply and native build adoption, rerun:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/session-acquisition-funnel-report.ts --days 30 --recent-telemetry-days 7 --expect-recent-client-build native-ios,1.0.1,11 --expect-recent-client-build native-android,1.0.1,11 --output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --fail-on-not-ready
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/session-acquisition-funnel-report.ts --validate-output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --max-report-age-hours 24
```

Expected immediately before deploy/adoption: the readiness report can still exit `2` until rated-session volume, recent build metadata, and recent event coverage clear their floors.
