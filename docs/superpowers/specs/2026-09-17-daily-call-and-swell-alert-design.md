# Daily Call and Swell Alert — design

**Date:** 2026-09-17
**Owner:** Steven
**Status:** design approved in conversation; awaiting written review
**Repos:** `quiver` (producers, arbitration, data), `quiver-native` (settings, deep link, banner)
**Supersedes:** similarity-match alerts, home-morning-call push
**Inputs:** `.planning/2026-09-17-push-alerts-audit/` (audit, evidence, copy research), `docs/features/INCOMING_SWELL_ALERT.md` (paused swell design, Q1–Q5 decisions carried forward)

## 1. Why

On 2026-09-16 the founder's account received "Go Osprey Point" and "Go PB Point" pushes for 2–2.7 ft days. The audit traced both to the similarity-match engine: its "profile peak 2.8 ft" was learned from a single break-compatible session, the cron hard-codes `sessionCount: 0`, a GOOD/EPIC personal label overrides a physical "Maybe" into "go", the rule is not scoped to the beach it is named after, and similarity bypasses every cross-rule cap. Beyond the bugs, the concept is wrong: resemblance to past sessions matches ordinary days, and only ~13% of users log sessions at all.

Alerts are the one activation funnel known to be broken (~6.5% conversion; D7 4.5%). The fix is not another producer. It is one surf push a user can trust.

## 2. Decisions (settled)

| # | Decision |
|---|---|
| D1 | Two new cadences: a **daily call** (morning, go-only) and a **swell alert** (evening before, a few times a month). |
| D2 | Daily call is silent on maybe and flat days. No "rest up" pushes. |
| D3 | Daily call picks the best **go** in the user's pool within drive range. Ties: favorite beats nearby, home beats other favorites. |
| D4 | The window is bounded by real drivers (tide, wind, swell direction, daylight), not hourly buckets, and the copy names them. |
| D5 | Send time is a **user preference** in the user's timezone: 5:00–8:00 in 30-minute steps or "at sunrise". Default **06:00**. |
| D6 | The morning call covers the whole day's best window, including afternoon windows. |
| D7 | Swell alert = the existing swell-watch detector, filtered by rarity, sent the evening before at 17:00 local. |
| D8 | Manual watch rules stay as a third, user-owned producer. **Similarity retires.** Home-morning-call retires. |
| D9 | One surf push per user per morning across daily call and manual rules; the swell alert is the evening exception. No window is pushed twice. |
| D10 | Copy: titles come from a rotating pool, funny but the "why" is unmistakable. A serious tier drops the jokes. |
| D11 | Daily call and swell alert are **free**. Manual rules keep current entitlement caps. |
| D12 | Rollout: no shadow mode. Flag with an allowlist of four accounts for ~two weeks, then on for everyone. |

## 3. Producers

### 3.1 Daily call

**Cron.** Hourly, `app/api/cron/daily-call`. Each tick selects users whose local send time falls in the current hour (or whose sunrise does, when preference is `sunrise`). Replaces `home-morning-call`.

**Pool.** Favorites, home beach, custom spots with forecasts, plus recommendation-eligible beaches within drive range of the last location snapshot (30 miles default, `max_drive_minutes × 0.5` when set). Reuse the candidate builder in `similarity-alerts/route.ts:680-801` extracted into `lib/alerts/user-pool.ts` (the paused swell design already calls for this file).

**Verdict.** Today's daylight hours per beach through the canonical decision engine. **Change:** `personalMatchVerdict` may no longer promote a physical `maybe` to `go`. Personal fit reorders beaches that are already `go`; it never creates a `go`. Safety holds and water-quality closures veto as today.

**Window.** Contiguous `go` hours form the coarse span. Each edge is then refined to the driver that flips the verdict:

| Driver | Source | Precision |
|---|---|---|
| Tide turning or crossing the beach's range | tide prediction curve | exact, e.g. "rising to a 9:52 high" |
| Wind turning onshore or exceeding the beach limit | hourly forecast rows, linear interpolation between rows | rounded to 5 min, shown with `~` |
| Swell direction leaving the beach window | hourly rows, interpolated | `~` |
| Daylight | sunrise/sunset | exact |

A refined window shorter than 60 minutes is discarded. If a beach has no tide curve, the tide edge falls back to the hourly row with `~`.

**Ranking.** Physical score, then personal fit (skill, board quiver, onboarding size preference; session history only when ≥5 rated sessions with snapshots), then D3 tie order. Take the top window; if none, silent.

**Evaluation time.** Everything is evaluated at the user's send time against the latest forecast, so the call reflects the morning model run. There is no earlier planning pass.

**Edge cases.** Window already open at send time: send, worded live. Window closing within 30 minutes of send time: skip it, take the next go window or stay silent.

**Tap.** Beach Detail, window start time selected, drivers in the alert banner. Push data carries `reason`, `window_start`, `window_end`, `drivers[]`, `decision_id` so the banner never falls back to generic copy.

### 3.2 Swell alert

**Detector.** `lib/alerts/swell-watch-detector.ts` as is: rise ≥2 ft to a peak ≥3 ft at ≥11 s within the lookahead, cross-checked with NWS advisories where available (`major-swell-awareness`).

**Rarity filter** (new). Fire only if the peak day is the best day in the user's pool over the trailing 30 days, **or** the first `go` day after ≥3 flat days in the pool. The paused design's "flat-then-surfable" rule (Q1) is the second clause; its hybrid floor/ceiling (Q2, Q4) applies unchanged.

**Dedupe.** One alert per user per swell event. Key = `(user_id, event_key)` where `event_key` = peak date ± 1 day bucket plus lead beach, so a one-day forecast shift does not re-fire. Hard floor of 72 h between swell alerts per user.

**Send.** 17:00 local the evening before the first good day. The daily call handles the morning of, referencing the swell in its title. If the swell falls apart overnight the morning call is silent; no retraction is sent.

**Body contract.** Always: size and period, direction, peak day and part of day, top three beaches from the pool in rank order, one rarity line.

**Tap.** Beach Detail for the lead beach with the peak day selected; beaches two and three as chips. (Paused design Q6 option B. A multi-beach swell page is a later step.)

**Preference.** New `notif_swell_alerts`, default true. Free (paused Q8). Own toggle, not folded into similarity (paused Q9).

### 3.3 Manual rules

Unchanged in evaluation and copy. Two fixes from the audit ride along because they change what "matches" means:

- `swell_period_min` compares against the displayed dominant `wave_period`, not `swell_1_period`. (Or the field is relabelled "primary swell period" if that was intended; decide in implementation review, default to the former.)
- The actionable-window selector stops treating a window as eligible 15 minutes after its best hour.

## 4. Arbitration

`surf_alert_delivery_slots` key changes from `(user_id, beach_id, alert_date)` to `(user_id, alert_date)`.

1. **One morning push.** Manual rule (priority 3) beats daily call (2). If both fire for different beaches, the manual rule is the push; the daily call's beach becomes a second body line and the top card on Home.
2. **Swell alert is exempt** from rule 1 because it sends the evening before. It claims the slot for its own send date (priority 1) and never the following date, so a processed swell alert cannot block the next morning's call. The daily call reads `swell_event_alerts` for that user and date and, when a row exists, uses the swell-referencing title variant.
3. **No repeat for a window.** A `(beach_id, window_start)` already pushed by any producer is not pushed again that day, including by a manual rule.
4. **Quiet hours** stay 22:00–04:00 and never conflict with the 05:00–08:00 send options.
5. **Water-quality and safety pushes** sit outside the budget.

The five-minute enqueue coalescing delay stays. The similarity throttle bypass in `condition-alert-deliver` is deleted with the similarity branch.

## 5. Copy system

Source of truth: `.planning/2026-09-17-push-alerts-audit/COPY_RESEARCH.md` (40 swell titles, 30 daily titles, tagged; founder to cut). Shipped as a versioned JSON file `lib/notifications/copy/surf-titles.v1.json`, not a table.

**Voice.** Chill, reliable, smart. Title leads with the judgment, ≤40 characters after substitution, one place, one reason from payload data. No emoji. Never "NOW FIRING".

**Tags.** Swell: `first-after-flat`, `biggest-in-weeks`, `weekend`, `weekday`, `long-period`, `south`, `northwest`, `manageable`, `serious`, `hawaii`, `generic`. Daily: `tide-driven`, `wind-driven`, `early`, `afternoon`, `home-beach`, `not-home`, `live`, `generic`.

**Selection rules.**

- Tags must be proven by event data. Never infer `long-period` or `biggest-in-weeks` to reach a joke.
- `serious` (≥8 ft or safety-hold adjacent) overrides every other tag. No film references.
- Tag priority for swell: `serious` → `hawaii` → `biggest-in-weeks` → `first-after-flat` → `weekend`/`weekday` → direction/period → `generic`.
- No exact-title repeat per user for 30 days (daily) / 120 days (swell). Among eligible titles, pick by a stable hash of user + event so retries are idempotent.
- At most one film allusion in three swell alerts per user.
- Render, then count Unicode characters. Over 40: try the shortest eligible title; fall back to `{beach} {start}–{end}` (daily) or `Swell peaks {peak_day}` (swell).
- Long beach names use an approved short display name column, never a runtime abbreviation.

**Examples.**

> **Wind stays polite. Osprey 7:15–9:40**
> Offshore through ~9:40, then it turns. Rising to a 9:52 high. 3ft @ 13s SW.

> **Not home. Better. Osprey 8:00–10:00**
> Blacks turns onshore; Osprey holds light offshore with 3ft @ 13s SW.

> **Big Wednesday at Blacks**
> SW swell, 6ft @ 16s, peaking Wednesday morning. Blacks, Osprey, Scripps. Best since August.

> **Heavy water at Blacks**
> Serious NW surf: 10ft @ 18s, peaking Thursday morning. Blacks, Osprey, Scripps. Biggest of the season.

## 6. Data

| Change | Detail |
|---|---|
| `profiles.daily_call_time` | text, default `'06:00'`; values `05:00`…`08:00` in 30-min steps or `sunrise` |
| `profiles.notif_swell_alerts` | bool, default true |
| `profiles.notif_forecast_alerts` | reused as the daily-call toggle so existing opt-outs carry over |
| `beaches.short_name` | text, nullable; approved short display names for copy |
| `surf_alert_delivery_slots` | key `(user_id, alert_date)`; priorities manual 3, daily 2, swell 1 |
| `swell_event_alerts` (new) | `user_id`, `event_key`, `peak_date`, `lead_beach_id`, `payload jsonb`, `sent_at`, unique `(user_id, event_key)` |
| `alert_rules` | similarity rows set `enabled=false` by migration; not deleted |
| `alert_queue` | no new similarity rows; existing rows untouched |
| `notification_events` | new type `daily_call`; `swell_watch` type gets real channels |

## 7. Retirements

- `app/api/cron/similarity-alerts` and its `vercel.json` entry; `try_insert_similarity_alert`, `compute_user_match_score_batch` callers (RPCs stay for Beach Detail insights until the second engine question is settled).
- `app/api/cron/home-morning-call` and `lib/cron/home-beach-push-runner.ts`.
- The similarity branch in `condition-alert-deliver` (lines ~1836–2320) and the legacy similarity formatter in `lib/alerts/push-formatter.ts`.
- `ALERTS_DELIVERY_USER_ALLOWLIST` for surf alerts once the daily call is on for everyone (see §9). The audit found ≥49 users silently gated by it in 30 days.
- Native: Alert Center stops rendering `similarity_match` rules.

## 8. Native changes (`quiver-native`)

- Settings → Notifications: "Daily call time" picker (5:00–8:00 / sunrise, default 6:00) and "Swell alerts" toggle. Also expose `notif_water_quality`, which the audit found missing.
- Push routing: new `daily_call` type → Beach Detail with `window_start` selected; `swell_watch` → Beach Detail for lead beach with `peak_date` selected and two beach chips.
- Alert banner renders `drivers[]` from push data.
- Registration: send `installation_id` so the modern registration RPC is used and device rows stop multiplying. Not a blocker for launch; ride-along if the packet is small.

## 9. Rollout

**Flag.** `DAILY_CALL_ENABLED` plus `DAILY_CALL_USER_ALLOWLIST`, read through `lib/flags/` like `isAlertsDeliveryEnabled`. No shadow mode.

**Allowlist (verified in prod 2026-09-17):**

| Account | user_id | Notes |
|---|---|---|
| omg.its.thefuture@gmail.com | `73040cff-afe9-4fa0-a874-2016203fc015` | Steven, advanced, home OB Pier, 6 active devices |
| stcha0004@gmail.com | `610a5745-1fac-429c-8f5a-8d085783a5ea` | Steven, "Johnny Utah", home Blacks, 144 active device rows (dev/sim) |
| shapandashore@gmail.com | `bcacdc51-b01b-4702-ac0b-fb492c0a926a` | Shapan, beginner, 1 device |
| chrisluna220@gmail.com | `bb33a36a-466f-44d1-8ea3-9983e66efd3d` | Chris Luna, intermediate, home Scripps, 1 device (ignore the `.co` typo duplicate) |

**Steps.**

1. Merge daily call + arbitration + retirements behind the flag. Allowlist the four accounts. Each morning, compare the push to what Home shows at the same time; they must agree.
2. **Reminder.** The day the allowlist flag ships, schedule a reminder for Steven **14 days later** to turn `DAILY_CALL_ENABLED` on for everyone and clear the allowlist. The exact date is unknown until step 1 lands, so the reminder is created then, not now. This is a required step of the ship checklist.
3. Turn on for everyone with alerts enabled. Remove the surf-alert production allowlist.
4. Swell alert ships two weeks after step 3, behind `SWELL_ALERT_ENABLED` with the same allowlist, informed by the no-send study.

Expected signal from the allowlist fortnight: two to four go mornings a week across the four pools, so roughly eight to twelve pushes plus silent days, afternoon windows, and at least one not-home pick.

## 10. Success measures

Read at the stated points; work stays `shipped_unvalidated` until then.

| Measure | Baseline | Read at |
|---|---|---|
| Daily-call tap rate vs `forecast_alert` tap rate | current forecast_alert tap rate | 2 weeks after step 3 |
| Share of daily-call mornings with a session logged that day | — | 4 weeks after step 3 |
| D7 for users who received ≥1 daily call in week one | 4.5% | 6 weeks after step 3 |
| Swell alert precision: share of alerts whose peak day scored `go` | from no-send study | at swell launch |
| Push opt-out rate | current | continuous |

## 11. Testing

- Unit: window refiner (each driver, `~` rounding, <60 min discard, missing tide curve), ranker with D3 tie order, budget gate (manual beats daily, different beaches → one push + second line, no window repeat), send-time resolution per preference and timezone incl. sunrise and DST, copy rotation (tag proof, serious override, 40-char fallback, hash stability, repeat windows), swell rarity filter and event-key dedupe.
- Integration: one fixed forecast fixture drives both producers plus a matching manual rule on the same day and asserts exactly one morning push and one evening swell push.
- Canonical engine: `maybe` + `GOOD` personal label → `maybe`, not `go`.
- Maestro: daily-call tap lands on Beach Detail with the window selected and the banner showing drivers.
- Migration tests for the slot key change and `swell_event_alerts`.

## 12. Open questions (not blockers)

1. Tide curve coverage: confirm every beach in the pool has sub-hour tide predictions; identify the fallback set.
2. Whether `swell_period_min` should be relabelled rather than re-pointed (§3.3).
3. Long-beach short names: who approves the list.
4. The second similarity engine (`similarity-insights-service.ts`) used by Beach Detail insights stays; consolidating engines is a separate decision.
5. Multi-beach swell page (paused Q6 option A) after the swell alert has a month of live data.
