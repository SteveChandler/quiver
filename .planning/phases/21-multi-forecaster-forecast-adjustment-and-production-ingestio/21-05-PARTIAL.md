---
phase: 21-multi-forecaster-forecast-adjustment-and-production-ingestio
plan: 21-05
subsystem: infra
tags: [python, typescript, verification, read-only, live-sources, rollout]

requires: [21-01, 21-02, 21-03, 21-04]
provides:
  - "Read-only live verifier over the 17-source contract with sanitized output and fail-closed exit codes."
  - "Exact-target production smoke runner whose preflight aborts before any write-capable module is imported."
  - "Cross-repo parity checks for the three tables hand-mirrored between sources.py and the TypeScript policy."
  - "A coverage ratchet against the PRODUCTION vocabulary rather than the fixture corpus."
  - "21-VERIFICATION.md: live evidence, gate output, mutation audit and the ordered blocker list."
affects: []

tech-stack:
  added: []
  patterns:
    - "A verifier proves read-only by making the write accessor unusable, not by not calling it."
    - "A degraded-item budget is zero unless someone writes down why it is not."
    - "Deploy ordering is a preflight probe, not a line in a runbook."

key-files:
  created:
    - /Users/stevenchandler/Desktop/dev/seaside/scripts/verify_trusted_forecast_ingestion.py
    - scripts/trusted-forecast-production-smoke.ts
    - scripts/__tests__/trusted-forecast-production-smoke.test.ts
    - .planning/phases/21-multi-forecaster-forecast-adjustment-and-production-ingestio/21-VERIFICATION.md
  modified:
    - /Users/stevenchandler/Desktop/dev/seaside/tests/test_fetch_trusted_forecasts.py

key-decisions:
  - "Degraded gating is a per-source written budget defaulting to zero, not a >0 threshold and not report-only."
  - "The nws_hawaii_srf degraded budget was removed after measurement contradicted the guess behind it."
  - "--build-anchor-at is required in addition to the plan's five arguments, because a build key derived from the key under test is not a check."
  - "Findings in 21-03/21-04 files were reported, not patched: those artifacts carry a critic-verified mutation digest."

patterns-established:
  - "Cross-language mirrors are compared by parsing the TypeScript, and the parser raises on anything it cannot read rather than skipping it."
  - "Coverage vocabulary is ratcheted against what production emits, since the fixture corpus can be both short of it and stale relative to it."

requirements-completed: [MFA-08 (read-only half)]

duration: single-session
completed: 2026-08-07
---

# 21-05: Verification and Rollout — PARTIAL

**Status: read-only verification COMPLETE and green. Rollout BLOCKED at step 1 of 6.**
Nothing was committed, pushed, merged, deployed or written.

Full evidence: `21-VERIFICATION.md`.

## What shipped

| File | What it is |
|---|---|
| `seaside/scripts/verify_trusted_forecast_ingestion.py` | **NEW.** `--live --no-write` verifier: 17 sources in registry order, sanitized report, 10 contract checks, nonzero exit on any enabled-source failure |
| `seaside/tests/test_fetch_trusted_forecasts.py` | +20 tests for the verifier (858 → 878 suite-wide) |
| `quiver/scripts/trusted-forecast-production-smoke.ts` | **NEW.** Seven-step exact-target preflight; the write-capable module is not *imported* until all seven pass |
| `quiver/scripts/__tests__/trusted-forecast-production-smoke.test.ts` | **NEW.** 41 tests; "no write" is asserted on a `jest.fn` call count |
| `21-VERIFICATION.md` | **NEW.** Live results, five carried items, D2, four new findings, gates, mutations, blocker list |

## Live result

```
13 ok · 4 skipped_disabled · 0 failed · exit 0
512 issues · 512 distinct identities · 512 distinct revisions · 502 authority rows
C1-C10 all PASS
```

Independently reproduces 21-01's numbers.

## The prediction round 3 asked 21-05 to verify: FALSIFIED

`nws_hawaii_srf` was predicted to "fail on most runs" on `Rest of today:`.
Across **22 consecutive live issuances** (7 days), the surf-table label vocabulary
is exactly `{Today, Tonight, <Weekday>}` — **220 label occurrences, 0 rejections**.
`.REST OF TODAY...` does appear, but only as a *narrative section header*; the
parser reads labels solely from the fixed-width surf table, which says `Today` on
the very same product. Round 3's own finding — that surf lives only in the table —
is what makes it safe.

## Carried items

| # | item | outcome |
|---|---|---|
| 1 | `skipped_disabled` non-failing | DONE, MV1 RED |
| 2 | degraded gating product call | **per-source written budget, default 0**; `new_york` = 8 of 16, measured; the speculative `nws_hawaii_srf` budget was removed when measurement showed 34 = 17 rows × 2 periods with zero losses |
| 3 | freshness tables agree | DONE and widened to timezones and chart slugs; 17/17, 17/17, 8/8 |
| 4 | coverage ratcheted against production | **22 of 56 production triples are UNCLAIMED**; 1 excusal (`regional/norcal/primary`) is stale |
| 5 | `malibu` may not be a real slug | **Neither `malibu` nor `trestles` exists in `beaches`** (346 rows). The feature is 100 % inert in production |
| D2 | deploy ordering | encoded as preflight step 2 and **firing today** — `trusted_forecast_*` return HTTP 404 |

## New findings (belong to 21-03/21-04)

- **F1 (P1)** — 21-04 put `server-only` inside the forecast-builder import graph, so
  `yarn tsx scripts/regenerate-enhanced-forecasts.ts` now fails at import. Proven
  by running the same dynamic import on the base tree (OK) and on 21-04 (fails).
- **F2 (P1)** — 21-04's `expectConsoleErrors` blast-radius fix missed
  `enhanced-forecast-service.test.ts` and `enhanced-forecast-cdip-integration.test.ts`;
  full `yarn test:unit` has 7 failures where the base has 5.
- **F3 (P2)** — `lib/services/forecast/__tests__/fixtures/trusted-forecast-real-issues.ts`
  is collected by Jest as a test suite.
- **F4 (P2)** — `scripts/**` is excluded from both `tsconfig.json` and
  `eslint.config.mjs`, so `yarn typecheck` does not cover it. An explicit
  typecheck found **three real errors** in the new script that `yarn typecheck`
  never saw. All fixed.

None were patched in place: those are 21-04's audited artifacts and editing them
would invalidate its mutation digests.

## Gates

```
seaside  pytest tests/ -q                       878 passed, 3 skipped   (baseline 858/2)
quiver   yarn typecheck                         clean, 36.38s (tsbuildinfo deleted first)
quiver   jest smoke suite                       41 passed
quiver   jest 12 trusted/builder suites          336 passed
quiver   jest full                              7 failed / 17123 passed  <- F2, F3
verifier --live --no-write                      exit 0
```

`yarn build` and `supabase test db` were **not run**: memory pressure (50 % free,
4.5 GB of 6 GB swap in use) and the Docker prohibition. Recorded as not-run rather
than assumed green.

## Mutation audit — 18/18 RED, digests identical before and after

Harness rejects a mutation whose file digest did not change. One harness bug was
caught first: the Jest command was piped through `tail`, so all eight Quiver
mutations reported GREEN on a shell exit status that was never Jest's.
`set -o pipefail` turned all eight RED. *A harness that cannot see failure reports
perfect coverage.*

## Deviations

1. **`--build-anchor-at` is a sixth required argument.** Without it the build key
   cannot be derived from production inputs, and comparing a key derived from the
   key under test is a tautology.
2. **The smoke runner aliases `server-only` to Next's own empty module** for Node,
   exactly as `next/jest` does, so it can run while F1 is outstanding. This is a
   workaround for the runner only — the regeneration script is still broken.
3. **The cross-repo mirror test skips** when the Quiver checkout lacks the
   TypeScript files, which it does while 21-03/21-04 are uncommitted. The
   `--live --no-write` verifier treats the same condition as a hard FAIL.

## Rollout

Step 1 of 6 (schema in production) is **not done**, so steps 2-6 are blocked.
Ordered blockers: land `20260727231500`; fix both coverage slugs; claim or excuse
the 22 production triples and drop the stale one; then F1, F2/F3, F4.
