# Push alert audit — production evidence (collected 2026-09-17 by Claude, read-only)

Prod Supabase project `vawdnbbgawichorsjiwe` (quiverDB). All timestamps UTC unless noted. User timezone America/Los_Angeles (PDT = UTC-7).

## The complaint

Founder (Steven) received two pushes on Wed 2026-09-16 on the test account `omg.its.thefuture@gmail.com` and considers them useless. Screenshot of Android notification tray (Thu 8:30am):

```
Quiver · 21h   Go PB Point
               2.0ft @ 14s · Wed 11am · S wind 5mph · rising tide
Quiver · 1d    Go Osprey Point
               2.7ft @ 13s · Wed 8am · S wind 5mph · rising tide
```

His read: the only thing that made them fire was "an optimal tide". He wants alerts that are actually useful. A third push (Blacks Beach, "Worth a look") was also sent that morning but is not in the tray.

## The account

- user_id `73040cff-afe9-4fa0-a874-2016203fc015`, created 2026-01-27, profile name "Steven"
- experience_level `advanced`, surf_styles shortboard/funboard/longboard, location San Diego, home_beach_id `65d177de-…` (Ocean Beach Pier)
- notif_push_enabled true, notif_forecast_alerts true, notif_similarity_alerts true, notif_email_enabled true
- **42 logged sessions**, last one 2026-09-16T18:20Z
- Active (non-retired) devices: iOS build 16 (1.0.2), iOS build 17 (1.0.2), Android build 17 (1.0.3, updated 2026-09-16T13:20Z). Several retired Android rows.
- favorite_beaches: Blacks Beach, Scripps, Del Mar, Avalanche (rank 1), Pacific Beach, Ocean Beach Pier (rank 2), Ala Moana Bowls, Osprey Point, plus two custom-spot rows. **alerts_enabled = false on every favorite.**

## alert_rules for the account (10 rows)

| id (prefix) | name | beach | preset_type | enabled | key conditions | last_matched_at |
|---|---|---|---|---|---|---|
| 72685a93 | Similar to your best at Scripps | Scripps (4b0cf129) | similarity_match | true | similarity_threshold 7.5 | 2026-09-17T13:00Z |
| 57f2545f | Watch Blacks Beach Now | Blacks (01330afc) | null (manual) | true | swell 3–6ft, period_min 7, wind ≤9kt, tide 0–4ft rising, max 5/wk, quiet 22–05 | 2026-09-17T09:00Z |
| 2ee1844b | Watch 15th Street Current window | Del Mar (5e72b79d) | null | true | swell 3.5–6.5ft, period_min 14, wind ≤6kt, tide 0–4 rising, 3/wk | never |
| 7af1ef41 | Watch Ocean Beach Pier Best window | OB Pier | null | true | swell 3–7, period_min 12, wind offshore ≤5kt, tide 0–4 rising, 4/wk | never |
| 1f2a5519 | Watch Ocean Beach Pier Best window (duplicate, created 6s later) | OB Pier | null | true | identical to 7af1ef41 | never |
| 5d5e4fb0 | Epic Conditions at Ocean Beach Pier | OB Pier | epic_conditions | true | swell ≥3, period ≥10, wind offshore ≤10kt, tide 0–4, swell dir 220–6° | never |
| 499c19be | Watch Scripps 2 | Scripps | null | true | swell 1–4, period_min 16, wind ≤11kt, tide 0–4 rising, local 10:00–15:00, 3/wk | never |
| 1097f12a | Watch Pacific Beach 5 | Pacific Beach | null | true | swell 1–4, period_min 14, wind ≤10kt, tide 0–4 falling, local 15:00–20:00, 3/wk | never |
| 19bf373c | Watch Osprey Point 5 | Osprey Point (c3b42f85) | null | true | swell 0–2ft, period_min 13, wind ≤7kt, tide 0–4 rising, local 15:00–20:00, 3/wk | never |
| 02e6a6a3 | 5-minute Android push test | OB Pier | null | **false** | days_of_week [0], 16:00–18:59 | never |

Observations: 7 of 9 enabled rules have never matched. The user explicitly configured Osprey Point as a 0–2ft afternoon spot, yet the push that fired for Osprey was 2.7ft at 8am from the *similarity* rule scoped to Scripps.

## alert_queue rows (last 7 days) for the account

### Osprey Point push (sent Wed 2026-09-16 07:05 PDT)
- queue `2905520e`, rule 72685a93 (similarity_match, configured_beach_id = Scripps), beach Osprey Point
- created 2026-09-15T13:00:09Z (i.e. the day before), send_at 2026-09-16T14:00Z, window 15:00–16:00Z (8–9am PDT), best_hour 15:00Z, **best_score 0**
- conditions_snapshot: label EPIC, score 9.4, **confidence 40**, reason "Wave height 2.7 ft — profile peak 2.8 ft", board_tip "Twin pin 6'2", wave 2.7ft @ 13s, wind S 5mph, tide rising 3.7ft, window_local "Wed 8am"
- session_decision: verdict go, reasonCode selected_go, decisionBasis personal_match, holdEpoch similarity-alert-preflight, evidence.personalMatch { label EPIC, score 9.4, confidence "high", **sessionCount 0** }, conditionScore 75, recommendationLabel "Worth it", skill advanced eligible
- delivery attempt: push sent 2026-09-16T14:05:48Z, message_instance ea8fd245

### PB Point push (sent Wed 2026-09-16 10:05 PDT)
- queue `e3fcb0de`, rule 72685a93, beach PB Point (13ef0aa1)
- created 2026-09-16T13:00:11Z, send_at 17:00Z, window 18:00–19:00Z (11am–12pm PDT), best_score 0
- snapshot: label GOOD, score 7.9, confidence 92, reason "Wave height 2.0 ft — profile peak 2.8 ft", wave 2.0ft @ 14s, wind S 5mph, tide rising 4.7ft, window_local "Wed 11am"
- session_decision: verdict go, personal_match, personalMatch { GOOD 7.9, confidence "high", **sessionCount 0** }, conditionScore 65, "Worth it"
- delivery: push sent 2026-09-16T17:05:48Z

### Blacks Beach push (sent Wed 2026-09-16 06:06 PDT) — manual rule
- queue `cd29f3af`, rule 57f2545f, created 09:00:21Z, send_at 13:00Z, window 15:00–16:00Z, best_score 0.6457
- snapshot: wave 4.4ft @ 13s SSW, wind 4.3 (units?) dir 189°, tide 3.8 rising
- notifications row: title "Worth a look — Blacks Beach, 8–9 AM", body "Blacks Beach 8 AM-9 AM — 4-5ft @ 13s, 5 mph"; session_decision verdict maybe, decisionBasis physical_fallback, personalMatch null, conditionScore 64.6, recommendationLabel "Maybe"
- delivery: push sent 13:06:48Z

### Thu 2026-09-17 (today)
- PB Point again: queue d96de62a, rule 72685a93, created 13:00:06Z, send_at 17:00Z, EPIC 8.8 confidence 91, reason "Wave height 2.3 ft — profile peak 2.8 ft", 2.3ft @ 12s W 5mph rising 4.3ft, sessionCount 0, sent=false (not yet due at collection time)
- Blacks Beach: queue 7789bd95, rule 57f2545f, created 09:00Z, send_at 13:00Z, best_score 0.437, 3.2ft @ 12s — delivery **skipped_cooldown**: "rule 57f2545f last sent 24h ago, within 24h cooldown"

## Key anomalies to explain

1. `personalMatch.sessionCount` is **0** and confidence "high" in every similarity decision, for a user with **42 logged sessions**. Where does "profile peak 2.8 ft" come from if not from sessions? Is the similarity profile built from onboarding defaults / experience_level baseline rather than the user's actual sessions? Is the wrong user id or wrong beach scope passed?
2. The similarity rule is named/scoped "Similar to your best at Scripps" (beach_id Scripps) but fires for PB Point and Osprey Point. Is it intended to fan out across all beaches near the configured beach? What is the copy contract?
3. Osprey snapshot confidence **40** yet session_decision.personalMatch.confidence "high" and verdict go. Two confidence fields disagree.
4. The match reason is wave height alone ("Wave height 2.7 ft — profile peak 2.8 ft"). Period, wind, direction and tide appear not to contribute to the reason. A 2.0ft @ 14s S-wind day at PB Point is labelled GOOD 7.9 / EPIC 8.8.
5. `best_score` is 0 on every similarity queue row while manual rows carry a real 0–1 score. Does anything downstream read best_score (ranking, dedupe, shadow outcomes)?
6. Push copy "Go PB Point / 2.0ft @ 14s · Wed 11am · S wind 5mph · rising tide" — imperative "Go" for a 2ft day. Compare with the manual-rule copy "Worth a look — Blacks Beach, 8–9 AM". Two different formatters / tones for the same user on the same morning.
7. Lead time: PB Point queued at 06:00 PDT for a 10:00 send and 11:00 window (1h notice). Osprey queued the day before for a 07:00 send and 8:00 window. Is a 1-hour heads-up useful for an 11am window? What is the intended lead-time policy?
8. Three pushes in one morning (06:06, 07:05, 10:05 PDT) from two different rules. Is there a per-user daily push cap across rule types? The 24h cooldown is per rule.
9. Seven enabled manual rules have never matched. Several require swell_period_min 14–16s with wind ≤5–6kt, which may be practically unmatchable in San Diego. Does the rule UI steer users into unmatchable rules? Does the evaluator compare `swell_period_min` against primary swell period or dominant wave period?
10. favorite_beaches.alerts_enabled is false for all favorites yet rules exist and fire. What does that column gate, if anything?

## System-wide delivery stats (alert_delivery_attempts, last 30 days, joined to alert_rules.preset_type)

| preset | channel | status | attempts | users |
|---|---|---|---|---|
| clean_groundswell | email | sent | 80 | 19 |
| clean_groundswell | email | skipped_allowlist | 54 | 19 |
| clean_groundswell | email | skipped_stale_forecast | 46 | 18 |
| clean_groundswell | email | skipped_cooldown | 42 | 13 |
| clean_groundswell | email | failed_provider | 14 | 11 |
| clean_groundswell | push | skipped_cooldown | 46 | 7 |
| clean_groundswell | push | sent | 38 | 9 |
| clean_groundswell | push | skipped_allowlist | 26 | 10 |
| clean_groundswell | push | skipped_dedup_collision | 21 | 1 |
| clean_groundswell | push | skipped_stale_forecast | 17 | 8 |
| clean_groundswell | push | failed_internal | 12 | 4 |
| mellow_session | email | skipped_stale_forecast | 176 | 49 |
| mellow_session | email | skipped_allowlist | 148 | 49 |
| mellow_session | email | sent | 108 | 37 |
| mellow_session | email | failed_provider | 48 | 29 |
| mellow_session | email | skipped_cooldown | 32 | 17 |
| mellow_session | push | skipped_stale_forecast | 105 | 26 |
| mellow_session | push | skipped_allowlist | 74 | 22 |
| mellow_session | push | skipped_disabled | 60 | 14 |
| mellow_session | push | sent | 18 | 5 |
| mellow_session | push | skipped_cooldown | 16 | 7 |
| mellow_session | push | skipped_channel_disabled | 11 | 4 |
| mellow_session | push | failed_internal | 9 | 3 |
| similarity_match | push | sent | 12 | 3 |
| similarity_match | push | skipped_dedup_collision | 2 | 2 |
| weekend_warrior | email | skipped_allowlist | 110 | 38 |
| weekend_warrior | email | sent | 50 | 26 |
| weekend_warrior | email | skipped_stale_forecast | 12 | 11 |
| weekend_warrior | email | skipped_cooldown | 10 | 7 |
| weekend_warrior | push | skipped_allowlist | 43 | 15 |
| weekend_warrior | push | skipped_disabled | 16 | 5 |
| weekend_warrior | push | sent | 13 | 7 |
| weekend_warrior | push | skipped_cooldown | 11 | 4 |
| weekend_warrior | push | skipped_dedup_collision | 9 | 1 |
| manual (preset null) | push | sent | 6 | 3 |
| manual | push | skipped_stale_forecast | 5 | 3 |
| manual | email | sent | 3 | 1 |

Takeaways to verify against code: `skipped_stale_forecast` is the single largest outcome for mellow_session; `skipped_allowlist` is large on every preset (is an allowlist flag still gating prod delivery?); `failed_provider` on email is ~10% of email attempts; `skipped_disabled` = 60 on mellow_session push; similarity_match push has only 3 users in 30 days (one of them is this account).

## Tables that exist in prod (public schema, alert/push/notification related)

activation_push_log, alert_deliveries, alert_delivery_attempts, alert_queue, alert_rules, forecast_alert_deliveries, notification_delivery_attempts, notification_delivery_targets, notification_events, notification_send_log, notifications, pending_alert_captures, surf_alert_delivery_slots, swell_watch_notification_event_bindings, trial_ending_push_log, trusted_forecast_alerts, user_devices.

`notification_send_log` had no rows for this user in the last 7 days; `notifications` had the three rows above (types similarity_match, similarity_match, forecast_alert).
