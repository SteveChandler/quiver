# Swell Watch release identity review — 2026-09-04

Verdict: **identity guard implemented; local verification only**. The synthetic-evidence bypass below is historical and is now rejected by the public dispatch RPC. Production release remains blocked on the separate producer, evidence, device and deployment gates.

## Original finding: synthetic observations could reach dispatch

`20260904140000_create_swell_watch_provider_run_receipts.sql` restricts generic `ingest_swell_watch_evaluation` to `synthetic_fixture` inputs (lines 428–431), allowing those inputs to populate the same event pipeline as verified observations. This is useful for local testing, but the final `swell_watch_validate_notification_release` wrapper (lines 470–515) rejects invalid provider evidence only when `identity_kind = 'genuine_completed'`. Synthetic latest/supporting observations skip that condition and reach the internal release check. There is no fixture-only transport/environment constraint in that SQL path.

The original reproduction used `bash scripts/test-swell-watch-worker-postgres.sh` with two `synthetic_fixture` evaluations and observed one recording-transport send. The updated drill instead requires that case to be suppressed and exercises the verified ingestion path for its positive control. No production deployment or live configuration was inspected.

## Focused implementation handoff

Follow-up source audit confirmed the fix must cover supporting evidence, not only the latest observation. `advance_swell_watch_event` accepts both identity kinds and promotes the last two distinct evaluation rows without filtering their kind; once stable it returns stable early. Thus a latest-only genuine check would leave mixed support insufficiently guarded. This is source-level evidence; a mixed-support database reproduction remains part of the implementation tests.

The existing verified path already preserves same-run identity: issuances are unique on transport/model/run, batches are unique on issuance, and verified ingestion derives `genuine_completed:<batch.id>` rather than using the completed revision ID. Event evaluations are unique on event/evaluation. Reuse those invariants; do not add a second issuance-key scheme or broad schema refactor. Distinct valid batch identities correspond to distinct issuances under these constraints, but current evidence and continuity still require validation.

Implementation: user-authorized Terra/high subagent in the isolated Phase 26 web worktree. The final release RPC now rejects a missing, synthetic, mixed, revoked, superseded, or non-independent evidence set before calling the original release logic. It requires a current genuine destination observation and exactly two current genuine supporting evaluations from distinct provider issuances. Lock order and the original invalid-input response are preserved. No production mutations, real sends, commits, pushes, or publishing occurred.

1. Make the public dispatch RPC fail closed unless its destination observation and the required supporting evaluations are genuine, current, independently issued completed batches. Reject synthetic, missing, mixed, revoked and superseded evidence. Preserve existing lock ordering and invalid-input handling. Do not introduce a fixture bypass, environment switch, caller-controlled attestation, or weaken the requirement to keep a test green.
2. Inspect the event advancement/stability contract before choosing the supporting-evidence query: confirm distinct provider issuance, same-run revision behavior, suppression boundaries and beach/region scope. Do not assume two rows mean two evaluations. Preserve existing typed suppression semantics where appropriate.
3. Keep local synthetic ingestion for detector tests, but change the real worker drill to prove it cannot dispatch. For the positive worker case, reuse the receipt/attestation fixtures from `scripts/test-swell-watch-provider-run-receipts-postgres.sh` and its associated fixture helpers to exercise the verified ingestion RPC with two distinct locally simulated provider runs. Those attestations remain explicitly local synthetic test evidence, never real operational qualification.
4. Add real-database negative cases for all-synthetic and mixed genuine/synthetic support with otherwise eligible policy, audience and control. Assert exact terminal suppression, no provider outcome/send, and no retry dispatch. Keep a positive verified-path control, hold/reset/stale-binding tests and the existing provider-revocation race test.
5. Review migration application status and all harness consumers before editing the unapplied migration or adding a follow-up. Follow repository migration rules. Do not hand-edit generated types; no new RPC signature should be needed for this guard.

Required verification: both existing disposable PostgreSQL harnesses, full-snapshot worker drill, scoped notification/receipt tests, scoped strict ESLint, `yarn typecheck`, and PR-style review of the full affected diff. Record exact commands/counts and cleanup. Neither these fixtures nor this guard close the commercial producer, real shadow corpus, physical-device or deployment gates.

## Implementation evidence — 2026-09-04

Parent independently reran `bash scripts/test-swell-watch-worker-postgres.sh` (1 suite / 1 test) and the exact scoped Jest command below (3 suites / 80 tests): both passed, exit 0, using explicit fixture values with no environment files present. The tested migration/drill hashes match the worker artifacts. Dedicated database/REST resources and the parent-owned dependency symlink were cleaned up. Final source review found no remaining actionable finding within this identity-gate fix.

- `bash scripts/test-swell-watch-event-pipeline-postgres.sh` — PASS. Its release-positive control now uses two distinct locally simulated receipt attestations and `ingest_verified_swell_watch_evaluation` calls.
- `bash scripts/test-swell-watch-provider-run-receipts-postgres.sh` — PASS. Includes the provider revocation race with independently issued supporting evidence.
- `bash scripts/test-swell-watch-worker-postgres.sh` — PASS (1 suite, 1 test). It proves all-synthetic and reverse-ordered mixed evidence (synthetic support followed by a genuine latest observation) terminate without a send or provider outcome; the verified positive uses two receipt/attestation batches and an S2 `1.8m/13s/170°` tuple matching queued context.
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only yarn test:unit --runInBand __tests__/migrations/swell-watch-provider-run-receipts.test.ts __tests__/notifications/swell-watch-release.test.ts __tests__/notifications/worker.test.ts` — PASS (3 suites, 80 tests).
- `npx eslint --max-warnings=0 __tests__/migrations/swell-watch-provider-run-receipts.test.ts __tests__/notifications/swell-watch-worker-postgres.drill.ts` — PASS.
- `yarn typecheck` — PASS.

The local attestations are explicitly simulated fixture evidence. They neither qualify the prototype provider transport nor close commercial-producer, real-shadow-corpus, physical-device, deployment, or activation gates.

## Review evidence and limitations

Parent review inspected the final guard, same-issuance constraints, exact S2 fixture correspondence, reverse-ordered mixed-support case and zero-outcome assertions. Migration SHA-256: `ccf349a4d984c695863088ea9f803528f03df62db9ba7b8dc328938d903df468`; worker drill SHA-256: `e367d45eafe64e7ca97294f25be5730c1fac75973f77f079cddc6dac5a6f9e09`.

Environment deviation: an intermediate failed Jest configuration attempt temporarily linked the primary checkout's `.env.local`, contrary to the no-credentials task boundary. The worker removed the link; no values were printed. Configuration failure alone does not prove no values were loaded. Successful worker-reported scoped tests used explicit fixture values. Parent separately confirmed `.env`, `.env.local`, `.env.test` and `.env.test.local` absent before its independent fixture-only rerun. Do not repeat the symlink workaround.

The attached Pixel is authorized but its installed production binary/active OTA is not verified as Phase 26. No browser/physical E2E was run for this DB/worker fix; native canary evidence is recorded separately.
