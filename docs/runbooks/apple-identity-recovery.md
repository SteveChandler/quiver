# Apple Identity Recovery Runbook

## Release gates

Do not enable `APPLE_IDENTITY_RECOVERY_ENABLED` or mutate production Auth config
until all gates are approved:

1. Apply the committed migration through the normal migration approval process.
2. Enable Supabase manual identity linking in the target Auth environment.
3. Confirm the schema-coverage assessment returns complete against production.
4. Complete security review of the threat model and the supported identity
   transfer primitive.
5. Pass Apple sandbox linking and conflict flows in the iOS simulator.
6. Rehearse recovery, notification, session revocation, and rollback against
   disposable users. Production monitoring validates the released flow.

Local `supabase/config.toml` enables manual linking for testing only. This commit
does not change production Auth configuration or apply a migration.

## Production configuration checklist

Apply and verify these changes through the normal operator approval path. Code
deployment alone does not enable recovery.

1. Apply `20260725190000_apple_identity_recovery_foundation.sql`, then
   `20260802160000_register_post_foundation_apple_recovery_dependencies.sql`.
   The later migration registers whichever of the 21 reviewed Auth FKs exist
   in the target schema, covering the Android tester roster, community photo,
   and canonical Android waitlist migrations after the foundation's frozen
   dependency snapshot. It aborts if any current Auth/Profile FK is still
   uncovered, including an unexpected dependency outside that reviewed set.
2. Apply `20260802161000_add_apple_orphan_recovery_flagged_event.sql` before a
   native build can trigger `apple_orphan_recovery_flagged`, then apply
   `20260802162000_detect_apple_orphan_after_sign_in.sql`.
3. Set Vercel Production `APPLE_RECOVERY_AUDIENCES` exactly to
   `app.quiversurf.mobile,app.quiversurf.mobile.web`. Verify the existing
   public identifiers remain `APPLE_APP_BUNDLE_ID=app.quiversurf.mobile` and
   `NEXT_PUBLIC_APPLE_CLIENT_ID=app.quiversurf.mobile.web`.
4. Enable Supabase Auth manual identity linking in the target environment.
5. Run the schema-coverage query in
   `.planning/apple-orphan-population-20260802.sql`; it must return zero rows.
6. Set Vercel Production `APPLE_IDENTITY_RECOVERY_ENABLED=true` and redeploy so
   the serverless functions receive the new environment.
7. With a canonical account signed in less than ten minutes ago, submit a new
   Apple identity token issued less than five minutes ago. `eligible` requires
   the Apple-linked secondary to have no `profiles` row and no row in any
   registered dependency. A profile row alone deliberately returns
   `support_required`; do not delete product data to force eligibility.

Assessment remains unavailable when the feature flag is not the exact string
`true`, when no allowed Apple audience is configured, or when current catalog
FKs exceed the reviewed dependency registry. Invalid, stale, or wrong-audience
Apple challenges return `invalid_apple_challenge` instead of being reported as
server configuration failures. Confirmation remains fail-closed with
`identity_transfer_not_supported` after it records explicit consent.

## Supported-provider boundary

Rechecked against the official Supabase Auth contract on 2026-07-26:

- [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
  supports automatic same-verified-email linking and signed-in manual linking.
  A candidate identity already linked to another user is rejected.
- [Identity unlinking](https://supabase.com/docs/reference/javascript/auth-unlinkidentity)
  is initiated by the currently authenticated identity owner and requires that
  user to retain at least one other identity.
- The [Supabase Auth repository](https://github.com/supabase/auth) explicitly
  warns applications not to modify or depend on the Auth-managed schema.

Supabase documents no admin API that transactionally reassigns an OAuth
identity between users. `admin.updateUserById()` changes user attributes; it
does not transfer an `auth.identities` owner. Do not work around that boundary
by coercing email metadata, deleting the secondary user before a replacement
link is confirmed, or writing Auth-owned tables directly. Those approaches
cannot provide the approved atomic transfer, session revocation, notification,
snapshot, and rollback guarantees.

## Assessment drill

Test four disposable cases: unclaimed Apple identity, identity already linked to
the canonical account, secondary account without a profile/dependencies, and a
secondary with one product row. Verify responses are respectively `unclaimed`,
`already_linked`, `eligible`, and `support_required`. Add a temporary public
table with an FK to `auth.users`; assessment must become
`schema_coverage_incomplete` until that FK is deliberately registered.

## Confirmation and transfer

The current confirm endpoint records explicit consent and produces an opaque
support reference, then stops. It must return
`identity_transfer_not_supported`; this is expected, not a recoverable runtime
error. No operator may manually update `auth.identities` from this runbook.

A future approved transfer must be one transaction or supported Auth operation
that:

- locks both users and the recovery request;
- rechecks schema coverage and product-data emptiness;
- snapshots the secondary auth/profile state;
- attaches the Apple identity to the confirmed canonical user;
- revokes every secondary session;
- marks notification delivery;
- records `completed_at` and `rollback_until`;
- preserves the secondary snapshot through the rollback deadline.

## Rollback drill

Before release, prove rollback restores the exact identity owner and metadata,
revokes post-transfer sessions on both accounts, records `rolled_back`, and
notifies the user. Compare snapshot hashes before and after. If rollback cannot
be completed atomically, keep automatic recovery disabled and route every case
to support.

## Incident response

Set `APPLE_IDENTITY_RECOVERY_ENABLED=false` first. Preserve request and audit
rows. Do not delete or merge either account. Revoke affected sessions through
supported Supabase Admin APIs, notify the owner through verified contact
channels, and require a reviewed per-user merge plan for any data-bearing
conflict.
