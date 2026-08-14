# Cron outcome assertions — Pass 3

## Result

Pass 3 adds outcome assertions to six of the eleven deferred routes. Five routes are deliberately
left unwrapped because their current output is either privacy-sensitive maintenance, destructive
retention with multiple independent stages, an existing diagnostic signal, or shadow-only
evaluation. The four enhanced-forecast aliases already inherit the `forecasts_written` assertion
from their shared runners; they were verified here and were not wrapped a second time.

All new minimums are `expectedMin: 1`. No trustworthy per-cycle production history is available in
this worktree, so the minimums are detection floors rather than throughput SLOs. The outcomes
migration remains unapplied; the shared helper still degrades a missing outcomes table to its
existing warning log without changing the cron result.

## Final tally

The 48 physical route entrypoints are accounted for as follows:

- **43 wrapped:** 39 route files call `withCronOutcome` directly, and the four enhanced-forecast
  aliases use one of the already-wrapped shared runners.
- **33 wrapped route files have an explicit legitimate-zero branch:** this includes prior Pass 1
  and Pass 2 contracts plus four of the six new Pass 3 contracts. Legitimate zero is a property of
  a wrapped outcome, so this category overlaps with “wrapped.”
- **5 deliberately unwrapped:** these are the explicit no-wrap decisions below. Thus the
  mutually exclusive route-entrypoint tally is **43 wrapped + 5 deliberately unwrapped = 48**.

The 33 previously wrapped route files and their per-job reasons remain documented in the [Pass 1
report](./cron-outcome-assertions-pass1-20260813.md) and [Pass 2 report](./cron-outcome-assertions-pass2-20260813.md).

## Pass 3 decisions

| Route | Decision | Outcome / minimum | Reason |
| --- | --- | --- | --- |
| `/api/cron/android-tester-roster` | Deliberately unwrapped | — | Internal, privacy-sensitive roster reconciliation has independent purge and Google-sync branches, disabled flags, busy claims, and incomplete snapshots. There is no single stable primary count without creating a new roster-maintenance contract. |
| `/api/cron/cleanup-pending-alert-captures` | Wrapped; legitimate zero | `captures_deleted`, 1 | Deletion is the meaningful maintenance effect. Zero is normal when no expired, unconsumed captures exist, and is recorded with that reason. |
| `/api/cron/community-photo-retention` | Deliberately unwrapped | — | Destructive retention has stuck-upload cleanup, orphan-object cleanup, and removed-photo finalization. A single deletion count could pass while one stage is broken; keep the separate retention/safety contract until it is defined. |
| `/api/cron/enhanced-forecast-sync` | Already wrapped through shared runner | `forecasts_written`, 1 | The canonical shared runner records the request pathname as the job, so this entrypoint already has a route-specific outcome. |
| `/api/cron/enhanced-forecast-sync-offset` | Already wrapped through shared runner | `forecasts_written`, 1 | Same shared-runner contract; no duplicate assertion. |
| `/api/cron/enhanced-forecast-sync-dispatch` | Already wrapped through shared runner | `forecasts_written`, 1 | Same shared-runner contract, including the resolved shard. |
| `/api/cron/enhanced-forecast-sync-cdip` | Already wrapped through CDIP shared runner | `forecasts_written`, 1 | CDIP runner records the fixed CDIP route identity; no duplicate assertion. |
| `/api/cron/indexnow-submit` | Wrapped; zero fails | `urls_submitted`, 1 | The job exists to submit the site’s URL set to IndexNow. A zero submission is suspicious, including an all-pending response; no routine legitimate-zero branch is declared. |
| `/api/cron/major-event-hold-retention` | Wrapped; legitimate zero | `rows_deleted`, 1 | Retention is healthy when there are no expired regional hold rows. That normal zero is recorded explicitly. |
| `/api/cron/refresh-beach-traffic-weights` | Wrapped; legitimate zero | `weights_refreshed`, 1 | Counts materialized beach weights. Zero is normal only when there are no active beaches to refresh. |
| `/api/cron/session-video-retention` | Deliberately unwrapped | — | Destructive storage cleanup has separate scan, orphan, delete, and failure semantics. It needs a retention-specific contract rather than a broad “videos deleted” count. |
| `/api/cron/sitemap-health` | Deliberately unwrapped | — | This diagnostic already alerts on an empty sitemap and non-2xx probes through its dedicated Sentry check-in. Probed URL count is not a production-data outcome. |
| `/api/cron/swell-watch` | Deliberately unwrapped | — | Explicit shadow-only evaluation; it never queues or sends notifications and zero matches is expected. Existing `swell-watch` observability remains the appropriate signal. |
| `/api/cron/sync-buoys` | Wrapped; zero fails | `buoys_synced`, 1 | The NOAA reference-data sync should successfully upsert at least one relevant buoy in a normal run. A zero result is a silent infrastructure failure, not a quiet user cycle. |
| `/api/cron/update-implicit-preferences` | Wrapped; legitimate zero | `preferences_recomputed`, 1 | Counts users whose implicit preferences were recomputed. Zero is normal when no users have eligible events; expired-event cleanup remains visible in the response but is not used as a proxy for preference recomputation. |

## Minimums to revisit after two weeks

Use recorded outcome rows, split by phase and shard, before raising any floor:

- Forecast, water-quality, CCC, IOOS, NDBC, wind, buoy, and traffic-weight refreshes: derive a
  low-percentile normal floor from successful cycles and keep “no eligible input” as an explicit
  legitimate-zero condition where applicable.
- Notification, email, push, call, and alert-delivery jobs: condition the floor on eligible
  candidates or due queue items; do not turn quiet cycles into false alarms.
- Evaluation and preference jobs: compare produced counts to their input populations, especially
  `preferences_recomputed`, `holds_evaluated`, `alerts_queued`, and `beaches_evaluated`.
- IndexNow and cleanup/retention jobs: tighten `urls_submitted` from observed submission history,
  but keep deletion minimums at explicit legitimate zero unless retention policy establishes a
  required backlog drain.

## Verification

The new route wiring tests fail if a route’s outcome unit or assertion is removed. The shared
outcome matrix covers zero failure, legitimate-zero recording, missing-table degradation, and
handler rethrow for all six new identities. No migrations were applied and `quiver-native/` was not
read or changed.
