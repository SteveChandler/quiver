# Phase 12 Sentry Runbook

**Date:** 2026-05-31
**Status:** Code-level cron monitor support added. Account changes approved on 2026-05-31; after Sentry card/Business Plan setup, the approved critical monitors are active, owned by the `quiver` team, and routed through a dedicated Cron monitor failures issue alert rule.

Sentry Cron monitors supplement `cron_runs`; they do not replace it. Use Sentry to answer whether critical jobs fired and finished. Use `cron_runs` for internal run summaries, stale-run diagnostics, route-level history, and detailed payloads.

## Monitor Inventory

| Monitor slug | Route | Schedule | Max runtime | Source state | Owner | Account state |
|--------------|-------|----------|-------------|--------------|-------|---------------|
| `forecast-health` | `/api/monitoring/forecast-health` | `*/30 * * * *` | 3m | 12-05 wrapper wiring | `quiver` team | Active; unmuted; owned by `quiver` |
| `forecast-alerts` | `/api/cron/forecast-alerts` | `15 */3 * * *` | 5m | 12-05 wrapper wiring | `quiver` team | Active; unmuted; owned by `quiver` |
| `notifications-deliver` | `/api/cron/notifications-deliver` | `* * * * *` | 3m | 12-05 wrapper wiring | `quiver` team | Active; unmuted; owned by `quiver` |
| `trial-ending-push-deliver` | `/api/cron/trial-ending-push-deliver` | `0 17 * * *` | 5m | 12-05 wrapper wiring | `quiver` team | Active; unmuted; owned by `quiver` |
| `first-session-nudge-push` | `/api/cron/first-session-nudge-push` | `0 17 * * *` | 5m | 12-05 wrapper wiring | `quiver` team | Active; unmuted; owned by `quiver` |
| `sitemap-health` | `/api/cron/sitemap-health` | `15 6 * * *` | 2m | Existing explicit check-in path retained | `quiver` team | Active; unmuted; owned by `quiver` |
| `enhanced-forecast-sync-cdip` | `/api/cron/enhanced-forecast-sync-cdip` | `0 * * * *` | 5m | Existing explicit check-in path uses `forecast-cdip-sync`; slug rename deferred to avoid losing historical monitor continuity | Engineering owner | Existing `forecast-cdip-sync` monitor active |
| `enhanced-forecast-sync-dispatch` | `/api/cron/enhanced-forecast-sync-dispatch` | `0,30 * * * *` | 5m | Existing shard-aware explicit check-ins use `forecast-enhanced-shard-0..3`; dispatch-level monitor deferred because shard-specific monitors already capture the work | Engineering owner | Existing shard monitors remain disabled/deferred |

Notes:

- `forecast-health`, `forecast-alerts`, `notifications-deliver`, `trial-ending-push-deliver`, and `first-session-nudge-push` are the first wrapper-driven critical set.
- `sitemap-health` remains on its explicit check-in path because it marks empty sitemap and probe failures as monitor errors while still returning HTTP 200 for cron scheduling health.
- Enhanced forecast monitors stay on their explicit check-in paths because CDIP and shard-specific routing already have source-level check-ins and historical Sentry monitor continuity.
- Dedicated issue alert rule: `Cron monitor failures` sends Cron-category new, regressed, or escalated issues to IssueOwners with ActiveMembers fallback.

## Alert Owners

| Alert class | Owner | Initial routing | Noise expectation |
|-------------|-------|-----------------|-------------------|
| Forecast health and forecast sync | `quiver` team | Active monitor owner plus `Cron monitor failures` issue alert | Low; failures affect forecast trust |
| Forecast and notification alerts | `quiver` team | Active monitor owner plus `Cron monitor failures` issue alert | Medium; includes no-op runs and user-volume variance |
| Trial and onboarding push paths | `quiver` team | Active monitor owner plus `Cron monitor failures` issue alert | Low; daily lifecycle jobs should be stable |
| Sitemap health | `quiver` team | Active monitor owner plus `Cron monitor failures` issue alert | Low; probe failures need source review before filtering |
| Budget and usage anomalies | Engineering owner | Monthly manual review | Low; review before increasing any cap |

## Weekly Top-Issue Triage

1. Query unresolved production issues by count, affected users, and last seen for the last 7 days.
2. Split web versus native by project, SDK, release, and environment.
3. Confirm source maps or debug symbols resolve stack traces before creating engineering tasks.
4. Assign one owner and one next action for every top issue that hits session logging, photo upload, native analytics writes, location/onboarding/explore, RevenueCat, push, forecast freshness, `/pricing`, `/pbsc`, or launch blog conversion routes.
5. Link a GitHub issue only for actionable regressions with sanitized reproduction notes.
6. Do not paste raw emails, IPs, tokens, cookies, headers, request bodies, or full raw stack traces into GitHub.
7. Mark noisy expected fallbacks as filtered only after source review proves they are expected and user-safe.
8. Record whether each top issue is still active in the last 24 hours.

## Monthly Usage Review

Record these fields while the startup credit is active:

- remaining startup credit.
- Prior-month error event volume.
- Prior-month transaction volume.
- Prior-month Replay volume.
- Prior-month log volume.
- Prior-month profile volume.
- Projected spend risk before the next review.
- Sampling cap changes since the prior review.
- New monitor or alert routes added since the prior review.
- Owner decision: keep caps, reduce caps, or request explicit approval to expand caps.

## Budget Expansion Gate

No increase to tracing, Replay, Logs, Profiling, monitor scope, alert fanout, or Seer/GitHub automation ships without:

- Current monthly spend risk.
- Projected event, transaction, Replay, log, and profile volume.
- Numeric cap being changed.
- Owner and rollback.
- Verification that preview/local traffic remains dropped from production reporting.
- Update to this runbook or a follow-up plan.

## Seer And GitHub Workflow

- Use Seer for weekly diagnosis, not automatic code changes.
- Keep automatic GitHub issue creation off until source maps/debug symbols are proven readable in the relevant project.
- GitHub issues should include Sentry short id, project, environment, release, user impact, last seen, event count, and sanitized reproduction notes.
- Link Sentry issues to existing GitHub issues only after confirming ownership and duplicates.
- Never copy sensitive event payloads or raw user identifiers into GitHub.

## Phase 12 Verification Record

### 12-03 Web Sentry Hygiene

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/monitoring/sentry-config.test.ts` - passed, 31 tests.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck` - passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/monitoring/sentry-config.ts instrumentation-client.ts sentry.server.config.ts sentry.edge.config.ts next.config.mjs __tests__/lib/monitoring/sentry-config.test.ts` - passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && VERCEL_ENV=preview yarn build` - passed.
- `git diff --check -- ...` scoped to the 12-03 web Sentry files - passed.

### 12-04 Native Sentry Hygiene

- `npm test -- --runInBand src/__tests__/sentry-config.test.ts` - passed, 18 tests.
- `npm run typecheck` - passed.
- `npm test -- --runInBand src/__tests__/sentry-config.test.ts src/__tests__/analytics.test.ts src/stores/__tests__/onboarding-store.test.ts` - passed, 42 tests.
- Sentry API readback - passed; `quiver-native` exists with project id `4511486193041408` and platform `react-native`.
- EAS env readback - passed; production has `SENTRY_AUTH_TOKEN` as a project-scoped secret.
- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && SKIP_NATIVE_REGRESSION=1 RELEASE_PREFLIGHT_ONLY=1 ./scripts/release-ios.sh` - passed; no build or upload was run.
- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && SKIP_NATIVE_REGRESSION=1 RELEASE_PREFLIGHT_ONLY=1 ./scripts/release-android.sh` - passed; no build or distribution was run.

### 12-05 Cron Monitors And Runbook

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts` - failed first as expected before implementation; the new monitor check-in assertions had zero calls.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts __tests__/app/api/cron/sitemap-health.test.ts` - passed, 18 tests.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/app/api/cron/forecast-alerts/route.test.ts __tests__/app/api/cron/notifications-deliver.test.ts __tests__/app/api/cron/trial-ending-push-deliver.test.ts __tests__/app/api/cron/first-session-nudge-push.test.ts __tests__/app/api/monitoring/forecast-health.test.ts` - passed, 31 tests.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/cron/observability.ts lib/monitoring/sentry-cron.ts app/api/cron/forecast-alerts/route.ts app/api/cron/notifications-deliver/route.ts app/api/cron/trial-ending-push-deliver/route.ts app/api/cron/first-session-nudge-push/route.ts app/api/monitoring/forecast-health/route.ts __tests__/lib/cron/observability.test.ts __tests__/app/api/cron/notifications-deliver.test.ts` - passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck` - passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && VERCEL_ENV=preview yarn build` - passed.
- `git diff --check -- ...` scoped to the 12-05 cron, route, test, and planning files - passed.

### 12-05 Account Mutation Attempt

- `npx -y @sentry/mcp-server auth status` - passed; authenticated as Steven Chandler with read/project/team scopes, but no `alerts:write`.
- `GET /api/0/organizations/quiver-z4/projects/` - passed; `javascript-nextjs` and `quiver-native` exist.
- `GET /api/0/organizations/quiver-z4/teams/` - passed; `quiver` team exists.
- `GET /api/0/organizations/quiver-z4/monitors/` - passed; `forecast-cdip-sync` is active, while `sitemap-health` and enhanced forecast shard monitors were disabled.
- `POST /api/0/organizations/quiver-z4/monitors/` with MCP token - failed `403`, insufficient permission to create monitors through the REST endpoint.
- `Sentry.captureCheckIn(...)` using the project DSN - passed; created monitor records for `forecast-health`, `forecast-alerts`, `notifications-deliver`, `trial-ending-push-deliver`, and `first-session-nudge-push`.
- Initial `PUT /api/0/organizations/quiver-z4/monitors/{slug}/` activation attempt - failed `400` with Sentry account capacity/pay-as-you-go seat constraint.
- After Sentry card/Business Plan setup, monitor activation/readback - passed; `forecast-health`, `forecast-alerts`, `notifications-deliver`, `trial-ending-push-deliver`, `first-session-nudge-push`, and `sitemap-health` are `active`, unmuted, and owned by the `quiver` team.
- `POST /api/0/projects/quiver-z4/javascript-nextjs/rules/` - passed; created `Cron monitor failures`, matching Cron-category new/regressed/escalated issues and emailing IssueOwners with ActiveMembers fallback.
- Alert rule readback - passed; `Cron monitor failures` and the existing high-priority issue alert rule are both present.

## Verification Commands

Run after code changes:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts __tests__/app/api/cron/sitemap-health.test.ts
source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/cron/observability.ts lib/monitoring/sentry-cron.ts app/api/cron/forecast-alerts/route.ts app/api/cron/notifications-deliver/route.ts app/api/cron/trial-ending-push-deliver/route.ts app/api/cron/first-session-nudge-push/route.ts app/api/monitoring/forecast-health/route.ts __tests__/lib/cron/observability.test.ts
source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck
source ~/.nvm/nvm.sh && nvm use 22 && VERCEL_ENV=preview yarn build
```

## Approval-Gated Account Actions

Monitor and alert account changes were approved on 2026-05-31. These items are complete after Sentry card/Business Plan setup:

- Activated `forecast-health`, `forecast-alerts`, `notifications-deliver`, `trial-ending-push-deliver`, `first-session-nudge-push`, and `sitemap-health`.
- Assigned monitor ownership to the `quiver` team.
- Created Sentry issue alert routing for Cron-category monitor issues via `Cron monitor failures`.

These account actions still require separate budget/plan resolution before retry:

- Enabling GitHub issue automation.
- Enabling Seer automation beyond manual triage use.
- Changing Sentry billing or paid-plan settings.
- Changing web Sentry DSNs in Vercel or local release secrets.
- Deploying production code solely to create/check live monitors.

## Phase 12 Closeout

### OBS-03

Code-level web/native sampling, Replay caps, privacy defaults, and runbook budget controls are in place. Live alert noise must be reviewed during weekly triage and monthly usage review.

### OBS-04

`cron_runs` remains the internal run ledger. Sentry monitor code support covers the first wrapper-driven critical set, while sitemap and enhanced forecast monitors stay on explicit source check-ins. The approved critical monitor records are active in Sentry and owned by the `quiver` team.

### OBS-05

Weekly top-issue triage, monthly startup-credit usage review, budget expansion gates, and Seer/GitHub workflow rules are documented. Cron monitor issue alert routing is active; Seer and GitHub automation remain manual/disabled until separately approved.

### Account Changes

Account changes approved and completed after Sentry card/Business Plan setup.
