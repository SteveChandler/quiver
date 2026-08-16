---
phase: 12-sentry-observability-rollout
plan: 12-05
subsystem: observability
tags: [sentry, cron, runbook, budget, alerts]

requires:
  - phase: 12-sentry-observability-rollout
    provides: "Plans 12-03 and 12-04 established web/native Sentry hygiene, sampling, releases, privacy, and source-map/debug-symbol expectations."
provides:
  - "Optional Sentry Cron monitor check-ins in withObservedCron while preserving cron_runs."
  - "Critical cron route monitor config for forecast health, forecast alerts, notifications delivery, trial-ending push, and first-session nudge push."
  - "Sentry runbook covering monitor inventory, weekly triage, monthly usage review, budget gates, and account-change guardrails."
affects: [phase-12, sentry, cron, observability, planning]

tech-stack:
  added: []
  patterns:
    - "Use withObservedCron(route, handler, monitor) for wrapper-driven Sentry Cron monitors on critical cron routes."
    - "Keep source-specific explicit check-ins when handler logic needs custom monitor semantics."

key-files:
  created:
    - .planning/phases/12-sentry-observability-rollout/12-SENTRY-RUNBOOK.md
    - .planning/phases/12-sentry-observability-rollout/12-05-SUMMARY.md
  modified:
    - lib/cron/observability.ts
    - lib/monitoring/sentry-cron.ts
    - app/api/cron/forecast-alerts/route.ts
    - app/api/cron/notifications-deliver/route.ts
    - app/api/cron/trial-ending-push-deliver/route.ts
    - app/api/cron/first-session-nudge-push/route.ts
    - app/api/monitoring/forecast-health/route.ts
    - __tests__/lib/cron/observability.test.ts
    - __tests__/app/api/cron/notifications-deliver.test.ts
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "Sitemap health remains on its explicit check-in path so empty sitemap and probe failures can be marked as monitor errors while the cron route may still return HTTP 200."
  - "Enhanced forecast CDIP and dispatch remain on existing explicit/source-specific check-ins to preserve historical monitor continuity and shard-level signal."
  - "Live Sentry monitor and alert account changes were approved on 2026-05-31; after Sentry card/Business Plan setup, the approved critical monitors were activated, assigned to the quiver team, and routed through a cron-monitor issue alert rule."

requirements-covered:
  - "OBS-03: reinforced through ownership/noise and budget controls."
  - "OBS-04: code-level monitor support added; live monitor records are active for the approved critical set."
  - "OBS-05: triage, usage review, budget gates, and Seer/GitHub workflow documented; cron-monitor alert routing is active via Sentry issue alerts."

duration: 32min
completed: 2026-05-31
---

# Plan 12-05 Summary: Sentry Cron Monitors And Runbook

Plan 12-05 added code-level Sentry Cron monitor support for the critical cron set and documented the operating model. After account-change approval and Sentry card/Business Plan setup, the wrapper-driven critical monitor set plus `sitemap-health` were activated, assigned to the `quiver` team, and routed through a dedicated Cron monitor failures issue alert rule. No GitHub automation, Seer automation, Vercel env, or production deployment changes were made.

## Accomplishments

- Extended `withObservedCron(route, handler, monitor?)` to start a Sentry check-in only for authorized cron requests, complete with `ok` on 2xx responses, complete with `error` on non-2xx responses, and complete with `error` before rethrowing handler exceptions.
- Preserved existing `cron_runs` behavior: unauthorized requests skip observability, stale `started` rows are swept, summaries are parsed best-effort, and DB writes remain fail-open.
- Wired monitor configs into `/api/monitoring/forecast-health`, `/api/cron/forecast-alerts`, `/api/cron/notifications-deliver`, `/api/cron/trial-ending-push-deliver`, and `/api/cron/first-session-nudge-push`.
- Refactored `/api/cron/notifications-deliver` away from inner `withCronObservability` so the route uses the shared response-level wrapper and avoids double `cron_runs` accounting.
- Kept `/api/cron/sitemap-health` on explicit check-ins and recorded why enhanced forecast CDIP/dispatch monitor changes are deferred.
- Added `12-SENTRY-RUNBOOK.md` with monitor inventory, owners, weekly top-issue triage, monthly usage review fields, budget expansion gates, Seer/GitHub workflow rules, verification commands, and account-change guardrails.

## Verification

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts` - failed first as expected before implementation; new monitor assertions saw zero calls.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts __tests__/app/api/cron/sitemap-health.test.ts` - passed, 18 tests.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/app/api/cron/forecast-alerts/route.test.ts __tests__/app/api/cron/notifications-deliver.test.ts __tests__/app/api/cron/trial-ending-push-deliver.test.ts __tests__/app/api/cron/first-session-nudge-push.test.ts __tests__/app/api/monitoring/forecast-health.test.ts` - passed, 31 tests.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/cron/observability.ts lib/monitoring/sentry-cron.ts app/api/cron/forecast-alerts/route.ts app/api/cron/notifications-deliver/route.ts app/api/cron/trial-ending-push-deliver/route.ts app/api/cron/first-session-nudge-push/route.ts app/api/monitoring/forecast-health/route.ts __tests__/lib/cron/observability.test.ts __tests__/app/api/cron/notifications-deliver.test.ts` - passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck` - passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && VERCEL_ENV=preview yarn build` - passed.
- `rg -n "sitemap-health|forecast-health|notifications-deliver|forecast-alerts|trial-ending-push|first-session-nudge-push|withObservedCron|cron_runs" e2e __tests__` - reviewed relevant E2E/unit references.
- `git diff --check -- ...` scoped to the 12-05 cron, route, test, and planning files - passed.
- `npx -y @sentry/mcp-server auth status` - passed; authenticated as Steven Chandler with read/project/team scopes, but no `alerts:write`.
- `Sentry.captureCheckIn(...)` using the project DSN - passed; created disabled monitor records for `forecast-health`, `forecast-alerts`, `notifications-deliver`, `trial-ending-push-deliver`, and `first-session-nudge-push`.
- Initial `PUT /api/0/organizations/quiver-z4/monitors/{slug}/` activation attempt - failed `400` with Sentry account capacity/pay-as-you-go seat constraint.
- After Sentry card/Business Plan setup, Sentry monitor readback - passed; `forecast-health`, `forecast-alerts`, `notifications-deliver`, `trial-ending-push-deliver`, `first-session-nudge-push`, and `sitemap-health` are active, unmuted, and owned by the `quiver` team.
- `POST /api/0/projects/quiver-z4/javascript-nextjs/rules/` - passed; created issue alert rule `Cron monitor failures` for Cron-category new/regressed/escalated issues, notifying IssueOwners with ActiveMembers fallback.
- Sentry alert rule readback - passed; `Cron monitor failures` exists with the Cron issue-category filter and email action.

## E2E

- Reviewed E2E references. `e2e/push-deeplink-routing.spec.ts` references forecast-alert payload deep-link structure, but this plan changed cron observability wrappers and monitor metadata, not user-facing browser or native app flows.
- No E2E tests were added or modified.
- Final E2E status: not run; route-level Jest, typecheck, lint, and preview build covered the touched backend/observability surface.

## Deviations From Plan

- Live Sentry monitor account mutations required a separate card/Business Plan setup step before activation could succeed.
- The route-level test sweep initially failed because `notifications-deliver` still mocked `withCronObservability`; the test was updated to the new wrapper shape and passed.
- `lib/monitoring/sentry-cron.ts` now suppresses expected fail-open capture warnings in `NODE_ENV=test` because Jest's `@sentry/nextjs` mock does not expose `captureCheckIn`.

## Remaining Risk

- Wrapper-driven Sentry Cron check-ins are not proven against production traffic until the code is deployed and the next scheduled runs produce check-ins.
- OBS-05 automation is intentionally limited: Cron issue alert routing is live, but Seer automation and GitHub issue automation were not enabled.
- Code-level check-ins auto-create or update monitors only when the approved code runs with a Sentry SDK/environment that supports check-ins; no production deploy was run in this plan.
- Sentry usage still needs the documented monthly review because the Business Plan can draw down the startup credit faster if event, transaction, replay, log, or monitor volume increases.

## Next Phase Readiness

Phase 12 is complete. Phase 13 can resume the controlled refactor at Slice 82.

---
*Phase: 12-sentry-observability-rollout*
*Completed: 2026-05-31*
