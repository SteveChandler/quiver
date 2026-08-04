---
phase: 22
slug: demand-driven-bot-engagement-and-morning-intel-orchestration
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-03
---

# Phase 22 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x, TypeScript, Supabase migration source assertions |
| **Config file** | `jest.config.js`, repository Jest setup |
| **Quick run command** | `yarn test:unit --runInBand __tests__/lib/npc __tests__/app/api/cron/npc-activity.test.ts __tests__/app/api/cron/morning-forecast-bot.test.ts` |
| **Full suite command** | `yarn test:unit --bail=0` |
| **Estimated runtime** | Quick: under 60 seconds; full suite: repository-dependent |

## Sampling Rate

- After every task commit: run the focused unit command above.
- After every plan wave: run focused unit tests plus `yarn typecheck`.
- Before `$gsd-verify-work`: run the full unit suite and scoped lint; run preview build when cron/config or public event behavior changes.
- Max feedback latency: 90 seconds for focused checks.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | phase-goal | T-22-01 | Demand excludes bot/mock/system traffic and is deterministic | unit | `yarn test:unit --runInBand __tests__/lib/npc/demand-ranking.test.ts` | W0 | pending |
| 22-01-02 | 01 | 1 | phase-goal | T-22-02 | Audit rows contain no raw user identity or event payload | migration/source | `yarn test:unit --runInBand __tests__/migrations/bot-engagement-audit.test.ts` | W0 | pending |
| 22-02-01 | 02 | 2 | phase-goal | T-22-03 | NPC writes are capped, deduped, attributed, and review-limited | unit | `yarn test:unit --runInBand __tests__/lib/npc/demand-ranking.test.ts __tests__/app/api/cron/npc-activity.test.ts` | W0 | pending |
| 22-02-02 | 02 | 2 | phase-goal | T-22-04 | Home region affects voice/context only, not target quota | unit | `yarn test:unit --runInBand __tests__/lib/npc/npc-selection.test.ts` | W0 | pending |
| 22-03-01 | 03 | 3 | phase-goal | T-22-05 | Morning Intel Bot is distinct from Quiver Surf Forecast and selects 3–5 targets | unit | `yarn test:unit --runInBand __tests__/app/api/cron/morning-intel-bot.test.ts` | W0 | pending |
| 22-04-01 | 04 | 4 | phase-goal | T-22-06 | Dry-run and production reporting expose supply/demand and downstream intent | unit/script | `yarn test:unit --runInBand __tests__/scripts/bot-engagement-report.test.ts` | W0 | pending |

## Wave 0 Requirements

- [ ] Add focused fixtures/mocks for demand ranking and the Morning Intel cron route.
- [ ] Add migration source assertions if a durable audit table is introduced.
- [ ] Add report-script fixture coverage that excludes the known mock/system identities.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production demand distribution and bot supply coverage | phase-goal | Requires production read-only data and date-window selection | Run the dry-run report for the same 30-day PT window; compare top visited beaches, target coverage, over-supply concentration, and suppression reasons before enabling writes. |
| Cron activation and kill switch | phase-goal | Vercel production scheduling is external state | Confirm the new route is deployed, schedule is correct in UTC, and kill switch prevents inserts before enabling. |
| Attribution/trust wording on public intel cards | phase-goal | Requires rendered production/preview UI review | Inspect one Morning Intel post, one NPC derived post, and one Quiver forecast post for source, generated-at, expiry, and non-eyewitness wording. |

## Validation Sign-Off

- [ ] All tasks have automated verification.
- [ ] No three consecutive tasks without automated verification.
- [x] Existing test infrastructure covers the phase.
- [ ] No watch-mode flags.
- [ ] Focused feedback latency remains under 90 seconds.
- [ ] `nyquist_compliant: true` set after implementation and verification.

**Approval:** pending
