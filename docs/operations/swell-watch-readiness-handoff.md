# Swell Watch readiness implementation handoff

Status: diagnosed; implementation not launched. Operator launch and Sol final review required by workspace policy. Recommended implementation model: Terra, high reasoning. No commit, integration, deployment, production write, or automatic attestation is authorized by this handoff.

## Current evidence

Read-only replay inspection of completed batch `60b88e41-6cbf-415e-bafb-080a23eabcb5`, initialization 2026-09-09 18:00 UTC, using `read_swell_watch_attested_run` for all ten configured scopes. Existing direction/period gates are 25 degrees and 2 seconds.

Ambiguous adjacent frames (excluding unavailable tuples): Santa Cruz 2, San Francisco 3, Oahu North 3, Outer Banks 4. No ambiguous frame has a unique complete one-to-one assignment. Six other scopes have no ambiguous adjacent frames. Missing tuples: Outer Banks 24, Rincon 1.

First Santa Cruz collision, 2026-09-15 20:00 UTC (height m, period s, direction degrees): previous `[[0.83,10.79,267],[0.23,15.69,244]]`, current `[[0.55,14.08,242],[0.21,14.45,269]]`. Both current components match only the previous secondary component. Merely accepting unique complete assignments cannot solve this captured failure.

First Oahu North collision, 2026-09-10 21:00 UTC: previous `[[0.62,7.85,316],[0.22,12.15,78]]`, current `[[0.52,7.8,316],[0.28,9.7,318]]`. Both current components match only the previous primary component. First Outer Banks fully ambiguous frame at 2026-09-11 20:00 UTC: previous `[[0.44,7.7,135],[0.26,9.3,125]]`, current `[[0.44,7.75,134],[0.26,9.3,125]]`.

Current `deriveSwellWatchHorizon` rejects the entire horizon at any collision. `deriveAttestedSwellWatchRun` rejects a scope with any unavailable tuple. `ingestAttestedSwellWatchCohort` returns on the first suppressed scope before persistence; the shadow response discards its sourcePointId. Consequently the first failure hides later coverage failures. Production replay previously returned ambiguous_partition_path; zero event evaluations and zero sends. Accepted provenance is not a complete qualifying day.

## Execution plan and review constraints

1. Preserve the existing uncommitted policy fix and immutable qualification document. Implement in an exclusively owned isolated worktree based on this reviewed source; do not silently omit the policy fix when branching from HEAD.
2. Add captured-run regression fixtures with exact source IDs/timestamps and original raw-response hashes. Replay with an explicitly historical evaluation timestamp within the original freshness window; do not use historical time to bypass live production freshness checks.
3. Evaluate a minimal one-to-one trajectory assignment for two components, including births/deaths and source-slot swaps. Do not assume slot identity means physical identity. Compare valid assignments under existing physical gates; do not widen gates or invent a scoring/tie threshold merely to pass this run. Retain suppression for genuinely indistinguishable trajectories. Any new scientific decision rule must be explicit and reviewed before implementation is accepted. No generic assignment framework or new dependency.
4. Test actual collision examples, slot permutation invariance, circular directions, exact ties, unmatched births/deaths, and episode arrival/peak boundaries. An ambiguity outside the actionability window cannot simply be ignored if it affects an episode's closure or peak.
5. Preserve missing tuples as unavailable. Add bounded scope-level diagnostic coverage so all ten scopes can be reported, including failures, without persisting partial cohort events or labeling a partial cohort complete. Do not interpolate, drop a beach, alter the frozen policy, or relabel zero tuples as calm water. Review the result contract and add tests that prove no persistence on incomplete coverage.
6. Replay the entire captured cohort through derivation and shadow evaluation with write calls mocked/asserted. Record per-scope outcomes and separate accepted batches, successful evaluations, distinct genuine initializations, and complete study days. A valid zero-event evaluation is not the same as a suppressed evaluation. Locate and verify the existing study-accounting source; do not create an optimistic new counter.
7. Run targeted Jest suites for attested runs, provider ingestion, shadow evaluation, and evaluate API; then typecheck, scoped ESLint, and diff review. Sol independently reviews the actual diff and evidence. No browser/native E2E needed unless UI scope changes.
8. Return the reviewed result for operator approval before integration or deployment. After approval, verify a fresh live no-send evaluation, verify no announcements/bindings, and update the daily-launch-health source with actual remaining study requirements. A historical replay does not prove live readiness.

## Inspection verification

Study-accounting follow-up: targeted search of `lib/alerts/swell-watch`, Swell Watch migrations, and Swell Watch scripts found no implementation referring to qualifying days or study-day accounting. The launch-review document specifies 30 qualifying observed days and a 45-day administrative policy lifetime, but those are not a verified executable qualification rule. Before reporting a positive day count, identify an authoritative definition and evidence query (including coverage, genuine initialization deduplication, day timezone, and required observation cadence). Do not infer that one successful evaluation qualifies a day. The absence of these search terms is not proof that no accounting exists elsewhere; the implementation investigation must resolve this gap.

Read-only Node analysis called `supabase db query --linked` with the attested-run RPC and counted adjacent match matrices for all ten scopes: passed. Initial aggregate read hit Node's default output buffer (ENOBUFS); bounded retry with 20 MiB maxBuffer passed. No production writes or code edits in this investigation. No tests run in this investigation; earlier policy-fix results remain separate evidence, not validation of this planned change.
