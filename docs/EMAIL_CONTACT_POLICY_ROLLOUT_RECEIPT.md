# Disabled email contact policy rollout receipt

Verified: 2026-09-03T18:52:09.709Z (11:52 PDT).
Result: production database migration applied and verified; policy remains disabled. No application deployment or mail configuration changes.

## Authorization and source

Approved plan: `docs/EMAIL_CONTACT_POLICY_ROLLOUT.md`, SHA-256 `afd510aa4c2a45ff8493bfc0e070a20bcadac5ef068e23338d822117887984b6`. The approved plan was preserved unchanged.

Migration: `supabase/migrations/20260903180000_email_contact_policy.sql`, SHA-256 `155525bedfbd825dbae70ec4b6975211bf21928b30fc2939c6bb6bf076ee5698`.

Local commit: `d2a23fd2755259208d7e5255c33b152a77417a37`, `feat(email): add private contact policy state`. Exactly one file committed, the migration. Nothing pushed. Unrelated work and other task files remained unstaged.

Target: production project `vawdnbbgawichorsjiwe`, database `postgres`, owner role `postgres` through `postgres.vawdnbbgawichorsjiwe` at `aws-0-us-west-1.pooler.supabase.com`. Server version 15.8. Credentials were supplied through protected environment variables and are not included here.

## Backup

Path: `/Users/stevenchandler/.codex/backups/quiver/email-contact-policy-20260903-preapply.dump`.

Custom-format full database dump, 237,899,566 bytes, created immediately before application. Directory mode 0700; file mode 0600. File creation was exclusive and did not overwrite an existing backup.

SHA-256: `6d4fc00ff5630bb3729d0ad2cbbcb2e21756add5126ed634400079839dd7b7ba`.

PostgreSQL 15.14 `pg_dump` completed with exit 0 and empty stderr. Matching `pg_restore --list` completed successfully with 4,800 archive entries; archive includes data for `auth.users`, `public.profiles` and `public.email_send_log`. This was archive inspection, not a full restore drill. The backup contains private production data and must remain outside Git and shared reports.

## Transaction and verification

Preflight confirmed all 19 referenced columns, service-role read grants and BYPASSRLS, and absence of the new tables, function names and migration version.

Applied the reviewed migration body and inserted version `20260903180000`, name `email_contact_policy`, with its exact original SQL in `supabase_migrations.schema_migrations.statements`, in one transaction. Lock timeout 10 seconds; statement timeout 90 seconds. All assertions passed before COMMIT; psql exit 0, empty stderr.

Postflight confirmed:

* Four tables owned by postgres with RLS enabled; 23 columns with expected types/defaults/nullability, eight indexes and ten constraints read back.
* Service-role table privileges and function EXECUTE allowed; anon/authenticated table privileges and function EXECUTE denied, checked in the transaction.
* Three security-invoker functions with `search_path=public, pg_temp` and bodies matching the approved migration.
* `email_contact_controls`: singleton true, enabled false, daily_cap 15.
* Recipient state rows: 0; send attempt rows: 0; inbound reply rows: 0.
* Exactly one stored migration SQL statement; its MD5 `cb30c25e2de3ece8799ecd2f3dbbdb90` matches the full local migration contents.

Function body MD5 checks:

| Function | MD5 |
| --- | --- |
| claim_email_contact | 39eb7066953759ff3ff30b843244eb0a |
| finish_email_contact | ffb3895f6aaf5bb96deb789bb17b96bd |
| record_email_reply | 05be8b7179819559f5d91c5719bfe600 |

## Commands and checks

Run from `/Users/stevenchandler/Desktop/dev/quiver`:

```sh
shasum -a 256 docs/EMAIL_CONTACT_POLICY_ROLLOUT.md supabase/migrations/20260903180000_email_contact_policy.sql
git diff --cached --name-only
git add -- supabase/migrations/20260903180000_email_contact_policy.sql
git commit -m 'feat(email): add private contact policy state'
/opt/homebrew/Cellar/postgresql@15/15.14/bin/pg_dump --format=custom --lock-wait-timeout=30s
/opt/homebrew/Cellar/postgresql@15/15.14/bin/pg_restore --list /Users/stevenchandler/.codex/backups/quiver/email-contact-policy-20260903-preapply.dump
psql -X -v ON_ERROR_STOP=1 -P pager=off
psql -X -qAt -v ON_ERROR_STOP=1
```

All listed rollout checks passed. pg_dump stdout was directed to the exclusively opened protected backup file. psql received SQL on stdin via a local Node wrapper: read-only preflight, the approved migration/tracking transaction with assertions, then read-only catalog verification. Passwords were supplied only via the child process environment. The commit hooks also passed (14 checks, zero failures; no secret leaks).

No unit or E2E tests rerun this turn: application code was not changed or deployed. Prior validation remains 168 passing Jest tests and isolated PostgreSQL policy/concurrency checks; E2E/live send-reply testing remains not run.

## Remaining boundary

Existing production email schedules and environment variables are unchanged. This rollout did not send emails, enroll recipients, grant consent or activate the new policy. The available Resend key remains send-only; receiving-mailbox and webhook configuration require administrative access. Application deployment, mailbox validation and live activation still require separate approval. Do not interpret installed schema as a running campaign.
