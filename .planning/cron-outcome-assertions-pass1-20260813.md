# Cron outcome assertions — Pass 1

## Delivered

`lib/cron/outcome.ts` exports:

```ts
withCronOutcome<T>(
  options: {
    job: string;
    unit: string;
    expectedMin: number;
    expectedMax?: number;
    getProduced: (result: T) => number;
    legitimatelyZero?: (result: T) => { reason: string } | undefined;
    failureReason?: (result: T) => string | null;
  },
  handler: () => Promise<T>,
): Promise<T>
```

The wrapper runs the handler, derives the produced count, and writes one `cron_runs` outcome
row containing the job, unit, produced count, minimum/maximum, status, timing, summary, and any
legitimate-zero reason. A below-minimum or above-maximum result becomes `failed` and emits an
error-level Sentry message. A handler exception is recorded as `error` and rethrown unchanged.
The handler's successful result is returned unchanged.

The unapplied migration is
`supabase/migrations/20260813180000_add_cron_outcome_assertions.sql`. Its first line is exactly
`-- UNAPPLIED FORWARD MIGRATION (2026-08-13)`, and it is wrapped in `BEGIN`/`COMMIT` with
`NOTIFY pgrst, 'reload schema'`. No migration was applied during this pass.

## Pass-1 jobs and minimums

The five requested jobs include three phase-specific water-quality outcomes. The forecast
ingestion family has four route entrypoints, but the primary, offset, and dispatch paths share
one runner and the CDIP path has a parallel runner; all use the same `forecasts_written` unit.

There is no per-cycle production history in this worktree, and no production query was run. The
incident figures in the specification are aggregate stranded rows, not a safe per-cycle
baseline. Therefore every enabled minimum starts at `1`, as required by the specification, and
should be tightened after two weeks of recorded outcomes.

| Job / phase | Outcome unit | Minimum | Legitimate zero | Derivation |
| --- | --- | ---: | --- | --- |
| `/api/cron/condition-alert-deliver` | `notifications_sent` | 1 | No due queue items; delivery-disabled flag | Counts `emailSent + pushSent`, the actual delivered notifications. Starts at 1 because no per-cycle baseline is available. |
| `/api/cron/condition-alert-evaluate` | `alerts_queued` | 1 | No actionable windows, with no evaluator errors or unresolved hold state | Counts `queued`, the rows delivered to the alert queue. A quiet evaluator cycle is explicitly explained rather than silently accepted. |
| `/api/cron/water-quality-sync?phase=stations` | `stations_synced` | 1 | None | Counts `stationsUpserted`; no safe per-cycle history is available. |
| `/api/cron/water-quality-sync?phase=samples` | `samples_stored` | 1 | None | Counts `samplesUpserted`; the reported 19,637 stranded samples are not a per-cycle baseline. |
| `/api/cron/water-quality-sync?phase=evaluate` | `beaches_evaluated` | 1 | None | Counts `beachesEvaluated`; no safe per-cycle history is available. |
| Enhanced forecast ingestion (primary, offset, dispatch) | `forecasts_written` | 1 | None | Counts the updater summary's `successful` forecasts for the selected shard. Starts at 1 pending observed history. |
| `/api/cron/enhanced-forecast-sync-cdip` | `forecasts_written` | 1 | None | Counts the CDIP updater summary's `successful` forecasts. Starts at 1 pending observed history. |
| `/api/cron/system-cards` | `cards_published` | 1 when enabled | `QUIVER_SYSTEM_CARDS_ENABLED=false` | Counts `summary.successful`. Cap exhaustion, no candidate, no forecast, duplicate, and failed insert remain failures; only the explicit disabled flag is legitimate zero. |

## Pre-migration behavior

`persistOutcome` catches a missing `cron_runs` table, missing outcome columns, or another outcome
insert failure, logs `[cron-outcome] could not persist outcome`, and returns control to the
cron. It does not convert a successful handler into a 500 and does not replace a handler error.
This is intentionally best-effort until the owner applies the migration. The handler result and
handler exception tests cover this deployment gap explicitly.

## Tests

`__tests__/lib/cron/outcome.test.ts` is failing-first and parameterized over the converted outcome
identities. For each identity it verifies:

- zero production returns the original result, inserts `status: "failed"`, and alerts through
  Sentry;
- `legitimatelyZero` inserts `status: "ok"` with its reason and emits no alert;
- an unavailable outcomes table logs and still returns the handler result; and
- a handler exception is rethrown as the same error.

Route tests retain their existing business assertions and add wiring guards for each unit. The
system-card route test exercises the disabled flag's successful, paused zero. The CDIP and
general forecast tests cover their shared runner wiring. No E2E tests were added; this is cron
handler/API unit coverage.

## Remaining route inventory for Passes 2 and 3

The following 42 route files were not named as separate Pass-1 targets. The remaining
enhanced-forecast aliases are listed for inventory completeness even though their shared runner
is already covered by the Pass-1 `forecasts_written` assertion; the CDIP path is likewise covered
by its parallel Pass-1 runner. They should not receive a second, conflicting assertion contract.

| Route | Suggested pass | Suggested unit |
| --- | --- | --- |
| `app/api/cron/android-tester-roster/route.ts` | 3 | `roster_rows_refreshed` |
| `app/api/cron/ccc-sync/route.ts` | 2 | `beach_matches_written` |
| `app/api/cron/cleanup-pending-alert-captures/route.ts` | 3 | `captures_deleted` |
| `app/api/cron/community-photo-retention/route.ts` | 3 | `photos_deleted` |
| `app/api/cron/county-beach-advisories/route.ts` | 2 | `advisories_synced` |
| `app/api/cron/daily-call-streak-reminder/route.ts` | 2 | `reminders_sent` |
| `app/api/cron/daily-intel/route.ts` | 2 | `intel_published` |
| `app/api/cron/earn-pro-evaluate/route.ts` | 2 | `rewards_evaluated` |
| `app/api/cron/enhanced-forecast-sync-cdip/route.ts` | 2* | `forecasts_written` |
| `app/api/cron/enhanced-forecast-sync-offset/route.ts` | 2* | `forecasts_written` |
| `app/api/cron/enhanced-forecast-sync/route.ts` | 2* | `forecasts_written` |
| `app/api/cron/first-session-nudge-push/route.ts` | 2 | `nudges_sent` |
| `app/api/cron/first-session-nudge/route.ts` | 2 | `nudges_sent` |
| `app/api/cron/forecasts/refresh/route.ts` | 2 | Source-specific: `marine_forecasts_written`, `tide_forecasts_written`, or `sun_events_written` |
| `app/api/cron/home-morning-call/route.ts` | 2 | `calls_sent` |
| `app/api/cron/indexnow-submit/route.ts` | 3 | `urls_submitted` |
| `app/api/cron/ioos-sync/route.ts` | 2 | `stations_synced` / `observations_stored` by phase |
| `app/api/cron/major-event-hold-evaluate/route.ts` | 2 | `holds_evaluated` |
| `app/api/cron/major-event-hold-retention/route.ts` | 3 | `rows_deleted` |
| `app/api/cron/morning-forecast-bot/route.ts` | 2 | `posts_published` |
| `app/api/cron/ndbc-direct-sync/route.ts` | 2 | `stations_synced` / `observations_upserted` by phase |
| `app/api/cron/notifications-deliver/route.ts` | 2 | `notifications_sent` |
| `app/api/cron/npc-activity/route.ts` | 2 | `posts_published` |
| `app/api/cron/reengagement-email/route.ts` | 2 | `emails_sent` |
| `app/api/cron/refresh-beach-traffic-weights/route.ts` | 3 | `weights_refreshed` |
| `app/api/cron/resolve-cam-thumbnails/route.ts` | 2 | `thumbnails_updated` |
| `app/api/cron/resolve-youtube-cams/route.ts` | 2 | `cams_updated` |
| `app/api/cron/session-prompt-email/route.ts` | 2 | `emails_sent` |
| `app/api/cron/similarity-alerts/route.ts` | 2 | `alerts_queued` |
| `app/api/cron/sitemap-health/route.ts` | 3 | `urls_probed` |
| `app/api/cron/swell-watch/route.ts` | 2 | `notifications_sent` |
| `app/api/cron/sync-buoys/route.ts` | 3 | `buoys_synced` |
| `app/api/cron/trial-ending-push-deliver/route.ts` | 2 | `notifications_sent` |
| `app/api/cron/update-buoy-conditions/route.ts` | 2 | `buoy_conditions_updated` |
| `app/api/cron/update-implicit-preferences/route.ts` | 3 | `events_deleted` |
| `app/api/cron/update-user-preferences/route.ts` | 2 | `preferences_updated` |
| `app/api/cron/water-quality-alerts/route.ts` | 2 | `notifications_sent` |
| `app/api/cron/weekend-window/route.ts` | 2 | `windows_evaluated` |
| `app/api/cron/weekly-recap-email/route.ts` | 2 | `emails_sent` |
| `app/api/cron/weekly-streak-reminder/route.ts` | 2 | `reminders_sent` |
| `app/api/cron/welcome-email/route.ts` | 2 | `emails_sent` |
| `app/api/cron/wind/update/route.ts` | 2 | `wind_rows_updated` |

`*` These aliases already share the Pass-1 forecast outcome implementation; the suggested Pass-2
follow-up is only to verify route-specific job identity and scheduling history, not to wrap the
same handler again.
