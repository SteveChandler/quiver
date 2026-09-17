# Packet B — Push notification surface, usefulness, and native client audit

Audit basis: detached web `origin/main`, the native repository at `/Users/stevenchandler/Desktop/dev/quiver-native`, and the supplied 30-day production evidence. This is a code-and-evidence review only; no production environment values or database state were queried. The founder account is an advanced San Diego surfer with 42 logged sessions, push/forecast/similarity/reminder preferences enabled, and three currently active device rows among eleven historical rows (`../audit/EVIDENCE.md:20-25`).

## B1. Inventory of every push producer

Vercel cron expressions are UTC. Pacific conversions below are `PDT / PST`; fixed UTC jobs therefore move by one local hour at daylight-saving boundaries. All live producers ultimately create `notification_events`; the minutely worker claims them, applies registry policy, fans out to active devices, and writes `notification_delivery_attempts` (`lib/notifications/enqueue.ts:56-127`; `app/api/cron/notifications-deliver/route.ts:26-52`; `lib/notifications/worker.ts:1645-1769`).

| Producer / status | Trigger and Pacific schedule | Audience and gating | Caps, cooldown, quiet hours | Copy contract, realistic example, and tap target | Logs |
|---|---|---|---|---|---|
| **Session like — live** | A non-owner likes a session; the API calls the atomic `like_session_with_notification` RPC (`app/api/sessions/[id]/likes/toggle/route.ts:58-77`; `supabase/migrations/20260430180518_social_producer_functions.sql:23-69`). | Recipient must have master push and `notif_likes`; self-likes are suppressed (`lib/notifications/registry.ts:529-541`). | One event per session/actor dedupe key; shared 22:00–04:00 local defer window (`app/api/sessions/[id]/likes/toggle/route.ts:70-76`; `lib/notifications/registry.ts:529-541`). | `Alex liked your session` / `Blacks Beach`; tap opens that session (`lib/notifications/registry.ts:543-553`; native `src/lib/push-notifications.ts:666-670`). | `notification_events`, `notification_delivery_attempts`; also an in-app `notifications` row (`lib/notifications/registry.ts:529-559`). |
| **New follower — live** | A user follows another user; atomic follow+event RPC (`app/api/users/[id]/follow/toggle/route.ts:72-96`; `supabase/migrations/20260430180518_social_producer_functions.sql:119-143`). | Master push and `notif_follows`; self-follow is rejected/suppressed (`lib/notifications/registry.ts:561-570`; `supabase/migrations/20260430180518_social_producer_functions.sql:98-104`). | Weekly-bucketed actor→recipient dedupe; shared 22:00–04:00 defer (`app/api/users/[id]/follow/toggle/route.ts:72-94`; `lib/notifications/registry.ts:561-570`). | `Alex followed you`; tap opens the follower's profile (`lib/notifications/registry.ts:572-583`; native `src/lib/push-notifications.ts:671-679`). | `notification_events`, `notification_delivery_attempts`, and in-app `notifications` (`lib/notifications/registry.ts:561-589`). |
| **Manual/preset condition alert (`forecast_alert`) — live only when two source-default-off flags are enabled** | Daily evaluation at `0 9 * * *` = **02:00 / 01:00**, followed by hourly delivery at `0 * * * *` (`vercel.json:137-139,161-166`). Evaluation writes matching rules to `alert_queue`; delivery revalidates against the latest forecast before enqueue (`app/api/cron/condition-alert-evaluate/route.ts:363-452,604-666`; `app/api/cron/condition-alert-deliver/route.ts:474-506,1677-1738`). | Enabled non-similarity rules; master push + `notif_forecast_alerts`; entitlement caps determine how many rules are evaluated; producer allowlist may exclude users (`app/api/cron/condition-alert-evaluate/route.ts:160-168,211-280`; `lib/notifications/registry.ts:663-679`; `app/api/cron/condition-alert-deliver/route.ts:388-404`). Both `ALERTS_DELIVERY_ENABLED` and `FORECAST_ALERT_DELIVERY_ENABLED` are false when unset (`lib/flags/alerts-delivery.ts:1-12`; `lib/flags/forecast-alert-delivery.ts:1-5`). | Per-rule 24-hour cooldown plus rolling 7-day user cap; `conditions.max_frequency_per_week`; dedupe per user+beach+alert-date+channel. Rule-specific quiet hours override the shared 22:00–04:00 default (`lib/alerts/throttle.ts:20-59`; `app/api/cron/condition-alert-deliver/route.ts:252-289,1169-1257,1569-1590`; `lib/notifications/worker.ts:1100-1136`). Intended send is two hours before the chosen window, but the selector remains eligible until **15 minutes after** the best hour (`app/api/cron/condition-alert-evaluate/route.ts:631-653`; `lib/alerts/actionable-window-selector.ts:6-28`). | `Worth a look — Blacks Beach, 8–9 AM` / `Blacks Beach 8 AM-9 AM — 4-5ft @ 13s, 5 mph`; tap opens Beach Detail with alert context (`lib/alerts/push-formatter.ts:119-190`; `../audit/EVIDENCE.md:60-64`; native `src/lib/push-notifications.ts:680-694`). | `alert_queue`, `alert_delivery_attempts`, `alert_deliveries`, `notification_events`, `notification_delivery_attempts`; in-app `notifications` (`app/api/cron/condition-alert-deliver/route.ts:830-963,1569-1590`; `lib/notifications/registry.ts:704-752`). |
| **Watched-call update — live through the condition pipeline** | Daily evaluator creates watched-call queue rows; hourly deliverer emits changes (`app/api/cron/condition-alert-evaluate/route.ts:321-363`; `app/api/cron/condition-alert-deliver/route.ts:1836-1936`). | Same master/forecast preference and delivery flags/allowlist as condition alerts; requires a qualifying prior call and category change (`lib/notifications/registry.ts:591-600`; `app/api/cron/condition-alert-deliver/route.ts:1836-1936`). | Category cooldowns: still-on 24h, call-changed 6h, better-nearby 12h, post-window 168h; shared 22:00–04:00 defer (`lib/notifications/registry.ts:591-607`). | Producer-supplied title/body, e.g. `Your call changed — Blacks Beach`; tap opens Beach Detail, or Home if the beach is absent (`lib/notifications/registry.ts:608-640`; native `src/lib/push-notifications.ts:695-719`). | `alert_queue`, `alert_delivery_attempts`, `notification_events`, `notification_delivery_attempts`, in-app `notifications` (`lib/notifications/registry.ts:642-660`). |
| **Similarity match — live only when `ALERTS_DELIVERY_ENABLED=true`; rollout allowlist can still suppress it** | Daily similarity scan at `0 13 * * *` = **06:00 / 05:00**; evaluates a 72-hour horizon and schedules approximately one hour before the selected window; hourly condition delivery enqueues it (`vercel.json:141-143`; `app/api/cron/similarity-alerts/route.ts:3-22,78-88,1039-1064`; `app/api/cron/condition-alert-deliver/route.ts:2118-2248`). | Enabled similarity rule, Pro/trial entitlement, home/recent-location context, global delivery flag and optional allowlist; worker applies master push + `notif_similarity_alerts` (`app/api/cron/similarity-alerts/route.ts:486-520,582-674`; `app/api/cron/condition-alert-deliver/route.ts:1987-2014`; `lib/notifications/registry.ts:755-771`). Candidate beaches are favorites plus nearby beaches and do **not** check `favorite_beaches.alerts_enabled`, so a rule stored under Scripps can recommend PB Point or Osprey Point (`app/api/cron/similarity-alerts/route.ts:680-801`; `../audit/EVIDENCE.md:27-42,46-58`). | Similarity insertion is one per user/local date; it explicitly bypasses the condition-alert cron's per-rule/user throttle. There is no registry cooldown. Shared 22:00–04:00 defer applies (`app/api/cron/similarity-alerts/route.ts:41-45`; `app/api/cron/condition-alert-deliver/route.ts:1836-1845`; `lib/notifications/registry.ts:755-771`). | `Go PB Point` / `2.0ft @ 14s · Wed 11am · S wind 5mph · rising tide`; tap opens Beach Detail (`lib/notifications/registry.ts:776-818`; `../audit/EVIDENCE.md:7-16`; native `src/lib/push-notifications.ts:720-760`). | `alert_queue`, `alert_delivery_attempts`, `notification_events`, `notification_delivery_attempts`, in-app `notifications` (`app/api/cron/condition-alert-deliver/route.ts:2118-2248`; `lib/notifications/registry.ts:820-876`). |
| **Home morning call — source-default-off** | Daily `0 13 * * *` = **06:00 / 05:00**; considers the home beach's 05:00–12:00 local forecasts (`vercel.json:145-147`; `app/api/cron/home-morning-call/route.ts:35-44,58-73`). | Requires `HOME_MORNING_CALL_ENABLED=true`, optional allowlist, home beach, master push, and `notif_reminders`; it has no entitlement gate (`lib/cron/home-beach-push-runner.ts:223-254`; `app/api/cron/home-morning-call/route.ts:230-238`). | One event per user/local date; same-beach surf slot priority 1; shared 22:00–04:00 defer (`app/api/cron/home-morning-call/route.ts:177-196`; `lib/notifications/registry.ts:879-900`). It can send a negative verdict (`Rest up today`) as well as a positive recommendation (`app/api/cron/home-morning-call/route.ts:166-196`). | `Pacific Beach: Worth a look` / `2.0ft @ 14s. Onshore wind.`; tap opens Home, not the beach (`lib/notifications/home-morning-call-presentation.ts:25-52`; native `src/lib/push-notifications.ts:803-806`). | `notification_events`, `notification_delivery_attempts` (`lib/cron/home-beach-push-runner.ts:317-359`). |
| **Weekend window — source-default-off** | Vercel invokes hourly Thursday–Saturday (`0 * * * 4-6`); the runner only acts at the user's **Friday 12:00 local** hour (`vercel.json:149-151`; `lib/cron/weekend-scout-runner.ts:247-255`). | Requires `WEEKEND_WINDOW_ENABLED=true`, optional allowlist, fresh recent location, master push, and `notif_reminders`; no entitlement gate is visible in the runner (`lib/cron/weekend-scout-runner.ts:212-252`). | One per user/weekend start via dedupe key; shared 22:00–04:00 defer (`lib/cron/weekend-scout-runner.ts:279-302`; `lib/notifications/registry.ts:903-912`). | `3 spots look promising this weekend` / `Blacks Beach leads Sat 7–9 AM. See your top picks and why.`; tap opens Explore → Weekend Scout (`lib/notifications/registry.ts:913-929`; native `src/lib/push-notifications.ts:807-831`). | `notification_events`, `notification_delivery_attempts` (`lib/cron/weekend-scout-runner.ts:279-316`). |
| **Swell watch — dead/shadow-only** | Daily `0 15 * * *` = **08:00 / 07:00** plus an hourly acquisition job at minute 15 (`vercel.json:153-159`). | `SWELL_WATCH_ENABLED` defaults off. Even when enabled, route documentation and code say it only evaluates shadow candidates and never enqueues (`app/api/cron/swell-watch/route.ts:1-6,243-248,310-334`). | Registry declares a 96-hour beach cooldown, but channels are empty, making it unreachable as a push (`lib/notifications/registry.ts:933-979`). | Dormant contract: `Swell incoming — Blacks Beach` / `Saturday: building to 8 ft @ 16s. Peak Sunday.`; nominal tap would open Beach Detail (`app/api/cron/swell-watch/route.ts:137-150`; native `src/lib/push-notifications.ts:832-846`). | Shadow cron output/major-swell evaluation data only; no `notification_events` from this route (`app/api/cron/swell-watch/route.ts:310-334`). |
| **Trial ending — live** | Daily `0 17 * * *` = **10:00 / 09:00**; targets trials ending in 36–60 hours (`vercel.json:177-179`; `app/api/cron/trial-ending-push-deliver/route.ts:54-62,151-169`). The code comment that this is always 09:00 Pacific is wrong during PDT (`lib/notifications/registry.ts:981-990`). | Trialing entitlement, master push, and at least one active device; no per-type preference or allowlist (`app/api/cron/trial-ending-push-deliver/route.ts:151-260`; `lib/notifications/registry.ts:981-990`). | One cron-level log per trial/user; **no quiet hours** (`app/api/cron/trial-ending-push-deliver/route.ts:176-193,274-327`; `lib/notifications/registry.ts:981-997`). | Producer title/body about the ending trial; tap opens Settings (`lib/notifications/registry.ts:992-996`; native `src/lib/push-notifications.ts:861-864`). | `trial_ending_push_log`, `notification_events`, `notification_delivery_attempts` (`app/api/cron/trial-ending-push-deliver/route.ts:274-327`). |
| **First-session nudge — live** | Daily `0 17 * * *` = **10:00 / 09:00**; signup age 6–8 days and fewer than three sessions (`vercel.json:181-183`; `app/api/cron/first-session-nudge-push/route.ts:6-7,403-484`). | Confirmed email, master push, active device; cohort copy may use home/forecast/entitlement context (`app/api/cron/first-session-nudge-push/route.ts:492-631`). No separate reminder preference is honored (`lib/notifications/registry.ts:999-1007`). | One `activation_push_log` row per user/nudge type; **no quiet hours** (`app/api/cron/first-session-nudge-push/route.ts:26-32,435-455`; `lib/notifications/registry.ts:999-1008`). | Examples include `Start your surf log` / `Check today's forecast, and log a session if you paddle out.`; tap opens Session Form (`app/api/cron/first-session-nudge-push/route.ts:322-351`; native `src/lib/push-notifications.ts:865-867`). | `activation_push_log`, `notification_events`, `notification_delivery_attempts` (`app/api/cron/first-session-nudge-push/route.ts:721-767`). |
| **Daily forecast-feedback nudge — source-default-off** | Daily `0 2 * * *` = **19:00 / 18:00 on the previous Pacific date**; runs after a candidate surf window has passed (`vercel.json:185-187`; `app/api/cron/daily-call-streak-reminder/route.ts:1-6,303-312`). | Requires `FORECAST_FEEDBACK_NUDGE_ENABLED=true`, master push + `notif_reminders`, a favorite beach, and no session/feedback for the candidate context (`app/api/cron/daily-call-streak-reminder/route.ts:131,166-168,303-390,512-526`; `lib/notifications/registry.ts:1041-1049`). Favorite `alerts_enabled` is not checked (`app/api/cron/daily-call-streak-reminder/route.ts:368-390`). | One daily category log per user; shared 22:00–04:00 defer (`app/api/cron/daily-call-streak-reminder/route.ts:343-354,629-644`; `lib/notifications/registry.ts:1041-1049`). | High confidence: `Surfed Blacks Beach today?` / `Log it in one tap.` Low confidence: `Catch a session today?` / `If you paddle out, log it when you are done.` The explicit `quiver://sessions/new` deep link opens Session Form (`lib/notifications/registry.ts:1051-1093`; `app/api/cron/daily-call-streak-reminder/route.ts:260-269`; native `src/lib/push-notifications.ts:651-664`). | `streak_reminder_log`, `forecast_feedback_contexts`, `notification_events`, `notification_delivery_attempts` (`app/api/cron/daily-call-streak-reminder/route.ts:512-526,595-644`). |
| **Weekly streak reminder — live** | Sunday `0 17 * * 0` = **10:00 / 09:00 Sunday** (`vercel.json:189-190`). | Master push + `notif_reminders`; user has a prior weekly streak but no session in the current week; optional allowlist (`app/api/cron/weekly-streak-reminder/route.ts:172-259`; `lib/notifications/registry.ts:1097-1105`). | One log per user/period; shared 22:00–04:00 defer (`app/api/cron/weekly-streak-reminder/route.ts:195-205,261-304`; `lib/notifications/registry.ts:1097-1105`). | `Keep your streak alive` / `Your 4-week streak ends Sunday. Log a session to keep it going.`; tap opens Session Form (`lib/notifications/registry.ts:1107-1126`; native `src/lib/push-notifications.ts:847-848`). | `streak_reminder_log`, `notification_events`, `notification_delivery_attempts` (`app/api/cron/weekly-streak-reminder/route.ts:261-304`). |
| **Water-quality transition — live** | Tuesday/Friday `0 13 * * 2,5` = **06:00 / 05:00**, after water-quality evaluation (`vercel.json:121-123`; `app/api/cron/water-quality-alerts/route.ts:16-24`). | Home beach changed status in prior 24h; user has `notif_water_quality=true`; mock users excluded. Worker separately applies master push/in-app prefs (`lib/services/water-quality/water-quality-alerts-service.ts:105-174`; `lib/notifications/registry.ts:1129-1142`). | One per user+beach+UTC status-change date; shared 22:00–04:00 defer (`lib/services/water-quality/water-quality-alerts-service.ts:212-231`; `lib/notifications/registry.ts:1129-1142`). | `Beach closed: Pacific Beach` / `High bacteria levels. Don't enter the water.`; advisory and all-clear variants; tap opens Beach Detail (`lib/notifications/registry.ts:1144-1178`; native `src/lib/push-notifications.ts:761-781`). | `notification_events`, `notification_delivery_attempts`, in-app `notifications` (`lib/services/water-quality/water-quality-alerts-service.ts:184-250`). |
| **Admin test — live, manual** | Admin-authenticated POST, no schedule (`app/api/admin/test-push/route.ts:18-50`). | Current admin only; master push preference; no per-type preference (`app/api/admin/test-push/route.ts:30-50`; `lib/notifications/registry.ts:1248-1259`). | Unique timestamp key allows repeated tests; no quiet hours (`app/api/admin/test-push/route.ts:27-29,44-50`; `lib/notifications/registry.ts:1248-1259`). | Default `Quiver Test Push` / timestamped FCM message; tap opens Settings (`lib/notifications/registry.ts:1261-1269`; native `src/lib/push-notifications.ts:849-852`). | `notification_events`, `notification_delivery_attempts` (`app/api/admin/test-push/route.ts:45-69`). |
| **Admin broadcast — live, manual, high blast radius** | Admin-authenticated POST, no schedule; targets distinct users with active device rows (`app/api/admin/broadcast-push/route.ts:20-35,49-72`). | Master push only; no per-type preference; optional `maxUsers` (`app/api/admin/broadcast-push/route.ts:10-17,69-72`; `lib/notifications/registry.ts:1273-1284`). | **Bypasses quiet hours.** Each request creates a new random broadcast ID, so repeating the same request rebroadcasts despite the misleading “retry dedup-safe” comment (`app/api/admin/broadcast-push/route.ts:30-31,74-95`; `lib/notifications/registry.ts:1273-1284`). | Admin-supplied title/body/URL. Native always routes `admin_broadcast` to Home; it does not honor the supplied `url` in this branch (`lib/notifications/registry.ts:1285-1294`; native `src/lib/push-notifications.ts:853-860`). | `notification_events`, `notification_delivery_attempts` (`app/api/admin/broadcast-push/route.ts:89-116`). |
| **Daily digest — dead contract** | No source producer found; registry explicitly disables all channels (`lib/notifications/registry.ts:1195-1205`). | N/A. | N/A. | Dormant title/body contract; native would route Home (`lib/notifications/registry.ts:1207-1245`; native `src/lib/push-notifications.ts:782-786`). | Legacy `notification_events` only, if any already exist. |

### B1 notes

- **The source tree cannot establish which default-off flags are currently enabled in production.** `ALERTS_DELIVERY_ENABLED`, `FORECAST_ALERT_DELIVERY_ENABLED`, `HOME_MORNING_CALL_ENABLED`, `WEEKEND_WINDOW_ENABLED`, `SWELL_WATCH_ENABLED`, and the feedback-nudge flag all require the exact string `true` in code, while `.env.example` documents Firebase but none of these rollout flags (`lib/flags/alerts-delivery.ts:1-12`; `lib/flags/forecast-alert-delivery.ts:1-5`; `.env.example:103-119`). The production rows prove condition/similarity delivery was enabled for at least some of the 30-day window, but do not reveal current settings (`../audit/EVIDENCE.md:83-120`).
- **`major-event-hold-evaluate` is not a push producer.** It runs hourly at minute 55, defaults off, and creates safety holds that can suppress positive recommendations (`vercel.json:197-198`; `app/api/cron/major-event-hold-evaluate/route.ts:426-451`; `lib/recommendations/major-event-hold/config.ts:5-22`).
- **`notifications-deliver` is the dispatcher, not another campaign.** It runs every minute and sends registry channels for already-created events (`vercel.json:165-166`; `app/api/cron/notifications-deliver/route.ts:26-52`).
- **Scheduling is defined in `vercel.json`; this worktree has no `vercel.ts`.** The complete push-related schedule block is `vercel.json:121-198`.
- **Legacy/dead surfaces remain.** `lib/services/push-notifications.ts` still exposes direct `sendPushNotification`, but no production caller was found; the current producer path is `enqueueNotification` → worker (`lib/services/push-notifications.ts:89-145`; `lib/notifications/enqueue.ts:56-127`). `swell_watch` and `daily_digest` retain payload/copy contracts despite having no deliverable channel (`lib/notifications/registry.ts:933-979,1195-1246`). `lib/alerts/push-formatter.ts` still contains an older similarity formatter even though current similarity copy is rebuilt by the registry (`lib/alerts/push-formatter.ts:51-90`; `lib/notifications/registry.ts:776-818`). These are drift risks, not current duplicate sends.
- **The similarity rule's beach label is misleading.** The native Alerts screen groups rules by their stored beach, but similarity fanout uses favorites and nearby beaches globally; the evidence's Scripps rule producing Osprey and PB is therefore consistent with current code, not proof of a routing bug (`app/api/cron/similarity-alerts/route.ts:680-801`; native `src/screens/alert-center.tsx:57-71`; `../audit/EVIDENCE.md:27-58`).
- **Manual alert timezone fallback is unsafe for West Coast users without a home-beach timezone.** Evaluation falls back to `America/New_York`, which can shift the interpreted local day/window by three hours (`app/api/cron/condition-alert-evaluate/route.ts:235-243`).

## B2. Cross-producer coordination

### No global per-user daily budget

There is **no global “N pushes per user per day” budget** in the registry, relevance helper, worker, or migrations. `relevance.ts` only normalizes metadata scores and labels; it does not arbitrate campaigns (`lib/notifications/relevance.ts:14-51`). Manual/preset alerts have a local rolling cap and per-rule cooldown, but similarity explicitly bypasses that cron throttle; home, weekend, reminders, social, lifecycle, water-quality, and admin events have independent dedupe/cooldown rules (`lib/alerts/throttle.ts:20-59`; `app/api/cron/condition-alert-deliver/route.ts:1169-1257,1836-1845`; `lib/notifications/registry.ts:529-1295`).

The one cross-producer mechanism is narrower: `surf_alert_delivery_slots` permits one winner per **user + beach + local alert date**, with priorities manual 3, similarity 2, home 1 (`supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:1-16`; `lib/notifications/registry.ts:678-679,770-771,887-888`; `lib/notifications/worker.ts:305-343,1276-1281`). It does not coordinate different beaches, weekend windows, watched-call updates, reminders, safety notices, social pushes, or lifecycle campaigns. The evidence's three surf pushes in four hours were Osprey, PB, and Blacks, so they occupy three different beach slots and are fully allowed (`../audit/EVIDENCE.md:7-16,46-68`).

The slot also is not a strict “highest priority always wins” auction across time. A higher-priority pending event can replace a lower-priority pending event, but once the first winner is `processing` or `processed`, later events lose regardless of priority (`supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:80-94`). The enqueue layer gives surf events a five-minute hold to let peers arrive, but schedules several producers hours apart, so the lower-priority home/similarity event can still lock a same-beach day before a later manual alert (`lib/notifications/enqueue.ts:29,106-108`; `supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:84-89`).

`claim_forecast_delivery_slot` is a separate legacy RPC that keys by user+beach+alert type with a 20-hour window, but no `app/` or `lib/` caller exists; it does not protect production delivery. Its semantics also would not form a global budget because alert type remains part of the key (`supabase/migrations/20260130120000_add_claim_forecast_delivery_slot.sql:1-57`).

### Quiet hours are mostly shared, with explicit exceptions

The shared implementation defines 22:00–04:00 local, handles midnight wrapping, validates timezone, and computes the next local end time (`lib/notifications/quiet-hours.ts:12-33,64-77`). Most registry entries use that common defer policy, including social, surf, weekend, feedback, streak, and water-quality pushes (`lib/notifications/registry.ts:529-979,1041-1193`). The worker checks registry quiet hours after preference gates and defers the event instead of dropping it (`lib/notifications/worker.ts:879-903,1100-1136`). Manual email delivery reuses the same primitives (`lib/notifications/quiet-hours.ts:1-7`).

Manual push/email rules do not roll their own time arithmetic: the producer selects a valid `conditions.quiet_hours_*` override and the shared worker/math applies it. When consolidated rules disagree, however, the first valid rule's window wins for the combined event (`app/api/cron/condition-alert-deliver/route.ts:262-289,1261-1281,1640-1658`; `lib/notifications/worker.ts:1100-1136`).

Exceptions are deliberate but risky: trial ending, first-session nudge, and admin test have no quiet window; admin broadcast bypasses quiet hours entirely (`lib/notifications/registry.ts:981-1039,1248-1295`). Fixed UTC “09:00 Pacific” lifecycle schedules actually run at 10:00 during daylight time, so they are not currently quiet-hour hazards in Pacific, but the comment is still wrong and users in other timezones are not protected (`vercel.json:177-183`; `lib/notifications/registry.ts:981-1008`).

### Can one user get similarity + manual + home + swell in one morning?

- **Similarity + manual + home:** yes, if they concern different beaches. Same-beach/same-date competition is limited by `surf_alert_delivery_slots`; cross-beach delivery is unlimited (`supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:7-16`; `lib/notifications/worker.ts:1276-1281`).
- **Similarity + manual + home at the same beach/date:** normally one wins, subject to valid beach/date payloads and timing. Priority is manual > similarity > home only while the existing winner remains pending (`lib/notifications/registry.ts:678-679,770-771,887-888`; `supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:84-150`).
- **Swell watch:** not today; it never enqueues and its registry channel list is empty (`app/api/cron/swell-watch/route.ts:1-6,310-334`; `lib/notifications/registry.ts:933-979`). If re-enabled as a real channel later, it is not assigned a surf-slot priority and would add another uncoordinated push.

Bottom line: the production result—three surf recommendations in four hours—is not an anomaly in coordination. It is the expected outcome of beach-scoped dedupe in a product whose user's decision is “should I surf this morning?”, not “should I surf this particular database beach?” (`../audit/EVIDENCE.md:7-16,66-68`).

## B3. Copy and actionability

| Contract | Why did it trigger? | When / lead time | Confidence | Action and tap context | Assessment |
|---|---|---|---|---|---|
| **Similarity** — `Go PB Point` / `2.0ft @ 14s · Wed 11am · S wind 5mph · rising tide` | The payload has a `reason`, but push construction appends wind, tide, setup, and reason, then truncates to the first two details. With both wind and tide present, the actual historical-similarity reason is omitted (`lib/notifications/registry.ts:781-791`). | It gives a local hour but is scheduled only about one hour before the window, which is often too late for work, travel, parking, and board choice (`app/api/cron/similarity-alerts/route.ts:1039-1064`). | The copy exposes neither similarity score, sample size, nor uncertainty. The canonical decision call supplies `sessionCount: 0`, so the outward confidence cannot be audited from the push (`app/api/cron/similarity-alerts/route.ts:1105-1113`; `../audit/EVIDENCE.md:70-75`). | Tap opens Beach Detail. The push data contains beach/date/forecast/decision IDs but not `reason`; the richer reason exists only in the in-app payload (`lib/notifications/registry.ts:805-841`; native `src/lib/push-notifications.ts:720-760`). The tapped banner can therefore show display copy or a generic fallback, not the omitted match evidence (native `src/lib/alert-context.ts:45-71`; `src/components/alerts/alert-context-banner.tsx:26-80`). | **Not actionable enough and overclaims.** “Go” is an imperative recommendation while the evidence it supposedly learned is hidden. For an advanced surfer with 42 sessions, `Go` on a 2.0 ft day is especially misleading unless the product can show a strong personal pattern, suitable spot/board, and reliable face-height interpretation (`../audit/EVIDENCE.md:20-23,53-58`). Packet A owns the matching-engine root cause; this finding is about the delivery contract around it. |
| **Manual/preset condition** — `Worth a look — Blacks Beach, 8–9 AM` / `Blacks Beach 8 AM-9 AM — 4-5ft @ 13s, 5 mph` | It shows conditions but not which user-set thresholds matched. The formatter maps score to tone and concatenates wave/period/wind; it never names `period ≥ 12s`, `wind ≤ 10kt`, or other triggering rule clauses (`lib/alerts/push-formatter.ts:19-31,119-190`). | It includes a one-hour window and intends two hours' lead, but the selector considers the window actionable until 15 minutes after its best hour (`app/api/cron/condition-alert-evaluate/route.ts:631-653`; `lib/alerts/actionable-window-selector.ts:6-28`). | Tone (`Firing`, `Worth a look`, `Not ideal`) is a hidden score mapping; no score/confidence is exposed (`lib/alerts/push-formatter.ts:19-31,119-141`). | Tap opens Beach Detail and the push data carries only decision ID/verdict, while the in-app row carries the full `session_decision` (`lib/notifications/registry.ts:682-714`; native `src/lib/push-notifications.ts:680-694`). | **The most defensible of the founder's three pushes** because it matched an explicit rule and used “Worth a look,” but it still does not say what the user asked to be alerted about, can arrive after the window has effectively started, and cannot demonstrate its confidence. |
| **Home morning call** — `Pacific Beach: Worth a look` / `2.0ft @ 14s. Onshore wind.` | It gives one condition and at most the first non-informational caution, but not the positive evidence that produced the verdict (`lib/notifications/home-morning-call-presentation.ts:40-50`). | Body says only “today”; no best hour appears even though the decision contains a window (`app/api/cron/home-morning-call/route.ts:181-190`; `lib/notifications/home-morning-call-presentation.ts:44-50`). | No confidence or sample size. | Push data has beach/date/verdict, but native routes it to Home rather than Beach Detail (`lib/notifications/registry.ts:890-900`; native `src/lib/push-notifications.ts:803-806`). | **Low actionability and highly duplicative.** It can send `Rest up today`—a negative push that consumes attention without offering a concrete action—and competes with manual/similarity only at the same beach (`app/api/cron/home-morning-call/route.ts:166-196`). |
| **Swell watch** — `Swell incoming — Blacks Beach` / `Saturday: building to 8 ft @ 16s. Peak Sunday.` | Clearly names the event: a building swell and peak (`app/api/cron/swell-watch/route.ts:137-150`). | Strongest lead-time contract: multi-day start and peak. | No explicit model/official-advisory confidence, though the internal payload carries signal/severity/evidence refs (`app/api/cron/swell-watch/route.ts:208-227`). | Nominal tap opens Beach Detail; currently no push is sent (`lib/notifications/registry.ts:933-979`; native `src/lib/push-notifications.ts:832-846`). | **Potentially valuable, presently nonexistent.** This is the kind of rare, plan-changing event that could earn a push, but it should expose official-vs-model basis and remain safety-aware before channels are enabled. |
| **Weekend window** — `3 spots look promising this weekend` / `Blacks Beach leads Sat 7–9 AM. See your top picks and why.` | It identifies the lead spot and promises reasons in the destination, but the notification itself does not say why (`lib/notifications/registry.ts:913-929`). | Friday noon for a weekend window is useful planning lead time (`lib/cron/weekend-scout-runner.ts:247-255`). | No confidence/rarity indicator. | Tap opens Weekend Scout, the only surf contract whose copy explicitly sets an expectation of comparative explanation (`lib/notifications/registry.ts:913-929`; native `src/lib/push-notifications.ts:807-831`). | **Best surf-product shape, but default-off and unproven.** It consolidates several beaches into one decision instead of pushing one message per beach. |

### Tone and trust

The surface speaks with three incompatible levels of certainty: similarity says **“Go”**, manual rules say **“Worth a look”**, and home can say **“It's firing”** for another canonical verdict mapping (`lib/notifications/registry.ts:793-803`; `lib/alerts/push-formatter.ts:119-141`; `lib/notifications/home-morning-call-presentation.ts:30-50`). These are not cosmetic differences. Users reasonably read “Go” as a high-confidence directive, yet the similarity push is the one that hides its match reason and confidence. The founder's two “Go” examples were 2.5 ft and 2.0 ft, one with a clearly inconsistent snapshot/push period, for an advanced profile (`../audit/EVIDENCE.md:46-58,70-81`). That copy spends more trust than the payload can support.

The consolidated email subject helper is more restrained—its job is to summarize multiple matches rather than issue one imperative—and demonstrates the safer pattern the push surface lacks (`lib/alerts/consolidated-subject.ts:66-94`). A useful push should state: **what changed or matched, the actual decision window, the evidence strength, and the next screen/action**. Current copy usually provides only conditions and a tone word.

## B4. Delivery health from the 30-day statistics

The evidence covers two different ledgers: alert-pipeline outcomes in `alert_delivery_attempts`, and centralized worker outcomes in `notification_delivery_attempts` (`../audit/EVIDENCE.md:83-125`; `supabase/migrations/20260426172046_create_alert_delivery_attempts.sql:16-35`; `supabase/migrations/20260430180243_create_notification_delivery_attempts.sql:3-25`). They should not be combined as if they were one funnel.

| Status | Code condition | Policy or defect? | What the 30-day count implies |
|---|---|---|---|
| **`skipped_allowlist`** | Condition deliver has a nonempty test allowlist and the matched rule's user is absent; this is recorded separately for email, manual push, watched-call, and similarity branches (`app/api/cron/condition-alert-deliver/route.ts:1292-1301,1542-1551,1872-1876,2004-2014`). | Expected only for an explicit canary rollout; a defect if users can create/enable rules without being told delivery is unavailable. | The table shows **312 email** allowlist skips (54 clean + 148 mellow + 110 weekend) and **143 push** skips (26 clean + 74 mellow + 43 weekend) (`../audit/EVIDENCE.md:87-120`). At least 49 people had matching enabled rules but were silently excluded during the window; unique users across presets/channels cannot be summed from the aggregate. These users wanted alerts and did not get them. Current allowlist state is unknown without production env/config. |
| **`skipped_stale_forecast`** | Hourly delivery reloads the latest forecast and reruns the match; if it no longer qualifies, it marks the queue stale (`app/api/cron/condition-alert-deliver/route.ts:474-506,921-963`). It does **not** mean the forecast row exceeded a data-age threshold. | Revalidation is good safety policy; the status name is misleading, and high volume indicates evaluation/delivery instability or excessive queue delay. | It is the top `mellow_session` outcome: 176 email rows/49 users and 105 push rows/26 users (`../audit/EVIDENCE.md:98-120`). Those users expressed intent and had an earlier match, but no delivery occurred. The table alone cannot distinguish healthy forecast change from evaluator/deliverer disagreement. |
| **`skipped_disabled`** | An overloaded bucket: major-event hold suppression, canonical-decision rejection, similarity kill switch/hold, and worker safety hold can all map here (`app/api/cron/condition-alert-deliver/route.ts:1058-1109,1695-1707,1987-2000,2182-2197`; `lib/notifications/worker.ts:1058-1097`). | Some causes are expected safety policy; a generic bucket is an observability defect. | 60 mellow push rows/14 users, plus 16 weekend push rows/5 users, cannot be explained from aggregate status alone (`../audit/EVIDENCE.md:103-120`). Because these are non-similarity rules, a similarity-only kill switch is unlikely; `skip_reason` must be grouped before judging. Users wanted these alerts and did not get them, potentially correctly. |
| **`failed_provider`** | Email provider error in the alert deliverer, or push provider unavailable/throws/returns no success in the worker (`app/api/cron/condition-alert-deliver/route.ts:1448-1466`; `lib/notifications/worker.ts:1245-1249,1345-1387,1432-1443`). | Defect/operational failure, not policy. | The shown email rows include 62 provider failures (`../audit/EVIDENCE.md:98-110`). The evidence's “~10%” takeaway is not derivable from the displayed table: failures are **6.6% of all 933 listed email outcomes**, or **20.5% of terminal provider outcomes** (`241 sent + 62 failed_provider`). The correct rate depends on the intended denominator. Every such row is an intended alert not delivered. |
| **`failed_internal`** | Profile/event/payload/enqueue errors in condition delivery, or device lookup/payload-builder/worker bookkeeping failures (`app/api/cron/condition-alert-deliver/route.ts:1140-1158,1773-1787,1967-1978,2285-2316`; `lib/notifications/worker.ts:1239-1267,1444-1447`). | Defect. | The evidence shows 12 clean push rows/4 users and 9 mellow push rows/3 users (`../audit/EVIDENCE.md:92-109`). These represent silent loss after user intent. |
| **`skipped_dedup_collision`** | Existing refreshed queue/delivery/event, or losing the surf-slot/install dedupe, maps to collision (`app/api/cron/condition-alert-deliver/route.ts:927-938,1370-1380,1580-1590,1759-1771,2272-2284`; `lib/notifications/registry.ts:330-356`). | Expected only if another event/attempt actually represents the user's delivery; otherwise silent loss. | 21 clean push collisions for one user and 9 weekend email collisions for one user are concentrated enough to suggest duplicate rules or repeated queue production, not broad healthy dedupe (`../audit/EVIDENCE.md:112-120`). The aggregate table does not prove the counterpart was sent. |
| **`skipped_channel_disabled`** | Profile/channel preference was off at delivery (`app/api/cron/condition-alert-deliver/route.ts:1130-1167,1510-1541`). | Expected user policy. | These are generally not users who still wanted that channel, although stale profile state or backend-forced push enablement should be checked. |
| **`skipped_cooldown` / `skipped_user_cap`** | Rule 24-hour cooldown, `conditions.max_frequency_per_week`, or rolling 7-day user cap (`lib/alerts/throttle.ts:20-59`; `app/api/cron/condition-alert-deliver/route.ts:252-260,1169-1257`). | Expected anti-spam policy, but users are not shown that a matching rule was suppressed. | `skipped_cooldown` affects clean, mellow, and weekend rules in the evidence (`../audit/EVIDENCE.md:98-120`). This is desired suppression only if the earlier counted `sent` corresponds to a real device delivery. |

Two additional health caveats matter:

1. A worker event is marked `sent` if **any one** target succeeds, even when another active installation fails; aggregate “sent” therefore does not mean every active device received it (`lib/notifications/worker.ts:1432-1447`).
2. Low-score condition queue items below the delivery threshold are consumed without an `alert_delivery_attempts` row, creating an observability hole outside the supplied status counts (`app/api/cron/condition-alert-deliver/route.ts:965-976`).

The statuses that unequivocally represent a user who wanted an alert and silently missed it are `skipped_allowlist`, `failed_provider`, and `failed_internal`. `skipped_stale_forecast`, `skipped_disabled`, cooldown/cap, and dedupe are policy-mediated misses: potentially correct, but only defensible if the reason is visible and a valid counterpart/safety decision can be proven. `skipped_channel_disabled` is the only listed alert-pipeline outcome that normally reflects an explicit user preference.

## B5. Native client handling

### Registration and the eleven device rows

The app requests permission, obtains an Expo token on iOS and a native FCM token on Android, then POSTs platform, token, app/build/OS/Expo metadata, and timezone (`src/lib/push-notifications.ts:486-581`). It does **not** send `installation_id` (`src/lib/push-notifications.ts:557-581`). The server therefore takes the legacy registration RPC path; it uses the modern installation RPC only when that field exists (`app/api/devices/upsert/route.ts:234-253`).

That explains the evidence's eleven historical rows across builds. The modern schema intentionally treats `installation_id IS NULL` rows as additive compatibility data; the legacy RPC updates only the same currently active token and inserts a new row when a token changes, without retiring older tokens (`supabase/migrations/20260818120000_surf_alert_trust_invariants.sql:36-50,127-180`). The app retires the exact stored token on logout, and the worker retires tokens only after the provider reports them invalid (`src/lib/push-notifications.ts:605-611,913-941`; `lib/notifications/worker.ts:1390-1398`). Token rotation, reinstall, and build/channel changes can therefore accumulate rows until logout or provider rejection.

The evidence says **three active rows**, not eleven active rows: two iOS and one Android (`../audit/EVIDENCE.md:24`). The worker loads every active row and creates one provider message per dispatchable target (`lib/notifications/worker.ts:1252-1273,1292-1343`). Identified installations are ledger-deduped, but legacy null-installation rows remain additive (`lib/notifications/worker.ts:1162-1224`; `supabase/migrations/20260818120000_surf_alert_trust_invariants.sql:184-223`). Thus all three active rows can receive every push, including multiple rows that may belong to the same physical install. Multiple genuine active iOS/Android devices are also intentionally fanned out.

Registration runs after authentication and again on foreground with a six-hour freshness guard, when profile push is allowed; failures retry on later lifecycle transitions (`src/providers/notification-provider.tsx:65-226`). A successful server registration forcibly updates `profiles.notif_push_enabled=true`, which can reverse a stored master preference merely because a client re-registers (`app/api/devices/upsert/route.ts:260-267`).

### Foreground/background behavior and tap routing

Expo's foreground handler shows banner/list, badge, and sound only for approved Quiver notification types (`src/lib/push-notifications.ts:391-402`). Background display is handled by the OS/provider payload; the app registers response listeners and also processes the last notification response on cold start (`src/lib/push-notifications.ts:870-910`).

Tap routing is explicit:

- `forecast_alert` → Beach Detail with alert context; `similarity_match` → Beach Detail by ID/slug, otherwise Home (`src/lib/push-notifications.ts:680-694,720-760`).
- `watched_call_update`, `water_quality`, and `swell_watch` → Beach Detail when possible (`src/lib/push-notifications.ts:695-719,761-781,832-846`).
- `home_morning_call` and `daily_digest` → Home; `weekend_window` → Explore/Weekend Scout; weekly and first-session nudges → Session Form; trial ending → Settings (`src/lib/push-notifications.ts:782-848,861-867`).
- A top-level `deeplink` wins before the type switch, which is why the daily feedback nudge opens Session Form (`src/lib/push-notifications.ts:651-664`; `app/api/cron/daily-call-streak-reminder/route.ts:260-269`).
- `admin_broadcast` ignores its registry `url` and routes Home; this makes the documented broadcast URL contract ineffective on native (`src/lib/push-notifications.ts:853-860`; `app/api/admin/broadcast-push/route.ts:10-17`).

For a tapped push, native adds the displayed notification title/body into its alert context, and Beach Detail can render an alert banner (`src/lib/push-notifications.ts:245-299`; `src/components/alerts/alert-context-banner.tsx:26-112`). But similarity push data does not contain the underlying `reason`; when wind and tide displace it from the displayed body, the destination cannot reconstruct why this supposedly matched the user's history (`lib/notifications/registry.ts:781-818`; native `src/lib/alert-context.ts:45-71`). In-app Alert Center rows are richer because the similarity in-app payload includes reason, detailed conditions, and the full session decision (`lib/notifications/registry.ts:820-841`; native `src/screens/alert-center.tsx:235-267`). The same campaign therefore explains itself better when opened from the inbox than from the push.

### Alerts and rule creation

Alert Center loads activity and rule state, groups rules by beach, and supports preset/expert creation, edit, pause, and delete (`src/screens/alert-center.tsx:148-224,287-380,452-515`). Similarity is system-managed rather than editable, but grouping it under a stored beach conflicts with server-side global candidate expansion (`src/components/alerts/alert-rule-group.tsx:118-220`; `app/api/cron/similarity-alerts/route.ts:680-801`).

The creation flow defaults to the **Mellow Session** preset; expert defaults are 1–3 ft, period ≥8s, wind ≤5, tide 0–4 ft rising, three alerts/week, quiet 22:00–05:00, push on, email off (`src/lib/condition-alert-presets.ts:127-155,301-302`; `src/screens/condition-alerts.tsx:105-128,337-430`). An advanced user must explicitly confirm applying the beginner-oriented Mellow window (`src/screens/condition-alerts.tsx:608-620,1367-1391`).

The expert form can create practically unmatchable combinations. Period and wind steppers have no feasibility-aware joint constraints, and validation checks only basic ranges/order, not historical probability; the server accepts period 0–30s and wind 0–80 (`src/screens/condition-alerts.tsx:960-976,1451-1481`; `lib/alerts/condition-validation.ts:191-215`). A rule such as period ≥16s plus wind ≤5kt is valid even if that beach almost never sees both. The evaluator compares period against primary swell period first and falls back to wave period, an implementation detail the form does not explain (`lib/alerts/condition-evaluator.ts:24-26`). There is no “would have matched X times in the last 30 days” preview or warning.

Saving a push rule verifies a device and forces `notif_forecast_alerts=true` (`src/screens/condition-alerts.tsx:846-957,1572-1617`). Rule quiet hours are honored: the deliverer copies the first valid surviving rule's override into the event, and the worker prefers that override to the registry default (`app/api/cron/condition-alert-deliver/route.ts:262-289,1640-1658`; `lib/notifications/worker.ts:1100-1136`). The edge case is consolidation: when several rules are bundled, only the first valid override wins, so conflicting rule windows are not independently enforced (`app/api/cron/condition-alert-deliver/route.ts:262-289`).

### Notification preferences

Settings exposes master push, email, forecast alerts, reminders, similarity alerts, likes, and follows (`src/screens/settings.tsx:44-61,302-317`). It does **not** expose `notif_water_quality` or `notif_inapp_enabled`, even though native profile types/hooks include both and the registry gates water-quality/in-app delivery on them (`src/hooks/use-profile.ts:6-17`; `src/hooks/use-update-profile.ts:5-14`; `lib/notifications/registry.ts:1129-1142`). Users therefore lack a native control for one safety-notification category and for the in-app channel.

## B6. Product assessment

### Candid verdict

The system is technically ambitious but product-incoherent. It has a centralized registry, shared quiet-hour math, durable event/attempt ledgers, per-installation delivery machinery, and same-beach surf arbitration (`lib/notifications/registry.ts:529-1295`; `lib/notifications/quiet-hours.ts:12-77`; `supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:1-155`). Those are good foundations. They do not solve the user's actual attention problem: five independent concepts can all decide that they deserve a push, while only one narrow database key coordinates three of them.

**Earning their place now:**

- Water-quality transitions: rare, event-driven, safety-relevant, and actionable, with advisory/closure/recovery copy (`lib/services/water-quality/water-quality-alerts-service.ts:57-92`; `lib/notifications/registry.ts:1144-1178`).
- Likes/follows: user-generated, expected social feedback with direct destinations and explicit per-type controls (`lib/notifications/registry.ts:529-589`).
- Trial ending: a clear lifecycle deadline with a direct Settings destination, though logging and quiet-hour policy need correction (`app/api/cron/trial-ending-push-deliver/route.ts:274-327`; native `src/lib/push-notifications.ts:861-864`).
- Watched-call changes can earn a place because the user explicitly watched a call and category-specific cooldowns exist; value depends on the producer title/body actually naming the change (`lib/notifications/registry.ts:591-640`).

**Promising but not trustworthy enough:**

- Manual condition alerts are closest to a user-requested contract, but allowlist loss, stale revalidation volume, feasibility-blind rules, late eligibility, and opaque “why” weaken them (`../audit/EVIDENCE.md:98-120`; `lib/alerts/actionable-window-selector.ts:6-28`).
- Weekend window is the best surf recommendation format because it consolidates choices and arrives with planning lead time, but it is default-off and absent from the supplied alert-rule statistics. The evidence's `weekend_warrior` rows are a condition-rule preset, not the separate `weekend_window` campaign (`lib/cron/weekend-scout-runner.ts:212-302`; `app/api/cron/condition-alert-evaluate/route.ts:160-168`; `../audit/EVIDENCE.md:112-120`).
- Swell watch describes a genuinely rare planning event, but it is deliberately shadow-only and should not be counted as product capability (`app/api/cron/swell-watch/route.ts:1-6,310-334`).

**Noise or trust-negative:**

- Current similarity push presentation. It issues “Go,” hides the historical reason when wind+tide are present, can recommend any favorite/nearby beach despite appearing under a Scripps rule, and offers roughly one hour of lead time (`lib/notifications/registry.ts:776-818`; `app/api/cron/similarity-alerts/route.ts:680-801,1039-1064`). Packet A should decide the matching root cause; Packet B's conclusion is that this campaign must not speak imperatively until its evidence is visible and calibrated.
- Home morning call duplicates the same decision space, can send a negative “Rest up” push, omits the best window, and routes to Home (`app/api/cron/home-morning-call/route.ts:166-196`; `lib/notifications/home-morning-call-presentation.ts:40-50`; native `src/lib/push-notifications.ts:803-806`).
- Low-confidence daily feedback asks “Catch a session today?” after the candidate window has passed; that is neither a recommendation nor reliable attendance inference (`lib/notifications/registry.ts:1051-1063`; `app/api/cron/daily-call-streak-reminder/route.ts:1-6`).

**Silently broken or operationally misleading:**

- Swell watch and daily digest are dead delivery surfaces (`app/api/cron/swell-watch/route.ts:1-6`; `lib/notifications/registry.ts:933-979,1195-1205`).
- Production allowlisting silently consumes matches for dozens of users (`../audit/EVIDENCE.md:98-120`; `app/api/cron/condition-alert-deliver/route.ts:1292-1301,1542-1551`).
- Legacy device registration can multiply active targets; a single event's `sent` status can mask partial device failure (`src/lib/push-notifications.ts:557-581`; `lib/notifications/worker.ts:1432-1447`).
- First-session, trial, daily-feedback, and weekly logs are written after enqueue, not after confirmed provider delivery; those campaign ledgers can block another try even if the worker later fails (`app/api/cron/first-session-nudge-push/route.ts:721-767`; `app/api/cron/trial-ending-push-deliver/route.ts:274-327`; `app/api/cron/daily-call-streak-reminder/route.ts:595-644`; `app/api/cron/weekly-streak-reminder/route.ts:261-304`).

### What a “useful alert” should mean

For an advanced San Diego surfer with 42 logged sessions, a useful alert is a **scarce, action-changing message**: a materially unusual window or safety change, personalized to demonstrated behavior and skill, delivered early enough to plan, explicit about why it fired and how certain it is, and linked to the exact evidence/action screen. A normal 2 ft day is not useful merely because it clears a numerical threshold; “Go” should mean the system has unusually strong personal evidence and a practical time window (`../audit/EVIDENCE.md:20-23,46-58`). One user morning is the unit of attention, not one beach row.

### Ranked changes by expected retention value

| Rank | Change | Evidence addressed | Effort | Risk |
|---:|---|---|:---:|---|
| **1** | **Add a per-user surf-attention budget and morning arbitration.** Collect manual, similarity, home, watched-call, and weekend candidates into one ranked decision; default to at most one recommendation push per morning/day, bundle alternatives in the destination, and exempt urgent safety transitions. | Three surf pushes in four hours are currently legal because slots key by beach (`../audit/EVIDENCE.md:7-16`; `supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:7-16`). | M | A strict cap can hide a genuinely different later opportunity; permit safety and explicit user-watch overrides and record losers. |
| **2** | **Demote or pause imperative similarity pushes until Packet A's evidence is trustworthy.** Require a minimum personal sample/confidence and skill-appropriate conditions; otherwise use “Possible match” or inbox-only. | Two useless `Go` pushes, hidden reason, hard-coded zero session count, advanced profile (`../audit/EVIDENCE.md:7-23,70-81`; `app/api/cron/similarity-alerts/route.ts:1105-1113`). | M | Push volume will fall; that is acceptable if current volume damages trust. Packet A may change exact gating. |
| **3** | **Make every surf push explain itself and preserve that explanation through the tap.** Include matched rule clauses or historical reason, confidence/sample size, decision window, and `reason` in push data; harmonize `Go`/`Worth a look`/`It's firing` against one confidence rubric. | Similarity truncates its reason; manual copy hides matched thresholds; push destination has less evidence than in-app (`lib/notifications/registry.ts:781-841`; `lib/alerts/push-formatter.ts:119-190`). | S–M | Payload growth and copy length; use a short reason in push and full evidence on destination. |
| **4** | **Fix action timing and make lead time product-specific.** Correct the post-best-hour selector, evaluate rolling windows, and send plan-worthy windows the prior evening or early morning; reserve one-hour notices for genuinely nearby/high-confidence cases. | Current selector can remain eligible 15 minutes after the best hour; similarity targets ~1 hour lead (`lib/alerts/actionable-window-selector.ts:6-28`; `app/api/cron/similarity-alerts/route.ts:1039-1064`). | M–L | Forecast drift increases with lead time; copy must communicate uncertainty and revalidation. |
| **5** | **End silent rollout gating.** Remove the condition/similarity production allowlist when ready, or explicitly label the feature as canary/unavailable and do not consume queue/rule cooldown state for excluded users. Add an operator metric for matched-but-withheld users. | At least 49 users had allowlist-skipped matches in 30 days (`../audit/EVIDENCE.md:98-120`). | S–M | Removing a canary suddenly can spike volume; ramp by cohort with a hard global budget first. |
| **6** | **Adopt stable native installation identity and reconcile legacy active rows.** Generate/send `installation_id`, use the modern registration RPC, retire superseded null-installation rows with an explicit migration policy, and expose partial per-target failures. | Native omits installation ID; legacy rows are additive; founder has three active rows across two platforms (`src/lib/push-notifications.ts:557-581`; `supabase/migrations/20260818120000_surf_alert_trust_invariants.sql:36-50,127-180`; `../audit/EVIDENCE.md:24`). | M | Incorrect reconciliation could retire a real second device; migrate conservatively and preserve audit history. |
| **7** | **Add rule-feasibility feedback before save.** Show “would have matched X times in the last 30 days,” flag jointly rare/contradictory filters, explain primary swell period, and choose skill-aware defaults instead of Mellow for advanced users. | Expert rules can validly require period ≥16s and wind ≤5 with no probability check; Mellow is the default even for advanced users (`src/screens/condition-alerts.tsx:337-430,960-976,1451-1481`; `lib/alerts/condition-validation.ts:191-215`). | M–L | Historical forecast queries can be expensive and past data may not mirror future seasons; present an estimate, not a guarantee. |
| **8** | **Repair observability around real delivery.** Write lifecycle/streak campaign logs from terminal worker outcomes, split `skipped_disabled` into named causes, rename `skipped_stale_forecast` to “no longer matches,” close the low-score no-attempt hole, and report provider failure with a defined denominator. | Aggregate status cannot explain 60 disabled mellow pushes; 62 email provider failures have an ambiguous rate; some campaign logs are enqueue-success logs (`../audit/EVIDENCE.md:98-125`; `app/api/cron/condition-alert-deliver/route.ts:921-976`; `lib/notifications/worker.ts:1432-1447`). | S–M | Schema/dashboard migration; retain backward-compatible status mapping during transition. |

Given D7 around 4.5% and a broken ~6.5% alerts activation funnel, the highest-value move is not another campaign. It is making the one surf notification a user receives demonstrably personal, timely, and true. The current architecture can support that after arbitration and evidence contracts are made user-level rather than producer-level.

## Open questions

The following cannot be answered from the repositories/evidence alone. Each query is read-only and scoped to the missing decision.

### 1. Which rollout/kill-switch values are active in production now?

Database SQL cannot answer Vercel environment variables. Run this against the deployed runtime's secret-safe diagnostics (values only; never print unrelated secrets), or add these names to the existing secured admin config inspector:

```sh
for name in ALERTS_DELIVERY_ENABLED FORECAST_ALERT_DELIVERY_ENABLED ALERTS_DELIVERY_USER_ALLOWLIST HOME_MORNING_CALL_ENABLED HOME_MORNING_CALL_TEST_USER_IDS WEEKEND_WINDOW_ENABLED WEEKEND_WINDOW_TEST_USER_IDS SWELL_WATCH_ENABLED FORECAST_FEEDBACK_NUDGE_ENABLED MAJOR_EVENT_HOLD_AUTOMATION_ENABLED MAJOR_EVENT_HOLD_MODE; do
  printf '%s=%s\n' "$name" "$(printenv "$name" | sed 's/./*/g')"
done
```

For boolean/mode visibility without exposing allowlist IDs, the desired production log object is:

```ts
console.log({
  alertsDelivery: process.env.ALERTS_DELIVERY_ENABLED === "true",
  forecastDelivery: process.env.FORECAST_ALERT_DELIVERY_ENABLED === "true",
  alertAllowlistActive: Boolean(process.env.ALERTS_DELIVERY_USER_ALLOWLIST?.trim()),
  homeMorning: process.env.HOME_MORNING_CALL_ENABLED === "true",
  weekendWindow: process.env.WEEKEND_WINDOW_ENABLED === "true",
  swellWatch: process.env.SWELL_WATCH_ENABLED === "true",
  feedbackNudge: process.env.FORECAST_FEEDBACK_NUDGE_ENABLED?.toLowerCase() === "true",
  majorEventAutomation: process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED === "true",
  majorEventMode: process.env.MAJOR_EVENT_HOLD_MODE ?? "off",
});
```

### 2. What caused the 60 `mellow_session / push / skipped_disabled` rows?

```sql
select
  coalesce(ada.skip_reason, '(null)') as skip_reason,
  count(*) as attempts,
  count(distinct ada.user_id) as users,
  min(ada.attempted_at) as first_seen,
  max(ada.attempted_at) as last_seen
from public.alert_delivery_attempts ada
join public.alert_rules ar on ar.id = ada.rule_id
where ada.attempted_at >= now() - interval '30 days'
  and ada.channel = 'push'
  and ada.status = 'skipped_disabled'
  and ar.preset_type = 'mellow_session'
group by 1
order by attempts desc;
```

Then correlate worker-level holds/cancellations:

```sql
select ne.type, ne.status, coalesce(ne.skip_reason, '(null)') as skip_reason,
       count(*) as events, count(distinct ne.recipient_user_id) as users
from public.notification_events ne
where ne.created_at >= now() - interval '30 days'
  and ne.type in ('forecast_alert', 'similarity_match', 'home_morning_call')
group by 1,2,3
order by events desc;
```

### 3. Are `skipped_stale_forecast` rows healthy forecast changes or evaluator/deliverer disagreement?

```sql
select
  ar.preset_type,
  aq.id as queue_id,
  aq.user_id,
  aq.rule_id,
  aq.beach_id,
  aq.alert_date,
  aq.created_at as evaluated_at,
  ada.attempted_at as revalidated_at,
  ada.skip_reason,
  aq.conditions_snapshot
from public.alert_delivery_attempts ada
join public.alert_queue aq on aq.id = ada.queue_id
join public.alert_rules ar on ar.id = ada.rule_id
where ada.attempted_at >= now() - interval '30 days'
  and ada.status = 'skipped_stale_forecast'
order by ada.attempted_at desc;
```

For each returned queue row, compare `aq.conditions_snapshot` with the forecast selected at `revalidated_at`; the application should log both old/new forecast IDs, timestamps, and failed clauses because current aggregate data does not preserve that explanation.

### 4. Did each `skipped_dedup_collision` have a successfully delivered counterpart?

```sql
with collisions as (
  select ada.*, aq.beach_id, aq.alert_date
  from public.alert_delivery_attempts ada
  join public.alert_queue aq on aq.id = ada.queue_id
  where ada.attempted_at >= now() - interval '30 days'
    and ada.status = 'skipped_dedup_collision'
)
select
  c.id as collision_attempt_id,
  c.user_id,
  c.rule_id,
  c.beach_id,
  c.alert_date,
  c.channel,
  c.attempted_at,
  count(sent_q.id) as sent_counterparts
from collisions c
left join public.alert_delivery_attempts sent
  on sent.user_id = c.user_id
 and sent.channel = c.channel
 and sent.status = 'sent'
 and sent.attempted_at between c.attempted_at - interval '24 hours'
                           and c.attempted_at + interval '24 hours'
left join public.alert_queue sent_q
  on sent_q.id = sent.queue_id
 and sent_q.beach_id = c.beach_id
 and sent_q.alert_date = c.alert_date
group by c.id, c.user_id, c.rule_id, c.beach_id, c.alert_date, c.channel, c.attempted_at
having count(sent_q.id) = 0
order by c.attempted_at desc;
```

This returns only collisions with no proven same-beach/date send.

### 5. How many users are receiving duplicate physical-device deliveries, and did the founder's three active rows all receive each event?

```sql
select
  user_id,
  count(*) filter (where retired_at is null) as active_rows,
  count(*) filter (where retired_at is null and installation_id is null) as active_legacy_rows,
  count(distinct installation_id) filter (
    where retired_at is null and installation_id is not null
  ) as identified_installations,
  array_agg(distinct platform) filter (where retired_at is null) as platforms
from public.user_devices
group by user_id
having count(*) filter (where retired_at is null) > 1
order by active_rows desc;
```

Per event/target outcome for the founder account:

```sql
select
  ne.id as event_id,
  ne.type,
  ne.created_at,
  ndt.installation_id,
  ndt.token_fingerprint,
  ndt.status as target_status,
  ndt.error_message,
  ndt.provider_response
from public.notification_events ne
left join public.notification_delivery_targets ndt
  on ndt.notification_event_id = ne.id
where ne.recipient_user_id = '<FOUNDER_USER_ID>'::uuid
  and ne.created_at >= now() - interval '30 days'
order by ne.created_at desc, ndt.installation_id;
```

Legacy targets are not guaranteed to have durable per-installation ledger rows; correlate the worker's structured provider response for those events with token fingerprints, never raw tokens.

### 6. What is the real provider failure rate and which provider errors dominate?

Email alert attempts:

```sql
select
  status,
  coalesce(skip_reason, '(null)') as skip_reason,
  count(*) as attempts,
  count(distinct user_id) as users
from public.alert_delivery_attempts
where attempted_at >= now() - interval '30 days'
  and channel = 'email'
group by 1,2
order by attempts desc;
```

Push worker terminal outcomes by type:

```sql
select
  ne.type,
  nda.status,
  coalesce(nda.error_message, '(none)') as error_message,
  count(*) as attempts,
  count(distinct ne.recipient_user_id) as users
from public.notification_delivery_attempts nda
join public.notification_events ne on ne.id = nda.notification_event_id
where nda.created_at >= now() - interval '30 days'
  and nda.channel = 'push'
group by 1,2,3
order by attempts desc;
```

Report two denominators explicitly: failures / (`sent` + `failed_provider`) for provider-attempt reliability, and failures / all policy+terminal outcomes for end-to-end funnel loss.

### 7. Are rule quiet-hour settings actually honored anywhere in push delivery?

```sql
select
  ar.id,
  ar.user_id,
  (ar.conditions->>'quiet_hours_start')::int as quiet_hours_start,
  (ar.conditions->>'quiet_hours_end')::int as quiet_hours_end,
  count(ada.id) filter (where ada.status = 'sent') as sent_attempts,
  min(ada.attempted_at) filter (where ada.status = 'sent') as first_sent,
  max(ada.attempted_at) filter (where ada.status = 'sent') as last_sent
from public.alert_rules ar
left join public.alert_delivery_attempts ada on ada.rule_id = ar.id
where ar.enabled = true
group by ar.id, ar.user_id,
         (ar.conditions->>'quiet_hours_start')::int,
         (ar.conditions->>'quiet_hours_end')::int
order by sent_attempts desc;
```

The decisive runtime log query is to emit, for each forecast event, `{event_id, rule_quiet_start, rule_quiet_end, registry_quiet_start, registry_quiet_end, recipient_local_hour, disposition}`. Current worker code only exposes the registry window.

### 8. How many active rules are practically unmatchable, and which presets create alert fatigue?

```sql
select
  preset_type,
  count(*) as enabled_rules,
  count(*) filter (
    where (conditions->>'swell_period_min')::numeric >= 16
      and (conditions->>'wind_speed_max_kt')::numeric <= 5
  ) as extreme_period_clean_wind_rules,
  avg((conditions->>'max_frequency_per_week')::numeric) as avg_weekly_cap
from public.alert_rules
where enabled = true
group by preset_type
order by enabled_rules desc;
```

Then backtest each enabled rule over the last 30 days of `enhanced_forecasts` using the production `evaluateConditions` semantics and return `{rule_id, candidate_hours, matching_hours, distinct_matching_days}`. SQL alone should not approximate nested rule semantics differently from the application evaluator.

### 9. Are lifecycle/streak campaign logs overstating successful delivery?

```sql
select
  source,
  count(*) as logged,
  count(*) filter (where nda.status = 'sent') as worker_sent,
  count(*) filter (where nda.status = 'failed_provider') as provider_failed,
  count(*) filter (where nda.status = 'failed_internal') as internal_failed,
  count(*) filter (where nda.id is null) as no_terminal_attempt
from (
  select
    'trial_ending'::text as source,
    nullif(meta->>'notification_event_id', '')::uuid as notification_event_id
  from public.trial_ending_push_log
  union all
  select
    'first_session',
    nullif(metadata->>'notification_event_id', '')::uuid
  from public.activation_push_log
  union all
  select
    srl.reminder_type,
    ne.id
  from public.streak_reminder_log srl
  left join public.notification_events ne
    on ne.recipient_user_id = srl.user_id
   and ne.dedupe_key = srl.reminder_type || ':' || srl.user_id::text || ':' || srl.period_key
   and ne.type = case srl.reminder_type
     when 'daily_call_streak' then 'forecast_feedback_nudge'
     when 'forecast_feedback_nudge' then 'forecast_feedback_nudge'
     when 'weekly_streak' then 'weekly_streak_reminder'
   end
) l
left join public.notification_delivery_attempts nda
  on nda.notification_event_id = l.notification_event_id
 and nda.channel = 'push'
group by source
order by source;
```

The streak join has to reconstruct the event through its dedupe key because `streak_reminder_log` stores no event ID; that absence is itself the observability gap (`supabase/migrations/20260622041000_create_streak_reminder_log.sql:3-9`).
