# Email lifecycle: remaining gate cleanup

September 12, 2026. Steven approved continuing until the full build and repository-wide dead-code checks were resolved. All work remains in `orch/email-lifecycle-startup-20260911`. No production data, provider configuration, live schedule, send, deployment or Git commit was changed.

## Root causes and changes

The full build tried to pre-render every regional forecast with live Supabase data. The isolated environment deliberately had no live database credentials. Regional pages now generate on demand (`generateStaticParams` returns an empty list, `dynamicParams` remains true), preserving the 900-second revalidation and shared data cache. Runtime data failures still throw; there is no synthetic forecast or success-shaped fallback. The existing regional-page test now verifies no data read during static parameter generation and continues to assert real failure propagation. First uncached regional requests now perform the data read; this is the operational tradeoff.

Knip's source graph omitted `store`, `state` and `config`, disabled ESLint discovery, and missed several indirect test imports. The configuration now covers those directories and the ESLint entry points. Actual consumers remain exported. Test imports now expose their dependencies to TypeScript and Knip, including a legacy Vitest-shim test converted to native Jest so static imports respect mock hoisting.

Removed twelve confirmed unused modules across old map prototypes, personalization messaging, forecast cards/skeletons, a tide fallback and an unused rating input. The check-in form remains because its tests exercise it. Unused named/barrel exports and type exports were removed or made private across the repository; function bodies and interfaces remain unchanged except where an entire unused module was removed. No public HTTP/native contract changed.

The dependency manifest now declares the already-used Svix, PostgREST and ESLint globals packages. Removed unused direct dependencies include the old SWC platform pin (Next supplies its matching version), redundant Proj4 types, copy-webpack-plugin, baseline-browser-mapping, jsx-a11y and jsqr. Zustand remains: onboarding uses it. Yarn's lockfile was reconciled in an independent worktree-local node_modules directory; the primary checkout's shared installation was not modified.

Three CommonJS hoist pins (`ansi-regex`, `string-width`, `strip-ansi`) remain explicit scanner exceptions. Removing them caused Jest's reporter to fail before executing any tests (`stripAnsi is not a function`). This was reproduced after a clean local install and corrected by retaining the known pins. `server-only` is a Next-provided marker, not an undeclared external runtime service. Supabase CLI, psql, sleep, pkill and Codex are explicitly system-installed commands. There is no ignored unused-export category, issue baseline or pass-on-error wrapper.

## Review evidence

An AST comparison against the pre-cleanup source ignores only export declarations/modifiers, empty declarations and comments. The exact count and exceptions are recorded in `startup-verification-resumed/cleanup-ast-review.json` in the audit artifact directory. Exceptions were manually checked: the cream/paper alias retains the identical color; Coast Pulse uses an explicit type import; query builder exports were restored for real tests. Deleted modules were searched for consumers before removal. Types and tests were rerun to catch scanner blind spots.

The worktree contains a broad mechanical export cleanup in addition to the email implementation. Review/integrate this expanded diff deliberately. Original sources and the complete changed-file inventory are retained in the local audit artifacts; no bulk staging or commit was performed.

## Verification

**Final status: PASS. Both originally unresolved gates and the supporting checks passed.** Checks use the saved `local-check-env.sh` wrapper from the original audit's `startup-verification` directory, which supplies dummy loopback Supabase values. No production credentials are needed.

- Full build: `VERCEL_ENV=preview yarn build`.
- Repository-wide dead code: `yarn deadcode`, unfiltered.
- Full unit suite: `yarn test:unit --runInBand --bail=0`.
- Focused corrections: `yarn test:unit --runInBand __tests__/lib/supabase/query-builders.test.ts __tests__/components/ui/check-in-form.test.tsx __tests__/components/map/interactive-map.test.tsx __tests__/app/regional-forecast-score-gate.test.tsx` — 4 suites / 92 tests passed, rerun after the final test-fixture correction.
- Typecheck: `yarn typecheck`; the full build also runs TypeScript.
- Full lint: `NODE_OPTIONS=--max-old-space-size=8192 yarn lint`.
- Existing local email HTTP E2E: `yarn test:e2e --config=playwright.email-lifecycle.config.ts --workers=1 --retries=0`.
- Dependency validation: `yarn install --ignore-scripts`, then `yarn patch-package` to apply the existing auth patch without executing the Git-hooks postinstall. A frozen-lockfile verification follows.
- `git diff --check`.

Initial failures were resolved rather than hidden: absent offline package-cache entries; the Jest CommonJS-hoisting failure; two inline type consumers missed by Knip; query-builder and map helpers hidden behind indirect imports; mock ordering in the old check-in test; and the missing Zustand source directory. A lint scan was restarted after a deleted source file invalidated the in-progress scan. All initial logs remain local evidence; only final passing runs count toward completion.

## Remaining activation boundary

These gate fixes complete engineering validation; they do not make the email program live. Reply-to ingestion, approved real-inbox/client and authenticated CTA checks, production schema review/migration, sender/cohort approval, schedule/monitor provisioning and explicit activation remain governed by the original handoff. Both incentive offers remain unadvertised until their fulfillment mechanism and terms are verified. No review date authorizes an automatic send.

## Final results

| Gate | Result |
|---|---|
| Full `VERCEL_ENV=preview yarn build` | PASS, 84.28s, including TypeScript and static generation |
| Unfiltered `yarn deadcode` | PASS, 9.32s, no findings or configuration hints |
| Full unit suite | PASS, 1,423 suites / 18,209 tests; existing 16 skipped suites, 195 skipped tests and one todo unchanged; four snapshots pass |
| Full `yarn lint` | PASS, zero warnings, 62.39s |
| Standalone `yarn typecheck` | PASS, 5.71s after the final fixture correction |
| Scoped HTTP E2E | PASS, three tests; no production/provider calls |
| Frozen dependency lock | PASS; no lock update required |
| Synthetic email preview | PASS; all six HTML messages byte-identical to the approved-review artifacts. The independently edited gallery index was excluded from message comparison. |
| `git diff --check` | PASS |

Review evidence: 517 of 519 compared source files have identical normalized ASTs after excluding export visibility, export declarations and comments. The two exceptions were manually verified as the equivalent paper-color alias and an explicit Coast Pulse type import. Twelve removed modules had no consumers in the corrected source graph. Existing test assertions remain; no failing test was skipped or weakened to get a green result.

Files changed, complete diff statistics and exact command logs are in `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/email-audit-2026-09-11/startup-verification-resumed/`. New E2E tests were not necessary for the mechanical cleanup; the existing lifecycle HTTP spec was reviewed and rerun. The regional forecast test was updated, and three existing unit-test import/mock arrangements were corrected. No production deployment or production-data changes occurred.

The engineering goal is complete. Operational email activation remains off and requires the original handoff's separate approval and evidence. No additional repository build/dead-code blocker remains.

The final standalone typecheck exposed an obsolete map-test fixture that an earlier dynamic cast had hidden. It now uses real `SwellPartition` fields and asserts that a valid frame is returned as well as rejecting missing/malformed frames. Standalone typecheck and all four focused suites passed afterward; the full 18,209-test run precedes this isolated fixture-only correction. Production source, build, lint and E2E evidence are unchanged.
