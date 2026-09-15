# Vercel budget production release follow-up

## Production-only forecast hotfix preservation

PR #788 merged to `prod` as `596dace1462f43813328de71305b4fed328ab2e9` after Prod Gate passed typecheck, lint, unit tests, build, and all 20 browser smoke tests; the separate email/offer contracts also passed. PR #787 was closed as superseded after verifying its main head was an ancestor of production. The camera/SEO backport to main has the same tree as that release.

Final deployment inspection found the live production alias was serving CLI deployment `dpl_MC5vStau7PV9vbZ6yqHwt9L357NJ` from a dirty worktree based on `86bffa8f0`, with `forecastFix=cd03f4202`. Those deployed forecast fixes were absent from both Git branches. The replacement deployment `dpl_3DnUnucd6znUZPAx55wQJgpG7yHv` was canceled before promotion; `www.quiversurf.app` was verified still on the existing healthy deployment.

The follow-up preserves that deployed hotfix in Git: current-window countdown bounds, shared condition scoring, scored-forecast range/board context, surf-call source-row identity, and the existing blue Maybe map marker. All 17 restored source/test files exactly match `/private/tmp/quiver-window-production-20260914`; the original worktree was only read. No additional forecast behavior was introduced. The database retry migration remains applied and verified while the final application release is checked.

Preservation validation: typecheck and scoped ESLint passed. The full run passed 18,560 tests and exposed one stale session-decision test mock missing the real `resolveNativeSkillLevel` helper. Preserving the module’s actual exports fixed that test; its two-test suite and lint passed. Production code still exactly matches the deployed hotfix. The final production CI gate reruns the complete suite. The live sync ledger records attempts at 14:10:21 and 14:26:21 UTC, verifying bounded retry recovery after a 16-minute gap rather than the previous one-minute loop; 51 unresolved message holds remain.

Baseline migration and backup evidence: [Vercel budget review](vercel-budget-20260915.md).
