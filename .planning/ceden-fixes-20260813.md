# CEDEN ingestion fixes

Date: 2026-08-13

## Scope and safety

- No production writes were performed.
- No migration was applied or edited.
- `quiver-native/` was not touched.
- The seven future rows remain in `wq_samples`; the evaluator now ignores them without requiring a delete.

## What was already fixed

Nothing in the existing uncommitted worktree fixed defect 2. `evaluateWaterQuality` still selected `MAX(sample_date)` and used it as the 30-day anchor, with no `sample_date <= today` predicate. The claimed UTC-today fix was not present, so it was implemented here.

Defect 3 was intentionally not changed. The 5 km radius is a data-quality policy decision, not a safe mechanical fix.

## Newly fixed

### Defect 1: station pagination

`syncWQSamples` now reads `wq_monitoring_stations` in stable `id`-ordered pages of 1,000 rows. `evaluateWaterQuality` uses the same paged reader for linked stations, so the evaluator no longer has a second hidden 1,000-row cap.

### Defect 2: future-date poisoning

The evaluator now computes:

```text
end   = UTC today
start = UTC today - 30 calendar days
```

Its sample query is constrained to the inclusive `[start, end]` window. Future CEDEN and PacIOOS rows are rejected before they enter `wq_samples`. The samples result now exposes `futureSamplesRejected` as a structured cron result counter; it is not only a log line.

## Funnel

The current/latest column is the observed production run or table state from the diagnosis. The fixed column is a fixed-code replay/counterfactual; no fixed cron was run against production.

| Stage | Current/latest observed | Fixed code / estimate | Notes |
|---|---:|---:|---|
| CEDEN rows fetched | 9,089 in the latest recorded sample run; 9,266 in the complete source replay | 9,266 | The 32,000 source limit is not active. |
| Stations stored | 5,853 total table rows | 5,853 total remains | The existing 3,674 legacy rows are retained; the fixed reader sees all rows. |
| CEDEN stations matched to beaches | 929 / 1,705 valid unique CEDEN stations at 5 km; the table currently contains 934 linked CEDEN rows | 929 / 1,705 | Radius behavior is unchanged. |
| Samples stored | 3,543 in the latest sample batch; 19,637 total table rows | 9,228 deduped rows in the complete CEDEN replay | The existing table total remains 19,637 because no cleanup was performed. |
| Samples in correct 30-day window | 7 future rows in the poisoned window | 993 across 265 stations | The fixed SQL upper bound makes the seven rows harmless. |
| Beaches with non-unknown status | 1 `good`; 168 `unknown` in the latest 169-beach evaluation; 191 `unknown` of 192 historical rows | Approximately 118 CEDEN-linked beaches in a read-only full-map replay; 215 linked beach IDs is the current hard ceiling | This is an estimate, not a production evaluation result. It is about 34% of the ~346-beach catalog, with further coverage dependent on source freshness and station quality. |

The 118 estimate is deliberately conservative: the diagnosis found 96 distinct linked beaches before accounting for the station-page loss, while the full-map replay restores hidden station matches. It should be reported as approximately 118, not as a promise that all 346 beaches will receive a valid posting.

## Radius analysis

Read-only replay against 1,705 unique CEDEN stations and 167 CA beaches produced this curve:

| Radius | Matched stations | Match rate |
|---:|---:|---:|
| 1 km | 342 | 20.1% |
| 2 km | 627 | 36.8% |
| 3 km | 747 | 43.8% |
| 5 km | 929 | 54.5% |
| 10 km | 1,106 | 64.9% |
| 15 km | 1,253 | 73.5% |
| 20 km | 1,332 | 78.1% |

Recommendation: keep 5 km for now. Widening to 10 km would add 177 stations, but it also changes which station represents a beach and admits more inland, river, lagoon, Baja, and other non-posting sites. A coastal/recreational pre-filter would improve precision and make a future wider-radius experiment safer; it would not increase the raw 5 km numerator by itself. Build that filter as a shadow classification first, using source metadata and validated geography rather than station-name guesses.

## Production cleanup owner action

The WQ/DB owner should review and quarantine or remove the seven `2026-10-02` rows through an approved, reversible production cleanup procedure. This is still required for data hygiene and root-cause closure, but it is not required to restore evaluation correctness because the fixed evaluator excludes future dates. No cleanup was performed here.

The 3,674 legacy station rows also need a separate owner decision about deactivation or retention. That is not part of this fix and was not changed.

## Acceptance tests

Added `__tests__/lib/services/water-quality-sync-service.test.ts`:

- `processes every station across Supabase pages` — fails without station pagination because the second-page station is not matched.
- `rejects future CEDEN rows and reports the rejection count` — fails without ingest rejection and the structured counter.
- `anchors evaluation to UTC today and constrains the upper date bound` — fails with the old `MAX(sample_date)` anchor and without the SQL upper bound.

The cron route fixture was updated to carry `futureSamplesRejected: 0`.

