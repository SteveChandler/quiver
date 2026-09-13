# Growth email execution safeguards

Status: database migration applied in production and verified disabled on September 3, 2026. Application implementation remains local and undeployed. See [rollout receipt](EMAIL_CONTACT_POLICY_ROLLOUT_RECEIPT.md). The local validation record below predates this database-only rollout.

## Boundary

Codex can propose audiences and content. The database decides whether a managed email may be sent. Private recipient state stays in Supabase; Brand Vault receives aggregate results only.

`email_contact_state` stores consent evidence, the approved campaign reference, historical-contact review, expiring trial-eligibility evidence and reply/pause state. No existing user is automatically granted marketing consent or trial eligibility. Absence of an entitlement is not proof of store trial eligibility.

`email_contact_attempts` reserves a send before calling the provider. Reservation and daily-cap checks run under a transaction lock. The reservation ID is the provider idempotency key. Timeouts, provider errors and receipt-write failures remain unresolved reservations; they never silently become permission to send again. Resolve these only after checking provider evidence. This slice deliberately has no automatic retry or resume endpoint.

`email_reply_events` stores signed inbound metadata, not message bodies. An exact sender-address match pauses managed messages for the corresponding account. Unknown senders remain recorded, allowing later acquisition checks to fail closed. There is no fuzzy identity matching or model-based permission decision.

All four new tables have RLS enabled and no client access. Only service-role operations may access their data or functions.

## One contact policy

Managed routes: trial invitation, first-session nudge, session prompt, weekly recap, trial-start support and trial-ended feedback. They share a maximum of 15 managed attempts per Pacific calendar day and a 72-hour per-recipient cooldown. Acquisition also observes seven days since any previously logged email and is blocked by consent gaps, stale/missing eligibility evidence, any prior entitlement, prior attempts, or replies. Suppression lookup errors now fail closed on all consumers.

Explicit exemptions: authentication, requested app links, welcome/onboarding, user-requested condition alerts, and trial-ending charge notices retain their existing delivery rules. They must not be delayed by a marketing quota. Existing logged sends influence acquisition cooldowns, but simultaneous transactional delivery is allowed by design. This is not a universal cap on every kind of email.

Legacy founder-story and check-in scripts refuse direct sends when `EMAIL_CONTACT_POLICY_ENABLED=true`; they must not be used from another environment to bypass policy. Existing manual Gmail threads require reconciliation before enrollment. No Gmail send-history importer or automatic inbound forwarding has been configured.

## Reply routing

The existing signed Resend webhook now handles `email.received`. Set `EMAIL_REPLY_MAILBOX` to an approved Resend receiving address and subscribe the existing webhook to inbound events. The managed sender sets Reply-To to this mailbox. Provider metadata is validated before the atomic reply/pause operation. Persistence failures return 503 for retry; signature failures return 401.

Reference: [Resend inbound event schema](https://resend.com/docs/webhooks/emails/received). Use an approved receiving subdomain or provider-issued receiving address; do not change the apex domain's MX records and break existing mail. Verify a real reply and access for support review before enabling sends. This code records metadata only; it does not automatically answer replies or fetch their bodies.

A provider-verified event authenticates delivery, not the human author's identity. A spoofed sender can cause a conservative pause, never consent, account access or an automatic reply. A message already handed to the provider cannot be recalled if a reply or entitlement update arrives just afterward. New sends check state immediately before provider handoff.

## Activation gates

1. Review and apply `supabase/migrations/20260903180000_email_contact_policy.sql` using the repository's separate production migration approval protocol. Do not apply other pending migrations opportunistically.
2. Verify actual production columns, policies and grants against the migration. Regenerate database types from the validated schema; do not hand-edit generated types. The temporary RPC boundary in the adapter isolates the unapplied schema.
3. Deploy the sender and webhook with `EMAIL_CONTACT_POLICY_ENABLED=true` and the verified reply mailbox. The database control starts with `enabled=false`, so all managed sends remain blocked. Verify every relevant deployment/script uses the same flag; a flag-off worker retains legacy behavior.
4. Reconcile existing email jobs and historical Gmail contacts. Import only reviewed consent and eligibility evidence. Do not fabricate dates or references to make a cohort pass. Keep non-managed transactional jobs under their established rules.
5. Run internal send/reply acceptance tests on a safe environment. Confirm provider acceptance, duplicate denial, reply pause, unsubscribe and entitlement exits. Explicitly approve live activation before setting the database control to enabled.
6. Pause managed sends by setting the database control back to false while leaving the feature flag true. Turning the feature flag off restores legacy behavior and is NOT an emergency stop. Already in-flight requests may finish.

The Day 1/4/7 sequence, automatic agent scheduler, versioned campaign approvals, retry reconciliation tooling, PC video lane and social publishing are separate work. This slice does not enable them or declare the campaign running.

## Validation

`bash scripts/test-email-contact-policy.sh` creates a fresh local PostgreSQL cluster, applies the migration against minimal dependency fixtures, exercises the real functions and verifies concurrent jobs cannot both reserve the same recipient. It never connects to configured development or production databases. This is not a full Supabase migration replay or live provider test.

Jest covers fail-closed suppression, the shared sender gate, provider receipt handling, ambiguous failures, inbound schema validation, signed webhook routing and existing route regressions. Browser E2E is not changed: the modified surface is server-side email and webhook execution. Live delivery and reply validation remains a release gate.

### Local verification record

All commands below ran from `/Users/stevenchandler/Desktop/dev/quiver`.

* PASS: 168 Jest tests across 11 suites. Initial tests correctly failed before implementation; intermediate fixture/type failures were corrected and the final test set passed.
* PASS: real PostgreSQL function assertions and concurrent reservation check, using a fresh isolated cluster and minimal dependency schema.
* PASS: TypeScript, scoped ESLint and `git diff --check`.
* FAIL: repository-wide `yarn deadcode`; reported existing unused files/dependencies/exports and unlisted dependencies, including the pre-existing `svix` import. No unrelated cleanup was performed.
* Not run: browser E2E, full production build, full Supabase reset/replay, live provider sends, real inbound routing and production migration. No browser E2E specs were modified or reviewed for this server-only slice. E2E status: not run, not a pass.

Exact successful test commands:

```sh
yarn test:unit --runInBand --silent --runTestsByPath __tests__/lib/email/contact-policy.test.ts __tests__/lib/email/suppression.test.ts __tests__/lib/mailer/client.test.ts __tests__/app/api/webhooks/resend.test.ts __tests__/app/api/cron/session-prompt-email.test.ts __tests__/app/api/cron/trial-invitation-email.test.ts __tests__/app/api/cron/weekly-recap-email.test.ts __tests__/app/api/cron/trial-lifecycle-email.test.ts __tests__/app/api/cron/first-session-nudge.test.ts __tests__/api/cron/welcome-email.test.ts __tests__/api/internal/send-welcome-email.test.ts
bash scripts/test-email-contact-policy.sh
yarn typecheck
git diff --check
yarn eslint --max-warnings=0 lib/email/contact-policy.ts lib/email/suppression.ts lib/mailer/client.ts app/api/cron/trial-invitation-email/route.ts app/api/cron/first-session-nudge/route.ts app/api/cron/session-prompt-email/route.ts app/api/cron/weekly-recap-email/route.ts app/api/cron/trial-lifecycle-email/route.ts app/api/webhooks/resend/route.ts scripts/send-founder-story.ts scripts/send-check-in.ts __tests__/lib/email/contact-policy.test.ts __tests__/lib/email/suppression.test.ts __tests__/lib/mailer/client.test.ts __tests__/app/api/webhooks/resend.test.ts __tests__/app/api/cron/session-prompt-email.test.ts __tests__/app/api/cron/weekly-recap-email.test.ts __tests__/api/cron/welcome-email.test.ts
```

Failed broad check: `yarn deadcode` (exit 1). The earlier intentionally red test command was `yarn test:unit --runInBand --runTestsByPath __tests__/lib/email/contact-policy.test.ts __tests__/lib/email/suppression.test.ts`. The initial `yarn typecheck` also failed on the new test fixture's widened string type; corrected with a literal type, then passed.

### Files changed

Production code and schema:

* `lib/email/contact-policy.ts` (new), `lib/email/suppression.ts`, `lib/mailer/client.ts`.
* `app/api/cron/trial-invitation-email/route.ts`, `app/api/cron/first-session-nudge/route.ts`, `app/api/cron/session-prompt-email/route.ts`, `app/api/cron/weekly-recap-email/route.ts`, `app/api/cron/trial-lifecycle-email/route.ts`.
* `app/api/webhooks/resend/route.ts`.
* `scripts/send-founder-story.ts`, `scripts/send-check-in.ts`.
* `supabase/migrations/20260903180000_email_contact_policy.sql` (new, unapplied).

Tests added or changed:

* `__tests__/lib/email/contact-policy.test.ts` (new), `__tests__/lib/email/suppression.test.ts`, `__tests__/lib/mailer/client.test.ts`.
* `__tests__/app/api/webhooks/resend.test.ts`, `__tests__/app/api/cron/session-prompt-email.test.ts`, `__tests__/app/api/cron/weekly-recap-email.test.ts`, `__tests__/api/cron/welcome-email.test.ts`.
* `__tests__/fixtures/email-contact-policy.sql`, `__tests__/integration/email-contact-policy.sql`, `scripts/test-email-contact-policy.sh` (new isolated SQL tests).

Documentation: this runbook and the implementation-status paragraph in `Brand-Vault/marketing/growth-ops/plans/codex-driven-launch-2026-09-03.md`. Existing roadmap/Hawaii migration work was left untouched. Nothing committed, deployed, enabled or sent.
