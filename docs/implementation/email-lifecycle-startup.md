# Startup email lifecycle — implementation and activation handoff

Updated September 12, 2026. **Local startup implementation and remaining build/dead-code gates complete; awaiting operator review. The program is not live.**

[September 12 gate cleanup and final verification](./email-lifecycle-gate-cleanup.md): full build, unfiltered deadcode, 18,209 unit tests, full lint, typecheck and three HTTP E2E tests pass. The earlier failed checks below are historical and superseded by that report.

Steven authorized implementation. No commit, push, production migration, deployment, scheduling, provider configuration, customer send or production-data mutation was performed. This handoff does not authorize those actions. The original broader lifecycle map remains the expansion contract; this is its deliberately smaller startup release.

Branch: `orch/email-lifecycle-startup-20260911`, based on `origin/main` at `35f0fb359`.
Worktree: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/email-lifecycle-startup-20260911`.
The primary checkout contains separate uncommitted email-policy work and was preserved. Compare that work during integration; do not blindly overlay either tree.

## Delivered behavior

One SQL evaluator selects a relevant message from current product/contact state. One dispatcher records decisions, reserves a recipient, renders a fixed version, rechecks eligibility and persists the exact payload before provider handoff. There is no independent founder sequence and no catch-up blast.

| Job | Earliest opportunity and expiry | Stops or exclusions |
|---|---|---|
| Founder welcome | Registration to 48 hours, next permitted local slot | Known previous welcome/founder/trial-start; active entitlement; all shared gates |
| Activation | Day 3–7, zero completed sessions, meaningful use within seven days | First completion; no recent use; all shared gates |
| Progress | 72 hours after a canonical completion, one–four completed sessions, before Day 21 | Fifth completion, no recent use, previous progress attempt; all shared gates |
| Friction | Day 7–10, fewer than five sessions, last observed use and completion stalled at least four days | Recent use/completion; unknown activity does not prove a stall |
| Trial support | Verified production trial start +24h; next safe slot before start +7d and expiry −24h | Purchase, expiry, unverified/sandbox trial, target forecast-use event already observed, prior trial-support history |
| Routine | Day 21–28, at least two active days in 14 days including use within seven days | Inactivity, active paid access, prior attempt; no referral pitch in this release |

Founder context and the problem explanation appear immediately and during trial support. Six short variants share a cream/ink layout and one CTA each. Reply is the sole primary CTA for friction/routine. Trial copy makes no duration, billing or unverified premium-feature promise. Progress reports actual completed sessions without promising a reward.

Shared gates: confirmed matching identity, real-user classification, known timezone, explicit lifecycle consent/reference, reviewed contact history, current entitlement review, approved unexpired campaign/version, email preferences, suppression, reply pause, manual-contact cooldown, and current activity. Unknown identity/consent/entitlement holds the user.

Pilot ceilings: at most 50 enrolled users, five accepted messages per invocation, global maximum 15/day (or lower configured cap), 72h lifecycle spacing, two contacts/7d, four/30d, seven-day manual-contact cooldown, local 09:00–17:00. Requested condition alerts share the global cap and mutual exclusion, with 24h spacing and three alerts/7d. Alert history also conservatively consumes the lifecycle rolling caps/72h gap. This is stricter than the broader plan's separate alert allowance.

Six old cron routes now return an authenticated retirement response. The internal welcome route records a decision only and no longer auto-confirms an auth user. Four manual send scripts fail closed. Unclassified/raw shared-mailer sends fail closed. Requested app links/Android instructions and internal new-user notices retain classified send paths; auth-provider/account/security mail remains provider-owned. Existing condition-alert push behavior is unchanged.

## Storage, recovery and operations

The additive migration extends existing contact state/attempts rather than introducing another queue/provider. It adds campaign approval, one current recipient decision, session completion timestamps, private due/outcome views and service-role-only RPCs. No users or approved campaigns are seeded. Both database controls and the environment switch default off. Approved campaign identity/version/hash/approval metadata are frozen; pause/retire remain possible.

Reservations and alert claims share a database advisory lock. A unique active user/job/episode prevents competing workers from claiming twice. Handoff rechecks the current campaign, job, episode, source and five-minute lease. The payload is persisted with a SHA-256 hash, and the reservation UUID is the provider idempotency key.

A timeout, missing provider ID, or failed receipt write becomes `unknown` and disables the database lifecycle switch. A stale `handoff_started` also becomes unknown and pauses the program during reconciliation. No ambiguous send gets a fresh key or automatic resend. Only expired reservations that never began handoff are automatically released. Reconciliation restores accepted send logs and relinks orphan receipts. An operator must resolve unknowns against provider evidence before approving resume.

Signed delivery/open/click/bounce/complaint events are written transactionally; failed suppression writes return an error for webhook retry rather than treating a receipt as complete. Replies to the configured inbound mailbox reuse the existing durable reply/pause function. Signed unsubscribe GET only confirms intent; POST performs the durable pause/consent withdrawal and cancels reserved messages. Link scanners cannot unsubscribe through GET.

Live invocations persist `cron_runs` and use the existing Sentry check-in/error infrastructure. **No schedule or Sentry monitor was provisioned.** Before activation, provision/test the missing-run monitor independently of the job: automatic check-in configuration alone cannot detect a job that never starts.

Private dashboard queries (service role, access-controlled operator tooling only):

```sql
SELECT * FROM public.email_lifecycle_due ORDER BY evaluated_at;
SELECT * FROM public.email_lifecycle_outcomes ORDER BY handoff_at DESC;
SELECT * FROM public.cron_runs WHERE job='email-lifecycle' ORDER BY started_at DESC LIMIT 20;
```

The due view includes current status/reason, owner, timing/age, attempt and provider evidence. Decisions are current snapshots, not a full transition-history warehouse. Historical send attempts retain send evidence. Outcome rows distinguish message-attributed entry from subsequent session completion and identify mature seven-day windows; these are observational, not causal lift. Opens/clicks alone do not prove useful product activity.

## Review and activation packet — no steps executed against production

Owner: Steven. Status: `awaiting_operator`. Next action: review this diff and rendered copy. Next review: the next operator review session; no automatic activation or date rollover.

1. Operator review the diff, original audit, six rendered variants and consent/history cohort provenance. Resolve overlap with the primary checkout. Keep the reviewed cohort at 50 or fewer. Do not turn missing consent into enrollment.
2. Verify production schema prerequisites from `20260903180000_email_contact_policy.sql`, including actual provider event/entitlement contracts. The isolated database tests apply both migrations to explicit fixtures; they are not proof of current production schema. Separately approve staging/production migration and regenerate Supabase types from the applied staging schema. The narrow RPC adapter remains until that step.
3. Prove the actual reply-to mailbox delivers a signed inbound event and pauses a pending recipient. The audited Gmail-forwarding arrangement is not automatically a Resend inbound integration. `EMAIL_REPLY_INGESTION_VERIFIED=true` must reflect demonstrated evidence, not a workaround. Verify sender authentication and unsubscribe in separately approved internal inbox tests.
4. Approve sender/reply identity, rendered copy and manifest hash. Insert an explicitly approved, expiring `startup-lifecycle-v1` campaign only under separate production-data approval. Changes to layout/link behavior require bumping the layout/link contract in the content hash as well as new approval. Payload hashes preserve exactly what was handed off; the manifest hash is not an automatic hash of every transitive template source.
5. Individually enroll reviewed recipients with consent reference, historical/manual contact evidence and verified entitlement reference. Entitlement review validity is **at most 24 hours**. Steven owns refreshing it daily during the pilot; stale reviews hold recipients. There is no automatic RevenueCat fetch/consent-acquisition UI in this release. If the cohort is empty or all held, resolve the actual reason before activation.
6. Run authorized read-only dry run using `/api/cron/email-lifecycle?mode=dry-run`. It does not reserve, persist run decisions, check in or call the provider. Preview rendering uses synthetic data and no provider. Separately approve any staging fixtures or persistent shadow evaluation.
7. Verify authenticated CTA → intended app action → attributed event with approved test accounts/devices. The included HTTP tests prove route/auth/disabled/unsubscribe contracts, not this authenticated product journey. Complete real email-client/dark-mode checks before customer activation.
8. With all switches still off, separately approve deployment and cutover. Confirm the six legacy routes are retired in the deployed artifact, manual bypass scripts are inaccessible, requested account mail still works and the due view is available to the operator. Keep old proactive cron schedules harmless until separately authorized removal.
9. Separately approve provisioning a 15-minute job and an independent missing-run/failure alert to Steven, then test a missed run and webhook failure. No new schedule is in `vercel.json`. Confirm durable run records, unknown-handoff halt and the operator dashboard before enabling the cohort.
10. Explicit operator approval is required to enable the environment flag and both database controls. Pilot at the approved lower cap (hard ceiling 15/day). Review due/held/expired/unknown, failures, suppression and receipts every business day. Any unresolved unknown handoff or suppression failure stops new handoffs; no automatic expansion.

## Offers and expansion — preserved, not advertised

Steven owns the two offer decisions. Decision review target: first two working days after this implementation start, September 15, 2026. If unresolved, retain `awaiting_operator` with a named next action; do not silently enqueue a campaign.

- **Five genuine completed sessions → one month Pro on us.** Decide historical sessions, distinct-session validity, eligibility for prior trials/paid subscribers, exact access/renewal terms, budget and a verified fulfillment mechanism. Existing weekly promotional-entitlement helpers are not proof that a one-month five-session reward can be fulfilled. Next bounded implementation: one-time earned/claimed/fulfilled ledger, fifth-session concurrency, progress cancellation, expiry/redemption reconciliation and entitlement proof. Email opt-out must never erase an earned reward.
- **Selected falling-off users → three months Pro on us.** Decide the early falling-off threshold separately from a 30-day reactivation window, one-time/non-stacking rules, platform code inventory, prior-trial eligibility, renewal terms and budget. Next action: verify one approved test redemption end to end before approving offer copy. No ordinary trial link may substitute for the promised duration.
- Beach-proof specifics, transparent build updates, personalized invitation/reminder, conditional second trial help, referral and reactivation variants remain archived/reviewable content for future mutually exclusive slots. No seven-day blast was retained. Core lifecycle activation does not activate these features.

## Rollback

Before any approved rollout, record the deployed revision, migration checksum and previous control values. Emergency stop: disable the environment lifecycle switch and database lifecycle control, pause campaign and authorized schedule, retain all evidence. Disabling the shared database gate also stops requested condition-email handoffs; auth/account mail is separate. Any already-started provider request is reconciled, not assumed cancelled.

Prefer a forward fix while retaining the additive schema. Do not drop reservation/provider evidence, backfill old completions as new events, or remove legitimate entitlements. Do not blindly roll back to old cron/direct-SDK senders: preserve their retirement gates in any code rollback. Resume only after evidence review and explicit operator approval.

## Verification and limits

Full-suite results precede the final isolated provider/SQL corrections; targeted tests, SQL and typecheck were rerun after those changes. All checks used local dummy environment values and/or a disposable PostgreSQL 15 cluster, never production credentials. The PostgreSQL runner binds a unique local UNIX socket with TCP disabled and shuts down its cluster. The preview server was stopped after screenshots.

| Command | Result |
|---|---|
| `bash scripts/test-email-lifecycle.sh` | PASS. Both migrations, eligibility/session/trial/cadence/suppression rules, global legacy-log cap, final-slot handoff, unknown halt, service-role/read-only boundaries and two concurrent connections. |
| `yarn typecheck` | PASS after final source changes. |
| `yarn test:unit --runInBand --bail=0` | PASS: 1,423 suites, 18,208 tests; 16 suites/195 tests skipped, one todo. |
| `yarn test:unit --runInBand __tests__/lib/email __tests__/lib/mailer/client.test.ts __tests__/api/cron/condition-alert-deliver.test.ts __tests__/app/api/webhooks/resend.test.ts` | PASS: 10 suites, 160 tests after final provider-contract changes. Final SQL changes were rerun through the SQL suite. |
| Scoped `yarn eslint --max-warnings=0` on 26 changed/new production TS, script and config files | PASS. Full argument list is in `startup-verification/lint.log` in the audit artifact directory. |
| `yarn test:e2e --config=playwright.email-lifecycle.config.ts --workers=1 --retries=0` | PASS: 3 local HTTP tests. No provider, seeded production data or authenticated product-flow claim. |
| `VERCEL_ENV=preview yarn build` | FAIL at forecast prerender with isolated/unavailable Supabase data. Compilation/type validation succeeded. Resolved September 12 by on-demand regional generation; full build passes. Runtime production-data verification remains separate. |
| `VERCEL_ENV=preview yarn next build --experimental-build-mode compile` | PASS; does not validate prerender data. |
| `yarn deadcode` | FAIL: repository-wide unused files/dependencies/exports. Six remaining unused files are outside this change; legacy exports remain. Removed newly unused retired template files and the new unused export. Resolved September 12: corrected source graph, removed unused exports/modules and verified dependency declarations; unfiltered Knip now passes. |
| `node --import tsx scripts/preview-email-lifecycle.ts /Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/email-audit-2026-09-11/startup-previews` | PASS: six synthetic HTML/text variants and manifest. |
| `python3 /Users/stevenchandler/.codex/skills/visual-screenshot-evidence/scripts/render_visual_evidence.py --input /Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/email-audit-2026-09-11/startup-previews/visual-evidence.json` | PASS evidence validation. Browser renders at 390/800px: 12 screenshots, no horizontal overflow or console errors. |
| `git diff --check` | PASS. |

Checks requiring project environment were prefixed with `bash /tmp/quiver-email-lifecycle-check.sh`; its contents are copied to `startup-verification/local-check-env.sh` in the audit artifact directory for reproducibility. Initial checks found stale retired-route expectations and old sender mocks; those were corrected, then the full suite passed. Initial PostgreSQL 14 rejected the existing security-invoker view syntax; the runner now selects PostgreSQL 15. An attempted direct execution of the non-executable temporary wrapper failed with 126; invoking it through bash passed. Final provider review additionally corrected permanent-bounce classification and top-level event timestamps against the installed SDK and [Resend documentation](https://resend.com/docs/webhooks/emails/bounced); targeted regression tests passed. No test failures were left hidden.

E2E reviewed: existing `e2e/email-core-loop/session-logging.spec.ts`, email-preference flow, setup/helpers and global Playwright configuration. Added `e2e/email-core-loop/lifecycle-contract.spec.ts` and a separate no-global-seeding config. Existing product email flows were not run because they require configured test data. Final scoped E2E status: **3 PASS**. Full real-device/email-client/product-outcome E2E remains unverified.

Screenshots demonstrate browser layout, not Gmail/Outlook/Apple Mail rendering or dark-mode transformation. No real inbox send was performed. Existing Android instructions have a known low-contrast secondary paragraph from the audit; this release changes its sender classification only. Fix and validate that existing template before expanding its audience.

Rendered evidence: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/email-audit-2026-09-11/startup-previews/`.
The original factual `AUDIT.md` is unchanged. `PLAN.md` now records local implementation authorization. Removed source assets are preserved under `retired-source/` and Git history.


Migration SHA-256: `4246125a9acd907afc1823b889eaabf0d10bc9cc22b909dc9597f59a3b3598d6`.

## Files changed

Exact worktree inventory excluding verification evidence stored outside the repository; `M` modified, `D` deleted, `??` new. No production deployment/data was changed.

```text
 M .env.example
 M __tests__/api/cron/welcome-email.test.ts
 M __tests__/api/internal/send-welcome-email.test.ts
 M __tests__/app/api/app-link-email.test.ts
 M __tests__/app/api/cron/cron-outcome-wiring.test.ts
 M __tests__/app/api/cron/first-session-nudge.test.ts
 M __tests__/app/api/cron/session-prompt-email.test.ts
 M __tests__/app/api/cron/trial-invitation-email.test.ts
 M __tests__/app/api/cron/trial-lifecycle-email.test.ts
 M __tests__/app/api/cron/weekly-recap-email.test.ts
 M __tests__/app/api/webhooks/resend.test.ts
 M __tests__/lib/mailer/android-beta.test.ts
 M __tests__/lib/mailer/client.test.ts
 M app/api/app-link-email/route.ts
 M app/api/cron/condition-alert-deliver/route.ts
 M app/api/cron/first-session-nudge/route.ts
 M app/api/cron/session-prompt-email/route.ts
 M app/api/cron/trial-invitation-email/route.ts
 M app/api/cron/trial-lifecycle-email/route.ts
 M app/api/cron/weekly-recap-email/route.ts
 M app/api/cron/welcome-email/route.ts
 M app/api/internal/send-welcome-email/route.ts
 M app/api/webhooks/resend/route.ts
 D lib/email/email-types.ts
 M lib/mailer/android-beta.ts
 M lib/mailer/client.ts
 D lib/mailer/templates/CheckInEmail.tsx
 D lib/mailer/templates/FirstSessionNudgeEmail.tsx
 D lib/mailer/templates/PersonalizedNudgeEmail.tsx
 M lib/services/new-user-alerts.ts
 M scripts/send-check-in.ts
 M scripts/send-founder-story.ts
 M scripts/send-template-preview.ts
 M scripts/send-test-welcome.ts
?? __tests__/fixtures/email-lifecycle.sql
?? __tests__/integration/email-lifecycle-rules.sql
?? __tests__/integration/email-lifecycle.sql
?? __tests__/lib/email/lifecycle-dispatcher.test.ts
?? __tests__/lib/email/lifecycle-unsubscribe.test.ts
?? __tests__/lib/email/lifecycle.test.ts
?? __tests__/lib/email/provider-events.test.ts
?? app/api/cron/email-lifecycle/
?? app/api/email/
?? docs/implementation/email-lifecycle-startup.md
?? e2e/email-core-loop/lifecycle-contract.spec.ts
?? lib/email/lifecycle-dispatcher.ts
?? lib/email/lifecycle.ts
?? lib/email/provider-events.ts
?? lib/mailer/lifecycle-email.tsx
?? lib/mailer/templates/LifecycleEmail.tsx
?? playwright.email-lifecycle.config.ts
?? scripts/preview-email-lifecycle.ts
?? scripts/test-email-lifecycle.sh
?? supabase/migrations/20260912010000_startup_email_lifecycle.sql
```

## September 12 continuation

Steven approved resolving the remaining build and repository-wide dead-code gates. Goal reopened; local work only. Execution plan: fix regional on-demand generation while retaining error propagation and cache; correct scanner inputs and remove verified unused code; run full build, unfiltered deadcode, TypeScript, unit and relevant E2E checks; review the expanded diff. No baseline or blanket ignored issue category may substitute for resolving the failures.
