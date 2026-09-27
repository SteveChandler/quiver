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
