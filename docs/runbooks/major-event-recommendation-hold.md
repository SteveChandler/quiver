# Major-Event Recommendation Hold Runbook

This control suppresses positive session recommendations for an approved
region, beach/exposure scope, time window, and safety cohort. It never changes
physical wave, wind, tide, temperature, swell, or observation values.

The normal major-event cohort is `beginner`, `intermediate`, and `unknown`.
P0-A does not emit protected alternatives; if no separately approved option
exists, the product returns explicit none.

## Approval boundaries

Each item requires separate approval. Approval of one does not authorize the
next:

1. Apply the reviewed database migration.
2. Deploy server/web code in `shadow` with automation disabled.
3. Publish the native runtime/build.
4. Activate a short, beach-scoped canary.
5. Change server enforcement to `enforce`.
6. Activate a real event scope.
7. Enable official-source automation.

Do not expose either server flag through `NEXT_PUBLIC_` or `EXPO_PUBLIC_`:

```text
MAJOR_EVENT_HOLD_MODE=off|shadow|enforce
MAJOR_EVENT_HOLD_AUTOMATION_ENABLED=false|true
```

`MAJOR_EVENT_HOLD_MODE` is configured independently in the Vercel server
environment and the Supabase Edge Function environment used by
`bluesky-auto-post`. Before a canary or enforcement approval, verify the
explicit value in both environments and record both checks in the evidence
packet. A Vercel setting does not configure the Edge Function, or vice versa.

Disabling automation does not cancel an active hold.

## Local release gate

Run this before requesting any external action:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
source ~/.nvm/nvm.sh
nvm use 22
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  -v ON_ERROR_STOP=1 \
  -f scripts/db/regional-recommendation-holds-smoke.sql
yarn test:unit \
  __tests__/migrations/regional-recommendation-holds.test.ts \
  __tests__/lib/recommendations/major-event-hold \
  __tests__/app/api/admin/recommendation-holds \
  __tests__/app/api/cron/major-event-hold-evaluate \
  __tests__/app/api/cron/major-event-hold-retention \
  __tests__/app/api/cron/first-session-nudge-push.test.ts \
  __tests__/notifications/registry.test.ts \
  __tests__/notifications/worker.test.ts \
  --runInBand
yarn typecheck
yarn lint
yarn lint:tests

cd /Users/stevenchandler/Desktop/dev/quiver-native
npm run typecheck
npm test -- --runInBand
npx maestro test .maestro/flows/recommendations/major-event-hold.yaml

git -C /Users/stevenchandler/Desktop/dev/quiver diff --check
git -C /Users/stevenchandler/Desktop/dev/quiver-native diff --check
git -C /Users/stevenchandler/Desktop/dev/quiver status --short
git -C /Users/stevenchandler/Desktop/dev/quiver-native status --short
```

Also run the previous-compatible native build online. Fixture coverage does not
replace that check; an already-installed offline old client cannot learn about
a newly activated server hold.

## Read current state

Use the admin API/CLI, never a direct table write. Keep the admin cookie out of
shell history and logs.

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
export QUIVER_ADMIN_BASE_URL='https://approved-host.example'
export QUIVER_ADMIN_COOKIE='REDACTED'
yarn tsx scripts/recommendation-hold.ts list-active
```

Confirm the effective version, lifecycle, scope, cohorts, `validFrom`,
`validUntil`, and expiry. A scheduled future version must not hide the current
effective version.

## Activate a manual canary

Use one approved test beach, a 30-minute validity window, and only the three
P0 safety cohorts. Use a fresh UUID idempotency key and retain the accepted
response as audit evidence.

```bash
yarn tsx scripts/recommendation-hold.ts activate \
  --idempotency-key '<UUID>' \
  --body-json '{
    "regionKeys": [],
    "scopeBeachIds": ["<TEST_BEACH_UUID>"],
    "scopeExposureClasses": [],
    "protectedAlternativeBeachIds": [],
    "validFrom": "<ISO_INSTANT>",
    "validUntil": "<ISO_INSTANT_30_MINUTES_LATER>",
    "affectedCohorts": ["beginner", "intermediate", "unknown"],
    "action": "suppress_positive",
    "reasonCode": "major_swell_manual_safety"
  }'
```

Never put raw evidence, operator identity, private notes, or forecast payloads
in the policy body. Use only bounded opaque evidence references through the
approved control path.

## Verify the canary

For the held beach/window, verify all of the following:

- Discovery, Home, Oracle, Surf Call, Week Scout, map, scored forecasts, Daily
  Intel, Coach, intent pages, Session Intelligence, and regional/top-spot
  surfaces expose no positive recommendation.
- Web and native stale caches cannot restore a positive.
- Beginner, intermediate, and unknown users receive explicit none.
- Advanced/expert behavior matches the approved scope rather than inheriting a
  broader client-side guess.
- Push, in-app, direct email, social, OG, and share paths emit no positive.
- A consolidated alert is suppressed when any included match is held.
- Objective wave height, period, wind, tide, temperature, swell partitions,
  and observations are byte-for-byte unchanged.
- No low-confidence UI or confidence-derived hold behavior appears.

Exercise an extension, then verify the new expiry:

```bash
yarn tsx scripts/recommendation-hold.ts extend \
  --idempotency-key '<UUID>' \
  --body-json '{
    "holdId": "<HOLD_UUID>",
    "newValidUntil": "<LATER_ISO_INSTANT>",
    "reasonCode": "major_swell_manual_safety"
  }'
```

## Cancel and prove restoration

Cancellation is append-only:

```bash
yarn tsx scripts/recommendation-hold.ts cancel \
  --idempotency-key '<UUID>' \
  --body-json '{
    "holdId": "<HOLD_UUID>",
    "reasonCode": "operator_cancelled"
  }'
```

Confirm `list-active` no longer reports the hold as effective. Then verify a
fresh availability epoch restores ordinary recommendations on web, native,
map, Week Scout, alerts, and shares without changing the physical forecast.

## Rollback

1. List effective holds and append a cancellation for every active hold.
2. Set `MAJOR_EVENT_HOLD_AUTOMATION_ENABLED=false` through the approved server
   configuration path.
3. Verify cancellations and ordinary recommendation restoration.
4. Only if enforcement code itself is faulty, set
   `MAJOR_EVENT_HOLD_MODE=off` after reviewing active state.
5. Keep the Week Scout endpoint enabled.
6. Retain the additive schema and append-only audit history.
7. Re-run the physical-forecast invariance checks.

Automation-off alone is not rollback, and deleting policy rows is never the
normal rollback mechanism.

## Evidence packet

Record without secrets or internal evidence payloads:

- approvals and exact artifact versions;
- migration checksum and local smoke result;
- web/native gate commands and results;
- mode and automation state before/after each transition;
- accepted activation, extension, and cancellation request IDs;
- scoped screenshots/API assertions showing explicit none and unchanged
  physical values;
- previous-compatible online result and the offline-old-client limitation;
- rollback timestamps and final `list-active` result.
