# Phase 21 rollout decision — two-account server-side canary only (2026-08-29)

Product decision (program thread, recorded by the Fable coordinator):

**Trusted-forecast adjustments serve ONLY Steven's and Shapan's accounts. Phase 21 must
never become default-on for other users.** Broadening rollout requires a new product
decision supported by the canonical install-to-paid funnel — technical success alone is
insufficient.

Implementation (implemented, uncommitted): worktree `.worktrees/phase21-canary`, branch
`program/phase21-two-account-canary`, base `92c0b1b6b`. Server-only env allowlist requiring
exactly two distinct UUIDs (fail-closed; the alerts allowlist pattern was explicitly
rejected because empty is fail-open); eligibility enforced at the `update-enhanced` serving
boundary; stored `enhanced_forecasts` rows remain baseline for everyone; responses
`private, no-store`; kill switch `TRUSTED_FORECAST_CANARY_SERVING_ENABLED` (any value other
than exact `true` restores baseline). The two canonical user IDs are resolved from approved
account records at activation and are never hardcoded anywhere.

Authoritative execution record + activation checklist: GitHub issue #640.
