# Session Break Analysis

Generated: 2026-06-20

Scope: Quiver web app, Supabase-backed session behavior, read-only analysis. Outputs are aggregate only. No names, emails, avatars, notes, photo contents, board names, or raw user IDs are included.

## Commands

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
source ~/.nvm/nvm.sh && nvm use 22
yarn tsx scripts/analysis/session-break-behavior-report.ts --days 365 --top 10 --output-json /tmp/quiver-session-break-behavior.json
psql "$POSTGRES_URL_NON_POOLING" -v start='2025-06-20T00:00:00Z' -v end='2026-06-20T00:00:00Z' -v min_sessions='5' -f scripts/analysis/session-break-behavior.sql
```

The `tsx` report was run successfully against the configured Supabase environment. The `psql` command is provided for teams with direct database access; it was not needed for the generated findings.

## Inventory

### Tables Inspected

| Table | Role in this analysis |
| --- | --- |
| `sessions` | Primary behavior signal. Session creation is intent; `status='completed'` is the strongest activation signal. Current web session logging writes completed sessions, but historic planned rows can still exist. |
| `beaches` | Break metadata: name, region, timezone, skill level, break type, swell windows, offshore wind, preferred tide, terrain flags, CDIP/NWS mapping. |
| `enhanced_forecasts` | Main forecast rows used by beach pages and discovery recommendations. Includes `forecast_at`, wave/wind/tide strings, Open-Meteo numeric fields, confidence, and data source. |
| `marine_forecasts`, `tide_forecasts`, `sun_times` | Normalized forecast/tide/sun stores consumed by forecast APIs and scheduled refresh jobs. |
| `session_forecast_snapshots` | Session-time forecast snapshot and `forecast_confidence_score`; best current source for forecast confidence at completion time. |
| `beach_reviews` | Aggregate break review/rating signal. Text content was not inspected or summarized. |
| `boards` | Board type/volume only; names and descriptions were not output. |
| `favorite_beaches` | Break-save behavior signal; aggregate counts only. |
| `user_events` | Analytics behavior table. Used for event inventory, not live user-level output. |
| `user_beach_affinity`, `user_surf_preferences`, `user_implicit_preferences` | Existing personalization and learned-preference signals. |
| `beach_recommendation_calibration`, `beach_forecast_accuracy`, `forecast_accuracy_votes` | Forecast/recommendation calibration support tables. |
| `profiles` | Only profile flags needed to exclude mock/system/deleted users. No personal profile fields were selected. |

### Services Inspected

| Service/File | Current role |
| --- | --- |
| `lib/services/discovery/surf-discovery-orchestrator.ts` | Main spot recommendation orchestration and final ranking. |
| `lib/services/discovery/personalization-layer.ts` | Existing user affinity, learned preference, implicit preference, and avoidance bonuses. |
| `lib/domains/scoring`, `lib/scoring`, `lib/surf/scoring.ts` | Forecast quality, native condition score, window score, board fit, wind/tide/swell fit. |
| `lib/services/forecast/data-source-manager.ts` | Forecast source abstraction for wave, tide, weather, CDIP, IOOS observations. |
| `lib/services/noaa-wavewatch/*` | NWS grid/Open-Meteo wave fetching, merge/fallback behavior, GFS-Wave shadow helper. |
| `lib/services/cdip/*` | CDIP buoy observations and nowcast anchoring. |
| `app/api/cron/enhanced-forecast-sync/*`, `app/api/cron/forecasts/refresh/route.ts` | Scheduled forecast ingestion paths. |
| `lib/analytics/event-taxonomy.ts` | Accepted analytics events and missing event-name gaps. |

## Current Data Inputs

### Forecast Inputs

- NWS grid API via `api.weather.gov/points` and grid forecast data.
- Open-Meteo Marine as extended/fallback wave model data.
- NOAA CO-OPS tide predictions.
- CDIP buoy observations for West Coast nowcast/quality anchoring.
- IOOS/NDBC observation fallback through cached observation tables.
- NWS weather/wind forecast periods.
- Sun times from `sun_times`.
- Optional/disabled GFS-Wave shadow capture via Open-Meteo model `ncep_gfswave016`; not used in production scoring.

### Recommendation Inputs

- Native-compatible forecast condition score.
- Break metadata from `beaches`: swell window, wind orientation, preferred tide, skill level, break type, terrain/shoaling fields.
- Distance penalty.
- Water quality closure/advisory demotion.
- Personalization: user-beach affinity, learned session preferences, implicit engagement preferences, avoidance patterns.
- Similarity/pro session layer and board fit.
- Favorite status for response decoration.
- New conservative break behavior score from aggregate sessions.

### Confidence Inputs

- `enhanced_forecasts.confidence_score`.
- Source attribution and fallback handling from forecast builder/source manager.
- CDIP/IOOS nowcast freshness and observation quality.
- Session forecast snapshots with `forecast_confidence_score`.
- Forecast accuracy/session truth tables and calibration helpers.

## Live Session Findings

Window: 2025-06-20T18:43:49.383Z to 2026-06-20T18:43:49.383Z.

Summary:

- Raw session rows: 81.
- Included real-user sessions after mock/system/deleted-user filtering: 56.
- Completed sessions: 55.
- Breaks with included sessions: 26.
- Unique users represented in aggregate: 18.
- Session forecast snapshot coverage: 53 / 56 = 94.6%.
- Sample confidence: 23 sparse breaks, 3 low-confidence breaks, 0 medium, 0 high.

Interpretation: behavior is useful as an early calibration signal, but not large enough to override forecast science. The implemented boost must remain capped and sparse-data suppressed.

### Ranked Break Table

| Break | Planned | Completed | Completion Rate | Unique Users | Repeat Users | Common Conditions | Recommendation Note | Confidence Label |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Ponto | 8 | 8 | 100% | 2 | 1 | `<2ft`; `<8s`; SW swell; 0-5mph/W wind; falling tide | Neutral-to-light positive behavior signal only. | low |
| HB Cliffs | 6 | 6 | 100% | 1 | 1 | `<2ft`; 8-11s; SSW swell; 0-5mph/SW wind; falling tide | Repeat behavior exists but only one user; avoid broad popularity boost. | low |
| La Jolla Shores | 5 | 5 | 100% | 3 | 1 | 4-6ft; 8-11s; WNW swell; 0-5mph/NE wind; rising tide | Best early candidate for a conservative behavior boost because users are more distributed. | low |
| Ocean Beach Pier | 4 | 4 | 100% | 1 | 1 | 4-6ft; 16s+; SSW swell; light SSW wind; falling tide | Sparse; keep neutral until more users confirm. | sparse |
| Avalanche | 4 | 4 | 100% | 1 | 1 | 3-4ft; 8-11s; SSW swell; 6-10mph/W wind; rising tide | Sparse; repeat behavior is single-user only. | sparse |
| Ocean Beach | 3 | 2 | 67% | 3 | 0 | `<2ft`; 8-11s; WSW swell; light wind; rising tide | Sparse and mixed; no boost. | sparse |
| Waikiki - Queens | 3 | 3 | 100% | 1 | 1 | `<2ft`; 12-15s; W swell; 6-10mph/E wind; rising tide | Sparse; geographically outside core San Diego/California sample. | sparse |
| Blackies | 3 | 3 | 100% | 1 | 1 | 3-4ft; 8-11s; S swell; light SW wind; rising tide | Sparse; one-user repeat only. | sparse |
| Scripps | 2 | 2 | 100% | 1 | 1 | 3-4ft; 8-11s; WNW swell; light SSW wind; falling tide | Sparse; no boost. | sparse |
| Del Mar | 2 | 2 | 100% | 2 | 0 | 4-6ft; 12-15s; WSW swell; 6-10mph/WNW wind; rising tide | Sparse but worth watching as more users log sessions. | sparse |

`Planned` means created/intent sessions in this report, not necessarily current-product planned sessions. The current web session flow writes completed rows; historic `status='planned'` rows can still exist.

### Behavioral Segments

- High-demand breaks by session count: Ponto, HB Cliffs, La Jolla Shores, Ocean Beach Pier, Avalanche.
- High-completion breaks with minimum sample threshold of 5: Ponto, HB Cliffs, La Jolla Shores. All are low-confidence, not high-confidence, because total samples and user diversity remain limited.
- Niche repeat behavior: HB Cliffs, Ocean Beach Pier, Avalanche, Waikiki - Queens, Blackies, Scripps each show repeat completed sessions, but mostly from a single user. Treat as personalization signal more than global recommendation signal.
- High intent but low completion: none found at the `min_sessions=5` threshold.
- Completed sessions during low forecast confidence: none found below confidence score 55 in this run.
- Sparse-data breaks: 23 of 26 breaks. These should not jump in ranking from behavior.

### Forecast/Recommendation Gaps Seen In Data

- `session_forecast_snapshots` has strong coverage, but recommendation score at session time is not stored. That prevents direct answers to "completed despite low recommendation score" or "planned during high recommendation score but not completed."
- Forecast confidence is available at session time, but all completed snapshot confidence values in this sample were high enough that no low-confidence under-rating candidates appeared.
- Current sample is dominated by completed sessions, so planned-abandon/dropoff analysis needs either real planned sessions or explicit session plan/abandon events.
- Board type is usable in aggregate, but board fit is still mostly a personalization/UI signal; sample sizes are too small for global break scoring.
- Reviews are useful aggregate context, but free-text review content should not be used in recommendation training without a privacy-safe summarization policy.

## Analytics Event Inventory

Existing event equivalents:

| Requested signal | Current status |
| --- | --- |
| `forecast_viewed` | Partial: `forecast_check`, `forecast_interaction`, `home_beach_forecast_viewed`, `home_hero_forecast_viewed`, `forecast_tab_click`, `horizon_strip_day_selected`. |
| `beach_forecast_viewed` | Partial: `beach_view`, `home_beach_forecast_viewed`, `forecast_tab_click`. |
| `beach_card_tapped` | Partial: `home_nearby_spot_tap`, `map_marker_tapped`, `beach_search_result_click`. |
| `beach_recommended` | Missing exact event. `match_card_rendered`, `personalized_score_shown`, and `surf_window_impression` are adjacent. |
| `recommendation_seen` | Partial: `match_card_rendered`, `surf_window_impression`. |
| `recommendation_tapped` | Partial: `discovery_click`, `surf_window_click`, `match_strip_tap`, `for_you_tap`. |
| `session_planned` | Missing exact event; `plan_session_from_intel` exists. |
| `session_completed` | Partial: `session_log_submit`, `first_session_logged`. |
| `session_abandoned_or_expired` | Partial: `session_log_abandon`, `session_log_validation_failed`. |
| `session_canceled` | Missing exact event. |
| `favorite_break_added` | Missing exact event; table exists via `favorite_beaches`. |
| `notification_opened` | Missing exact event; notification tap/open events are partial by surface. |
| `forecast_alert_opened` | Missing exact event; `save_alert_clicked`, alert capture events, and `forecast_alerts_enabled` are adjacent. |
| `board_selected_for_session` | Partial: `session_board_fit_feedback_selected`, board table linkage. |
| `review_created` | Partial: `review_submit`. |

Recommended properties for future events: `beach_id`, `forecast_at`, `source_surface`, `session_id` when applicable, `recommendation_id`, `rank`, `score_bucket`, `confidence_bucket`, `board_type`, and booleans such as `is_favorite`. Avoid names, emails, avatars, free-form notes, photo URLs, or exact private location trails.

## Product Recommendations

1. Keep forecast quality as the primary ranking driver.
2. Use completed session history as a capped behavior boost only after closure/advisory and bad-condition checks.
3. Suppress behavior on sparse breaks until at least 5 intent sessions and 3 completed sessions; higher thresholds should be used before confidence meaning changes.
4. Treat single-user repeat behavior primarily as personalization, not global popularity.
5. Add explicit instrumentation for recommendation impressions/taps and planned-session lifecycle before trying to diagnose over-rating from planned-but-not-completed behavior.
6. Store recommendation score and score components in a privacy-safe snapshot when a user plans or completes a session.

## Implemented Change

Added a typed behavior scoring layer:

- `lib/services/discovery/break-behavior-score.ts`
- `lib/services/discovery/surf-discovery-orchestrator.ts`
- `types/personalization.ts`

Formula:

```text
behavior_score =
  completed_session_rate * 0.35
  + repeat_user_rate * 0.25
  + recent_session_activity * 0.20
  + condition_match_history * 0.20
```

The score is capped at 12 points and suppressed when the base forecast score is below 45. Sparse data suppresses the boost entirely. High planned/low completed patterns and stale completed history reduce the behavior score.

Rollback: remove the behavior helper import and the `fetchBreakBehaviorSessionRows`/`aggregateBreakBehaviorSessions`/`applyBreakBehaviorScore` block from `surf-discovery-orchestrator.ts`. The helper is isolated and read-only.
