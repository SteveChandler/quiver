# Android Private Tester Roster Runbook

## Status

The roster foundation is production-dormant. No Google Workspace credentials,
delegated subject, encryption key, or migration has been provisioned or
verified. Missing or invalid configuration fails closed before any Google
network request. Do not enable the roster until Terms and Privacy changes have
completed legal review.

## Evidence contract

Direct, active `USER` membership in the single configured Google Group
establishes eligibility. Nested groups, suspended members, captured beta-page
email, Google Play opt-in, install, first open, and account join never establish
or imply another stage.

Every stage stores its own `status`, `source`, `observed_at`, `confidence`, and
non-PII `evidence`. Google Play opt-in remains `unknown` unless an administrator
records one explicit manual Play Console observation. Manual Play evidence
accepts only the bounded `play_console_membership_review` code plus an opaque
internal UUID; raw Google member IDs, hashes, free-form references, and emails
are rejected by both the route and database function. Aggregate reporting and
non-PII exports do not reveal roster identity.

The authenticated native join is independent of analytics consent:

```http
POST /api/android-tester-roster/join
Authorization: Bearer <Supabase user JWT>
Cache-Control: no-store
```

```json
{
  "nativeInstallId": "uuid",
  "idempotencyKey": "43-character-base64url"
}
```

First success and same-key retry both return HTTP 200
`{ "outcome": "linked", "retryable": false }`.

First-open and bounded install attribution are separate authenticated, no-store
receipts with independent idempotency keys:

```http
POST /api/android-tester-roster/first-open
POST /api/android-tester-roster/install
```

```json
{
  "nativeInstallId": "uuid",
  "idempotencyKey": "43-character-base64url"
}
```

```json
{
  "nativeInstallId": "uuid",
  "idempotencyKey": "43-character-base64url",
  "attribution": {
    "source": "android_beta_page",
    "surface": "android_beta",
    "placement": "direct",
    "campaign": "app_first_v1",
    "createdOn": "2026-07-25",
    "expiresOn": "2026-08-24"
  }
}
```

All bodies are strict and contain no email. First success and same-key retry for
first-open or install return HTTP 200
`{ "outcome": "observed", "retryable": false }`. The native client submits join
first, then first-open, and submits install only when bounded attribution exists.
No complete snapshot, no exact transient authenticated-email match, or
operational evidence received before account join returns HTTP 200
`{ "outcome": "pending_retryable", "retryable": true }`. Malformed input is a
terminal 400. Auth, rate-limit, and service failures remain non-2xx and native
retries them on a later foreground launch.

## Identity encryption and retention

Unjoined identity is a single AES-256-GCM envelope containing the external email
and Google member ID. Every write uses a random 96-bit IV and an explicit key
version. The roster stores no plaintext identity and no reversible or
deterministic email/member hash.

An authenticated join atomically links `user_id`, records only its account-join
receipt and stage, anonymously audits the operation, and deletes the identity
envelope immediately. First-open and install evidence are recorded only by
their dedicated endpoints. Account deletion removes the entire user-linked
roster record and all three receipts, and anonymizes retained audit residue.
Later syncs resolve the linked account email
transiently through Supabase Auth to compare it with the complete Directory
snapshot; they never restore the deleted external identity envelope or persist
the auth email in roster tables, observations, audit, or logs.

A complete sync holds one database-backed claim before the Directory fetch
through the atomic snapshot apply. A concurrent sync returns `busy` without
fetching Directory or reading/applying identities. Failed fetch, encryption, or
apply paths finalize or release the claim; abandoned claims become recoverable
after 15 minutes. This prevents overlapping snapshots from creating duplicate
entries.
When Google changes an unjoined member's primary email or member ID, sync emits
an explicit `identity_refresh`, replaces the old ciphertext with a fresh-IV
envelope, and records only the non-PII refreshed count in the sync run/audit.

A complete snapshot that no longer contains an unjoined member marks the entry
ineligible and sets `purge_after = observed_at + 30 days` exactly. Rejoining
before that instant cancels the purge. Incomplete snapshots never mark leave.
For linked accounts, complete-snapshot leave and rejoin update eligibility
without a purge schedule because no raw identity remains to retain or purge.
The sync purges identities whose deadline is due; the separately callable purge
RPC supports an operational scheduler after rollout approval.

## Scheduled maintenance

Vercel invokes `GET /api/cron/android-tester-roster` every six hours at minute
15 UTC (`15 */6 * * *`). The route requires the existing `CRON_SECRET`
authorization and has two independent, exact-string feature flags that default
off:

```dotenv
ANDROID_TESTER_ROSTER_CRON_ENABLED=false
ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED=false
```

When the cron flag is not exactly `true`, the route returns `disabled` before
creating a service client. It does not contact Google, claim a sync, purge
identity, or mutate roster state. When the cron flag is `true`, due identity
purge runs even if Google sync remains disabled. Google Directory access and
sync claims occur only when the Google sync flag is also exactly `true`.

Purge and sync are independent maintenance attempts: a purge failure does not
prevent sync, and a sync failure does not undo a successful purge. Responses
contain only bounded outcome classes and aggregate counts. They never include
emails, member IDs, tokens, keys, ciphertext, provider errors, or exception
details. A concurrent claim reports `busy`; an incomplete Directory snapshot
reports `incomplete` and does not apply leave observations. Claims abandoned
for 15 minutes are recoverable by the next eligible run.

## Google Workspace provisioning

1. Create a dedicated service account in the approved Google Cloud project.
2. Enable Admin SDK API.
3. Grant domain-wide delegation for exactly:
   `https://www.googleapis.com/auth/admin.directory.group.member.readonly`.
4. Create a dedicated delegated Workspace subject with the minimum Directory
   privilege needed to list Group members.
5. Configure the one fixed Group key. Do not accept a group key from request
   input.
6. Store the service-account email/private key and delegated subject only in
   encrypted Vercel server environment variables.
7. Generate a 32-byte roster identity key with a CSPRNG, base64 encode it, store
   it as `ANDROID_TESTER_ROSTER_IDENTITY_KEY_V1`, and set active version `1`.
8. Confirm missing config, invalid key, token failure, and any failed page all
   produce an incomplete snapshot with no leave observations.

The adapter uses the signed-JWT service-account flow, exact readonly scope,
`members.list`, `maxResults=200`, full pagination, and direct active USER
filtering. A partial response is discarded.

## Key rotation

1. Add `ANDROID_TESTER_ROSTER_IDENTITY_KEY_V<N>` without removing prior keys.
2. Set `ANDROID_TESTER_ROSTER_IDENTITY_ACTIVE_KEY_VERSION=<N>`.
3. Run a complete manual sync; new/rejoined envelopes use the new version.
4. Re-encrypt remaining old-version envelopes only through a separately
   reviewed, audited maintenance change.
5. Remove an old key only after aggregate verification shows zero envelopes on
   that version and rollback artifacts are retained.

Never log keys, decrypted identity, JWT assertions, access tokens, raw email,
member ID, or ciphertext to application logs, Sentry, PostHog, or roster audit.

## Rollout

1. Complete legal approval for `/terms` and `/privacy`.
2. Review `20260725213000_create_android_tester_roster.sql` under
   `docs/MIGRATION_SAFETY.md`. Run
   `scripts/db/run-android-tester-roster-smoke.sh` against local Supabase; it
   creates and drops an isolated database while exercising RPC grants,
   concurrent claims, redaction, retention purge, and deletion cleanup. Then
   take a fresh production backup and obtain explicit approval.
3. Apply through the tracked production owner connection. Do not apply from a
   feature branch.
4. Regenerate database types only after the migration is applied.
5. Provision encrypted environment variables with both scheduler flags set to
   `false`, then deploy the web routes.
6. After separate production-owner approval, set
   `ANDROID_TESTER_ROSTER_CRON_ENABLED=true` while leaving Google sync disabled
   to exercise retention purge only.
7. After Google credentials and Directory behavior are independently verified,
   set `ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED=true`.
8. Run one admin manual sync and verify `complete=true` aggregate counts.
   A `busy` result means another sync owns the claim; retry after it finishes.
9. Validate Android simulator redemption, authenticated join, explicit
   first-open, optional bounded install receipt, all three idempotent retries,
   raw-identity deletion, and account deletion. Simulator/API validation plus
   production monitoring is the standard gate; a physical device is optional
   and non-blocking.
10. Release native join support and monitor before expanding membership.

## Monitoring and rollback

Alert on:

- any mandatory-audit failure;
- incomplete syncs or sync age above 24 hours;
- sync claims held longer than 15 minutes or repeated `busy` results;
- decryption or key-version failures;
- join, first-open, or install-receipt 5xx above 2%;
- sustained `pending_retryable` while complete snapshots are healthy;
- due identity purges that remain unprocessed;
- unexpected changes in per-stage eligible, linked, install, first-open, or
  manual Play-evidence aggregates.

Rollback Google synchronization first by setting
`ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED=false`. If scheduler execution itself
must stop, then set `ANDROID_TESTER_ROSTER_CRON_ENABLED=false`; otherwise keep
the cron enabled in purge-only mode so approved retention deadlines continue to
be enforced. Removing Google roster credentials also causes sync to fail
closed without leave changes. Keep encryption keys and schema in place so
retained envelopes remain decryptable. Do not roll back by dropping tables or
deleting rows. The existing Android beta Group/Play handoff continues
independently.
