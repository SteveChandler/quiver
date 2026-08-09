# 21-VERIFICATION — Phase 21 rollout verification (MFA-08)

**Run date:** 2026-08-07. **Mode:** read-only. **Writes performed:** none.
**Worktrees:** `seaside/` (21-01 working tree), `quiver/.worktrees/p21-05-verify`
(branched off `feat/trusted-forecast-builder`, with 21-03/21-04's uncommitted
files copied in byte-identical — `diff -rq lib/services/forecast` against
`p21-04-builder` is clean).

**Nothing was committed, pushed, merged or deployed.** Tasks 3-14 of the plan
(Seaside deploy, Quiver deploy, production writes, launchd retirement) were out
of scope for this execution and are additionally blocked — see *Rollout status*.

---

## 1. Live 17-source result (read-only)

```
$ ~/.venvs/seaside/bin/python scripts/verify_trusted_forecast_ingestion.py \
    --live --no-write --quiver-repo <p21-05-verify> --vocabulary-out <path>
exit 0
```

| source_key | status | http | issues | authority | degraded | budget | freshness_h | origin |
|---|---|---:|---:|---:|---:|---:|---:|---|
| socal | ok | 200 | 264 | 256 | 0 | 0 | 96 | https://wavecast.com |
| hawaii | ok | 200 | 32 | 32 | 0 | 0 | 36 | https://wavecast.com |
| new_england | ok | 200 | 16 | 16 | 0 | 0 | 36 | https://wavecast.com |
| new_york | ok | 200 | 15 | 15 | **1** `missing_surf_range` | 8 | 36 | https://wavecast.com |
| new_jersey | ok | 200 | 16 | 16 | 0 | 0 | 36 | https://wavecast.com |
| north_carolina | ok | 200 | 16 | 16 | 0 | 0 | 36 | https://wavecast.com |
| florida_east_coast | ok | 200 | 16 | 16 | 0 | 0 | 36 | https://wavecast.com |
| norcal | ok | 200 | 32 | 32 | 0 | 0 | 36 | https://wavecast.com |
| central_california | ok | 200 | 32 | 32 | 0 | 0 | 36 | https://wavecast.com |
| baja | ok | 200 | 32 | 32 | 0 | 0 | 36 | https://wavecast.com |
| nws_hawaii_srf | ok | 200 | 34 | 34 | 0 | 0 | 24 | https://api.weather.gov |
| surf_institute_pnw | ok | 200 | 2 | 0 | 0 | 0 | 36 | https://surf.institute |
| stormsurf_pnw_links | **skipped_disabled** | — | 0 | 0 | 0 | 0 | 72 | https://www.stormsurf.com |
| stormsurf_pnw_buoy | **skipped_disabled** | — | 0 | 0 | 0 | 0 | 36 | https://www.stormsurf.com |
| stormsurf_ny_shortcast | ok | 200 | 5 | 5 | 0 | 0 | 336 | https://www.stormsurf.com |
| nj_beach_cams_reports | **skipped_disabled** | — | 0 | 0 | 0 | 0 | 24 | https://njbeachcams.com |
| surfers_view_nj | **skipped_disabled** | — | 0 | 0 | 0 | 0 | 24 | https://thesurfersview.com |

```
13 ok · 4 skipped_disabled · 0 failed
512 issues · 512 distinct identities · 512 distinct revisions · 502 authority rows
```

Independently reproduces 21-01's 2026-08-06 numbers exactly.

### Contract checks

| id | check | result |
|---|---|---|
| C1 | exactly 17 sources, in `sources.py` registry order | PASS — 17 |
| C2 | every enabled source resolves; `skipped_disabled` is not a failure | PASS — 13/4/0 |
| C3 | no colliding identity or revision across the whole run | PASS — 512/512/512 |
| C4 | no authority-eligible row without a measured range (D-07/D-08) | PASS — 502 rows, 0 unmeasured |
| C5 | freshness bounds mirror `sources.py` | PASS — 17/17 |
| C6 | source timezones mirror `sources.py` | PASS — 17/17 |
| C7 | socal chart slugs mirror `sources.py` | PASS — 8/8, in order |
| C8 | degraded items inside each source's **written** budget | PASS — `new_york=1/8` |
| C9 | every parsed issuance inside its source's freshness bound | PASS |
| C10 | no Supabase write path reached | PASS — accessor never called |

---

## 2. 🚨 The round-3 NWS prediction is FALSIFIED

The round-3 critic predicted `nws_hawaii_srf` **"fails on most runs"** because
`_resolve_nws_segment` rejects `Rest of today:`, which real HFO SRF mid-day
issuances lead with.

**Measured against 22 consecutive live issuances** (2026-07-31T13:00Z →
2026-08-07T01:10Z, every product the NWS API still lists), running the shipped
`_srf_zone_blocks` / `_srf_surf_table` / `_resolve_nws_segment`:

```
issuances: 22        zone blocks per issuance: 5
label occurrences: 220        rejected: 0
issuances with >=1 rejected label: 0

label vocabulary
   70  'Today'      40  'Tonight'
   20  'Saturday'   15  'Friday'   15  'Thursday'   15  'Wednesday'
   15  'Tuesday'    15  'Monday'   15  'Sunday'
```

**The vocabulary is exactly `{Today, Tonight, <Weekday>}` and nothing else.**

The prediction was not wrong about the product — `.REST OF TODAY...` **does**
appear in mid-morning issuances. It appears as a **narrative section header**,
never as a surf-table period label. On the same 2026-08-06T17:53Z product:

```
narrative headers : ['.DISCUSSION...', '.FRIDAY...', '.REST OF TODAY...', '.TONIGHT...']
surf table header :                       Today                     Friday
```

Round 3's own finding is what makes this safe: surf lives **only** in the
fixed-width table, and the parser reads its labels only from the line above
`Shores  Surf`. The narrative sections carry weather and tides.

Secondary observation, harmless: the afternoon issuance orders the `Tonight`
sub-columns `PM AM` while `Today` is `AM PM`. The parser unions the two
sub-columns of a period, so column order cannot change a value.

---

## 3. Carried-forward items

### 1. `skipped_disabled` is non-failing — DONE

`SourceReport.is_failure` excludes `SKIPPED_DISABLED`. Live run is 13 ok / 4
disabled / 0 failed and exits 0. Mutation **MV1** (add `SKIPPED_DISABLED` to the
failure set) goes RED.

### 2. Degraded-item gating — PRODUCT CALL MADE: per-source *written* budget, default zero

Rejected both extremes:

* **`degraded_item_count > 0` fails the run** — would fail every run. Today's one
  degraded item is *correct behaviour*: WaveCast New York's Sunday August 9 reads
  `No signifcant Swell is expected.`, which states no height at all. Recording it
  as degraded is the fix; fabricating `0-0` is the defect.
* **Report-only** — makes the signal inert, which is what the round-3 critic
  objected to. Grammar drift shows up here first and nowhere else.

**The rule:** every source's budget is 0 unless a `DegradedBudget` is registered
with a reason of at least 40 characters. `new_york` is registered at
`WAVECAST_REGIONAL_OUTLOOK_DAYS // 2` = **8 of 16 published days**, on the
reasoning that below half the outlook a flat spell is ordinary, and at or above
half WaveCast NY has effectively stopped stating heights — which no other signal
distinguishes from the clause grammar having broken.

Measured to justify it, not assumed: NY publishes 16 day rows and exactly **1**
has no measured clause; the other four WaveCast East Coast regions publish 16
rows each with **0**.

`nws_hawaii_srf` was initially given a budget of 8 on the guess that the SRF
table drops far-period cells for shores the office does not forecast. **That guess
was wrong** — every one of the 17 shore rows across all 5 zone blocks carries the
full `len(labels) × 2` cells, and `34 = 17 × 2` issues come out with zero
degraded items. The budget was removed rather than left as an unearned allowance.

Mutations **MV3** (unlisted source silently gets 999), **MV4** (drop the written-reason
requirement) both RED, plus tests with a fixture on each side of the bound.

### 3. Cross-repo freshness parity — DONE, and widened to all three mirrored tables

`check_cross_language_mirrors` parses the TypeScript and compares against
`sources.py`. Three tables are hand-kept across two repos and two languages, and
each fails silently on drift:

| check | TS constant | why silence is the failure mode |
|---|---|---|
| C5 | `TRUSTED_FORECAST_FRESHNESS_MAX_AGE_HOURS` | an unknown key falls back to `STRICTEST_FRESHNESS_MAX_AGE_HOURS = 24`, so a drifted 336 h source vanishes as stale with no log |
| C6 | `TRUSTED_FORECAST_SOURCE_TIMEZONES` | a drifted zone makes the `validLocalDate` string match a day off |
| C7 | `WAVECAST_SOCAL_CHART_SLUGS` | a drifted slug makes a coverage entry match nothing |

All three agree today (17/17, 17/17, 8/8). The parser **raises** on any entry it
cannot read rather than skipping it — a skipped entry would make the check pass by
seeing less. Mutation **MV5** (skip instead of raise) RED; a synthetic drifted
checkout goes RED on exactly the drifted table and stays green on the others.

**Honest limit:** `test_the_shipped_quiver_mirrors_still_agree_with_sources_py`
**SKIPS** when `../quiver/lib/services/forecast/trusted-forecast-policy.ts` is
absent, which it is today because 21-03/21-04 are uncommitted. It becomes a real
assertion the moment they land on `main`. The `--live --no-write` verifier treats
the same condition as a hard FAIL, which is where the gate belongs.

### 4. 🚨 Coverage ratcheted against PRODUCTION, not the corpus — 22 UNCLAIMED TRIPLES

21-04's ratchet walks the 196-row fixture corpus: **35 distinct triples, 4 covered,
31 excused**. The live run emits **56**. The 21 extra ones match nothing and say
nothing.

```
production triples : 56
  covered          :  4   spot/{malibu,trestles}/{NNW,SSW}
  excused          : 30
  UNCLAIMED        : 22
```

The 22 production emits that neither an entry nor an excusal names:

```
regional/baja/NNW              regional/baja/SSW
regional/central_california/NNW  regional/central_california/SSW
regional/florida_east_coast/primary
regional/new_england/primary   regional/new_jersey/primary
regional/norcal/NNW            regional/norcal/SSW
regional/north_carolina/primary
spot/{beacons,huntington-beach,oceanside,oldmans,rincon,ventura}/{NNW,SSW}   (12)
```

The socal ones are the sharper half: the excusal list excuses
`spot/<slug>/dominant` for the six uncovered chart slugs on the stated ground
that *"this slug's own spot chart was never captured, so its section vocabulary
is unknown"*. Production shows the vocabulary **is** `NNW`/`SSW`, identical to
trestles and malibu — the charts were simply never fetched into the corpus.

And the reverse direction fires too: **1 excusal production never emits** —
`regional/norcal/primary`. Live NorCal emits `NNW`/`SSW`; the corpus entry comes
from the March/October DST capture. The corpus and production disagree, and only
a production-side ratchet can see it.

This is enforced by the smoke runner's preflight step 7 (`--live-vocabulary`),
which aborts with `vocabulary_uncovered` before any write. Mutations **MQ6**
(downgrade to a warning) and **MQ7** (unknown `scope_type` counts as covered) RED.

### 5. 🚨 `malibu` is not a real beach slug — AND NEITHER IS `trestles`

Read-only query against the production Supabase instance (`.env.local`; note
`.env` points at the local stack, which is not running):

```
beaches total: 346
slug=trestles          -> NOT FOUND
slug=malibu            -> NOT FOUND
slug=huntington-beach  -> NOT FOUND
slug=beacons           -> FOUND (Beacons, CA, America/Los_Angeles)

name/slug ilike 'trestle'  -> lower-trestles, upper-trestles
name/slug ilike 'malibu'   -> malibu-surfrider-first-point-malibu-ca,
                              malibu-first-point-surfrider, malibu-third-point-malibu-ca, ...
```

`config/regions.ts` carries `trestles` as a **spot/region key**, which is not the
same namespace as `beaches.slug`. 21-04's two enabled coverage entries are both
keyed on slugs that do not exist.

**Consequence:** the trusted-forecast layer is **100 % inert in production
today**, and it says so once per process and then goes silent (21-04's own D3).

Demonstrated through the shipped preflight against the live database:

```
PREFLIGHT ABORT: coverage_slug_unresolvable: trestles, malibu —
  approved coverage names 2 beach slug(s) and 2 do not exist in beaches.
  The trusted layer is inert for those entries and says so only once per process
```

Mutations **MQ2** (never check resolution) RED; tests cover the fully- and
partially-unresolvable cases.

### D2. Deploy ordering — ENCODED, and it fires today

`PGRST202` is unreachable: all seven `trusted_forecast_*` tables come from
migration `20260727231500`, so the *read* fails on a missing relation before the
RPC is called, and a read failure rejects `buildForecasts`. Preflight step 2
probes `trusted_forecast_issues` and classifies `PGRST205` / `PGRST202` / `42P01`
as `migration_not_deployed`, before any other read and long before the writer.

Live, right now:

```
$ npx tsx scripts/trusted-forecast-production-smoke.ts --mode=forecast ... --confirm-production
ABORT migration_not_deployed: trusted_forecast_* relations are absent, so migration
20260727231500 has not landed. It must be applied BEFORE 21-04's builder code
deploys: the issue READ fails on a missing relation before the RPC is reached, and
a read failure rejects buildForecasts
ABORTED before any write-capable dependency was resolved
exit 1
```

Direct REST probe agrees: `trusted_forecast_issues`, `trusted_forecast_decisions`
and `trusted_forecast_build_receipts` all return **HTTP 404**. Mutation **MQ1**
(empty the missing-relation code set) RED.

---

## 4. 🚨 New blocking findings (not mine to fix — they belong to 21-03/21-04)

### F1 (P1) — 21-04 breaks `scripts/regenerate-enhanced-forecasts.ts`

`trusted-forecast-repository.ts` and `trusted-forecast-persistence.ts` import
`server-only`. That package is **not a declared dependency**; Next provides it
through its bundler and `next/jest` maps it to an empty module. Every pre-existing
`server-only` importer sits outside the forecast-builder graph. 21-04 put one
**inside** it, via `forecast-builder.ts → trusted-forecast-repository.ts`.

Measured on both trees:

```
base (origin/main + 21-02):  import("../lib/utils/forecast-server-utils")  -> BASELINE IMPORT OK
with 21-04:                  same import -> Cannot find module 'server-only'
                             require stack: trusted-forecast-repository.ts
                                          <- forecast-builder.ts
                                          <- enhanced-forecast-service.ts
                                          <- forecast-server-utils.ts
```

So `yarn tsx scripts/regenerate-enhanced-forecasts.ts --force-all --confirm-prod`
— the documented production regeneration entrypoint, and the command 21-05's
Tasks 10/12 depend on — **fails at import**. Jest never saw it because `next/jest`
aliases `server-only` away.

The smoke runner works around it for itself (`aliasServerOnlyForNode`, the same
alias `next/jest` uses) and derives the build key through an injected async
dependency so its own module graph stays clean. **The regeneration script is still
broken.** Fix belongs with 21-04: either add a `server-only` shim to the tsx
entrypoints, or move the `server-only` marker off the modules the builder imports.

### F2 (P1) — 21-04 breaks two unit suites outside its 12-suite gate

`yarn test:unit` full run in this worktree:

```
Test Suites: 4 failed, 16 skipped, 1300 passed, 1304 of 1320 total
Tests:       7 failed, 195 skipped, 1 todo, 17123 passed, 17326 total
```

Attribution measured by running the same three suites on each tree:

| tree | failures |
|---|---|
| base (origin/main + 21-02) | 5 — all `__tests__/hooks/use-surf-discovery-hold.test.tsx`, **pre-existing** |
| with 21-04 | 7 — the same 5, plus 2 new |

The two new ones:

* `__tests__/lib/enhanced-forecast-service.test.ts` › *should generate forecasts for 12 days*
* `__tests__/lib/enhanced-forecast-cdip-integration.test.ts` › *should use CDIP data as primary source for Southern California*

Both fail identically:

```
Test produced 1 unexpected console.error(s):
  [ForecastBuilder] trusted_forecast_coverage_unavailable [object Object]
If intentional, use expectConsoleErrors([/pattern/]) from test-utils.
```

21-04 applied exactly this `expectConsoleErrors` fix to the four builder suites it
listed, and missed these two — they drive the builder too. One line per suite.

### F3 (P2) — a 21-03 fixture is collected as a test suite

```
FAIL lib/services/forecast/__tests__/fixtures/trusted-forecast-real-issues.ts
  ● Test suite failed to run — Your test suite must contain at least one test.
```

`jest` `testMatch` picks up everything under `__tests__/`. Move the fixtures
directory out of `__tests__/`, or add it to `testPathIgnorePatterns`.

### F4 (P2) — `scripts/**` is outside BOTH real gates

`tsconfig.json` excludes `scripts/**/*` and `eslint.config.mjs` ignores
`scripts/**`. So `yarn typecheck` **does not typecheck** anything in `scripts/`
(`tsc --listFiles | grep -c scripts/trusted-forecast-production-smoke` → `0`) and
`yarn lint` skips it. Jest transpiles with SWC, which strips types without
checking them, so a type error in a script ships.

This was not theoretical: an explicit typecheck of the new script found **three
real errors** `yarn typecheck` never saw (`TrustedForecastScopeType` imported from
the wrong module, `createServiceRoleClient` imported from `lib/supabase/server`
instead of `lib/supabase`, twice). All three are fixed. Reproduce with:

```jsonc
// tsconfig.p21-05-scripts.json (temporary; not committed)
{ "extends": "./tsconfig.json",
  "include": ["next-env.d.ts", "types/**/*.d.ts", "lib/**/*.ts",
              "scripts/trusted-forecast-production-smoke.ts",
              "scripts/__tests__/trusted-forecast-production-smoke.test.ts"],
  "exclude": ["node_modules", "docs/**/*", "supabase/functions/**/*"] }
```
```
$ npx tsc -p tsconfig.p21-05-scripts.json --noEmit   ->  clean
```

Worth a permanent `tsconfig.scripts.json` plus a `typecheck:scripts` script.

---

## 5. Gate output (verbatim)

### Seaside

```
$ ~/.venvs/seaside/bin/python -m pytest tests/ -q
878 passed, 3 skipped, 3 warnings in 5.08s
```
Baseline before this plan was 858 passed, 2 skipped. **+20 tests, +1 skip** (the
cross-repo mirror assertion, which skips only while 21-03/21-04 are uncommitted).

```
$ ~/.venvs/seaside/bin/python scripts/verify_trusted_forecast_ingestion.py --help   -> ok
$ ... --live --no-write --quiver-repo <p21-05-verify>                               -> exit 0
```

### Quiver

```
$ rm -f tsconfig.tsbuildinfo && yarn typecheck
$ tsc -p tsconfig.json --noEmit
Done in 36.38s.
```
(`tsconfig.tsbuildinfo` deleted first — `incremental: true` once made a run finish
in 4 s. **Note F4: this gate does not cover `scripts/`.** The scripts were
typechecked separately and are clean.)

```
$ npx jest --runInBand --runTestsByPath scripts/__tests__/trusted-forecast-production-smoke.test.ts
Tests: 41 passed, 41 total

$ npx jest --runInBand --runTestsByPath <12 trusted-forecast + builder suites>
Test Suites: 12 passed, 12 total
Tests:       336 passed, 336 total

$ NODE_OPTIONS=--max-old-space-size=4096 npx jest --maxWorkers=2 --bail=0
Test Suites: 4 failed, 16 skipped, 1300 passed, 1304 of 1320 total
Tests:       7 failed, 195 skipped, 1 todo, 17123 passed, 17326 total   <- see F2/F3
```

```
$ npx eslint --max-warnings=0 scripts/trusted-forecast-production-smoke.ts scripts/__tests__/...
File ignored because of a matching ignore pattern   <- see F4; scripts/** is not linted
```

### NOT RUN, and why

| gate | status |
|---|---|
| `yarn build` (`VERCEL_ENV=preview`) | **not run** — memory. The Mac has been crashing under parallel load; free memory was 50 % with 4.5 GB of 6 GB swap already in use. |
| `yarn db:reset` + `supabase test db` | **not run** — requires Docker, explicitly forbidden this session. 21-02's 62 pgTAP assertions were run and recorded by 21-02. |
| `yarn typecheck:forecast-gate` | not run separately; the full `yarn typecheck` ran clean. |
| Playwright E2E | not required — no UI or route work in this plan. |

---

## 6. Mutation audit — 18/18 RED

Harness edits source only, refuses a mutation whose file digest did not change
(the `void 0;` lesson, mechanised), runs the owning suite, restores, and
re-verifies the digest.

```
baseline digests  verify_trusted_forecast_ingestion.py be6c35274320
                  trusted-forecast-production-smoke.ts a3cfece19e7a
final digests     verify_trusted_forecast_ingestion.py be6c35274320
                  trusted-forecast-production-smoke.ts a3cfece19e7a
```

| # | broken rule | result |
|---|---|---|
| MV1 | `skipped_disabled` counted as a source failure | RED |
| MV2 | enabled-source failures no longer fail the run | RED |
| MV3 | an unlisted source gets an unwritten degraded budget | RED |
| MV4 | a degraded budget no longer needs a written reason | RED |
| MV5 | mirror parser silently skips an entry it cannot read | RED |
| MV6 | `origin` carries the full source URL | RED |
| MV7 | sanitization assertion never looks at private values | RED |
| MV8 | no-write guard does not actually replace the accessor | RED |
| MV9 | identity/revision collisions no longer fail | RED |
| MV10 | `--live` / `--no-write` no longer required | RED |
| MQ1 | D2: a missing relation is no longer an undeployed migration | RED |
| MQ2 | coverage slugs are never checked for resolution | RED |
| MQ3 | the authorized build key is not compared | RED |
| MQ4 | the authorized local date is not compared | RED |
| MQ5 | the write-capable dependency is resolved before the preflight | RED |
| MQ6 | an unclaimed production vocabulary triple only warns | RED |
| MQ7 | an unknown `scope_type` counts as covered | RED |
| MQ8 | a duplicated argument is accepted | RED |

**One harness bug caught and corrected before trusting the result:** the first
run reported all eight Quiver mutations GREEN. The Jest command was piped through
`tail`, so the shell returned `tail`'s exit status, not Jest's. Adding
`set -o pipefail` turned all eight RED. *A harness that cannot see failure reports
perfect coverage* — the same shape as the `void 0;` no-op mutation.

---

## 7. Privacy (D-23)

| assertion | evidence |
|---|---|
| no `source_hash`, `revision_hash`, `issue_identity_key` or `matched_fragment` in verifier output | `test_verifier_output_never_carries_a_private_value`, with a **non-vacuity** check that the run really produced >100 such values |
| the negative half is load-bearing | `test_verifier_sanitization_check_fails_when_a_private_value_is_present` |
| no full URL or query string | `source_origin` returns scheme+host only; the rendered report is scanned for every source's URL path, and for the stub's `secret=1` query |
| the check runs on the real output path | `assert_report_is_sanitized` is called in `main` before `print`, and raises rather than printing |
| smoke runner prints only sanitized target metadata | key set asserted exactly: `mode, beach_id, beach_slug, timezone, local_date, build_key, coverage_slugs, production_vocabulary_triples` |
| no credentials anywhere | no secret is read by either tool except through `dotenv` into the Supabase client; none is rendered |

---

## 8. Requirement coverage

| req | evidence | status |
|---|---|---|
| MFA-01 | live 17-source run, 13 ok / 4 disabled / 0 failed, `healthy` | PASS |
| MFA-02 | 512 issues, 512 identities, 512 revisions, 0 unmeasured authority rows | PASS |
| MFA-03 | evidence class and authority eligibility reported per source; `surf_institute_pnw` 2 issues / 0 authority | PASS |
| MFA-04 | **BLOCKED** — 22 production vocabulary triples unclaimed (item 4) | BLOCKED |
| MFA-05 | **BLOCKED** — both coverage slugs unresolvable (item 5) | BLOCKED |
| MFA-06 | **BLOCKED** — migration `20260727231500` not in production (D2) | BLOCKED |
| MFA-07 | privacy section above; 21-02's pgTAP 1-17 for privileges | PASS (local) |
| MFA-08 | this document; verifier + smoke runner; 18/18 mutations RED | PASS for the read-only half |

---

## 9. Rollout status (D-25 order)

| # | step | status |
|---|---|---|
| 1 | schema in production | ❌ **NOT DONE** — `trusted_forecast_*` return HTTP 404; 21-02's push aborted (six pending migrations incl. a syntactically broken one, plus two remote-only versions needing the Drift Repair Protocol) |
| 2 | production Seaside ingestion deploy | ⛔ not attempted — out of scope, and blocked on 1 |
| 3 | live parser/parity verification | ✅ **DONE, read-only** — this document |
| 4 | Quiver serving | ⛔ blocked on 1, plus F1/F2, plus coverage items 4 and 5 |
| 5 | audit verification | ⛔ blocked on 4 |
| 6 | launchd retirement | ⛔ blocked on parity; `gui/501/com.quiver.surf-forecast-ingest` untouched |

**No env mutation, no deploy, no production write, no launchd change occurred.**

### Ordered blocker list

1. **Land migration `20260727231500` before 21-04's code deploys** (D2). It is not
   in production. Prerequisites are 21-02's three operator actions.
2. **Fix the coverage slugs** — `trestles` → `lower-trestles`/`upper-trestles`,
   `malibu` → one of the real Malibu slugs. Until then the feature is inert.
3. **Claim or excuse the 22 production vocabulary triples**, and delete the stale
   `regional/norcal/primary` excusal.
4. **F1** — restore `scripts/regenerate-enhanced-forecasts.ts`.
5. **F2 / F3** — restore `yarn test:unit` to green.
6. **F4** — put `scripts/**` behind a real typecheck.
