# Track B Session Acquisition Instrumentation Report

Generated: 2026-06-20T12:55:32.462Z
Window: 2026-05-21T12:55:31.875Z to 2026-06-20T12:55:31.875Z (30 days)

## Summary

- Stored session-log event rows: 274
- Saved completed sessions: 31 from 14 users
- Rated completed sessions: 31 from 14 users
- Face-height truth sessions: 31 from 14 users
- Rated face-height truth sessions: 31 from 14 users
- Users with 5+ rated sessions in lifetime scope: 4

Track B conclusion: the bottleneck is still session acquisition, not model math. The last 30 days produced 70 new real profiles but only 14 users with a rated session in the window, and only 4 scoped users have reached the 5-rated-session threshold needed for stronger personalization and held-out session-fit evaluation.

## Actor-Deduped Funnel

| Step | Actors | Of start | From previous |
| --- | ---: | ---: | ---: |
| Form started | 34 | 100.0% | n/a |
| Beach selected event | 0 | 0.0% | 0.0% |
| Conditions set event | 0 | 0.0% | n/a |
| Rating set event | 15 | 44.1% | n/a |
| Stored submit event | 14 | 41.2% | 93.3% |
| Saved completed session | 14 | 41.2% | 100.0% |
| Rated completed session | 14 | 41.2% | 100.0% |
| Rated face-height truth session | 14 | 41.2% | 100.0% |

The beach-selected and conditions-set steps are not true product drop-offs in this historical window. Current native code now emits `session_log_beach_selected` when a route-prefilled or manually selected beach becomes active, and `session_log_conditions_set` once a form has explicit wave height, wave quality, and crowd-level feedback. Signed-in native analytics stamps `app_version` and `app_build` on stored events, preferring `expo-application` standalone runtime metadata before falling back to Expo constants. The latest 7-day telemetry window still shows no native beach-selected/conditions-set coverage and all recent native starts are unknown-version/unknown-build, so the current collected traffic is still pre-instrumentation or pre-adoption traffic for those event paths; verify migration, native deployment, and build adoption before treating this as product abandonment.

## Durable Session Signal

| Metric | Count |
| --- | ---: |
| Completed sessions | 31 |
| Rated sessions | 31 |
| Face-height truth sessions | 31 |
| Rated face-height truth sessions | 31 |
| Abandon actors | 23 |
| Validation-failed actors | 10 |

Durable conversion should be read from `sessions`, not submit events alone. Native first sessions emit `first_session_logged` instead of `session_log_submit`, and the report treats both as stored submit telemetry while using saved `sessions` as conversion truth.

## Activation

| Metric | Count |
| --- | ---: |
| Users with 1+ rated session in window | 14 |
| Users with 3+ rated sessions in window | 3 |
| Users with 5+ rated sessions in window | 2 |
| Users with 5+ rated sessions in lifetime scope | 4 |
| Median days to 5th rating | 13.5 |
| P75 days to 5th rating | 14.3 |

## Readiness Gate

Default criteria:

- Rated sessions `>=100`
- Rated-session users `>=25`
- Users with 5+ rated sessions `>=25`
- Rated face-height truth sessions `>=75`
- Beach-selected event coverage `>=80%`
- Conditions-set event coverage `>=80%`
- Submit-event coverage `>=80%`
- Recent app version/build metadata coverage `>=80%`
- When the recent telemetry window is narrower than the report window, recent beach-selected, conditions-set, and submit-event coverage must also clear the same floors.
- Optional expected recent client builds: every named build must have at least one recent `session_log_start` actor.

Current verdict: `not-ready`.

Current observed values: 31 rated sessions, 14 rated-session users, 4 users with 5+ rated sessions, 31 face-height truth sessions, 31 rated face-height truth sessions, 0.0% beach-selected event coverage, 0.0% conditions-set event coverage, 100.0% submit-event coverage, 0.0% recent beach-selected coverage, 0.0% recent conditions-set coverage, 37.5% recent submit-event coverage, and 0.0% recent app version/build metadata coverage.

`--fail-on-not-ready` exits `2` for automation while still printing the aggregate report.
The readiness JSON now also emits `readiness.findingCodes`, a stable machine-readable companion to the human-readable `readiness.findings`.

Expected-build adoption check:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/session-acquisition-funnel-report.ts --days 30 --recent-telemetry-days 7 --expect-recent-client-build native-ios,1.0.1,11 --expect-recent-client-build native-android,1.0.1,11 --output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --fail-on-not-ready
```

Latest read-only schema-v2 result generated at `2026-06-20T12:55:32.462Z`: exits `2` as expected. Recent telemetry has 0 start actors for `native-ios / 1.0.1 / 11` and 0 start actors for `native-android / 1.0.1 / 11`; all recent native starts remain `unknown-version / unknown-build`. The stricter readiness gate also fails current 7-day recent telemetry because beach-selected coverage is 0.0%, conditions-set coverage is 0.0%, and submit-event coverage is 37.5%. This keeps Track B from treating stale broader-window coverage as proof that the instrumented build is healthy.

Saved-artifact validation:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn tsx scripts/session-acquisition-funnel-report.ts --validate-output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --max-report-age-hours 24
```

Result: PASS. The JSON artifact carries `reportSchemaVersion: 2`. The validator rejects stale reports, stale measured or recent-telemetry windows, malformed aggregate counts/rates, UUID leakage, non-canonical validation-failure code evidence, validation-failure actor counts above event counts, validation-failure platform totals that do not reconcile to event counts, and readiness blocks that are not derived from the report's own counts, criteria, telemetry coverage, expected build list, and recent telemetry window.
It also rejects top-level telemetry coverage that no longer reconciles to the funnel, coverage rows where `*ActorsWithStart` exceeds the source actor count, build-metadata unknown actors exceed starts, or stored coverage rates no longer reconcile to the actor counts.
Current artifact SHA-256: `91b61351d5f130d17286f838879fb1f6418e32e6ccd484f5461652c339fa6292`.

Current readiness finding codes: `rated_sessions_floor`, `rated_session_users_floor`, `five_rated_session_users_floor`, `rated_face_height_truth_sessions_floor`, `beach_selected_coverage_floor`, `conditions_set_coverage_floor`, `recent_beach_selected_coverage_floor`, `recent_conditions_set_coverage_floor`, `recent_submit_event_coverage_floor`, `recent_build_metadata_coverage_floor`, and `expected_recent_client_build_missing` for both expected native builds.

## Onboarding Fuel

| Metric | Count | Rate |
| --- | ---: | ---: |
| New real profiles | 70 | 100.0% |
| Completed onboarding | 51 | 72.9% |
| Home beach set | 48 | 68.6% |
| Experience level set | 52 | 74.3% |
| Activity level set | 0 | 0.0% |
| Surf styles set | 19 | 27.1% |
| Preferred session time set | 6 | 8.6% |
| Timezone set | 56 | 80.0% |

## Stored Event Counts

| Event type | Count |
| --- | ---: |
| session_log_start | 109 |
| session_log_rating_set | 64 |
| session_log_abandon | 40 |
| session_log_validation_failed | 29 |
| session_log_submit | 23 |
| first_session_logged | 9 |

## Event Platform Counts

| Platform | Count |
| --- | ---: |
| native-ios | 232 |
| native-android | 42 |

## Telemetry Coverage By Platform

| Platform | Start actors | Beach-selected actors | Beach-selected of start | Conditions-set actors | Conditions-set of start | Submit actors | Submit of start |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| native-ios | 34 | 0 | 0.0% | 0 | 0.0% | 13 | 38.2% |
| native-android | 1 | 0 | 0.0% | 0 | 0.0% | 1 | 100.0% |

This split is the actionable Track B diagnostic. The 30-day beach-selected coverage gap is concentrated in native event traffic, especially `native-ios`. Conditions-set coverage is 0.0% because this event is newly prepared and has not yet been allowed/deployed in production. Treat the aggregate values as instrumentation/deploy-adoption gaps, not proven product drop-offs.

## Recent Telemetry Window

The report now includes a configurable recent telemetry window (`--recent-telemetry-days`, default 7) so Track B can distinguish stale historical telemetry from current client behavior.

Latest 7-day read-only rerun:

Window: `2026-06-13T12:55:31.875Z` to `2026-06-20T12:55:31.875Z`

| Metric | Count / Rate |
| --- | ---: |
| Event rows | 125 |
| Start actors | 24 |
| Start actors without version/build metadata | 24 |
| Beach-selected of start | 0.0% |
| Conditions-set of start | 0.0% |
| Submit event of start | 37.5% |

| Platform | Start actors | Beach-selected of start | Conditions-set of start | Submit of start |
| --- | ---: | ---: | ---: | ---: |
| `native-ios` | 24 | 0.0% | 0.0% | 33.3% |
| `native-android` | 1 | 0.0% | 0.0% | 100.0% |

| Client build | Start actors | Beach-selected of start | Conditions-set of start | Submit of start |
| --- | ---: | ---: | ---: | ---: |
| `native-ios / unknown-version / unknown-build` | 24 | 0.0% | 0.0% | 33.3% |
| `native-android / unknown-version / unknown-build` | 1 | 0.0% | 0.0% | 100.0% |

Conclusion: recent collected native traffic still does not show `session_log_beach_selected`, `session_log_conditions_set`, or signed-in app version/build metadata, and recent submit coverage is only 37.5%. The readiness gate now blocks on both build-adoption proof and recent-window event coverage. The saved-artifact validator now also fails closed if a stale or hand-edited JSON claims otherwise, including hand-edited validation-failure code rows that are raw prose, count-inconsistent, or platform-total-inconsistent. The next Track B action is applying the event allowlist migration, confirming the instrumented native build is deployed/adopted, and then rerunning the same report. It is not evidence to loosen validation or infer session-form product abandonment.

## Validation Failure Codes

The report now aggregates stable validation error codes without rendering raw user or session identifiers. Codes are checked against the native `SessionFormErrorCode` allowlist; drifted stable-looking codes are grouped as `unknown_code:*`, and raw prose is grouped as `unrecognized`. Schema-v2 saved-artifact validation requires those sanitized codes and internally consistent event/actor/platform counts. Latest read-only rerun:

| Error code | Events | Actors | Top platform |
| --- | ---: | ---: | --- |
| `wave_quality_required` | 25 | 9 | `native-ios` (21) |
| `crowd_level_required` | 15 | 8 | `native-ios` (15) |
| `rating_required` | 13 | 7 | `native-ios` (13) |
| `wave_height_required` | 13 | 7 | `native-ios` (13) |
| `beach_required` | 3 | 3 | `native-ios` (3) |
| `future_date` | 1 | 1 | `native-android` (1) |

The validation-failure bottleneck is concentrated in required quality/rating fields, not beach selection alone. Treat this as product-copy/default-state evidence before changing validation rules.

## Session Source Counts

| Source | Count |
| --- | ---: |
| manual | 30 |
| unknown | 1 |

## Verification Update

Verified on 2026-06-19, with native Track B verification refreshed on 2026-06-20:

- `quiver-native/src/screens/session-form.tsx` emits `session_log_beach_selected` once per selected `beachId`.
- `quiver-native/src/screens/session-form.tsx` emits `session_log_conditions_set` once per form after explicit wave height, wave quality, and crowd-level feedback.
- Route-prefilled beaches and manual beach picker selections are covered by `src/__tests__/session-form-screen.test.tsx`.
- `src/lib/analytics.ts` allowlists `session_log_beach_selected` and lifts `beach_id` out of metadata.
- `src/lib/analytics.ts` allowlists `session_log_conditions_set`.
- `src/lib/analytics.ts` stamps signed-in analytics with `app_version` and `app_build`, preferring `expo-application` runtime metadata, so Track B can verify build adoption.
- `supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql` prepares the database CHECK constraint widening required before a native build emits the new event.
- `scripts/db/track-b-session-acquisition-event-preflight.sql` now provides the read-only approval preflight for that CHECK widening.
- `scripts/db/track-b-session-acquisition-event-postflight.sql` now provides the read-only postflight after an approved apply.
- The migration now fails before mutating `public.user_events` unless the same database session sets `app.track_b_session_acquisition_event_approved = '2026-06-19-track-b-session-acquisition-event-approved'` after explicit human approval.
- The hash-bound production approval request is `docs/research/2026-06-20-track-b-session-acquisition-event-approval-request.md`; approval of that phrase is required before the post-approval apply command below.
- Latest production preflight on 2026-06-20 at `2026-06-20T12:55:32Z` exited `0`: `public.user_events` exists, `user_events_event_type_check` exists, `session_log_conditions_set` is not yet allowed, `migration_needed=true`, `can_request_track_b_event_migration_approval=true`, and `track_b_event_preflight_blockers` is empty.
- Running the postflight before apply exits `3`, as expected, because `session_log_conditions_set` is not accepted by the live CHECK constraint yet and there are 0 stored rows for that event. It now emits `track_b_event_postflight_blockers` with `session_log_conditions_set_not_allowed` before raising.
- `yarn test:unit --runTestsByPath __tests__/migrations/track-b-session-acquisition-event.test.ts` passed after approval-token hardening: 1 suite, 4 tests.
- `npm test -- --runInBand src/__tests__/analytics.test.ts src/__tests__/session-form-utils.test.ts src/__tests__/session-form-screen.test.tsx` passed in `quiver-native`: 3 suites, 107 tests.
- `npm test -- --runInBand src/__tests__/native-first-open.test.ts` passed in `quiver-native`: 1 suite, 3 tests.
- `npm test -- --runInBand` passed in `quiver-native`: 338 suites passed, 4 skipped; 2871 tests passed, 21 skipped.
- `npx eslint --max-warnings=0 --no-warn-ignored scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts` passed.
- `yarn jest scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand` passed after schema-v2 validation-failure and telemetry coverage consistency hardening: 1 suite, 36 tests.
- `yarn typecheck:forecast-gate` passed after schema-v2 validation-failure and telemetry coverage consistency hardening: 40 files.
- `yarn typecheck` passed.
- `npm run typecheck` passed in `quiver-native`.

## Gaps

- Beach-selected events cover 0.0% of start actors in the collected window. Platform gaps: `native-ios` 0.0% across 34 start actors and `native-android` 0.0% across 1 start actor. The latest 7-day recent window is also 0.0% across collected native starts.
- Conditions-set events cover 0.0% of start actors in the collected window and 0.0% in the latest 7-day recent window. The read-only DB preflight now confirms the migration is needed and approval-ready. Apply `supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql` only after explicit human approval and before deploying the native build that emits this event; otherwise stored analytics inserts can be rejected by `user_events_event_type_check`. Post-approval apply command:

```bash
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "SET app.track_b_session_acquisition_event_approved = '2026-06-19-track-b-session-acquisition-event-approved';" -f supabase/migrations/20260619173000_add_session_log_conditions_set_event.sql
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/track-b-session-acquisition-event-postflight.sql
```

- Recent app version/build metadata coverage is 0.0% vs the 80.0% readiness floor, so rerun after the instrumented native build is deployed/adopted and enough fresh sessions accumulate.
- Submit-event coverage currently clears the readiness floor; `createLoggedSession` emits the web `session_log_submit` event server-side, so the client hook should not duplicate it.
- Readiness counts rated face-height truth only when the same saved session has both `rating` and `wave_height_ft`; height-only sessions still help Track A but no longer satisfy the personalization-readiness floor.
- 10 actors hit validation failures. Top codes are `wave_quality_required` (9 actors), `crowd_level_required` (8 actors), and `rating_required` (7 actors).
- Excluded 61 event rows and 20 session rows from mock/system/deleted/non-real profiles.

## Notes

- Raw user IDs and session IDs were used only in-memory for dedupe and are not rendered.
- Saved completed sessions are the durable conversion source; stored submit events are telemetry coverage.
- Mock, system, deleted, analytics-excluded, and bot-flagged rows were excluded when profile flags were available.
- Query was read-only through `scripts/session-acquisition-funnel-report.ts --days 30 --recent-telemetry-days 7 --expect-recent-client-build native-ios,1.0.1,11 --expect-recent-client-build native-android,1.0.1,11 --output-json /tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json --fail-on-not-ready`; latest schema-v2 rerun at `2026-06-20T12:55:32.462Z` exited `2` as expected because readiness is not met.
- Event allowlist preflight was read-only through `scripts/db/track-b-session-acquisition-event-preflight.sql`; latest run refreshed by `2026-06-20T12:55:32Z`, exited `0`, emitted an empty `track_b_event_preflight_blockers` table, and rolled back. Recent 7-day counts before rollback were 67 `session_log_start`, 27 `session_log_abandon`, 24 `session_log_rating_set`, 23 `session_log_validation_failed`, 9 `first_session_logged`, 7 `session_log_submit`, 0 `session_log_beach_selected`, and 0 `session_log_conditions_set` rows.
- Event allowlist postflight was read-only through `scripts/db/track-b-session-acquisition-event-postflight.sql`; latest pre-apply run refreshed by `2026-06-20T12:55:32Z`, exited `3`, emitted `track_b_event_postflight_blockers` with `session_log_conditions_set_not_allowed`, reported 0 stored `session_log_conditions_set` rows, and rolled back.
- Machine-readable aggregate artifact: `/tmp/quiver-session-acquisition-funnel-report-20260620-current-refresh.json`.
