# Swell Watch boundary deferral — 2026-09-20

Arrival windows use the previous native frame and first candidate frame. Native steps are hourly through 120 hours and three-hourly thereafter, while actionability is measured from evaluation time. In v2, a window crossing either the two-day minimum or five-day maximum threw `arrival_window_crosses_actionability`; the exception suppressed its scope and the entire ten-beach cohort.

Production evidence supplied for this fix: `swell_watch_study_evaluations`, epochs 5–6, had 7 of 17 runs voided across 5 source points. Requiring all four issuance cycles for a qualifying day therefore penalized days with inbound swell. This evidence was not re-queried during implementation. The impact evaluator separately gates the persisted point estimate, `arrivalAt = arrivalWindow.latestAt`.

## v3 semantics

`swell-watch-horizon-derivation.v3` explicitly defers an episode whose arrival window crosses one boundary. It emits no event for that episode, never treats it as passing, and continues evaluating other episodes. The derivation records `boundaryDeferrals: [{ boundary: "minimum" | "maximum", sourceSlot, arrivalWindow: { earliestAt, latestAt } }]`, ordered by `latestAt`, then `sourceSlot`; no deferrals produces `[]`. Cohort/shadow results retain these records at `derivation.scopes[]` alongside `partitionCoverage`.

A deferred episode is non-actionable throughout its loop: unobserved onset, unbounded onset, unclosed episode, and unavailable-partition interruption checks do not suppress the run for it. A window crossing both boundaries still throws `arrival_window_crosses_actionability`. Other validation remains unchanged. This scopes the historical requirement for explicit suppression to the episode; the September 13 release document remains historical.

The repository SQL accepts this additional derivation key without a migration. No database was accessed or migration written/applied. See the [implementation report](../../.planning/2026-09-20-swell-watch-boundary-deferral/REPORT.md) for validation and source evidence.

## OPEN DECISIONS

- Founder: decide how to separate v2 and v3 study cycles before rollout. A new authority epoch is advisable for provenance but alone does not separate results: `swell_watch_study_cycle_start` joins adjacent active epochs with matching policy, qualification rule, cohort, scope inputs, and target days, ignoring derivation version. A separately reviewed cycle break or version-aware cycle contract is needed if mixed versions must be excluded.
- Database integration remains unverified at runtime: the normalization script requires PostgreSQL and applies migrations, so it was updated but not run. Live schema parity, deployment behavior, and the supplied production counts were not verified in this database-free task.
