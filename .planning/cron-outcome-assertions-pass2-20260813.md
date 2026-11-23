# Cron outcome assertions — Pass 2

## Result

Pass 2 wraps the remaining Pass-2 jobs that produce user-visible data. It adds 29 route
entrypoints and 32 outcome units, including phase-specific outcomes for CCC, IOOS, and NDBC.
Every enabled assertion uses `expectedMin: 1`: this worktree has no trustworthy per-cycle
production history, and the incident totals are not safe per-cycle thresholds. Minimums should be
tightened after two weeks of recorded outcomes.

The outcomes migration remains unapplied. `lib/cron/outcome.ts` continues to degrade a missing
outcomes table to the existing warning log and does not change the cron result or error behavior.

Running inventory count, using Pass 1's stated baseline: **6/48 → 35/48**. Four enhanced-forecast
route aliases are already covered by the Pass-1 shared runner and were not wrapped a second time;
counting physical route entrypoints, Pass 1 plus Pass 2 cover 37/48.

## Wrapped jobs

All minimums below are `1`, derived from the absence of a safe per-cycle baseline. A legitimate
zero is declared only for an explicit disabled/quiet path; otherwise zero is recorded as failure.

| Job / phase | Unit | Outcome counted and legitimate zero | Failing-first test |
| --- | --- | --- | --- |
| `/api/cron/ccc-sync?phase=import` | `ccc_locations_written` | CCC locations upserted; zero only when the source is unchanged by ETag. | `Pass-2 cron outcome wiring › asserts the outcome for CCC import` |
| `/api/cron/ccc-sync?phase=match` | `beach_matches_written` | Beach matches written; no quiet zero declared. | `Pass-2 cron outcome wiring › asserts the outcome for CCC match` |
| `/api/cron/county-beach-advisories` | `advisories_synced` | Records in the successful ingest summary; skipped ingest is legitimate zero. | `… county advisories` |
| `/api/cron/daily-call-streak-reminder` | `reminders_sent` | Notifications actually sent; disabled/no-candidate paths are legitimate zero. | `… daily call streak reminder` |
| `/api/cron/daily-intel` | `intel_published` | Successful intel publications; no processed candidates is legitimate zero. | `… daily intel` |
| `/api/cron/earn-pro-evaluate` | `rewards_evaluated` | Evaluated reward candidates; disabled flag, empty allowlist, or no candidates are legitimate zero. | `… earned Pro evaluation` |
| `/api/cron/first-session-nudge` | `nudges_sent` | Email nudges sent; no eligible candidates is legitimate zero. | `… first-session email nudge` |
| `/api/cron/first-session-nudge-push` | `nudges_sent` | Push nudges sent; no eligible candidates is legitimate zero. | `… first-session push nudge` |
| `/api/cron/forecasts/refresh` | `marine_forecasts_written`, `tide_forecasts_written`, `sun_events_written`, or `forecast_rows_written` | Source-specific forecast rows written; no targeted beaches is legitimate zero. | `… forecast refresh` |
| `/api/cron/home-morning-call` | `calls_sent` | Calls sent; disabled/no-candidate paths are legitimate zero. | `… home morning call` |
| `/api/cron/ioos-sync?phase=stations` | `stations_synced` | Stations upserted; zero remains a failure. | `… IOOS stations` |
| `/api/cron/ioos-sync?phase=observations` | `observations_stored` | Observations inserted; zero remains a failure. | `… IOOS observations` |
| `/api/cron/major-event-hold-evaluate` | `holds_evaluated` | Fresh high-risk source rows evaluated; no fresh source rows is legitimate zero. | `… major-event hold evaluation` |
| `/api/cron/morning-forecast-bot` | `posts_published` | Successful posts; this legacy route's disabled path is legitimate zero. | `… morning forecast bot` |
| `/api/cron/ndbc-direct-sync?phase=stations` | `stations_synced` | Stations upserted; zero remains a failure. | `… NDBC stations` |
| `/api/cron/ndbc-direct-sync?phase=observations` | `observations_upserted` | Observations upserted; zero remains a failure. | `… NDBC observations` |
| `/api/cron/notifications-deliver` | `notifications_sent` | Notifications with `sent` status; no pending events is legitimate zero. | `… notification delivery` |
| `/api/cron/npc-activity` | `posts_published` | Successful NPC posts; disabled/no selected NPCs are legitimate zero. | `… NPC activity` |
| `/api/cron/reengagement-email` | `emails_sent` | Emails sent; the intentionally retired route declares legitimate zero. | `… retired re-engagement email` |
| `/api/cron/resolve-cam-thumbnails` | `thumbnails_updated` | Thumbnails updated; no missing thumbnails is legitimate zero. | `… camera thumbnails` |
| `/api/cron/resolve-youtube-cams` | `cams_updated` | Camera rows updated; missing configuration/no work is legitimate zero. | `… YouTube cameras` |
| `/api/cron/session-prompt-email` | `emails_sent` | Session-prompt emails sent; no eligible candidates is legitimate zero. | `… session prompt email` |
| `/api/cron/similarity-alerts` | `alerts_queued` | Alerts enqueued; delivery disabled, no eligible users, or no matching window without errors is legitimate zero. | `… similarity alerts` |
| `/api/cron/trial-ending-push-deliver` | `notifications_sent` | Trial-ending notifications sent; no eligible trial users is legitimate zero. | `… trial-ending push` |
| `/api/cron/update-buoy-conditions` | `buoy_conditions_updated` | Buoy condition rows updated; no active buoys or all active buoys having no data is legitimate zero. | `… buoy conditions` |
| `/api/cron/update-user-preferences` | `preferences_updated` | Preference updates succeeding; no users with rated history is legitimate zero. | `… user preferences` |
| `/api/cron/water-quality-alerts` | `notifications_sent` | Water-quality notifications sent; no beaches with changes is legitimate zero. | `… water-quality alerts` |
| `/api/cron/weekend-window` | `windows_evaluated` | Weekend candidates evaluated; disabled/no candidates is legitimate zero. | `… weekend window` |
| `/api/cron/weekly-recap-email` | `emails_sent` | Recap emails sent; no active users is legitimate zero. | `… weekly recap email` |
| `/api/cron/weekly-streak-reminder` | `reminders_sent` | Streak reminders sent; no eligible candidates is legitimate zero. | `… weekly streak reminder` |
| `/api/cron/welcome-email` | `emails_sent` | Welcome emails sent; no eligible candidates is legitimate zero. | `… welcome email` |
| `/api/cron/wind/update` | `wind_rows_updated` | Wind rows updated; zero remains a failure. | `… wind update` |

The test names abbreviated with `…` above are parameterized cases in
`__tests__/app/api/cron/cron-outcome-wiring.test.ts`; the full case names are:

`CCC import`, `CCC match`, `county advisories`, `daily call streak reminder`, `daily intel`,
`earned Pro evaluation`, `first-session email nudge`, `first-session push nudge`, `forecast
refresh`, `home morning call`, `IOOS stations`, `IOOS observations`, `major-event hold
evaluation`, `morning forecast bot`, `NDBC stations`, `NDBC observations`, `notification delivery`,
`NPC activity`, `retired re-engagement email`, `camera thumbnails`, `YouTube cameras`, `session
prompt email`, `similarity alerts`, `trial-ending push`, `buoy conditions`, `user preferences`,
`water-quality alerts`, `weekend window`, `weekly recap email`, `weekly streak reminder`, `welcome
email`, and `wind update`.

Each case reads the route source and requires its outcome unit, `expectedMin: 1`, and the actual
`withCronOutcome` call (or the runner's injected outcome configuration). Removing the assertion
fails the corresponding case. Existing route assertions were retained; affected tests mock the
best-effort outcome persistence so their business assertions remain isolated.

## Deferred to Pass 3

These 11 physical routes remain intentionally unwrapped. They are maintenance, diagnostic,
shadow-only, or internal reference-data jobs rather than jobs whose primary successful output is
user-visible product data:

| Route | Reason |
| --- | --- |
| `/api/cron/android-tester-roster` | Internal tester-roster maintenance; not a user-facing delivery. |
| `/api/cron/cleanup-pending-alert-captures` | Expired-row cleanup; deletion is maintenance rather than a user-visible production output. |
| `/api/cron/community-photo-retention` | Destructive photo retention; requires a separate deletion/retention outcome contract. |
| `/api/cron/indexnow-submit` | External search-index submission, not application user data. |
| `/api/cron/major-event-hold-retention` | Destructive hold-history retention; separate from hold evaluation. |
| `/api/cron/refresh-beach-traffic-weights` | Internal analytics/recommendation weights. |
| `/api/cron/session-video-retention` | Destructive media retention; separate cleanup semantics and safety review. |
| `/api/cron/sitemap-health` | Diagnostic URL probing; it does not write user-visible data. |
| `/api/cron/swell-watch` | Shadow evaluation only; it explicitly never queues or sends notifications. |
| `/api/cron/sync-buoys` | Internal NOAA reference-data sync feeding downstream jobs; defer with the remaining infrastructure syncs. |
| `/api/cron/update-implicit-preferences` | Internal preference-event cleanup/model state, not a direct user-visible write. |

The enhanced forecast aliases (`enhanced-forecast-sync`, `-offset`, `-dispatch`, and `-cdip`) are
not deferred: their shared runners already carry the Pass-1 `forecasts_written` assertion.
