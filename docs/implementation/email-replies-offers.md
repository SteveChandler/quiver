# Reply ingestion and offer fulfillment

> Superseded for routine automation by [End-to-end lifecycle completion](email-automation-completion.md). The manual pilot/code-distribution and mirror-verification descriptions below record the earlier implementation; use the completion runbook for activation.

September 12, 2026. Local implementation authorized; production configuration,
migrations, sends and grants remain disabled. Continue in the existing isolated
email-lifecycle worktree. No commit or deployment.

Execution plan:
1. Ingest Gmail message metadata through read-only OAuth and durable history
   checkpoints, matching the existing Forward Email → Gmail path. Fail closed on
   incomplete scans, expired history, auth failure or stale health. Persist exact
   reply identities before advancing checkpoints; reuse the shared pause ledger.
2. Add approved, bounded offer programs and user-bound awards. Five canonical
   completed sessions, including historical sessions, earn one month; selected return recipients get three
   months. Retain earned rights across email opt-out. Use account claim codes and
   fixed calendar expiry, with no subscription/automatic renewal created.
3. Reserve a grant before RevenueCat handoff, verify active access beforehand,
   persist acceptance/verified promo evidence, and reconcile ambiguous results
   without automatic duplicate grants. Preserve existing weekly-grant behavior
   only where it cannot overlap the new programs.
4. Validate with disposable PostgreSQL and stubbed Gmail/RevenueCat endpoints;
   unit, type, lint, deadcode and relevant HTTP checks. Prepare the concrete
   mailbox/bootstrap and offer activation packet. No live OAuth changes, inbox
   test messages, offer-code issuance or entitlement grant without separate approval.

Approved session policy: count historical completed sessions too. Remaining defaults: paid,
trial, promo and lifetime holders cannot stack access; retain a qualified reward
until access lapses and eligibility is reviewed. Three-month targeting is manually
selected, not an inferred inactivity campaign. Both programs remain draft/off.

Review risks: a Gmail connector in Codex is not a deployed OAuth credential;
Gmail history expiry must stop sends rather than advance over a gap; direct
promotional access is not an App Store trial code and does not defer an existing
subscription. Claim wording must say promotional Pro access and disclose expiry.

## Implemented contract

Gmail ingestion uses the existing Quiver alias → Forward Email → Gmail topology.
Only metadata is read; no inbox label, message, folder, or body is modified. Each
scan owns a durable lease/run, checks the OAuth account, reads at most five history
pages / 200 distinct messages, and has a 40-second network deadline. A matching
sender pauses all profiles with that exact address and cancels outstanding email
reservations before the history checkpoint advances. IDs are namespaced by Gmail
account. Failed, missing, stale or expired history stops handoff. This is polling:
it bounds reply lag; it cannot promise that a reply arriving after the scan will
beat a handoff already in progress. Freshness is enforced in PostgreSQL at both
reservation and handoff, including conditions alerts (two minutes).

Both offer programs start disabled, with no enrolled recipients. Each defaults
to a 25-award pilot, with a hard maximum of 50. The one-month and three-month
programs therefore reserve at most 25 + 75 promotional months under defaults.
Approval freezes terms, duration, issuance budget and issuance window. A service
role is required for private tables/functions; authenticated clients cannot read
code hashes or issue awards directly. Admin issuance is authenticated and saves
the acting admin ID and eligibility reference. It returns a random 256-bit,
account-bound code once; only its SHA-256 hash is stored.

Five distinct nondeleted sessions with status `completed`, including historical
sessions, qualify. Historical qualification is checked at enrollment; subsequent
completion events persist the earned right at session write time. The five source
session IDs and earning time are retained. Planned/deleted sessions do not count
at qualification. Once earned, later edits, opt-out or campaign expiry do not
silently erase the reward. Each user can earn each program once. Three-month
recipients require explicit manual selection and an eligibility reference.

The claim page reviews the exact one- or three-calendar-month duration before a
second confirmation. Tokens stay out of URLs and persistent browser storage;
password inputs, replay masking and telemetry redaction protect them. Claims use
an authenticated, rate-limited POST. Preview is the default and neither reserves
nor calls RevenueCat. A live claim needs both the application flag and approved
database program. Detected active paid/trial/promotional/lifetime or billing-grace access holds the right;
it is not intentionally stacked or treated as an unconsumed billing trial. UTC calendar
arithmetic clamps month ends. The expiry is fixed before handoff.

The provider flow is reserve → independent customer/entitlement read → durable
handoff fence → one promotional grant POST → independent receipt verification →
ledger completion. A timeout, malformed receipt or ledger failure leaves a
reconciliation obligation; retrying a claim cannot create another grant. A later
reconciliation does GET only and verifies the original product, store,
production status and expiry. No invented provider idempotency header is used.
Account aliases without exact canonical identity are held for review. The existing
`earned_pro_grants` audit receives a unique award reference. RevenueCat access
proof and the Quiver entitlement mirror are recorded separately. A missing mirror
after 15 minutes makes reconciliation unhealthy and alerts the owner.

The previous two-week-streak / rolling-week grant job is retired. It cannot race
the new fulfillment path, even with its old environment flag enabled. An older
subscription-product expiration no longer revokes an active finite promotional
mirror. The six core lifecycle email templates are unchanged in this phase;
code issuance and claim fulfillment do not send email. Automated offer-email
selection is a later content activation step inside the single lifecycle policy,
not a new blast or an unconditional award notification.

## Activation packet — not executed

Owner: Steve. Review this code and migrations before any activation. The user has
approved counting historical completed sessions. The Quiver claim-code mechanism
is the implementation default; choosing App Store offer codes would require a
separate implementation and store setup. Three-month falling-off eligibility is
manual until a threshold is approved.

1. Apply reviewed migrations to a disposable/staging database first, in order:
   existing contact policy → startup lifecycle → Gmail reply ingestion → offer
   fulfillment. The pre-existing `earned_pro_grants` migration must already be
   present. Take the required backup and obtain separate production-migration
   approval before applying anything live. Do not hand-edit generated DB types;
   the narrow validated RPC boundary remains until a local schema type generation.
2. Keep `EMAIL_LIFECYCLE_ENABLED`, `PRO_OFFERS_ENABLED` and the database program
   switches off. Drain/disable the previous earn-Pro cron and ensure no earlier
   weekly grant is in flight before deploying the retirement. No grant revocation
   is part of rollout or rollback.
3. Configure a dedicated read-only Gmail OAuth credential (`gmail.readonly`),
   `EMAIL_GMAIL_ACCOUNT`, `EMAIL_REPLY_MAILBOX`, `EMAIL_GMAIL_CLIENT_ID`,
   `EMAIL_GMAIL_CLIENT_SECRET`, `EMAIL_GMAIL_REFRESH_TOKEN`. The Codex Gmail
   connector is not a deployed credential. Review historical mailbox replies and
   record pauses before inserting the singleton `email_reply_sync` row with the
   approved mailbox, trusted history ID and review reference. No automatic cursor
   bootstrap is provided. Enable Gmail sync alone, run the authenticated admin
   sync endpoint, verify durable runs and a controlled reply canary before
   setting the existing `EMAIL_REPLY_INGESTION_VERIFIED` flag.
4. Verify the RevenueCat project/key, canonical app-user identity, Pro entitlement
   identifier and production webhook. Separately approve one real test-account
   canary: review → claim → provider receipt → webhook → web/native access → repeat
   claim without another POST. No real grant or native canary was performed here.
5. Approve each program's terms/version, named recipient selection, expiry and
   award budget. Record approval in `pro_offer_programs` before turning on its
   `enabled` field and `PRO_OFFERS_ENABLED`. An expired issuance window stops new
   issuance while honoring issued rights. Pausing a program stops fulfillment
   without deleting rights. For recovery, rotate a lost code only after verifying
   ownership and approving the private-row update; do not issue a second award.
6. Install and verify monitored jobs before enabling sending: email lifecycle
   every 15 minutes, offer reconciliation every 15 minutes. No schedules were
   added by this work. Sentry monitors use `email-lifecycle` and
   `pro-offer-reconcile`; point alerts to the owner and test missed-run and error
   alerts. An independent admin reply sync is available while lifecycle sending
   remains off. Conditions alerts are held whenever inbox health is older than
   two minutes; any desired independent reply-poll cadence needs explicit schedule
   approval.

Operations endpoints (no scheduler entry is added):

- `POST /api/admin/email/replies/sync`: admin-only metadata synchronization;
  does not enable sending or recover a failed checkpoint automatically.
- `POST /api/admin/offers`: default `mode: "preview"`; `mode: "issue"` persists a
  user-bound award/code after program approval. Fields: `userId`, `program`,
  `reference`, `termsVersion`. Response uses `offerToken`; never put it in a URL.
- `POST /api/offers/claim`: authenticated own-account `offerToken`, with
  `mode: "preview"` (default) or explicit `mode: "claim"`.
- `GET /api/cron/pro-offer-reconcile`: cron authenticated, disabled by default,
  durable run records and Sentry check-ins; checks provider state, never re-grants.
- `/offers/claim`: user review/confirmation page, paused until enabled.

Daily operator dashboard queries (service role, read-only):

```sql
SELECT * FROM email_reply_sync;
SELECT * FROM email_reply_sync_runs ORDER BY started_at DESC LIMIT 25;
SELECT * FROM email_lifecycle_due ORDER BY due_at NULLS LAST;
SELECT * FROM pro_offer_attention ORDER BY enrolled_at;
SELECT * FROM cron_runs WHERE job IN ('email-lifecycle','pro-offer-reconcile')
ORDER BY started_at DESC LIMIT 25;
```

On Gmail failure, keep lifecycle disabled, investigate OAuth/forwarding/history
and review the missing interval. Persist missed reply pauses before resetting a
reviewed checkpoint; never advance over a history gap merely to make the job green.
On unknown grants, reconcile against RevenueCat with GET only. Absence of a
matching receipt is not permission to retry POST. Owner investigation resolves
revoked, expired, aliased or mismatched grants. Preserve the original fixed expiry
and ledger throughout recovery.

Rollback: turn off both application switches, pause offer programs, and stop the
new schedules. Retain all reply/award/provider evidence and outstanding earned
rights. Keep the legacy weekly grant disabled when rolling back application code.
Do not revoke legitimate promotional access or drop state tables to roll back.


Provider limitations verified against current primary documentation:
[RevenueCat Customer GET](https://www.revenuecat.com/docs/api-v1/customers) is a
**get-or-create** endpoint. A missing/deleted subscriber may be recreated even on
GET. No RevenueCat request was made during this implementation. Production
activation approval must cover this documented behavior; a 201 response is held
and never followed by a grant. Reconciliation is grant-free, but must not be
represented as universally free of provider-side writes. If recreation is
unacceptable, replace this lookup with the V2 customer/subscription read APIs
before activation (different credentials/contracts).

The [promotional grant API](https://www-docs.revenuecat.com/docs/api-v1/entitlements)
does not offer an atomic exclusion against a simultaneous store purchase. Local
reservations and fresh entitlement checks prevent duplicate Quiver claims and
hold known paid/trial/promo/grace access; an external purchase racing the grant
remains a provider limitation. Post-grant mismatches stay unresolved for review.
The [Gmail synchronization contract](https://developers.google.com/workspace/gmail/api/guides/sync)
requires full recovery when a history boundary expires; this implementation stops
for reviewed recovery instead of inventing a safe cursor.


## Verification and review record

All execution was local to `orch/email-lifecycle-startup-20260911` in the existing
isolated worktree. No commit, production migration, production configuration,
email send, grant, deployment or schedule change occurred. Production source files
were edited locally; production systems were not changed.

Evidence directory:
`/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/email-audit-2026-09-11/replies-offers-verification/`.
`files-changed.txt` lists this phase's files, including deletions, separately from
the already-completed broad repository cleanup in the same uncommitted worktree.

Production-code changes are the Gmail adapter/dispatcher and cron, offer
fulfillment library, admin issue/sync and authenticated claim APIs, reconciliation
cron, claim page/form, RevenueCat mirror guard, telemetry token redaction, two SQL
migrations, disabled environment defaults, and retirement of the weekly grant
route/helper. Test and runbook changes are listed in the same manifest.

Reviewed E2E: `e2e/README.md`, `e2e/utils/error-detection.ts`, existing
`e2e/email-core-loop/lifecycle-contract.spec.ts`, and its dedicated Playwright
configuration. Added HTTP authorization/disabled/405 contracts, paused mobile and
desktop claim-page checks, a single-main-landmark assertion, overflow checks and
screenshots. The unrelated page-view analytics endpoint is explicitly stubbed
because this UI test runs against a disconnected local database. Actual claim
ownership and confirmation behavior are tested through route and component unit
tests; provider transport is stubbed and durable state is tested in PostgreSQL.

Exact commands and results (run from the isolated worktree):

| Command | Result |
| --- | --- |
| `bash scripts/test-email-lifecycle.sh` | PASS: actual contact/lifecycle/reply/offer migrations on disposable PostgreSQL; reply pause/checkpoint, permissions, qualification, held rights, receipt/mirror and concurrent-claim assertions |
| `yarn test:unit --runInBand --bail=0` | PASS: 1,426 suites / 18,247 tests, four snapshots; existing 16 skipped suites / 195 skipped tests / one todo remain |
| `yarn test:unit --runInBand --runTestsByPath __tests__/lib/email/gmail-replies.test.ts __tests__/lib/subscription/offer-fulfillment.test.ts __tests__/lib/email/lifecycle-dispatcher.test.ts __tests__/app/api/cron/earn-pro-evaluate.test.ts __tests__/app/api/cron/cron-outcome-wiring.test.ts __tests__/app/api/webhooks/revenuecat.test.ts __tests__/app/offers/claim-form.test.tsx __tests__/lib/monitoring/redact-secrets.test.ts __tests__/app/api/offers/claim.test.ts` | PASS: nine suites / 104 tests |
| `yarn playwright test --config playwright.email-lifecycle.config.ts` | PASS: five local HTTP/browser tests; 390px and 1280px screenshots |
| `yarn typecheck` | PASS; the final full build also checks TypeScript |
| `NODE_OPTIONS=--max-old-space-size=8192 yarn lint` | PASS; final touched-source lint rerun after small review fixes also passed |
| `yarn deadcode` | PASS: unfiltered Knip, no findings |
| `env VERCEL_ENV=preview yarn build` | PASS: final production compilation, TypeScript and prerender build, 83.17 seconds |
| `git diff --check` | PASS |

Jest, Playwright, Knip and build commands used the existing safe environment wrapper:
`bash /Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/email-audit-2026-09-11/startup-verification/local-check-env.sh`.
For the build, its arguments are `env VERCEL_ENV=preview yarn build`.
The wrapper supplies dummy loopback database values, not production secrets.
Exact scoped ESLint invocations and command output are retained in the logs.

Initial failures were fixed: a PL/pgSQL variable/table-alias collision; a cron
wiring assertion that still expected the now-retired weekly grant implementation;
and an E2E readiness selector that used the mobile header label at desktop width.
An initial Knip invocation without the required dummy environment failed at config
loading and passed when rerun with the existing wrapper. No test was skipped to
obtain these passing results. Final review also added billing-grace suppression,
alerts for an overdue missing entitlement mirror, token redaction, and the
existing cream-input theme hook; it removed the nested main landmark.

Visual findings: the final screenshots show the cream content card on the existing
twilight shell, clear copy/CTA order, readable line lengths and no horizontal
overflow at either width. The disabled fields and explicit paused message reflect
the actual launch state. The enabled review/confirm states have component test
coverage but have not received a real signed-in browser/provider canary.

Remaining activation evidence: full shared-schema staging migration rehearsal;
real forwarded-reply/OAuth/history canary; provider identity/offer-mechanism and
terms approval; a separately approved production test-account grant plus native
and web entitlement confirmation; approved live jobs and tested alert delivery.
These are explicit release gates, not silently running background work. No native
source files changed; no native simulator or real-provider E2E test was run.
