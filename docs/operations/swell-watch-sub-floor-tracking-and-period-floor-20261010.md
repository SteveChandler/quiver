# Swell Watch study amendment: sub-floor tracking and a 9 s period floor (proposed, 2026-10-10)

Status: **ships as inert code; nothing applied.** The migration, both activation scripts and the production
`SWELL_WATCH_PRODUCER_CONFIG` change each need Steven's approval. Until then production behaves exactly as epoch 6.

## What changes

1. **Sub-floor tracking** (authority-bound, `tracking_mode = 'sub_floor_tracking.v1'`). Today an event is persisted only
   while its arrival is between `minimum_days_before_arrival` (2 d) and `maximum_days_before_arrival` (5 d). After that
   nothing is recorded, so the newest prediction of a swell is 2-3 days stale when it arrives. With tracking enabled, every
   hourly study evaluation also records, as a top-level `trackingMode` / `trackingEvents` field of the retained study
   result, each swell that is below the floor and has not yet passed: updated arrival (and window), peak time, height, period,
   direction, projected face height, phase (`approaching` or `in_progress`) and closure window. Tracking rows are never
   evaluations, candidates, qualifying-day inputs, stability counts or sends: they bypass `ingest_swell_watch_cohort`,
   `swell_watch_event_impacts` and matching entirely, and the result's `scopeOutcomes`, `candidateCount` and demand fields are computed
   exactly as before.
2. **Period floor** (policy-bound, `partition_matching.minimum_period_s = 9`). A partition with period below 9 s is treated as
   non-impactful (new suppression reason `below_period_floor`, handled like `non_impactful`): it can no longer open an
   episode, so wind sea is not tracked as swell. The 48 h baseline is deliberately unchanged (see "Decisions left open").

## Why (accuracy scorecard evidence)

- Every study timing error is late-biased: buoy onset came 14-59 h before the predicted arrival (Steamer Lane event issued
  once, 2026-09-28T18Z, for arrival 10-01T10Z; the buoy peaked 09-30T12Z). Persistence stops at the floor, so the study never
  sees the forecast converge on the true arrival.
- At Cape Hatteras the study tracks 6-7 s components as swells (6.3 s for 10-08; four overlapping ids near 7 s for 10-11/12).
  Against the buoy swell partition (NDBC SwH) those events show about 0.1 m rise, which is wind chop. HB Pier North predicted
  7.2 s against 12.5 s observed.
- In the retained 2026-09-09T18Z attested replay (10 feeds) the only persisted event is a 8.5 s partition, and a second feed is
  suppressed as `unbounded_episode` by a short-period partition appearing mid-series. Under the 9 s floor the 8.5 s event is
  not persisted and that feed derives cleanly (`sub-floor-tracking-replay.test.ts` pins the unchanged-by-default half of this).

## How tracking is derived (and a finding)

The approved detector measures a swell's rise against the maximum height/energy in the first 48 h of the same issuance.
Anything arriving inside 48 h is therefore already part of its own baseline and can never qualify, so re-running the same
derivation below the floor would return nothing. Tracking instead judges each partition track against the *other*
in-window partitions of that 48 h (its own samples excluded), using the same physical thresholds. It is a separate, pure,
non-throwing pass after the approved derivation: it cannot change whether a scope derives, nor any event. Rows are capped
at 10 per feed and 100 per result (the record function enforces 100; the 128 KiB result cap has wide headroom, max today 9.7 KB).

Rows are not linked to the original `regional_event_id`. The scorecard should join on feed + the policy tolerances already
used for matching (direction 25 deg, period 2 s, arrival 6 h).

## How it is gated (production unchanged until activation)

- App: `readSwellWatchStudyStatus` reads `trackingMode` from `read_swell_watch_study_health()` and defaults to `none` when
  the key is absent. Cron, study and shadow code pass the mode only when it is `sub_floor_tracking.v1`; for `none` every call
  site, argument list, persisted RPC payload and result key is identical to before (no tracking key is added, including
  `trackingEvents: []`). The period floor is read from the policy; an absent `minimum_period_s` keeps today's behaviour and
  today's policy hash (`86616945...`).
- Database (`supabase/migrations/20261010120000_add_swell_watch_study_sub_floor_tracking.sql`, hash-guarded against
  production's current definitions): adds `swell_watch_study_authorities.tracking_mode` (default `none`); binds it into
  `config_hash` only when non-default (epochs 1-6 validate byte-for-byte); exposes it in study health; makes
  `record_swell_watch_study_evaluation` reject tracking keys under a `none` authority and require a well-formed array bound to
  derived scopes under a tracking authority. `swell_watch_study_cycle_start` and send controls are untouched.
- Proof: all 356 pre-existing swell-watch Jest tests pass with zero edits; the retained replay produces byte-identical
  `ingest_swell_watch_cohort` payloads, scope outcomes and derivation with tracking on and off; the disposable-PostgreSQL
  harness (`scripts/test-swell-watch-tracking-postgres.sh`, wired into `.github/workflows/swell-watch-normalization.yml`)
  re-runs the entire existing study probe after the migration, proves the record-function gate, rollback, idempotence and both
  activation scripts.

## Cost: the qualifying-day counter

Currently 9 of 30 days (best feed; cycle start epoch 5, 2026-09-16; 9 qualifying dates in 23 days, about 0.39 per day).

- **Tracking alone does not reset it.** `swell_watch_study_cycle_start` breaks a cycle only on a change of `policy_hash`,
  `qualification_rule`, `cohort`, `scope_inputs` or `target_days`. Epoch 7 keeps all five, exactly as the epoch 5 to 6
  extension did (cycle start stayed 5). The disposable harness asserts this.
- **The period floor does reset it, to 0 of 30.** Adding `minimum_period_s` changes the policy hash (`86616945...` to
  `f5535096...`), so epoch 8 starts a new cycle, and health counts only evaluations under the authority's policy hash. This is
  the intended precedent behaviour: a detection-definition change makes earlier qualifying days non-comparable. One in-flight
  issuance is also skipped once (`issuance_accepted_under_previous_epoch`) at each epoch switch.
- **Runway.** Study expiry is 2026-12-31. Activating around 2026-10-12 leaves about 80 days; at the current 0.39 days per day
  that is about 31 qualifying days, i.e. no margin. The 9 s floor should raise the yield (it removes the wind-sea
  `unbounded_episode` suppressions seen at Hatteras-type feeds), but that is an expectation, not a measurement.
- Options for Steven: (a) tracking only, now (no reset, starts collecting the missing late data immediately); (b) tracking
  then period floor (reset at the floor); (c) the floor alone is not offered: tracking is the cheap, reversible half and
  the floor script requires epoch 7, so activate tracking first regardless.

## Activation (all steps need Steven; none has been run)

1. Merge this PR and deploy the app (inert: no health key, no tracking, no floor).
2. Apply `supabase/migrations/20261010120000_add_swell_watch_study_sub_floor_tracking.sql` with the production owner connection.
3. Fill in the approval sentence and run `docs/operations/swell-watch-study-amend-tracking.sql` (epoch 7). Both activation
   scripts raise `approval evidence not recorded` until the `<<FILL AT APPROVAL ...>>` placeholder is replaced; the evidence text
   is hashed at execution, so the final wording is the approval record.
4. Optionally, later: set `SWELL_WATCH_PRODUCER_CONFIG` to the policy in
   `docs/operations/swell-watch-no-send-producer-config-v3-proposed.json` (hash `f5535096...`, `pending_review`), redeploy, and
   run `docs/operations/swell-watch-study-amend-period-floor.sql` (policy epoch 4 plus authority epoch 8, one transaction).
   The code must be deployed first, or a v3 config would run without applying the floor. Between the env change and the SQL
   (or vice versa) the acquire cron returns 503 `study_config_hash_mismatch` before writing anything.
5. Rollback: `swell-watch-study-revoke-period-floor.sql` / `swell-watch-study-revoke-tracking.sql` (revocation blocks the study
   until a reviewed re-activation), then `swell-watch-study-sub-floor-tracking-rollback.sql` (restores the three function bodies
   exactly; refuses while a tracking authority is active). Reverting the policy hash needs its own amendment.

## Decisions left open

- Whether the 9 s floor should also exclude sub-9 s partitions from the 48 h baseline. Left unchanged: a feed whose first 48 h
  holds only wind sea would otherwise fail with `missing_baseline` and lose its qualifying day.
- Whether tracking should be linked to persisted event ids (needs a history read) or stay a scorecard-side join.
- Whether the reset at the floor is worth taking before the study has a chance of finishing; option (a) above postpones it
  without cost.
