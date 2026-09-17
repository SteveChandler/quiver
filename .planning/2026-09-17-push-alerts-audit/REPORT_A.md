# Packet A — Surf-alert push root-cause audit

## 1. Executive summary

- Both pushes were deliberately produced by the Scripps-named similarity rule, but that rule is not scoped to Scripps: it ranks recommendation-eligible beaches around the user's recent device location.
- The rule name therefore promises a Scripps comparison that the implementation does not honor; Scripps is only anchor/provenance and guaranteed inclusion when it is nearby.
- The engine did use the user's session history. “Profile peak 2.8 ft” is the rating-weighted mean wave height of qualifying good sessions at break-compatible beaches.
- `sessionCount: 0` is a metadata bug: the SQL returns the real count, the TypeScript drops it, then hard-codes zero while retaining the SQL's “high” confidence.
- A personal label of `GOOD` or `EPIC` forces canonical verdict `go`; PB's physical condition score was only 65 (`Maybe`) but its `GOOD` match label overrode that result.
- Wave height is only the displayed reason, not the only scoring input. The score also uses period, wind speed, wind direction, and tide; crowd is absent.
- Overlapping daily 72-hour scans and beach/window dedupe allowed Tuesday's Osprey pick and Wednesday's PB pick onto the same alert date; similarity bypasses the weekly cap.
- The lock-screen “Go” tone comes from a separate similarity formatter and hides the profile reason, making a historical resemblance sound like an objective recommendation.

## 2. End-to-end trace: Osprey Point

1. **Cron tick and eligibility.** Vercel invokes `/api/cron/similarity-alerts` daily at 13:00 UTC (`vercel.json:141-143`). The cron loads enabled `similarity_match` rules (`app/api/cron/similarity-alerts/route.ts:482-490`), then requires a profile with a home beach, a paid/trial entitlement, and a device-location snapshot no more than 24 hours old (`app/api/cron/similarity-alerts/route.ts:582-608`, `app/api/cron/similarity-alerts/route.ts:623-674`). On Tuesday 2026-09-15, this produced queue row `2905520e` at 13:00:09Z for rule `72685a93`; the production row identifies Scripps as `configured_beach_id` but Osprey as `beach_id` (`../audit/EVIDENCE.md:46-50`).

2. **Candidate query.** The search radius is `min(100 miles, max_drive_minutes × 0.5 miles)` or 30 miles when unset (`app/api/cron/similarity-alerts/route.ts:688-693`). It is centered on the recent **device location**, not Scripps, through `get_weekend_scout_candidates` (`app/api/cron/similarity-alerts/route.ts:696-708`). That RPC returns public, recommendation-eligible, non-excluded beaches inside the radius, ordered by distance (`supabase/migrations/20260902093602_add_humboldt_surf_beaches.sql:395-437`). Favorites are fetched without `alerts_enabled` (`app/api/cron/similarity-alerts/route.ts:696-701`), but they do not actually expand or rank the final set: every hydrated beach must be in `nearbyIds`, and after adding up to five favorites the code adds all nearby IDs anyway (`app/api/cron/similarity-alerts/route.ts:725-800`). The configured Scripps beach is preferred only if it is in that same nearby set (`app/api/cron/similarity-alerts/route.ts:773-800`). Osprey was therefore a normal local candidate, not a Scripps-scoped candidate. Despite its name, the cron does **not** call `get_user_match_candidates`; that separate RPC is used by other consumers (`supabase/migrations/20260902093602_add_humboldt_surf_beaches.sql:521-689`).

3. **Forecast and physical-quality gate.** For every candidate, the cron reads `enhanced_forecasts` from now through 72 hours, keeps local 06:00–19:00 slots, computes the shared beach-aware composite score, and rejects scores below 60 (`app/api/cron/similarity-alerts/route.ts:813-908`). Osprey's Wednesday 08:00 PDT forecast was inside Tuesday's 72-hour horizon. Its stored `conditionScore` was 75 (`../audit/EVIDENCE.md:48-50`). The physical engine combines base height/period, swell alignment/interference, wind, tide height/direction, stability, and trend (`lib/domains/scoring/discovery-adapter.ts:47-59`; weights at `lib/domains/scoring/types.ts:156-183`); 2.7 ft also imposes a hard maximum of 75 (`lib/domains/scoring/wave-height-ceiling.ts:16-40`). Thus 75 is the ceiling, not evidence that tide alone caused the alert.

4. **Personal profile and similarity score.** The cron sends the correct account ID and the **candidate** Osprey beach ID to `compute_user_match_score_batch` (`app/api/cron/similarity-alerts/route.ts:928-935`); the wrapper calls `compute_user_match_score` for each slot (`supabase/migrations/20260504023658_add_compute_user_match_score_batch_rpc.sql:3`). The production core first counts completed, rated, non-deleted sessions from the last 12 months that have forecast snapshots (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:121-130`). For a learned profile, its preference peak is the `(rating - 3)`-weighted mean of rating-4/5 session conditions (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:603-628`). The only beach restriction is break-type compatibility with Osprey, not Scripps beach identity (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:619-628`). This query produced the 2.8 ft peak represented in the row's reason (`../audit/EVIDENCE.md:49`). The advanced onboarding prior of 5.5 ft exists only in the under-five-session starter branch (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:121-164`, `supabase/migrations/20260622064000_coldstart_prior_match_score.sql:300-306`), and starter results are discarded because the cron accepts only `ready`/`learned` states (`lib/personalization/match-state-compat.ts:10-12`; `app/api/cron/similarity-alerts/route.ts:945-948`). It did not produce this push.

5. **Score, explanation, and pick.** The learned SQL score uses distance from the preference peak: wave height 35%, period 25%, wind speed 20%, tide height 10%, and wind direction 10% (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:688-706`), then applies aversion, session-fit, and board-band adjustments before clamping to 0–10 (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:901-907`). `EPIC` begins at 8.5 and `GOOD` at 7.0 (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:909-915`). The SQL emits wave, period, and wind reasons in that order (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:923-927`), but the cron keeps only the first bullet (`app/api/cron/similarity-alerts/route.ts:240-247`, `app/api/cron/similarity-alerts/route.ts:990-993`). Across every beach and daylight hour, it rejects scores below the hard-coded 7.5 and ranks by personal score, categorical match confidence, physical score, earliest time, then stable ID (`app/api/cron/similarity-alerts/route.ts:77-88`; `lib/alerts/similarity-best-pick.ts:80-115`). Osprey won Tuesday's global search with 9.4/`EPIC`; the stored rule condition is not read, even though it also says 7.5 (`../audit/EVIDENCE.md:31`, `../audit/EVIDENCE.md:49`).

6. **Canonical decision.** The producer maps physical 75 to `Worth it`, then creates a personal match containing 9.4/`EPIC`/`high` and hard-codes `sessionCount: 0` (`app/api/cron/similarity-alerts/route.ts:1068-1113`). Canonical logic maps `EPIC` and `GOOD` directly to `go` (`lib/recommendations/canonical-decision/engine.ts:129-143`) and prefers a learned personal decision over the physical verdict (`lib/recommendations/canonical-decision/engine.ts:257-283`, `lib/recommendations/canonical-decision/engine.ts:312-325`). It also rewrites the selected evidence label from the final verdict, so `go` becomes `Worth it` (`lib/recommendations/canonical-decision/engine.ts:207-236`). Confidence is a tie-breaker, not a delivery gate (`lib/recommendations/canonical-decision/engine.ts:146-152`, `lib/recommendations/canonical-decision/engine.ts:263-273`).

7. **Queue and schedule.** `window_start`, `best_hour`, and `forecast_at` are the selected forecast timestamp; `window_end` is one hour later. `send_at` is exactly 60 minutes before `window_start`, clamped to now (`app/api/cron/similarity-alerts/route.ts:1039-1064`). `created_at` is the database insertion time (`supabase/migrations/20260408163000_add_condition_alerts.sql:63-76`). The queue RPC stores the selected beach/window/snapshot but omits `best_score`, leaving its default zero (`supabase/migrations/20260724005515_similarity_alert_canonical_dedupe.sql:69-91`; `supabase/migrations/20260614005533_add_alert_queue_best_score.sql:1-5`). Its dedupe key is user + actual beach + window + verdict, not user + alert date (`supabase/migrations/20260724005515_similarity_alert_canonical_dedupe.sql:12-30`, `supabase/migrations/20260724005515_similarity_alert_canonical_dedupe.sql:92-105`). That exactly matches Osprey's `created_at` Tuesday 13:00Z, Wednesday 15:00Z window, and 14:00Z send time (`../audit/EVIDENCE.md:47-50`).

8. **Delivery and copy.** The hourly delivery cron (`vercel.json:161-163`) fetches due unsent rows (`app/api/cron/condition-alert-deliver/route.ts:791-814`) and routes similarity rows away from manual refresh, consolidation, and the manual `best_score` floor (`app/api/cron/condition-alert-deliver/route.ts:897-975`). It rebuilds the typed payload from the snapshot (`app/api/cron/condition-alert-deliver/route.ts:2017-2115`), reuses the stored `go` decision when beach/window match, and enqueues a `similarity_match` event (`app/api/cron/condition-alert-deliver/route.ts:2036-2050`, `app/api/cron/condition-alert-deliver/route.ts:2162-2187`, `app/api/cron/condition-alert-deliver/route.ts:2236-2267`). Surf alerts receive a five-minute `next_attempt_at` coalescing delay (`lib/notifications/enqueue.ts:28-30`, `lib/notifications/enqueue.ts:104-121`); the notification worker then enforces master/per-type preferences, quiet hours, and same-beach/day arbitration immediately before push (`lib/notifications/worker.ts:879-903`, `lib/notifications/worker.ts:1276-1290`). This accounts for the 14:05:48Z actual send (`../audit/EVIDENCE.md:51`). The registry turns verdict `go` into title `Go Osprey Point` and builds the body from wave/time plus only the first two context details—wind and tide—so the profile reason is omitted (`lib/notifications/registry.ts:755-818`).

## 3. Answers to anomalies 1–10

### 1. `sessionCount: 0` despite 42 sessions

**Finding.** The profile is session-derived; the zero is not. The SQL receives the correct user ID, counts qualifying sessions account-wide, and derives 2.8 ft from rating-4/5 snapshots filtered only by candidate-break compatibility. It returns its actual **global qualifying** count as `sessions_in_profile`, but `BatchSlotResult` does not model that field and the producer writes `sessionCount: 0` unconditionally (`app/api/cron/similarity-alerts/route.ts:181-193`, `app/api/cron/similarity-alerts/route.ts:1105-1113`). The evidence's 42 is total logged sessions (`../audit/EVIDENCE.md:20-24`), while SQL eligibility additionally requires completed + rated + last 12 months + snapshot + not deleted (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:121-130`). A learned `high` result implies at least 25 globally qualifying sessions under this function (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:917-921`, `supabase/migrations/20260622064000_coldstart_prior_match_score.sql:965-974`), but the SQL does not return how many rating-4/5, break-compatible rows actually formed this candidate's peak. It is neither an onboarding default, a wrong user ID, nor a Scripps-empty query.

**Evidence.** Production row: 42 sessions, 2.8 ft profile peak, `high`, and zero (`../audit/EVIDENCE.md:20-24`, `../audit/EVIDENCE.md:46-50`). Query and fallback: `s.user_id = p_user_id` with the filters above; only `v_session_count < 5` enters the experience-level starter branch (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:121-164`). The learned peak query is `s.rating >= 4` and break-type-compatible (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:603-628`).

**Severity:** bug. **Confidence:** high.

### 2. A Scripps rule firing at PB Point and Osprey Point

**Finding.** This is intentional fan-out but a false user contract. The engine is “best personal match near your current device,” not “conditions similar to your best at Scripps” and not “beaches near Scripps.” It considers up to 15 IDs returned around the device (10 nearby + 5 capacity), bounded by 30 miles/default or the drive-time radius, then ranks all candidate daylight hours in the next 72 hours globally (`app/api/cron/similarity-alerts/route.ts:97-103`, `app/api/cron/similarity-alerts/route.ts:684-708`, `app/api/cron/similarity-alerts/route.ts:813-819`; `lib/alerts/similarity-best-pick.ts:80-115`). The rule's beach is only the configured anchor/preferred candidate and snapshot provenance. The push never displays the rule name; it displays the winning beach (`lib/notifications/registry.ts:795-803`).

**Evidence.** Rule row says Scripps, while queue rows use Osprey and PB (`../audit/EVIDENCE.md:29-31`, `../audit/EVIDENCE.md:46-57`). Candidate construction and ranking are cited above. The hypothesis that fan-out is centered on the configured beach is wrong; it is centered on a fresh device-location snapshot (`app/api/cron/similarity-alerts/route.ts:582-608`, `app/api/cron/similarity-alerts/route.ts:696-708`).

**Severity:** design flaw. **Confidence:** high.

### 3. Snapshot confidence 40 versus personal-match confidence `high`

**Finding.** They measure different things but share the same name. Categorical `high` is match-profile confidence from the global qualifying-session count (at least 25), not from the smaller candidate-break-compatible positive sample that formed the peak. Numeric 40 is the forecast row's `confidence_score`: because the SQL result is categorical, the producer falls back to `source.confidence_score` for the numeric snapshot (`app/api/cron/similarity-alerts/route.ts:961-970`). Neither gates delivery. Categorical confidence only breaks equal personal scores; numeric confidence is copied through the payload and not consulted by the picker, canonical engine, or registry (`lib/alerts/similarity-best-pick.ts:93-109`; `lib/notifications/types/similarity-match.ts:35-49`).

**Evidence.** Osprey has 40/`high`; PB has 92/`high` (`../audit/EVIDENCE.md:46-57`). SQL confidence thresholds are at `supabase/migrations/20260622064000_coldstart_prior_match_score.sql:917-921`; canonical verdict uses label, not confidence (`lib/recommendations/canonical-decision/engine.ts:129-143`, `lib/recommendations/canonical-decision/engine.ts:320-325`).

**Severity:** bug. **Confidence:** high.

### 4. Score, label, reason, physical score, and `go`

**Finding.** There are two scores:

- **Personal similarity (0–10):** wave 35%, period 25%, wind speed 20%, tide height 10%, wind direction 10%, plus aversion/fit/board adjustments. Swell direction and crowd have zero contribution. Osprey 9.4 becomes `EPIC` (≥8.5); PB 7.9 becomes `GOOD` (≥7.0), and both exceed the cron's hard-coded 7.5 (`supabase/migrations/20260622064000_coldstart_prior_match_score.sql:688-706`, `supabase/migrations/20260622064000_coldstart_prior_match_score.sql:901-915`; `app/api/cron/similarity-alerts/route.ts:77-88`).
- **Physical condition score (0–100):** base height/period 25%, swell alignment 15%, swell interference 15%, wind 15%, tide height 5%, tide direction 15%, stability 5%, trend 5%; crowd is absent (`lib/domains/scoring/types.ts:156-183`). The base subscore itself is height 60% and period 40% (`lib/domains/scoring/scorers/base-conditions-scorer.ts:157-166`, `lib/domains/scoring/scorers/base-conditions-scorer.ts:320-348`). Osprey's raw composite was capped at 75 because it was under 3 ft; PB's other subscores reduced it to 65 (`lib/domains/scoring/scoring-engine.ts:108-142`; `lib/domains/scoring/wave-height-ceiling.ts:16-40`).

The reason shows only wave height because the producer discards every SQL reason after the first; that is an explanation defect, not the score formula. `GOOD`/`EPIC` then maps to canonical `go` regardless of whether the physical recommendation was `Maybe`. For PB, 65 maps to input `Maybe`, but personal `GOOD` produces final `go`, and selection evidence is rewritten to `Worth it` from that verdict (`app/api/cron/similarity-alerts/route.ts:1068-1074`; `lib/recommendations/canonical-decision/engine.ts:129-143`, `lib/recommendations/canonical-decision/engine.ts:207-236`).

**Evidence.** The rows record Osprey 9.4/`EPIC`/75 and PB 7.9/`GOOD`/65, both `go`, with wave-only reasons (`../audit/EVIDENCE.md:46-57`). The founder's “optimal tide alone” hypothesis is false: tide is only 10% of personal similarity and 20% of the physical composite (height + direction); it cannot alone explain either score.

**Severity:** design flaw. **Confidence:** high. (The exact PB subscore decomposition remains unavailable because the evidence omits some partition/profile inputs.)

### 5. `best_score = 0` on similarity rows

**Finding.** `try_insert_similarity_alert` never inserts `best_score`, so the column default supplies zero (`supabase/migrations/20260724005515_similarity_alert_canonical_dedupe.sql:69-91`; `supabase/migrations/20260614005533_add_alert_queue_best_score.sql:1-5`). The manual path uses it for a delivery floor and consolidation ordering, but similarity is partitioned out before both (`app/api/cron/condition-alert-deliver/route.ts:897-975`, `app/api/cron/condition-alert-deliver/route.ts:1836-1845`). The similarity branch reads `conditions_snapshot.score` first and consults queue `best_score` only as a fallback when the snapshot score is absent (`app/api/cron/condition-alert-deliver/route.ts:2122-2140`). Dedupe does not read it. Therefore zero had no effect on these valid rows, but it is a latent fallback bug and misleading data.

**Evidence.** Both similarity rows are zero while the manual row is 0.6457 (`../audit/EVIDENCE.md:46-63`). The generic payload builder sorts manual/consolidated rows by `best_score` (`lib/alerts/payload-builder.ts:39-69`), but the similarity branch explicitly bypasses it (`app/api/cron/condition-alert-deliver/route.ts:1836-1845`).

**Severity:** bug. **Confidence:** high.

### 6. Imperative “Go” versus manual “Worth a look”

**Finding.** Two separate presentation paths intentionally diverge. Similarity uses the centralized registry, where canonical `go` renders `Go {beach}` and the body includes wave/time, wind, and tide (`lib/notifications/registry.ts:776-818`). Manual alerts use `formatPushNotification`, where canonical `maybe` renders `Worth a look — {beach}, {window}` (`lib/alerts/push-formatter.ts:119-169`). The old similarity formatter in `push-formatter.ts` is dead for current similarity rows because they are partitioned into the registry path (`lib/alerts/push-formatter.ts:45-89`; `app/api/cron/condition-alert-deliver/route.ts:897-919`, `app/api/cron/condition-alert-deliver/route.ts:2236-2247`). PB's personal `GOOD` overrode physical 65/`Maybe`, so the stronger title is mechanically consistent with current canonical policy but misleading as surf advice.

**Evidence.** The tray says `Go` for Osprey/PB, while the same morning's Blacks manual row says `Worth a look` with conditionScore 64.6 (`../audit/EVIDENCE.md:7-16`, `../audit/EVIDENCE.md:60-64`).

**Severity:** design flaw. **Confidence:** high.

### 7. Lead time and day-ahead queueing

**Finding.** The policy is fixed: scan 72 hours, choose the single highest score in the entire horizon, and send 60 minutes before its window. Queue residence time is incidental. Tuesday's 13:00Z scan selected Wednesday 15:00Z Osprey, so it sat for 25 hours; Wednesday's 13:00Z scan selected Wednesday 18:00Z PB, so it sat four hours. Both still gave one hour of user notice. Overlapping scans can queue multiple beaches for the same local date because dedupe is beach/window/verdict and the former one-user/day index is explicitly dropped (`supabase/migrations/20260724005515_similarity_alert_canonical_dedupe.sql:12-30`). There is no travel-time-aware or minimum-planning-lead policy.

**Evidence.** Exact timestamps are in `../audit/EVIDENCE.md:46-58`. Horizon and lead are `app/api/cron/similarity-alerts/route.ts:90-116`; global ranking is `lib/alerts/similarity-best-pick.ts:80-115`; `created_at` is insertion-time default (`supabase/migrations/20260408163000_add_condition_alerts.sql:63-76`).

**Severity:** design flaw. **Confidence:** high.

### 8. Cross-rule caps

**Finding.** There is no effective per-user daily or weekly cap spanning similarity + manual/preset alerts. Manual/preset delivery enforces a 24-hour per-rule cooldown, optional rule weekly cap, and hard user cap of 10 sent attempts per seven days (`lib/alerts/throttle.ts:20-60`; `app/api/cron/condition-alert-deliver/route.ts:1169-1203`, `app/api/cron/condition-alert-deliver/route.ts:1205-1256`). Similarity explicitly bypasses all of those gates (`app/api/cron/condition-alert-deliver/route.ts:1836-1845`), and the test suite locks that policy in (`__tests__/api/cron/condition-alert-deliver.test.ts:2759-2787`). Because similarity terminal outcomes are nevertheless written into `alert_delivery_attempts`, they count against later manual alerts while manual counts do not block similarity (`lib/notifications/registry.ts:843-875`). The worker's cross-source slot is only user + **same beach** + local alert date, with priority forecast/manual 3, similarity 2, home call 1 (`lib/notifications/worker.ts:270-343`; `lib/notifications/registry.ts:663-679`, `lib/notifications/registry.ts:755-771`, `lib/notifications/registry.ts:879-888`; `supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:7-16`, `supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:80-150`). Different beaches do not collide. Quiet hours defer pushes from 22:00–04:00 local; they are not a cap (`lib/notifications/quiet-hours.ts:12-23`; `lib/notifications/worker.ts:889-903`).

**Evidence.** Blacks, Osprey, and PB all sent on one morning at three different beaches (`../audit/EVIDENCE.md:46-64`), exactly outside the same-beach slot contract.

**Severity:** design flaw. **Confidence:** high.

### 9. Seven enabled manual rules that never matched

**Finding.** Every configured condition is an AND gate with exact comparisons (`lib/alerts/condition-evaluator.ts:5-110`). Most importantly, `swell_period_min` uses `forecast.swell_1_period ?? forecast.wave_period` (`lib/alerts/condition-evaluator.ts:24-26`): it compares the first/primary swell period whenever present, **not** the dominant wave period displayed by the site. The shared forecast adapter explicitly says stored `wave_period` represents the dominant wave train and can disagree with `swell_1_*` (`lib/domains/scoring/discovery-adapter.ts:69-107`). The cron only evaluates the beach's current local day and daylight hours (`app/api/cron/condition-alert-evaluate/route.ts:385-455`), then forms contiguous all-condition windows (`lib/alerts/window-finder.ts:17-45`).

Most likely single blocker for each never-matched row (a code-only likelihood, not a measured failure count):

| Rule / evidence row | Most likely blocker | Why | Confidence |
|---|---|---|---|
| `2ee1844b` Del Mar (`../audit/EVIDENCE.md:33`) | `swell_period_min = 14` | Applied to `swell_1_period`; 14s primary swell plus the other AND gates is rare. | medium |
| `7af1ef41` OB Best (`../audit/EVIDENCE.md:34`) | `wind_direction = offshore` | Exact beach-relative class is required; calm/cross-shore fails even if speed is ≤5kt. | medium-low |
| `1f2a5519` duplicate OB Best (`../audit/EVIDENCE.md:35`) | `wind_direction = offshore` | Identical conditions, so identical blocker; duplication does not broaden coverage. | medium-low |
| `5d5e4fb0` Epic OB (`../audit/EVIDENCE.md:36`) | `wind_direction = offshore` | Preset requires exact offshore simultaneously with size, period, tide, and swell arc. | medium-low |
| `499c19be` Scripps 2 (`../audit/EVIDENCE.md:37`) | `swell_period_min = 16` | A 16s first swell is exceptionally restrictive. | high |
| `1097f12a` Pacific Beach 5 (`../audit/EVIDENCE.md:38`) | `swell_period_min = 14` | First-swell ≥14s must coincide with falling tide, 15:00–20:00, and ≤10kt wind. | medium |
| `19bf373c` Osprey 5 (`../audit/EVIDENCE.md:39`) | `swell_period_min = 13` | First-swell ≥13s is the strongest single rarity; ≤2ft, rising tide, 15:00–20:00, and ≤7kt compound it. | low |

The current UI does **not** default users toward 14–16 seconds: adding period starts at 10s, while presets use 10s (`epic_conditions`) or 12s (`clean_groundswell`) (`components/alerts/condition-builder.tsx:108-136`; `lib/alerts/presets.ts:111-180`). It does nudge toward strict conjunctions: the management screen starts every new rule at 1–3 ft and ≤5kt and calls that the recommended small-clean setup (`components/alerts/alerts-management-page.tsx:73-77`, `components/alerts/alerts-management-page.tsx:537-540`, `components/alerts/alerts-management-page.tsx:801-805`, `components/alerts/alerts-management-page.tsx:892-901`); adding wind direction defaults to exact offshore (`components/alerts/condition-builder.tsx:121-125`). Numeric validation accepts period up to 30s and wind up to 80kt but gives no rarity/feasibility warning (`lib/alerts/condition-validation.ts:204-215`; `components/alerts/condition-builder.tsx:288-302`, `components/alerts/condition-builder.tsx:336-350`). The current builder exposes no time-of-day, weekday, frequency, or quiet-hours controls (`components/alerts/condition-builder.tsx:7-39`), so the exact 14–16s/time-window combinations are legacy or were created through another surface/API, not nudged by this current form.

**Evidence.** Seven rows and their conditions are at `../audit/EVIDENCE.md:33-42`. No per-condition failure counters exist in the evaluator, so the table is necessarily probabilistic.

**Severity:** bug. **Confidence:** high. (The feasibility UX is a separate design flaw; individual blocker attribution uses the confidence shown in the table.)

### 10. `favorite_beaches.alerts_enabled = false`

**Finding.** It does not disable explicit `alert_rules`, and similarity does not read it. Similarity fetches every favorite's `beach_id` regardless of the flag (`app/api/cron/similarity-alerts/route.ts:696-701`), although the favorite list is effectively redundant in the current candidate builder because only nearby IDs are hydrated and all nearby IDs are selected (`app/api/cron/similarity-alerts/route.ts:725-800`). The live runtime read of `alerts_enabled = true` is in Swell Watch audience construction (`lib/alerts/swell-watch/audience.ts:175-186`); Swell Watch separately treats an enabled explicit rule as an active beach relationship even when the favorite flag is false (`lib/alerts/swell-watch/audience.ts:189-202`, `supabase/migrations/20260824130000_create_swell_watch_production_approval_authority.sql:492-503`). The flag is therefore a favorite-derived Swell Watch opt-in, not a master alert kill switch.

**Evidence.** Every favorite is false while explicit rules and these pushes exist (`../audit/EVIDENCE.md:20-25`, `../audit/EVIDENCE.md:27-58`). The only user-facing mutation found sets the flag true when “Get Alerts” favorites a beach (`actions/beach/beach-favorite-actions.ts:127-195`).

**Severity:** working as intended. **Confidence:** high. (The field/UI meaning is still ambiguous.)

## 4. Defect list, ranked by user impact

1. **Similarity's scope and name disagree.** A Scripps-labelled rule searches around the device and applies a cross-spot break-type profile. **Smallest safe fix:** either restrict a beach-scoped rule to `configured_beach_id`, or rename the single auto rule to “Best match near you” and stop presenting Scripps as its scope. Do not keep both semantics under one rule type. **Tests:** update/add scope cases in `__tests__/api/cron/similarity-alerts.test.ts`, candidate ranking in `__tests__/lib/alerts/similarity-best-pick.test.ts`, and management copy expectations in `__tests__/components/alerts/alerts-management-page.test.tsx`.

2. **Overlapping scans can send multiple similarity pushes for one local day.** The code/comment still says “once-per-day,” but the user/day index was removed and the active key is beach/window/verdict. **Smallest safe fix:** if product intent is one daily personal pick, enforce a database uniqueness key on `(user_id, alert_date)` for similarity and choose/update the best candidate deterministically; otherwise implement an explicit per-user daily push cap before delivery. **Tests:** change `__tests__/migrations/similarity-alert-canonical-dedupe.test.ts`, add overlapping Tuesday/Wednesday horizon coverage in `__tests__/api/cron/similarity-alerts.test.ts`, and add cross-beach/day coverage to `__tests__/notifications/surf-alert-arbitration.test.ts`.

3. **Personal resemblance can issue objective `Go` copy over a physically mediocre window.** PB's 65/`Maybe` became `Go` solely because its personal label was `GOOD`. **Smallest safe fix:** keep “personal match” and “surf call” distinct: require the physical result to be `go` before using imperative `Go`; otherwise title it “Matches your best”/“Worth a look.” **Tests:** update canonical cases in the recommendation decision tests, registry copy in `__tests__/notifications/registry.test.ts` and `__tests__/lib/notifications/similarity-match.test.ts`, plus PB-like conditionScore 65 coverage in `__tests__/api/cron/similarity-alerts.test.ts`.

4. **No symmetric user-level notification budget.** Similarity bypasses the 10/week cap yet its sends count against manual rules; same-beach arbitration does not prevent three-beach mornings. **Smallest safe fix:** apply one worker-level per-user surf-alert budget across `forecast_alert`, `similarity_match`, and `home_morning_call`, with explicit priority and a documented daily limit. **Tests:** reverse the bypass expectation at `__tests__/api/cron/condition-alert-deliver.test.ts:2759-2787`; extend `__tests__/notifications/surf-alert-arbitration.test.ts` and `__tests__/notifications/worker.test.ts` for different beaches and priority.

5. **Decision metadata lies about session count and conflates confidence types.** **Smallest safe fix:** return an effective contributing count (`v_pref_count`) alongside global `sessions_in_profile`, carry the effective count into `personalMatch.sessionCount`/confidence, and rename the numeric snapshot field to `forecast_confidence` while retaining categorical `match_confidence`. **Tests:** strengthen the match-score migration tests and `__tests__/api/cron/similarity-alerts.test.ts` to assert a nonzero propagated contributing count and both named confidences; update schemas/tests in `__tests__/lib/notifications/similarity-match.test.ts` and `__tests__/notifications/registry.test.ts`.

6. **Explanation hides 65% of the base personal-score weights and all adjustments.** The SQL creates multiple bullets; `firstReasonBullet` throws all but wave height away, and lock-screen context pushes even that reason out. **Smallest safe fix:** retain a short multi-factor explanation (for example, the two largest positive/negative contributors) and surface “personal match” in the title/body. **Tests:** update reason snapshot assertions in `__tests__/api/cron/similarity-alerts.test.ts` and push-body assertions in `__tests__/lib/notifications/similarity-match.test.ts`.

7. **Manual period rules evaluate a different wave train than the displayed forecast.** **Smallest safe fix:** compare `swell_period_min` to `wave_period` (the dominant train), or rename the field/UI to “first swell period” if that is truly intended. **Tests:** update `__tests__/lib/alerts/condition-evaluator.test.ts` with mixed-swell cases where `swell_1_period` and `wave_period` disagree; add a cron integration case in `__tests__/api/cron/condition-alert-evaluate.test.ts`.

8. **The rule UI permits implausible AND combinations without feedback and defaults new management rules to ≤5kt.** **Smallest safe fix:** add inline “rare match” warnings for period ≥14s, wind ≤6kt, and heavily conjunctive rules; do not block advanced users. **Tests:** update `__tests__/components/alerts/alerts-management-page.test.tsx` and add focused `ConditionBuilder` warning tests.

9. **Similarity `best_score` is structurally wrong.** **Smallest safe fix:** have `try_insert_similarity_alert` accept and store the normalized personal score (or make `best_score` nullable and remove the fallback); do not leave a meaningful column at zero. **Tests:** update `__tests__/migrations/similarity-alert-canonical-dedupe.test.ts`, `__tests__/api/cron/similarity-alerts.test.ts`, and the legacy fallback case in `__tests__/api/cron/condition-alert-deliver.test.ts`.

10. **There are two similarity implementations with different labels and selection semantics.** Alerts use the SQL continuous-distance engine; `lib/services/similarity-insights-service.ts` is a separate bucket engine using rating ≥3, top-five matches, and `Perfect/Great/Good/Low` labels (`lib/services/similarity-insights-service.ts:1-20`, `lib/services/similarity-insights-service.ts:325-343`, `lib/services/similarity-insights-service.ts:405-473`, `lib/services/similarity-insights-service.ts:575-583`). **Smallest safe fix:** designate one engine as canonical and route both alerts and insights through it; until then, do not claim UI insights explain alert scores. **Tests:** consolidate expectations now split between `__tests__/lib/services/similarity-insights-service.test.ts` and the similarity cron/migration tests.

## 5. Open questions

1. **Exactly how many of the 42 sessions qualified, and which rows produced the 2.8 ft peak?** The code proves the source but the evidence does not include ratings, timestamps, snapshots, or break types. Desired read-only SQL:

   ```sql
   WITH target AS (
     SELECT b.break_type
     FROM public.alert_queue q
     JOIN public.beaches b ON b.id = q.beach_id
     WHERE q.id::text LIKE '2905520e%'
     LIMIT 1
   )
   SELECT
     count(*) AS qualifying_rated_sessions,
     count(*) FILTER (WHERE s.rating >= 4) AS positive_profile_sessions,
     round(
       sum(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') * (s.rating - 3))
       FILTER (WHERE s.rating >= 4)
       / nullif(sum(s.rating - 3) FILTER (WHERE s.rating >= 4), 0),
       2
     ) AS weighted_wave_peak_ft,
     jsonb_agg(jsonb_build_object(
       'session_id', s.id,
       'beach_id', s.beach_id,
       'rating', s.rating,
       'arrival_time', s.arrival_time,
       'wave_height', sfs.forecast_snapshot->>'wave_height',
       'wave_period', sfs.forecast_snapshot->>'wave_period'
     ) ORDER BY s.arrival_time DESC) FILTER (WHERE s.rating >= 4) AS contributing_sessions
   FROM public.sessions s
   JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
   LEFT JOIN public.beaches sb ON sb.id = s.beach_id
   CROSS JOIN target t
   WHERE s.user_id = '73040cff-afe9-4fa0-a874-2016203fc015'
     AND s.status = 'completed'
     AND s.rating IS NOT NULL
     AND s.arrival_time > now() - interval '12 months'
     AND s.deleted_at IS NULL
     AND sfs.forecast_snapshot IS NOT NULL
     AND (t.break_type IS NULL OR sb.break_type = t.break_type OR sb.break_type IS NULL);
   ```

2. **What exact candidate/slot leaderboard did each run see?** The cron logs only aggregate counters (`app/api/cron/similarity-alerts/route.ts:419-425`), and both device location and forecasts are mutable. Desired log for run timestamps `2026-09-15T13:00Z` and `2026-09-16T13:00Z`: one structured row per candidate slot containing `user_id`, `rule_id`, location `captured_at`, radius, beach ID/name/distance, forecast ID/time, physical score, personal base score, adjustments, final score/label/confidence, reject reason, and final rank. Without that, Osprey's 9.4 is known to have won, but the losing candidates cannot be reconstructed confidently.

3. **Which single condition historically blocked each manual rule?** The evaluator records only whole-rule matches, not per-condition failures. Desired read-only extract for offline evaluation with the repository's exact `evaluateConditions` semantics:

   ```sql
   SELECT
     ar.id AS rule_id,
     ar.name,
     ar.conditions,
     b.id AS beach_id,
     b.timezone,
     b.wind_offshore_deg,
     b.wind_offshore_tol_deg,
     b.aspect_deg,
     ef.forecast_at,
     ef.wave_height,
     ef.wave_period,
     ef.swell_1_period,
     ef.swell_1_direction,
     ef.wind_speed,
     ef.wind_direction_deg,
     ef.tide_height,
     ef.tide_status
   FROM public.alert_rules ar
   JOIN public.beaches b ON b.id = ar.beach_id
   JOIN public.enhanced_forecasts ef ON ef.beach_id = ar.beach_id
   WHERE ar.user_id = '73040cff-afe9-4fa0-a874-2016203fc015'
     AND ar.enabled = true
     AND ar.last_matched_at IS NULL
     AND ef.forecast_at >= now() - interval '90 days'
   ORDER BY ar.id, ef.forecast_at;
   ```

   Run each returned hour through `evaluateConditions` with one condition removed at a time and report pass counts. A raw SQL approximation would not reproduce beach-relative wind classes, daylight, local-time, and range-string parsing faithfully.

4. **Which SQL match function body is actually installed in production?** Main contains a later file explicitly marked “NOT YET APPLIED” (`supabase/migrations/20260811183000_fix_match_score_core_board_aliases.sql:1-29`), while it identifies `20260622064000` as the production definition. Desired verification query:

   ```sql
   SELECT
     p.oid::regprocedure AS signature,
     pg_get_functiondef(p.oid) AS definition
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'compute_user_match_score_core',
       'compute_user_match_score',
       'compute_user_match_score_batch',
       'try_insert_similarity_alert',
       'claim_surf_alert_slot'
     )
   ORDER BY p.proname, p.oid::regprocedure::text;
   ```

5. **How were the 14–16s/time-window manual rules created?** The current form cannot author time/day/frequency fields, and no creation provenance is present in the evidence. Desired rows/logs: `alert_rules.created_at`, `updated_at`, `auto_created_at`, full `conditions`, and any `alert_rule_created` analytics event metadata for rule IDs `2ee1844b`, `7af1ef41`, `1f2a5519`, `5d5e4fb0`, `499c19be`, `1097f12a`, and `19bf373c`. This would distinguish current UI behavior from legacy UI/API/import behavior.

Read-only static audit only. Per instruction, no database query, application run, dependency installation, or test command was executed.
