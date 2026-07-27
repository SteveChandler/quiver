# Apple Identity Recovery Threat Model

## Scope

This flow begins only from an authenticated Quiver account. The client completes
a fresh Sign in with Apple challenge and sends the signed identity token to
`POST /api/auth/apple-recovery/assess`. The server verifies Apple's signature,
issuer, configured audience, expiry, and a five-minute issue-time window. The
stable Apple `sub` is the only ownership key. Email, verified-email flags, and
`privaterelay.appleid.com` addresses are deliberately ignored.

## Trust boundaries and controls

| Threat | Control |
| --- | --- |
| Stolen or old Apple token | Five-minute Apple-token age; issuer/audience/signature validation; token SHA-256 replay claim |
| Stolen long-lived Quiver session | `withAuth` plus canonical `last_sign_in_at` no older than ten minutes |
| Account enumeration | Authenticated-only routes; opaque account labels and support references; no emails or UUIDs in responses |
| Brute force / replay | Strict per-client recovery rate limit, required idempotency keys, unique token digest |
| Relay/shared-email collision | Never used for identity resolution |
| Data loss from incomplete emptiness check | Frozen `pg_catalog` FK inventory; any new unregistered dependency returns `schema_coverage_incomplete` |
| Split data-bearing accounts | Any profile row or dependent product row returns `support_required`; no automatic mutation |
| Partial auth transfer | No direct write to GoTrue-owned `auth.identities`, `auth.users`, or `auth.sessions` |
| Insider/operator ambiguity | Append-only recovery audit events and explicit canonical-account confirmation |
| Cached sensitive response | Dynamic Node routes and `Cache-Control: no-store` on every response |

## Current fail-closed boundary

Supabase Auth does not expose a supported operation that transactionally moves
an identity between users while revoking sessions and maintaining GoTrue
metadata. The confirmation RPC therefore records consent as `operator_pending`
and returns `identity_transfer_not_supported`. It does not change identity
ownership. Production recovery must remain disabled until a supported transfer
primitive or reviewed operator transaction exists.

## Monitoring

Alert on `schema_coverage_incomplete`, replay attempts, rate-limit violations,
confirmation failures, and any recovery request left `operator_pending`.
Dashboard counts must be grouped by event type only; never export Apple subjects,
token hashes, emails, or account IDs to analytics.
