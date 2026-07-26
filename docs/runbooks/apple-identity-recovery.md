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
