# Match-score forward backtest — 2026-09-27

## Protocol and data

The pre-registered protocol at `scratchpad/backtest/PROTOCOL.md` was written before cohort export or candidate results and was not edited afterward. The reproducible, SELECT-only [export query](../../../scripts/backtest-match-score-export.sql) ran through the read-only `q.sh` helper. Its only retained data file is outside the repository at `scratchpad/backtest/data.json` (SHA-256 `db1e3c81080bc1a6c412f0f309c27dc5031d92cb90ba5ac12e9f34db8e14e1e7`). Export cutoff: `2026-09-27T23:41:08.4529Z`. User IDs were replaced with md5-derived UUIDs; board names and unknown board types were replaced with aliases or hashes, and free-text board dimensions were set to null. Board-tip copy was outside this numeric test. No personal names, emails, or free-text session fields were exported.

The cohort has **9 users and 133 eligible sessions** (completed, rated, undeleted, snapshot present, in the preceding 12 months). Each user's sixth and later eligible sessions became holdouts: **88 predictions**. At each holdout, the disposable PostgreSQL 15 replay hid every session at or after its arrival time, including simultaneous arrivals, then scored its own snapshot at its beach. A and B used identical visible training rows. A installed the deployed `20260923040000` function; B installed the branch `20260927230000` function. The local B copy added diagnostic JSON fields for full precision prior and adjustments; it did not change B's score. C used B's fit and board adjustments with a similarity-weighted rating mean over **all** earlier eligible sessions, shrunk toward B's prior with fixed `k=2`. Its aversion penalty was zero. `k=1` and `k=3` are sensitivity runs only. Metrics use the one-decimal, clipped user-facing score. Missing numeric scores are excluded from that candidate's denominators.

Primary concordance compares each user's differently rated held-out pairs, counts predicted ties as 0.5, then averages users equally. Spearman uses average ranks for ties. Good-day recall is `rating >= 4` predicted `>= 7.0`; false-good is `rating <= 2` predicted `>= 7.0`.

## Results

| Candidate | Numeric / 88 | Mean within-user concordance (7 users) | Pooled Spearman | Mean user Spearman (7 users) | Good-day recall | False-good rate |
|---|---:|---:|---:|---:|---:|---:|
| A — deployed | 72 | 81.64% | 0.148 | 0.609 | 43.48% (10/23) | 26.92% (7/26) |
| B — branch means | 79 | 75.69% | 0.118 | 0.505 | 20.00% (5/25) | 20.69% (6/29) |
| C — similarity, k=2 | 79 | 60.69% | -0.025 | 0.214 | 44.00% (11/25) | 55.17% (16/29) |
| C sensitivity, k=1 | 79 | 56.99% | -0.016 | 0.138 | 44.00% (11/25) | 55.17% (16/29) |
| C sensitivity, k=3 | 79 | 62.60% | -0.043 | 0.253 | 48.00% (12/25) | 55.17% (16/29) |

Two users lacked differently rated, numeric-scored holdout pairs, so they do not enter the primary or per-user Spearman means. A has 16 missing numeric scores; B and C have 9. A versus B is therefore not a like-for-like denominator comparison. On the 72 holdouts both scored, concordance was **81.64% A versus 77.90% B**, pooled Spearman **0.148 versus 0.092**, and false-good **26.92% versus 23.08%**. The branch expanded coverage by seven scored holdouts. This comparison measures the whole deployed-to-branch difference; board-class resolution also changed in B, so its numeric delta cannot be attributed solely to break families.

## Decision

**Do not adopt C.** The pre-registered rule requires all three: concordance at least B + 2 percentage points, pooled Spearman at least B - 0.01, and false-good rate no higher than B. C at `k=2` is **15.00 points below** B on concordance, **0.143 below** B on pooled Spearman, and **34.48 points above** B on false-good rate. No scoring code was changed. Steven's supplied Monday Scripps branch result therefore remains **6.8 FAIR**, versus the prior **7.3 GOOD**. This test does not validate the averaged-profile formula; it only rejects this specified replacement against the chosen gate.

## Marketed-figure audit and limits

Searches of `app/forecast-accuracy`, `docs`, `.planning`, and `../seaside` found no computation method for `r=0.68 / 75% concordance`. A 2026-06 SEO spec repeats an approximately 75% claim, while later planning calls it an in-sample claim and the current `/forecast-accuracy` page discusses buoy validation without that statistic. Under this forward protocol A yields 81.64% within-user concordance, 0.148 pooled Spearman, and 0.102 pooled Pearson; it **does not reproduce** `r=0.68 / 75%` as the metrics defined here. Without the original sample and method, direct equivalence cannot be established. Nine users, seven contributing to the primary metric, make these estimates sensitive to individual histories.

The first mechanical replay completed but omitted fit flags on 62 sessions when loading generated columns. It was discarded; the loader now rebuilds the minimal `session_decomposition` that generates those exact flags. Review also corrected null optional source fields in C to match B's similarity inputs. All numbers above come from the corrected replay; the cohort, protocol, and decision thresholds were unchanged.

## Reproduce and checks

```sh
scratch=/private/tmp/claude-501/-Users-stevenchandler-Desktop-dev-quiver/9be52a9f-f78d-48c8-8672-df41bb250973/scratchpad
"$scratch/q.sh" -At -f scripts/backtest-match-score-export.sql > "$scratch/backtest/data.json"
python3 scripts/backtest-match-score.py selftest
bash scripts/backtest-match-score.sh "$scratch/backtest/data.json" "$scratch/backtest/run"
```

The corrected replay, Python self-check, shell syntax check, and `bash scripts/test-match-score-board-model-postgres.sh` passed. Conditional implementation checks, the Week Scout regression, performance gate, Jest, typecheck, batch equivalence, and production shadow comparison were not run because C was not adopted and no scorer changed. No production write or migration was attempted.


## Attribution

This follow-up reuses the frozen export (same SHA-256 and cutoff above), the existing disposable PostgreSQL harness, and the unchanged forward-chaining protocol and metrics. All 9 users and 88 heldouts remain included; 7 users have comparable differently rated, numeric-scored pairs. No scoring code or protocol file was changed.

The scratch-only variants are:

- **B1:** A with only the two exact-break predicates in `peaks` and `fit_pairs` replaced by `break_types_match`; deployed board resolution retained.
- **B2:** A with only the branch's `chosen_board` CTE and its four supporting history fields, including row-first precedence and the thruster alias; exact-break predicates retained.
- **B3:** B with only the two scoring predicates restored to A's exact-break matching; family matching remains in `similar_good`.

| Candidate | Numeric / 88 | Mean within-user concordance | Pooled Spearman | Mean user Spearman | Good-day recall | False-good rate |
|---|---:|---:|---:|---:|---:|---:|
| A | 72 | 81.64% | 0.148 | 0.609 | 43.48% (10/23) | 26.92% (7/26) |
| B | 79 | 75.69% | 0.118 | 0.505 | 20.00% (5/25) | 20.69% (6/29) |
| B1 | 79 | 75.32% | 0.096 | 0.496 | 20.00% (5/25) | 20.69% (6/29) |
| B2 | 72 | 81.87% | 0.172 | 0.614 | 47.83% (11/23) | 26.92% (7/26) |
| B3 | 72 | 81.87% | 0.172 | 0.614 | 47.83% (11/23) | 26.92% (7/26) |

Per-user concordance and contributing pair counts follow. Pairs require different ratings and two numeric predictions; counts therefore vary by candidate. Each contributing user has equal weight in the primary metric, regardless of pair count. A dash means no comparable pairs, not zero concordance.

| Pseudonymous user | A concordance | A pairs | B concordance | B pairs | B3 concordance | B3 pairs |
|---|---:|---:|---:|---:|---:|---:|
| `1908fcac-5f23-7319-fb95-6a3b8ba658a4` | — | 0 | — | 0 | — | 0 |
| `3379ec73-0133-b15a-9e02-71a6902995b7` | 67.19% | 64 | 64.06% | 64 | 67.19% | 64 |
| `75597ad2-6e45-a166-b309-5fc820de7bec` | 75.00% | 8 | 75.00% | 8 | 75.00% | 8 |
| `8bec372f-94e7-fa4d-53f6-cd6808fd11e2` | 90.91% | 11 | 90.91% | 11 | 90.91% | 11 |
| `bac71d83-98a0-6ef5-49ca-d147db6ed1a5` | 100.00% | 6 | 65.62% | 16 | 100.00% | 6 |
| `bc17a4e6-cbeb-7c5b-fa6f-945ebc671a28` | — | 0 | — | 0 | — | 0 |
| `c22b4a86-d2c2-a93e-e0ba-1903bb58cbff` **Steven** | 49.51% | 407 | 41.36% | 492 | 51.11% | 407 |
| `df50d1b6-f798-f4af-485b-1dd9adaac864` | 88.89% | 9 | 92.86% | 14 | 88.89% | 9 |
| `fa1f696e-5b14-7335-4946-c745f93cce8f` | 100.00% | 3 | 100.00% | 3 | 100.00% | 3 |

Bootstrap: 2,000 paired draws of 9 user IDs with replacement from the complete cohort, Python `random.Random(20260927).choices` over sorted pseudonyms. The same sampled IDs and multiplicities are used for both sides of each difference. Users without comparable pairs remain in sampling but are omitted from each mean, as in the primary metric. All 2,000 draws had a defined mean. The 90% percentile interval uses linearly interpolated 5th and 95th percentiles; these are user-resampling intervals, not pair-resampling intervals.

| Difference | Estimate (percentage points) | Bootstrap 90% interval (percentage points) |
|---|---:|---:|
| B − A | -5.95 | [-14.93, +0.17] |
| B3 − A | +0.23 | [+0.00, +0.64] |

The observed regression is attributable to family matching in scoring: B1 alone loses 6.32 percentage points versus A, whereas B2 gains 0.23 points. B3 reproduces B2's scores and missingness on all 88 holdouts, recovering the regression while retaining the branch's board resolution and family-based reason count. However, B−A's interval includes zero, and B3−A's interval touches zero; this small cohort does not establish a reliable population improvement. B3's entire concordance gain over A comes from Steven (49.51% to 51.11%). Much of B's aggregate loss comes from the user `bac71d83-98a0-6ef5-49ca-d147db6ed1a5`, whose comparable pairs expand from 6 to 16 while concordance falls from 100% to 65.62%. B3 also returns to A's lower numeric coverage (72 versus B's 79) and higher false-good rate (26.92% versus 20.69%). These results support B3 as the candidate to investigate, with that coverage tradeoff; they do not authorize a scoring change.

Validation passed: A and B's full prediction rows exactly reproduce the prior replay; the export and protocol hashes are unchanged; reviewed generated SQL diffs contain only the specified attribution changes; per-user means reproduce the primary metrics. The scratch artifacts are `scratchpad/backtest/attribute.py`, `scratchpad/backtest/attribution/run.sh`, `summarize.py`, generated variant SQL, `predictions.tsv`, and `summary.json`. The original repository harness is unchanged. No new production query was needed.


## Decision: B3 adopted

The owner approved B3 on 2026-09-27. The branch migration now restores the deployed exact break-type predicate in `peaks` and `fit_pairs`; break families still support the similar-good count and the unchanged TypeScript picker. Board-row precedence, the thruster alias, null RPC board tips, the similar-session bullet, public helpers, and batch performance work remain.

The unchanged committed backtest harness, using the same frozen export and protocol, reproduced all 88 B3 per-holdout scores including 16 missing scores. Final B3 metrics: **81.87%** mean within-user concordance (7 contributing users), **0.172** pooled Spearman, **0.614** mean user Spearman, **47.83% (11/23)** good-day recall, and **26.92% (7/26)** false-good rate. There are 9 cohort users, 88 heldouts, and 72 numeric predictions. The original C rejection remains valid for its original comparison; this section records the later owner decision.

The SQL fixture was changed first and failed against the family-scored profile (base 9.50, fit -1.00, score 9.0). It now passes the hand calculation: the sole exact-beach positive has `(wave,period,wind,direction,tide)=(3,12,4,90,3)`, matching the slot, hence base 10, fit 0, aversion 0, and score 10 after a +0.5 board adjustment and clipping. The mixed-break positive still contributes to the five similar good sessions. A second assertion changes it to rating 1 and proves it remains excluded from aversion and fit, while similar-good drops to four.

Performance uses the Week Scout fixtures, one warmup and the median of five runs per size, with `EXPLAIN (ANALYZE, BUFFERS)` retained under `scratchpad/backtest/b3-perf`. The 252- and 5,040-slot gates pass; the single-slot ratio is reported but has no specified 2× gate.

| Slots | Deployed median ms | B3 median ms | Ratio | Gate |
|---:|---:|---:|---:|---|
| 1 | 4.778 | 12.142 | 2.5412× | Informational |
| 252 | 37.942 | 73.745 | 1.9436× | PASS ≤2× |
| 5,040 | 154.701 | 186.854 | 1.2078× | PASS ≤2× |

**Batch equivalence:** all 69,160 fixture outputs equal single-slot outputs (13 users × 5,320 slots, including the full benchmark slots); zero mismatches. The scratch harness omitted the old frozen-B JSON comparison because B3 intentionally changes scores, while retaining the full batch-versus-single check. Repository harness files were not modified.

Production shadow used SELECT-only `q.sh`, the same seven learned-user inputs as the earlier shadow and Steven's specified Scripps slot. New family and midpoint helpers were inlined. A guard confirmed no long numeric tokens requiring the midpoint helper's exceptional overflow path. All eight states remain learned. Pseudonyms below follow the export's md5 scheme.

| User | Deployed score / label | B3 score / label | First bullet | Similar / good |
|---|---|---|---|---:|
| `c22b4a86-d2c2-a93e-e0ba-1903bb58cbff` **Steven** | 7.3 GOOD | 6.8 FAIR | 8 of your 19 good sessions were in conditions like this. | 8/19 |
| `bac71d83-98a0-6ef5-49ca-d147db6ed1a5` | 5.3 RIDEABLE | 5.3 RIDEABLE | 2 of your 3 good sessions were in conditions like this. | 2/3 |
| `df50d1b6-f798-f4af-485b-1dd9adaac864` | 7.0 FAIR | 7.0 FAIR | 2 of your 4 good sessions were in conditions like this. | 2/4 |
| `fa1f696e-5b14-7335-4946-c745f93cce8f` | 10.0 EPIC | 10.0 EPIC | 1 of your 2 good sessions were in conditions like this. | 1/2 |
| `3379ec73-0133-b15a-9e02-71a6902995b7` | 4.9 RIDEABLE | 4.9 RIDEABLE | 5 of your 8 good sessions were in conditions like this. | 5/8 |
| `0b9caa08-b34f-2759-fdd9-2dccb49f98b6` | 9.5 EPIC | 9.5 EPIC | 2 of your 3 good sessions were in conditions like this. | 2/3 |
| `75597ad2-6e45-a166-b309-5fc820de7bec` | 6.9 FAIR | 6.9 FAIR | 2 of your 2 good sessions were in conditions like this. | 2/2 |
| `1908fcac-5f23-7319-fb95-6a3b8ba658a4` | 10.0 EPIC | 10.0 EPIC | 2 of your 2 good sessions were in conditions like this. | 2/2 |

Steven remains 6.8 FAIR in this shadow. His old and new base score, aversion, and fit adjustment match; board resolution changes `fish` to `shortboard`, removing a +0.5 board-band bonus at 3.2 ft. Thus B3 repairs the cohort regression without recovering that particular 0.5-point difference. The displayed 7.0/FAIR row is unchanged: labels use the unrounded internal score.

Commands (run from the worktree; `scratch` is the scratchpad path in the reproduction section above):

| Command | Result |
|---|---|
| `bash scripts/test-match-score-board-model-postgres.sh` before migration change | Expected FAIL: mixed-break profile/fit assertion |
| `bash scripts/test-match-score-board-model-postgres.sh` after migration change | PASS |
| `bash scripts/test-week-scout-match-postgres.sh` | PASS |
| `bash scripts/backtest-match-score.sh "$scratch/backtest/data.json" "$scratch/backtest/b3-adopted"` | PASS; all 88 outputs equal frozen B3 |
| `bash "$scratch/backtest/b3-perf/verify.sh" > "$scratch/backtest/b3-perf/benchmark.log" 2>&1` | PASS; benchmark and 69,160 batch comparisons |
| `python3 "$scratch/backtest/b3-perf/check-performance.py"` | PASS at both gated sizes |
| `source ~/.nvm/nvm.sh && nvm use 22 && yarn jest __tests__/lib/scoring lib/personalization/__tests__/match-score.test.ts __tests__/api/personalization/match-score.test.ts --runInBand` | PASS: 14 suites, 243 tests |
| `source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck` | PASS: Node 22.22.0 |
| `python3 "$scratch/backtest/build-b3-shadow.py"` then `"$scratch/q.sh" -At -f "$scratch/backtest/b3-shadow.sql"` | PASS: eight SELECT-only shadow rows |
| `git diff --check` | PASS |

No production mutation, deployment, or push was performed.
