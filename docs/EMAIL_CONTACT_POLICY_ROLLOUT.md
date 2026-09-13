# Email contact policy: disabled database rollout approval

Prepared September 3, 2026. Status: awaiting explicit approval. No production changes made.

## Authorized scope when this plan is approved

Commit only the migration named below locally, create and validate a protected production backup, apply only that migration through the production owner connection, record it in migration tracking, and verify its objects and disabled state. Do not push, deploy application code, configure mail accounts, change environment variables, enroll users, grant consent, enable the policy or send any email.

## Exact migration and target

Migration: `/Users/stevenchandler/Desktop/dev/quiver/supabase/migrations/20260903180000_email_contact_policy.sql`

Migration SHA-256: `155525bedfbd825dbae70ec4b6975211bf21928b30fc2939c6bb6bf076ee5698`

Target project: `vawdnbbgawichorsjiwe`. Host: `aws-0-us-west-1.pooler.supabase.com`. Database: `postgres`. Connection user: `postgres.vawdnbbgawichorsjiwe`, resolving to database role `postgres`. Use the existing protected `POSTGRES_URL_NON_POOLING` configuration; never include its password in logs or commands.

Objects created: `public.email_contact_controls`, `public.email_contact_state`, `public.email_contact_attempts`, `public.email_reply_events`, their indexes, RLS and restricted service-role privileges, plus functions `claim_email_contact`, `finish_email_contact` and `record_email_reply`. The only application-data insert is the singleton control with `enabled=false` and cap 15. Existing recipients and messages are unchanged.

Migration tracking: version `20260903180000`, name `email_contact_policy`, with the exact migration contents retained in `supabase_migrations.schema_migrations.statements`. Schema creation and tracking must be one transaction; do not commit schema first and add tracking afterward. No other pending migrations are included.

## Preconditions and execution

1. Verify the migration file still matches the SHA above and that task-owned changes do not overlap other work. Commit only this migration using `feat(email): add private contact policy state`; no push. If unrelated staged files exist, stop rather than including them.
2. Recheck that the migration version, four tables and three function signatures are absent. Verify all referenced production columns and service-role grants. Any drift stops execution for a revised plan.
3. Create a full custom-format pg_dump backup at `/Users/stevenchandler/.codex/backups/quiver/email-contact-policy-20260903-preapply.dump` using the owner connection. Protect its directory and file permissions; never put it in the repository. Do not overwrite an existing backup. Require successful dump completion, archive inspection and age below 24 hours before applying anything. The backup has not yet been created.
4. Apply only the exact reviewed SQL and its migration-tracking record in one transaction. If any statement fails, roll back; do not broaden into a general migration push or repair other schema drift.
5. Read back every table, index, function signature, RLS setting, grant and migration record. Confirm the control has `enabled=false`, the three other new tables are empty, and no email was dispatched. Retain a sanitized receipt with backup path, migration/commit hashes, timestamps and verification results.

## Recovery

Before transaction commit, roll back on any failure. After commit, leave the additive schema in place and keep its control disabled; do not drop tables or restore production wholesale as an automatic rollback. Disabling is not needed for existing mailers because this stage makes no application or environment changes. Preserve any unexpected data and request a separate recovery plan if verification fails.

## Read-only preflight results

The owner connection succeeded with `BEGIN READ ONLY`. All 11 checked profile and entitlement columns have the expected types. The migration version and four new tables are absent. Remaining object/grant checks are repeated immediately before application.

The available production Resend API key returned HTTP 401 for both `GET /domains` and `GET /webhooks`, with the message that it is restricted to sending. No configuration was changed. Local production configuration has no `EMAIL_REPLY_MAILBOX` or `EMAIL_CONTACT_POLICY_ENABLED` value. This does not prove Vercel's current remote environment settings; those still require a separate check.

Mailbox setup requires authenticated Resend administrative access through its dashboard or a locally configured appropriately scoped management credential. Do not paste secrets in chat. Receiving-domain choice, webhook subscriptions and actual send/reply acceptance remain later approval gates. Do not alter apex-domain MX records.

## Separate later releases

Application deployment, receiving-mailbox configuration, historical contact reconciliation, evidence-backed cohort enrollment and live-send activation are not authorized by this database-only approval. A disabled database rollout does not mean the campaign is running.

Validation this turn: production schema read-only preflight passed; provider management checks blocked by send-only access; `git diff --check` passed. Only this plan and environment-variable documentation were changed. No E2E or unit tests rerun for these documentation-only changes; prior local implementation checks are recorded in `docs/EMAIL_CONTACT_POLICY.md`.
