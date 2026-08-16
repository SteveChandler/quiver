# 21-04 — Forecast Builder Integration and Privacy: SUMMARY

**Status:** implemented, gates green, 22/22 mutations RED. **Not committed, not merged, not deployed.**
**Worktree:** `quiver/.worktrees/p21-04-builder` on branch `feat/trusted-forecast-builder`.

---

## Branch base — a deviation, stated plainly

Branched off **`feat/trusted-forecast-decision-engine`** (`986f90bb3`), which the dispatch named as
`origin/main` + the 21-02 commit + the 21-03 commits. That is only two-thirds true:
`feat/trusted-forecast-decision-engine` is **exactly `origin/main` + the single 21-02 commit**, and
**21-03's work is uncommitted** — `trusted-forecast-policy.ts`, `trusted-forecast-adjustment.ts`,
their two test files and the fixture directory are all untracked in `quiver/.worktrees/p21-03-engine`.

So the new worktree was created from that branch and 21-03's six untracked paths were **copied in
verbatim** (byte-identical; 21-03's own 99 tests pass unchanged in this worktree). Nothing was
committed anywhere and the p21-03-engine worktree was not modified. Whoever lands this must land
21-03's files with it.

`node_modules` is symlinked to the parent checkout (`../../node_modules`), as 21-03 did; `package.json`
is byte-identical to the parent's. `.env` / `.env.local` were copied in — Jest cannot even load
`jest.config.js` without them.

---

## Files

| File | What it is |
|---|---|
| `lib/services/forecast/trusted-forecast-coverage.ts` | **NEW.** Approved coverage (slug-keyed), the 17-source inventory mirror, the live-vocabulary excusal list, and the timezone / `beach_id` guards |
| `lib/services/forecast/trusted-forecast-repository.ts` | **NEW.** `server-only` reads: eligible issues, exact durable decisions, durable applications, beach-slug resolution |
| `lib/services/forecast/trusted-forecast-persistence.ts` | **NEW.** `server-only` RPC client and the eight-state transport/receipt matrix |
| `lib/services/forecast/forecast-builder.ts` | Post-loop trusted pass: coverage → reads → engine → one RPC → receipt-gated public mutation |
| `lib/services/forecast/log-display-prediction.ts` | Doc-only: the D-18 no-UPDATE / no-trusted-field invariant recorded beside the existing three |
| `lib/services/forecast/trusted-forecast-adjustment.ts` | **21-03's file, modified**: day-part application restriction (see deferred item 2) |
| `lib/services/forecast/__tests__/trusted-forecast-coverage.test.ts` | **NEW.** 20 tests — the coverage ratchet against all 196 real rows |
| `lib/services/forecast/__tests__/trusted-forecast-persistence.test.ts` | **NEW.** 37 tests — transport matrix + repository read matrix |
| `lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts` | +15 tests — builder order, horizons, feedback suppression, reuse, races, flag, privacy |
| `lib/services/forecast/__tests__/log-display-prediction.test.ts` | +3 tests — first-write immutability against the trusted layer |
| `lib/services/forecast/__tests__/trusted-forecast-adjustment.test.ts` | +4 tests — the day-part application restriction |
| `CHANGELOG.md` | One `[Unreleased] / Added` bullet, no rollout claim |

**Blast radius, fixed in the same change** (the trusted pass now runs by default, so every suite that
drives `ForecastBuilder` had to answer the coverage read): `forecast-builder.decay-off.test.ts`,
`__tests__/lib/services/forecast/forecast-builder.test.ts`, `…-nowcast-anchor.test.ts`,
`…-cdip-semantics.test.ts` — supabase stubs extended and the one expected
`trusted_forecast_coverage_unavailable` console.error declared with `expectConsoleErrors`, not silenced.

**Deviations from the plan's `files_modified`:** `trusted-forecast-coverage.ts` +
`trusted-forecast-coverage.test.ts` are new (coverage authorship was deferred to this plan but given no
home), and `trusted-forecast-adjustment.ts` + its test were touched because the day-part fix the 21-03
critic demanded has no other correct home. `syncTrustedForecastApplications` **does not exist on this
base** — the plan's "remove it" step describes a draft that lives only on
`wip/session-prompt-optout-20260803`. The intent was implemented as a ratchet instead.

---

## How each `must_haves.truth` is proven

| Truth | Named test | Mutation |
|---|---|---|
| The builder compares trusted local-day ranges only after base face transform, handoff blend and beach offset (D-14) | `D-14: compares the POST-offset baseline, after transform, blend and beach offset` — asserts the payload's `baselineMaxFaceFt` is 5 ft on a day with no 24 h+ slot and the *offset* value on a day that clears the gate | M16 RED |
| Trusted decisions use only raw 0–168 h snapshot-eligible slots and suppress session-feedback adjustment on claimed slots (D-16, D-17) | `D-16: the slot at exactly 168 h is claimed and 171 h is not`; `D-17: a claimed slot drops session feedback; an unclaimed slot keeps it` | M19 RED |
| One RPC persists decisions, applications, alerts, missing first-write snapshots and a matching receipt before adjusted output can escape (D-18, D-19, D-20) | `serves the trusted delta only on a matching receipt, from real chart ranges`; `state 1: a matching returned receipt authorizes adjusted output`; `snapshot payloads carry the RPC's column names, not the buffer's` | M15, M22 RED |
| Definite rejection may serve baseline; transport ambiguity requires a matching durable receipt or throws a retriable generation error (D-21) | `state 3` (5 SQLSTATEs, table-driven); `D-19..D-21: a definite rejection serves byte-identical baseline`; `state 5`–`state 8`; `D-21: unresolved ambiguity throws retriably instead of serving anything` | M3, M4, M5, M6 RED |
| Eligible issue and durable daily-decision reads are server-only; repeated builds reuse the original decision, and a decision uniqueness race can never degrade to baseline | `D-13/D-18: a durable decision is reused exactly, even with newer guidance`; `a uniqueness race reconciles to attributed output, never to baseline`; `a uniqueness race that cannot be reconciled throws rather than serving baseline`; `a query failure is a typed retriable error, never an empty evidence result` | M8, M9, M17, M18 RED |
| Private forecaster and internal audit fields never enter public forecast DTOs, UI payloads, analytics or public logs (D-23) | `D-23: no private forecaster or audit value reaches the public forecast payload` — 26 sentinels incl. all 32 real `issue_id`s, plus a **non-vacuity check** that the private payload really carries them; `read errors carry codes only, never source ranges, hosts or hashes`; the plan's `rg` source scan (clean) | — |
| Serving defaults enabled while explicit false remains independent of ingestion (D-24) | `D-24: serving defaults on; only an explicit false disables it` — asserts the read store is **never touched** when disabled, so the builder's own gate is load-bearing rather than shadowed by the engine's | M20 RED |

---

## The six items deferred to this plan

### 1. Coverage authorship — proven against the live vocabulary, deliberately small

`trusted-forecast-coverage.ts` holds **two enabled entries** (`trestles`, `malibu`), both keyed by
beach **slug** and resolved to `beach_id` at run time. Every accepted `region_key`/`exposure` pair is
backed by rows in the 196-row real corpus; nothing was inferred from a page that was never captured.

The ratchet is what makes this non-inert **and** honest: `trusted-forecast-coverage.test.ts` walks
every distinct `(scope_type, region_key, exposure)` in all 196 real rows and requires each to be
either accepted by an entry or listed in `TRUSTED_FORECAST_UNCOVERED_VOCABULARY` **with a >40-character
reason**. Set equality holds in both directions, so a combination cannot go silently unclaimed and an
excusal cannot go stale. Two further tests assert no entry is inert (each resolves ≥1 real *authority*
row) and that **no entry's `compatibleExposures` excludes all of its own scope-matched rows**. One test
runs the real trestles chart end-to-end through `selectTrustedForecastAuthority` and asserts a
`spot_wavecast` primary with a measured range actually comes out.

The named vocabularies are all present and classified: socal chart slugs as `region_key`
(`trestles`, `malibu`, `huntington-beach`, …), `kauai/NORTH`-style exposures (all 17 island/shore
values), and `primary` / `dominant` / `NNW` / `SSW`.

**⚠️ The honest limit.** Only `trestles`, `huntington-beach` and `beacons` are slugs I could verify
against a source of truth in this repo (`config/regions.ts`); `malibu` is corpus-backed but its Quiver
slug is unverified. Hawaii, New York and NorCal are **excused, not covered**, because no database read
was available from this worktree (Docker is forbidden this session) and inventing beach slugs is the
exact failure this phase has punished four times. Expanding coverage is now a data edit with a ratchet
behind it. Slug resolution fails **loudly**: an unresolvable slug raises
`TrustedForecastCoverageError`, which the builder reports once as
`trusted_forecast_coverage_unavailable` at error level and then serves baseline — it can never be
mistaken for "no evidence" (M14 RED).

### 2. Day-part application asymmetry — applications restricted, exemption kept

Implemented the first of the critic's two options. `slotIsInPrimaryDayPart` places each slot in the NWS
public-forecast convention 21-01 stamps on `valid_start_at`/`valid_end_at` (day = 06:00–18:00 local),
and a primary may only claim slots inside its own `day_part`.

**Why this one.** Dropping the conflict exemption would make NWS's "Today 2-4 ft" and "Tonight 8-12 ft"
read as a 6-foot disagreement between providers, which is wrong on the domain. And the critic's own
ruling was *"accept the rule, REJECT its current pairing"* — the daily-maximum rule was accepted; only
its pairing with unrestricted application was rejected. So the comparison basis is deliberately
unchanged (both sides still take the maximum across the whole local day) and a test pins that:
`the daily maximum is still taken across the whole local day` puts the day's biggest baseline on a
*night* slot and asserts it still drives the decision while only 4 day slots are claimed.

Proven with the real HFO rows: `a day-only NWS primary claims only the local day slots, never the
night ones` (claims exactly 06/09/12/15 HST), `a night-only primary claims only the night slots`
(00/03/18/21), and `an all_day primary still claims every eligible slot`. M1 and M2 RED.

**21-03's 99 tests were green both before and after this change**, which means the branch it fixes was
genuinely uncovered — the fifth time in this phase that a live corpus agreed everywhere and hid a real
branch.

### 3. Unknown `source_key` fails loudly

`loadEligibleTrustedForecastIssues` rejects any row whose `source_key` is not in the pinned 17-key
inventory with `TrustedForecastRepositoryError("unknown_source_key")`, naming the hazard: it would
otherwise inherit `STRICTEST_FRESHNESS_MAX_AGE_HOURS = 24` and vanish as stale with no log.
`TRUSTED_FORECAST_SOURCE_KEYS` is pinned literally in a test against the `sources.py` order. M7 RED.

**Not done:** an automated cross-repo assertion that the TypeScript freshness table and
`seaside/trusted_forecasts/sources.py` still agree. The Seaside path is outside this repo and not
CI-portable (21-03 has the same limitation with its fixture generator). **This stays 21-05's job** —
the critic's own alternative. What is closed is the silent-drift half: a *new* key now fails loudly
instead of vanishing.

### 4. `issue.validTimezone` vs `coverage.localTimezone`

Closed twice. Statically: `assertCoverageTimezonesAgree` refuses a coverage entry whose
`localTimezone` disagrees with the declared zone of any source that can emit its region keys, and it
runs inside `resolveTrustedForecastCoveragePolicy` (M12 RED). At run time:
`partitionIssuesByCoverageTimezone` drops any row stamped in another zone and the builder logs the
count (M11 RED). So the string-equality date match is same-zone by construction.

A paired test asserts **the live corpus cannot reach the mismatch branch** — every source emits exactly
its configured zone — so the one derived fixture that exercises it is registered with a note rather
than quietly redundant.

### 5. `beach_id` in the collapse key — guarded, not documented away

`assertIssueBeachIdsUnresolved` runs at the repository read boundary and **throws** if Seaside ever
starts resolving `beach_id`, naming the consequence (an older `null` row and a newer resolved row of
the same call stop collapsing and 21-03's supersession P0 silently returns) and naming the operator's
immediate remedy (`TRUSTED_FORECAST_ADJUSTMENTS_ENABLED=false`). A test asserts all 196 real rows still
carry `beach_id: null`, so the guard cannot fire spuriously today. M10 RED.

This is deliberately a hard failure rather than a warning: the failure mode it prevents is a *wrong
served height* attributed to a stale issuance, which is exactly what D-19..D-21 exist to prevent.

### 6. `superseded` vs `stale` — explicitly recorded as NON-DURABLE

Chose the third option the dispatch offered. `TrustedForecastEngineResult` still carries no exclusion
data and 21-02's schema still has no exclusions table or reason column, and **nothing here adds either**.
Rationale: 21-02 is committed on a shared branch and its pgTAP evidence covers the current shape;
widening it from this plan would push an unproven column into a migration that is already blocked on
operator work.

**Recorded consequence:** the distinction is computed by `selectTrustedForecastAuthority().excluded[]`
and then discarded. Nothing downstream can ever answer "was this row dropped because it was superseded,
or because it went stale?" from durable state. If that question matters operationally, it needs an
additive 21-02 change (an `exclusion_reason` column or an exclusions table) and it should be made
before 21-02 pushes, not after.

---

## Fixture provenance, per fixture

| Fixture | Provenance |
|---|---|
| All issue rows in `trusted-forecast-coverage.test.ts`, `trusted-forecast-persistence.test.ts`, the builder tests and the new day-part tests | **Real** — verbatim rows from `trusted-forecast-issues.real.json` (21-01's shipped parsers via 21-03's fixture, independently verified byte-identical by 21-03's critic), with only the database-assigned `issue_id` added by the shared loader |
| `coverage_timezone_mismatch` | **Derived**, registered with a note: no live source emits a row stamped outside its configured zone, and a paired test asserts the corpus cannot reach that branch |
| `coverage_seaside_resolved_beach_id` | **Derived**, registered with a note: Seaside never resolves `beach_id`, and a paired test asserts all 196 rows still carry `null` |
| Coverage definitions | **Not source data** — operator configuration |
| The `"5 ft"` builder baseline, offset rows, feedback candidates | **Not source data** — Quiver's own display output and its own configuration |
| Receipt rows, SQLSTATE codes, RPC error shapes | **Synthetic by necessity** — no live database ran in this worktree. Each is built from migration `20260727231500`'s own receipt column list and its own `USING ERRCODE` values |

---

## Gate output (verbatim)

```
$ rm -f tsconfig.tsbuildinfo && yarn typecheck
$ tsc -p tsconfig.json --noEmit
Done in 35.42s.

$ npx eslint --max-warnings=0 <16 source and test files>
ESLINT_EXIT=0

$ yarn test:unit --runInBand --runTestsByPath <12 suites>
Test Suites: 12 passed, 12 total
Tests:       343 passed, 343 total

$ rg -n "provider_lineage|source_hash|parser_version|evidence_ids|trusted_forecast_(issue|decision|application|receipt)_id" \
    app components hooks lib --glob '!**/*.test.*' --glob '!**/__tests__/**' <plus the six approved files>
SCAN_CLEAN
```

`tsconfig.tsbuildinfo` was deleted first: `incremental: true` had made an earlier run finish in 4 s,
which is not a real gate.

---

## Mutation audit — 22/22 RED

Harness edits **source only**, refuses a mutation whose file digest did not change (the `void 0;`
lesson, mechanised), runs six suites, restores, and re-verifies the digest. Combined per-file SHA-256
before the first mutation and after the last: **identical** (`trusted-forecast-persistence.ts`
`203a5026bd8f`, `trusted-forecast-repository.ts` `68c6b4e66d33`, `trusted-forecast-coverage.ts`
`0dce18ad523a`, `trusted-forecast-adjustment.ts` `5eb65299f4f0`, `forecast-builder.ts` `77edd2990ba2`,
`log-display-prediction.ts` `7a945ff516e6`).

| # | Broken rule | Result |
|---|---|---|
| M1 | day-part application restriction removed | RED 3 |
| M2 | day/night boundary 06:00 → 07:00 | RED 3 |
| M3 | uniqueness `23505` treated as a definite baseline-safe rejection | RED 9 |
| M4 | reconciliation skips the database hash replay | RED 3 |
| M5 | receipt match ignores every expected count | RED 1 |
| M6 | unclassifiable RPC error treated as definite rejection | RED 2 |
| M7 | unknown `source_key` silently accepted | RED 1 |
| M8 | a failed issue read degrades to an empty evidence result | RED 1 |
| M9 | out-of-scope durable decision accepted as this beach's day | RED 1 |
| M10 | Seaside-resolved `beach_id` guard disabled | RED 2 |
| M11 | timezone partition accepts every zone | RED 1 |
| M12 | coverage timezone agreement check disabled | RED 1 |
| M13 | a covered entry silently also claims an excused exposure | RED 1 |
| M14 | unresolvable coverage slug silently dropped instead of raised | RED 1 |
| M15 | public heights mutated before the receipt is in hand | RED 1 |
| M16 | D-14 order broken: trusted compares the PRE-offset baseline | RED 1 |
| M17 | durable applications ignored on a reused decision | RED 1 |
| M18 | existing durable decisions never loaded into the engine | RED 1 |
| M19 | D-17 broken: the trusted delta stacks on the feedback value | RED 1 |
| M20 | D-24 kill switch ignored by the builder | RED 1 |
| M21 | snapshot writer reintroduces a trusted sidecar UPDATE | RED 18 |
| M22 | snapshot payload keeps the buffer's column name | RED 1 |

### ⚠️ Two escaped the first audit — the fourth consecutive round

- **M3** (add `23505` to `DEFINITE_REJECTION_CODES`) went GREEN because the uniqueness branch is
  checked *before* the definite-rejection set, so the mutation was unreachable. Replaced with the real
  one — make the uniqueness branch itself return `definite_rejection` — which went **RED on 9 tests**.
- **M20** (delete the builder's `isTrustedForecastAdjustmentEnabled()` gate) went GREEN because
  `buildTrustedForecastDecisions` also checks the flag, so the builder's own gate was shadowed and not
  independently load-bearing. Closed by asserting the read store is **never called** when the flag is
  explicitly false — an explicit `false` must stop the builder before any private read, not merely
  leave the pure engine with nothing to return. M20 then went RED.

---

## Design calls a reviewer should rule on

1. **Coverage resolution fails SOFT; evidence reads fail HARD.** A `TrustedForecastCoverageError` or a
   `TrustedForecastRepositoryError` raised while resolving *beach slugs* is reported once at error
   level and the run serves baseline. Every other repository failure (issues, decisions, applications)
   throws retriably as the plan requires. The line drawn is "configuration lookup" vs "private trusted
   evidence" — failing to resolve configuration means trusted serving is not available here, which is a
   different thing from private rows being unreadable. A reviewer may reasonably want both to be
   retriable; that would take forecast generation down on every environment without the schema.
2. **Missing service-role config skips the trusted layer with a one-time warn**, mirroring
   `logDisplayPredictions`. Without it, `createServiceRoleClient()` throws outright and an unconfigured
   preview environment loses forecast generation entirely.
3. **Reconciliation replays the RPC once** so the database compares its own canonical hash. This
   process cannot recompute `payload_sha256` — that is the point of the schema — so a caller-side
   "matching hash" check is otherwise impossible. The replay is bounded to one attempt and any
   ambiguity in it is retriable.
4. **The build key is per-run** (`tf:<policy>:<beachId>:<anchorIso>`), so `trusted_forecast_alerts`'
   `UNIQUE (build_key, beach, local_date, alert_code)` re-alerts a persistent conflict on every run.
   That follows from 21-02/21-03's shapes; it is a volume call, not a defect.
5. **A reused `applied` decision needs one extra read.** `applied_delta_ft` says how much, not which
   slots, and the original primary may have claimed only one day part — so the durable
   `trusted_forecast_applications` rows are read and replayed verbatim rather than recomputed.

## Carried into 21-05

- Expand coverage beyond `trestles`/`malibu` once beach slugs can be verified against the `beaches`
  table. The excusal list names every combination that is waiting and why.
- Assert the TypeScript freshness table and `seaside/trusted_forecasts/sources.py` agree, key for key
  and value for value. The unknown-key half is closed here; the drift half is not.
- The RPC is not deployed: `PGRST202` is classified as a definite rejection, so until migration
  `20260727231500` is pushed the feature degrades to byte-identical baseline with a counted warn on
  every build. Verify that is what production actually does before enabling anything.
- Exclusion reasons (`superseded` vs `stale`) are non-durable by decision. If 21-05 needs them, the
  additive schema change belongs in 21-02 **before** it pushes.
