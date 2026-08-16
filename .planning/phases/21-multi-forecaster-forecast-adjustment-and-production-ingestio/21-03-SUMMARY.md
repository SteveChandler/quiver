# 21-03 — Coverage-Aware Decision Engine: SUMMARY

**Status:** implemented, gates green, 29/29 mutations RED (round-4 critic P0 fixed). **Not committed, not merged, not deployed.**
**Worktree:** `quiver/.worktrees/p21-03-engine` on branch `feat/trusted-forecast-decision-engine`.

---

## Branch base — a deviation, stated plainly

The dispatch said "off `origin/main`". `origin/main` (`4dbe62894`) carries **neither** the 21-02
migration **nor** any `trusted-forecast-*.ts` (the "existing draft" the plan's `read_first` names lives
only on `wip/session-prompt-optout-20260803`). Task 2 requires asserting a real row against the
migration's `trusted_forecast_issues` definition, which is impossible without that file.

`feat/trusted-forecast-schema` is **exactly `origin/main` plus the single 21-02 commit `986f90bb3`**,
with zero divergence (`git merge-base` == `origin/main` tip; `feat/…^..origin/main` is empty). The
worktree was branched from it, which is `origin/main` + the dependency this plan declares
(`depends_on: 21-02`). Nothing was merged.

---

## Files

| File | Lines | What it is |
|---|---:|---|
| `lib/services/forecast/trusted-forecast-policy.ts` | 890 | Versioned coverage/lineage/evidence/precedence/exposure/freshness policy + the strict `TrustedForecastIssue` input parser |
| `lib/services/forecast/trusted-forecast-adjustment.ts` | 471 | Pure local-day decision engine (authority → conflict → band → applications/alerts) |
| `lib/services/forecast/__tests__/trusted-forecast-adjustment.test.ts` | 1846 | D-05…D-16 boundary matrix |
| `lib/services/forecast/__tests__/trusted-forecast-contract.test.ts` | 358 | Seaside → SQL → TypeScript contract on one concrete row |
| `lib/services/forecast/__tests__/fixtures/trusted-forecast-issues.real.json` | — | **196 real serialized issues** from 21-01's shipped parsers |
| `lib/services/forecast/__tests__/fixtures/trusted-forecast-real-issues.ts` | 152 | Fixture loader + the real/derived provenance rule |
| `lib/services/forecast/__tests__/fixtures/generate-trusted-forecast-issue-fixture.py` | 125 | Regenerator for the JSON fixture |

The last three are beyond the plan's four-file list. They exist because the plan's `key_links` point
Task 2 at `seaside/tests/fixtures/trusted_forecasts/corpus.json`, which holds **raw source documents,
not normalized issues** — a Jest test cannot run the Python parsers, so the bridge is generated and
committed with its generator.

---

## Fixture provenance — per fixture

**Real (verbatim 21-01 output), 196 rows from 11 corpus documents.** Produced by running the shipped
`trusted_forecasts.parsers.dispatch` / `parse_wavecast_spot_chart` plus
`crons.fetch_trusted_forecasts._serialize_issue` over the bounded corpus. Not one byte hand-authored.
The fixture header records the Seaside HEAD, corpus version and producing functions.

| Document | Rows | What it uniquely supplies |
|---|---:|---|
| `wavecast_regional_live_hawaii` | 32 | **NNW 0-1 vs SSW 1-2 on one date** — D-12 non-union, real |
| `wavecast_regional_live_new_york` | 15 | regional WaveCast authority (1-2 ft on 2026-08-06) |
| `stormsurf_ny_shortcast_live` | 5 | second **independent lineage on the same beach/day** (0-1 ft) |
| `wavecast_spot_chart_live_trestles` / `_malibu` | 64 | `scope_type='spot'` with **chart slugs as `region_key`** |
| `wavecast_socal_index_live` | 8 | `validity_basis='derived_publication_day'`, evidence-only, no height |
| `nws_hawaii_srf_live_morning_issuance` / `_evening_issuance` | 68 | `day_part` day/night, `kauai/NORTH`-style exposures |
| `surf_institute_pnw_live` | 2 | `measurement_basis='unspecified'` — the metres-Hs refusal, D-08 |
| `wavecast_regional_dst_spring_23h` / `_fall_25h` | 2 | **real 23-hour and 25-hour local days** |

**Derived (real row + named overrides + mandatory note), 21 fixtures.** Each is registered and a
ratchet test asserts every one names its source row, its overridden fields and a >40-character reason,
and pins the count at 21 so this number cannot drift from the registry. (The registry records 24
*registrations*: `stormsurf_payload_conflict` is built by a helper that four payload tests run.)

They exist for five things the live corpus cannot reach. **All five are now held by a corpus assertion**
— if a corpus refresh makes one reachable, the paired test goes red instead of the derivation quietly
becoming redundant:

1. **The four disabled sources emit nothing.** `stormsurf_pnw_buoy` (D-07 model/buoy), the two NJ
   mirrors (D-05 shared `surfers_view` lineage), a second Stormsurf endpoint (D-06).
   *Held by* `the four disabled sources emit nothing, so their shapes must be derived` — pins the seven
   `source_key`s the corpus actually emits and asserts the four disabled keys are absent.
2. **No live independent pair separates by more than a foot.** WaveCast NY (1-2) and Stormsurf NY
   (0-1) *touch*, so their real nearest-edge separation is **0** — neither side of the 1.00 ft bound is
   reachable. *Held by* `the real corpus alone cannot reach the two branches the derivations exist for`.
3. **No live authority row carries `validity_basis='derived_publication_day'`** — the same test counts
   them and asserts **0**. The three derived-basis producers are all evidence-only.
4. **Tier precedence and the daily maximum never disagree in the configured pairing.** *Held by*
   `the spot chart out-maxes the regional page on every shared date, hiding D-09 tier 1`, which
   compares the real Trestles spot chart against the real WaveCast Hawaii page at **NNW only** — the
   one exposure `SPOT_OVER_REGIONAL` accepts — across all 15 shared dates. Deliberately claimed no
   wider than that: at **SSW** the corpus does contain regional rows that out-max the spot chart, and
   that exposure is incompatible with this entry. This is the round-3 lesson (*live data agreeing
   everywhere can hide a real branch*) applied forward.
5. **Both real NWS issuances of one local day state the same range.** The morning and evening
   issuances of `2026-08-07 / oahu/NORTH / day` both say 0-2 ft, so no live row shows a source
   revising itself. One derived fixture moves the *earlier* row to 8-12 ft, which is the only way the
   supersession branch is observable. *Held by* `a source's newer issuance supersedes its own earlier
   call, including downward`, which asserts the older row is excluded `superseded` while still fresh.

Coverage entries and forecast slots are **not** source data — coverage is operator configuration and
slots are Quiver's own post-offset baseline.

---

## How each plan truth is proven

| `must_haves.truth` | Named test | Real / derived |
|---|---|---|
| Authority selection dedupes provider lineage and excludes model/buoy/evidence-only rows before voting (D-05…D-08) | `D-08: an unconvertible height scale stays evidence-only and cannot be authority` · `D-07: a model/buoy row never becomes a human face-height authority` · `D-06: multiple Stormsurf endpoints produce exactly one Stormsurf vote` · `D-05: NJ Beach Cams and The Surfers View are one lineage, never two votes` · `same-lineage disagreement can neither corroborate nor block` | D-08 real; D-05/06/07 derived (sources disabled) |
| Fresh compatible spot WaveCast wins, then regional WaveCast, then configured validated regional authority; one valid authority activates without universal consensus (D-09, D-10) | `D-09 tier 1: compatible spot WaveCast beats regional WaveCast even when regional reads bigger` · `D-09 tier 2: regional WaveCast beats the configured regional authority` · `D-09 tier 3: the configured regional authority takes over once WaveCast goes stale` · `D-10: one valid authority activates with no corroboration at all` · `configured regional-authority priority order decides between two non-WaveCast lineages` · `a stated validity basis outranks a newer derived publication-day window` · `a source's newer issuance supersedes its own earlier call, including downward` · `selection is stable when every ranked dimension ties` · `two stored revisions of ONE issuance resolve by revision hash, not by size` | tiers 2/3 + D-10 fully real; tier 1 needs one derived range; supersession is a real NWS issuance pair with one derived range |
| Independent separation above 1.00 ft blocks and creates an alert; at or below 1.00 ft the primary range remains unchanged (D-11) | `separation of exactly 1.00 ft does not block` · `separation of 1.0001 ft blocks and raises exactly one alert` · `real overlapping authorities separate by zero and the primary range is untouched` · `the worst conflicting corroborator is the one recorded` · `nearest-edge separation is edge-to-edge, never midpoint-to-midpoint` | zero-separation case real; both boundary fixtures derived |
| Spot supersedes regional, exposure must match, and NNW/SSW are never unioned (D-12) | `NNW and SSW are never unioned` · `exposure matching is exact, not a prefix or substring match` · `a region_key outside the coverage entry is excluded before voting` · `a spot row is not matched against the regional key list, or vice versa` · `D-09 tier 1 …` | NNW/SSW **real**; tier case derived |
| Exactly one durable decision per beach/IANA local day and each slot belongs to at most one decision (D-13) | `produces exactly one decision per beach/local day and one claim per slot` · `D-13/D-18: an existing durable decision is reused exactly and never superseded` · `a durable decision for another beach does not suppress this beach's day` · `groups by the beach's IANA local date across a 23-hour spring-forward day` · `… across a 25-hour fall-back day` | all real |
| Signed adjustment bands are exactly 0, 0.25 or 0.50 ft and only raw horizons 0…168 h are eligible (D-14, D-15, D-16) | 13-row `it.each` boundary matrix (1.5 / 1.0 / 2.0 / ±0.499 / ±0.500 / ±0.749 / ±0.750 / caps) · `appliedDeltaFt has addition semantics and always moves toward the range` · `no delta outside the three approved magnitudes can ever be produced` · `filters on the raw hour, before any rounding` · `ineligible slots are neither adjusted nor allowed to set the day baseline` · `a slot at exactly 0 and one at exactly 168 both participate` | all real (trusted range is the live WaveCast NY 1-2 ft call) |

Plus: exact payload-key equality against the RPC's own `c_decision_keys` / `c_application_keys` /
`c_alert_keys` arrays parsed out of migration `20260727231500`; a privacy test asserting no source
hash, identity key, parser version, source key or host string reaches any payload; determinism under
reversed input order.

---

## How `validity_basis` and `day_part` are weighed

Both fields exist because round 2 of 21-01 failed without them. Neither is decorative here.

**`validity_basis`** is a **precedence rank ahead of recency**: `stated` (0) beats
`derived_publication_day` (1) before `issuedAt` is consulted. A derived window is the source's
*publication day*, not a window it claimed to forecast; letting a newer assumption about which day is
covered outrank an explicit claim is how the wrong day gets adjusted. Test:
`a stated validity basis outranks a newer derived publication-day window`. The first version of that
test **escaped mutation M15** because the two rows also differed by configured lineage priority, which
decides earlier — it was rewritten so the two rows are identical in tier, lineage, priority and
maximum, and the derived one is *newer*, so only the basis rank can decide. M15 then went RED.

**`day_part`** governs **conflict eligibility**, not just tie-breaking. `dayPartsOverlap` is false for
exactly one pair — `day` vs `night` — and true otherwise. NWS states "Today 2-4 ft" and "Tonight
8-12 ft" as two windows of one local date; those must not read as a 6-foot disagreement between
providers. `all_day` overlaps everything, so the same 6-foot gap **does** block once the primary claims
the whole day. Both halves are asserted in
`day and night windows of one local date are not an independent disagreement`. `day_part` is also the
tie-break on equal maxima (`all_day` < `day` < `night`, broadest stated coverage first).

`day_part` deliberately does **not** restrict which rows can be primary: D-14 compares the trusted
local-day maximum against Quiver's local-day maximum, and the Quiver side is a max over the same local
day including night slots. Taking the max over all day parts keeps both sides of the comparison on the
same basis.

---

## Gate output (verbatim)

```
$ yarn test:unit --runInBand --runTestsByPath \
    lib/services/forecast/__tests__/trusted-forecast-adjustment.test.ts \
    lib/services/forecast/__tests__/trusted-forecast-contract.test.ts
Test Suites: 2 passed, 2 total
Tests:       99 passed, 99 total

$ npx eslint --max-warnings=0 <all five source/test files>
ESLINT_EXIT=0

$ rm -f tsconfig.tsbuildinfo && yarn typecheck
$ tsc -p tsconfig.json --noEmit
Done in 37.28s.
```

(99, not the 95 of the first round: the critic's round-4 review found a P0 in authority selection and
an untested tie-break. See *Supersession* below — three tests added, one rewritten, two ratchets added.)

(The `tsbuildinfo` was deleted first: `incremental: true` in `tsconfig.json` made an earlier run
finish in 4 s, which is not a real gate.)

---

## Mutation audit — 29/29 RED (22 first round + 7 added in round 4)

Each mutation edits the **source**, runs both suites, then restores. Combined SHA-256 of the two
source files before the first mutation and after the last: **`4d7acc68eb75`** — identical.
Round 4 re-ran MX1 and MX2 (which had **escaped** the first audit) and added five more; SHA-256 of
`trusted-forecast-policy.ts` before the first and after the last: `2a8a51de1fd9…` — identical.

| # | Broken rule | Result |
|---|---|---|
| MX1 | tie-break `? -1 : 1` → `? 1 : -1` (**escaped round 1, now RED**) | RED 1 |
| MX2 | tie-break deleted, `return 0` (**escaped round 1, now RED**) | RED 2 |
| MX3 | `revisionHash` fallback inverted | RED 1 |
| MD1 | supersession collapse removed (the P0 as-shipped) | RED 2 |
| MD2 | collapse keeps the OLDEST issuance of an identity | RED 1 |
| MD3 | issuance identity ignores `source_key`, so two endpoints look like one revised issuance | RED 4 |
| MD4 | collapse moved AFTER the daily-maximum lineage vote | RED 2 |
| M1 | D-07/D-08 evidence-class exclusion removed | RED 2 |
| M2 | D-05/D-06 dedupe keyed by `source_key` not lineage | RED 6 |
| M3 | D-09/D-12 precedence tier dropped, maximum decides | RED 4 |
| M4 | D-12 every exposure compatible | RED 2 |
| M5 | D-12 spot rows matched against the regional key list | RED 1 |
| M6 | D-11 threshold `>` → `>=` | RED 1 |
| M7 | D-11 day and night treated as overlapping | RED 1 |
| M8 | D-15 0.75 ft edge `<` → `<=` | RED 3 |
| M9 | D-15 0.50 ft edge `<` → `<=` | RED 3 |
| M10 | D-15 ±0.50 cap removed | RED 10 |
| M11a | D-16 upper bound `<= 168` → `< 168` | RED 2 |
| M11b | D-16 horizon rounded before comparison | RED 4 |
| M12 | D-13 grouped by UTC date not IANA local date | RED 2 |
| M13 | D-13/D-18 durable decision ignored | RED 1 |
| M14 | D-09 staleness never triggers | RED 1 |
| M15 | `validity_basis` ranks stated == derived | RED 1 |
| M16 | D-11 midpoint instead of nearest-edge separation | RED 5 |
| M17 | D-12 primary range unioned with corroborators | RED 6 |
| M18 | D-24 explicit-`false` kill switch ignored | RED 3 |
| M19 | unstored (`issue_id`-less) row allowed to be primary | RED 1 |
| M20 | contract required-field presence check removed | RED 2 |
| M21 | contract SHA-256 hash format check removed | RED 1 |

**Two escaped the first audit and were closed** (M15 and M19 above; both went GREEN on the first run).
That is the third consecutive round in this phase where the first mutation audit found a test that
looked load-bearing and was not. **A fourth: MX1 and MX2 also went GREEN**, because
`selection is stable when every ranked dimension ties` declared two authority lineages but passed only
`["nws_hfo"]` to both calls, so the second candidate was dropped as `unapproved_lineage` and the
tie-break was never reached. Rewritten as a same-lineage pair; both mutations are now RED.

---

## Supersession — the round-4 P0

`compareCandidates` ranks the daily maximum ahead of `issuedAt`, and nothing removed older issuances.
`issued_at` is inside Seaside's `_IDENTITY_FIELDS`, so **every re-fetch mints a new identity**, and
`trusted_forecast_issues` is UNIQUE on `revision_hash` alone — so every issuance of a local day
coexists, all inside the freshness bound. The engine therefore picked the **biggest** call of the day,
not the **current** one, and `primary_issue_id` pointed at a superseded row. Proven with two real NWS
issuances for `2026-08-07 / oahu/NORTH / day` (13:06Z and 01:10Z, 12 hours apart): **no source that
revised downward within a day was ever honoured.**

Fixed by collapsing each issuance identity to its newest issuance **before** any ranking, in
`selectTrustedForecastAuthority`; losers are excluded `superseded`. The grouping key is exactly
Seaside's `_IDENTITY_FIELDS` **minus `issued_at`** (`issuanceIdentityKey`), so two endpoints of one
provider, two windows of one day and two regions stay independent rows — MD3 proves that key
composition is load-bearing.

The guard that already existed was **inert**: `superseded` was built only from `supersedesIssueId`,
which 21-01 emits as `null` on all 196 rows, while the doc comment claimed it "is normally derived from
the loaded rows themselves", which no code did. That comment is corrected;
`supersededIssueIds` is now documented as what it is — an escape hatch for supersession the caller
knows about but did not load.

Two revisions of ONE issuance (same identity, same `issued_at`, different `revision_hash` — exactly
what the UNIQUE constraint permits) have no recency signal at all, so they resolve on the
content-addressed hash. That is the `revisionHash` branch, previously unreachable and untested; it is
now shared by the collapse and by `compareCandidates` and is covered by
`two stored revisions of ONE issuance resolve by revision hash, not by size`.

---

## Design calls a reviewer should rule on

1. **`validity_basis` weighs into precedence but not into blocking.** A `derived_publication_day` row
   can still block under D-11 if it is authority-eligible. An alternative reading is that a row which
   never stated its window cannot establish an independent disagreement about that window. No live row
   can distinguish the two (0 authority rows carry a derived basis today), so the stricter rule was not
   invented on speculation.
2. **The daily maximum is taken across all day parts.** Justified above by symmetry with the baseline,
   but it does mean a night-only maximum can drive a whole local day's adjustment.
3. **Coverage must resolve `beach_id` itself.** All 196 real rows carry `beach_id: null` — Seaside
   never resolves it — so the coverage map from `(scope_type, region_key, exposure)` to a beach is the
   only bridge, and it is explicit configuration, never inferred from display text. **21-04 must
   author the production coverage entries**; none ship here.
4. **Freshness bounds mirror `seaside/trusted_forecasts/sources.py` exactly** (keyed by `source_key`,
   unknown keys fall back to the strictest 24 h). One justified cadence governs both fetch-time
   rejection and serve-time staleness; the two now have to be kept in step by hand.

## Carried into 21-04

- The engine is pure: no database write, no DTO, no `server-only` import. `21-04` owns
  `trusted-forecast-persistence.ts`, the builder insertion point and the coverage table.
- `reusedDecisions[].governedForecastAts` tells the builder which slots a durable decision covers, so
  reuse does not re-emit applications that would violate `UNIQUE (beach_id, forecast_at)`.
- `no_authority` decisions are emitted with `primaryIssueId: null` and delta 0. They satisfy every CHECK
  in the migration; whether 21-04 wants that audit row for every uncovered beach/day is a volume call.
- The fixture regenerator hard-codes `/Users/stevenchandler/Desktop/dev/seaside`. Fine locally, not
  CI-portable.
