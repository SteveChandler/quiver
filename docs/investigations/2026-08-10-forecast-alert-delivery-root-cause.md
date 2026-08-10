**The proven cause is that the deliver route's canonical hold event ID becomes a 189-character `notification:` candidate, the 160-character guard converts it to `null`, and enforce mode deterministically returns `suppressed / hold_state_unavailable` before canonical selection or either delivery channel.**

# Forecast alert delivery investigation — 2026-08-10

Research only. No production route or hold-adapter code was changed, no production writes or cron calls were made, and no provider request was sent.

## Snapshot and method

- Code: `8a8ad5d8e` on `research/alert-delivery-rootcause`, matching `origin/prod` after PRs #529 and #530.
- Queue/control snapshot: `2026-08-10T16:49:30.147Z`. All seven named queue rows were still `sent=false` in a second read-only check at `2026-08-10T17:09:35.039628Z`.
- Forecast projection run: `2026-08-10T17:17:08.257Z`. Forecast data can change before the scheduled 19:00, 22:00, and 01:00 UTC runs; the report calls this out wherever it matters.
- Production access in the harness: SELECTs plus the production `STABLE` `resolve_active_regional_recommendation_holds` RPC. The separate schema inspection ran inside `BEGIN READ ONLY` and rolled back.
- End-to-end proof: real production row/profile/device _shape_, actual application functions, in-memory write adapters, a redacted synthetic Expo token, and an intercepted Expo HTTP boundary. This proves code reaches the provider call; it does not claim Expo accepted a real notification.

The executable harness is `scripts/research/prove-alert-delivery-root-cause.ts`. The only stub is an empty `server-only` package shim needed to execute server modules under standalone `tsx`.

Run:

```bash
NODE_PATH="$PWD/scripts/research/stubs" \
ALERTS_DELIVERY_ENABLED=true \
node --import tsx scripts/research/prove-alert-delivery-root-cause.ts
```

## Full-horizon decision measurement

### Direct answer

**A `go`-only preset gate would functionally mute the free-tier headline alert.** It would not reduce `mellow_session` to literal zero, but only **11 of 150 matched windows (7.3%)** verdicted `go`. Those 11 windows belonged to **3 of 65 enabled mellow rules/users**. Over the visible 11.76-day horizon, 62 of 65 mellow rule owners (95.4%) would receive no mellow alert under the gate.

The proposed policy produces a modeled **13 user×beach×local-day alerts to 5 users** over the horizon: 12 preset alerts to 4 users and 1 custom alert to 1 user. With presets ungated, the same snapshot produces **153 alerts to 32 users**. The gate therefore removes 140 modeled alerts (91.5%) and reduces reached users by 27 (84.4%). These are decision-layer models, not observed provider sends.

### Snapshot and scope

- Snapshot: `2026-08-10T17:51:32.043Z`.
- Forecast horizon visible at the snapshot: `2026-08-10T18:00:00Z` through `2026-08-22T12:00:00Z`, 11.76 days (1.679 weeks). The final date is partial.
- Source: 7,764 `enhanced_forecasts` rows for 76 alert beaches. Newest forecast write: `2026-08-10T17:31:16.123Z`, 0.34 hours before the snapshot.
- Rules: 147 enabled total; 3 `similarity_match` rules excluded because `condition-alert-evaluate` explicitly sends them to a separate pipeline; 3 mock-owned rules excluded. The resulting scope was **141 rules for 94 real users**: 65 mellow, 35 weekend warrior, 25 clean groundswell, 15 custom, and 1 epic. No scoped rule was removed by the evaluator's entitlement cap or profile alert preference. Null-email users were retained by the filter, although this snapshot had none.
- Replay: 1,833 rule-day evaluations yielded 279 matched actionable windows. The harness used the same condition parser, daylight filter, surfability gate, and actionable-window selector as the evaluator/revalidation path.
- Hold control: the harness SHA-256-shortened the deliver-shaped event identity before hold resolution. The resulting candidate was 84 characters, and **279/279 resolved `allowed`**. The known 160-character guard therefore did not mask this measurement.

Forecasts are a moving target. Every verdict below was computed from rows visible at the snapshot, not from the rows that will exist at a future evaluator run or `send_at`.

### Preset type × canonical verdict

| Rule type | Matches | `go` | `maybe` | `no` |
| --- | ---: | ---: | ---: | ---: |
| `mellow_session` | 150 | 11 (7.3%) | 40 (26.7%) | 99 (66.0%) |
| `clean_groundswell` | 86 | 1 (1.2%) | 13 (15.1%) | 72 (83.7%) |
| `weekend_warrior` | 39 | 0 (0.0%) | 18 (46.2%) | 21 (53.8%) |
| `epic_conditions` | 0 | 0 | 0 | 0 |
| Custom (`preset_type IS NULL`) | 4 | 0 (0.0%) | 1 (25.0%) | 3 (75.0%) |

Non-`go` reason codes:

| Rule type | `selected_maybe` | `selected_no` | `beach_skill_exceeds_user` |
| --- | ---: | ---: | ---: |
| `mellow_session` | 40 | 11 | 88 |
| `clean_groundswell` | 13 | 72 | 0 |
| `weekend_warrior` | 18 | 8 | 13 |
| `epic_conditions` | 0 | 0 | 0 |
| Custom | 1 | 0 | 3 |

The mellow sample covered 33 of the 65 enabled mellow rules. Only 3 rules/users produced any `go`. The remaining 32 mellow rules had no match in the visible horizon, so the 7.3% is the share of matched windows, not a claim that every mellow rule was exercised.

### Volume and cadence

The report's alert-count proxy deduplicates eligible rule windows to one alert per user, beach, and local date. Raw eligible rule-window counts are included to show the pre-dedup input.

| Policy | Split | Eligible rule windows | Modeled alerts | Users | Alerts/reached user/week | Alerts/all 94 users/week |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Presets `go` only; custom quality-ungated | Presets | 12 | 12 | 4 | 1.79 | 0.08 |
| Presets `go` only; custom quality-ungated | Custom | 1 | 1 | 1 | 0.60 | 0.01 |
| Presets `go` only; custom quality-ungated | **Total** | **13** | **13** | **5** | **1.55** | **0.08** |
| Presets ungated; custom quality-ungated | Presets | 174 | 152 | 31 | 2.92 | 0.96 |
| Presets ungated; custom quality-ungated | Custom | 1 | 1 | 1 | 0.60 | 0.01 |
| Presets ungated; custom quality-ungated | **Total** | **175** | **153** | **32** | **2.85** | **0.97** |

“Custom ungated” means `maybe` and `no` quality verdicts do not suppress an explicit custom rule. It does **not** override safety. Three of the four custom matches were safety-rejected, so only one custom window remains in both policy models.

The normalized weekly rates are based on only 1.679 weeks of visible forecast. They describe this snapshot; they are not a long-run forecast of alert cadence.

### Safety and calibration findings

Safety blocked **104 of 279 matches (37.3%)**: 101 preset windows and 3 custom windows. Every safety rejection was `beach_skill_exceeds_user`; there were no active major-event holds and no other safety reason in this snapshot. Safety remained fail-closed for presets and custom rules.

The preset matcher is systematically looser than the canonical scorer:

| Preset | Matches | Safety rejected | Safety-eligible | Safety-eligible `maybe`/`no` | Disagreement rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `mellow_session` | 150 | 88 | 62 | 51 | 82.3% |
| `clean_groundswell` | 86 | 0 | 86 | 85 | 98.8% |
| `weekend_warrior` | 39 | 13 | 26 | 26 | 100.0% |
| `epic_conditions` | 0 | 0 | 0 | 0 | Inconclusive |

That is a calibration conflict, not merely a delivery-gate choice: the preset component says the window matched while the canonical quality component rejects nearly every safety-eligible match for clean groundswell and weekend warrior, and 82.3% for mellow session.

### What this could not measure

- The live evaluator runs once daily and scans only the user's current local date. The harness replayed that logic across every future local date visible in one fixed snapshot. Future daily forecasts will differ.
- Exact provider sends were not modeled. Hourly cross-beach canonical batching, 24-hour and weekly attempt caps, channel/profile preferences, device availability, forecast revalidation at `send_at`, Resend/Expo acceptance, and device receipt can reduce or reshape the modeled user×beach×day count.
- Custom rules are thin (`n=4` matched windows), and epic conditions had no matches (`n=0`), so neither supports a broad calibration conclusion.
- The final horizon date is partial. The data-correctness check returned `WATCH` solely for partial-day coverage; all row-count and reconciliation checks passed.

Set `ALERT_MEASUREMENT_INCLUDE_RECORDS=true` on the harness command to emit the full 1,833-row ledger. User identities are recorded as stable 12-character SHA-256 keys; email addresses are never emitted.

## Executable reproduction and actual output

For every row the harness reconstructed the exact canonical payload built at `app/api/cron/condition-alert-deliver/route.ts:871-882`:

```ts
eventId = `condition-alert-deliver:canonical:${userId}:${canonicalAlertCandidateId(match)}`;
payload = {
  beach_id: match.beach_id,
  forecast_at: match.best_hour,
  policy_context: {
    kind: "positive_session_recommendation",
    beach_id: match.beach_id,
    starts_at: match.window_start,
    ends_at: match.window_end,
  },
};
```

The live serialization produced a 176-character route `eventId`; `candidateIdFor()` prepends `notification:`, producing the 189-character value to which the cap actually applies. The brief's earlier 186-character measurement used a different timestamp serialization/sample; both are decisively over 160. The harness reports both lengths so “event ID” and “hold candidate ID” are not conflated.

Actual result, repeated on Q1–Q7:

```json
{
  "route_event_id_length": 176,
  "hold_candidate_id_length": 189,
  "long_hold": {
    "status": "suppressed",
    "reason": "hold_state_unavailable",
    "audit_code": "major_event_hold",
    "candidate_id": null
  },
  "short_event_id_length": 70,
  "short_candidate_id_length": 83,
  "short_hold": { "status": "allowed" },
  "hashed_event_id_length": 71,
  "hashed_candidate_id_length": 84,
  "hashed_hold": { "status": "allowed" }
}
```

This executes the entire suspected causal chain:

1. `candidateIdFor()` returns `null` when `notification:${eventId}` exceeds 160 (`lib/recommendations/major-event-hold/adapters/notification.ts:94-98`).
2. `buildNotificationMajorEventHoldCandidate()` returns `null` (`notification.ts:240-247`).
3. The batch builder returns `[null]` (`notification.ts:280-303`).
4. Enforce-mode evaluation treats that as unresolved (`lib/recommendations/major-event-hold/evaluator.ts:27-38,95-118`; `lib/recommendations/major-event-hold/service.ts:164-259`).
5. The adapter returns `suppressed / hold_state_unavailable` (`notification.ts:369-424`).
6. The route records the skip before either channel branch (`condition-alert-deliver/route.ts:871-945`).

The control matters: the same production payload, profile experience, production hold RPC, and `asOf` returned `allowed` when only the ID was changed to an 83-character queue-ID candidate or an 84-character SHA-256 candidate. All current hold chains were `cancelled` in the read-only production query, so the control did not bypass a real active hold.

### End-to-end Q6 result after the hash transform

Q6 is the only row with the complete push prerequisites: rule push enabled, profile push enabled, forecast-alert preference enabled, one device, and an Expo transport token. The harness applied only the proposed overflow hash at the failing canonical hold call, then ran the actual canonical engine, push formatter, `enqueueNotification`, notification registry, notification worker, hold checks, surf-slot checks, and push dispatcher. All writes were in memory and the provider URL was intercepted.

Actual output:

```json
{
  "queue_alias": "Q6",
  "canonical_hold_after_hash": "allowed",
  "canonical_decision": {
    "verdict": "maybe",
    "reason": "selected_maybe",
    "selected": true
  },
  "producer_push_hold": "allowed",
  "enqueue_result": { "enqueued": true },
  "worker_summary": {
    "fetched": 1,
    "processed": 1,
    "skipped": 0,
    "failed": 0,
    "pending_after_run": 0,
    "firebase_configured": true,
    "by_status": { "sent": 2 }
  },
  "expo_http_send_calls": [
    {
      "url": "https://exp.host/--/api/v2/push/send",
      "messageCount": 1
    }
  ],
  "notification_attempts": [
    { "channel": "push", "status": "sent" },
    { "channel": "in_app", "status": "sent" }
  ],
  "legacy_alert_attempts": [
    { "channel": "push", "status": "sent", "skip_reason": "sent" }
  ],
  "provider_boundary_reached": true,
  "provider_response_simulated": true,
  "real_provider_network_requests": 0,
  "production_mutations": 0
}
```

This is stronger than “the hold became allowed”: Q6 reached the actual Expo POST construction at `lib/services/push-delivery.ts:105-180` through the real worker dispatch at `lib/notifications/worker.ts:1068-1216`.

## Seven-row outcome after fixing the first gate

Legend: `PASS` proceeds; `BLOCK` is a terminal suppression/skip at the projected due run; `OFF` means the rule did not request that channel; `WAIT` means not due at the control snapshot.

| Gate/outcome                          | Q1                    | Q2                    | Q3                    | Q4                 | Q5                    | Q6                    | Q7                    |
| ------------------------------------- | --------------------- | --------------------- | --------------------- | ------------------ | --------------------- | --------------------- | --------------------- |
| Due at control snapshot               | WAIT 19:00Z           | WAIT 22:00Z           | WAIT 22:00Z           | WAIT 22:00Z        | WAIT 22:00Z           | WAIT 01:00Z           | WAIT 01:00Z           |
| Current forecast projection           | PASS                  | **BLOCK stale**       | PASS                  | PASS               | **BLOCK stale**       | PASS                  | PASS                  |
| Current long canonical hold ID        | **BLOCK**             | **BLOCK**             | **BLOCK**             | **BLOCK**          | **BLOCK**             | **BLOCK**             | **BLOCK**             |
| Canonical hold after overflow hash    | PASS                  | PASS                  | PASS                  | PASS               | PASS                  | PASS                  | PASS                  |
| Canonical safety                      | PASS `selected_maybe` | **BLOCK beach skill** | PASS `selected_maybe` | PASS `selected_no` | **BLOCK beach skill** | PASS `selected_maybe` | **BLOCK beach skill** |
| Cooldown/rule cap/user cap            | PASS                  | PASS                  | PASS                  | PASS               | PASS                  | PASS                  | PASS                  |
| Email requested + profile/destination | PASS                  | PASS                  | PASS                  | PASS               | PASS                  | PASS                  | PASS                  |
| Email provider branch after fix       | **REACHES**           | blocked earlier       | **REACHES**           | **REACHES**        | blocked earlier       | **REACHES**           | blocked earlier       |
| Push requested                        | OFF                   | OFF                   | OFF                   | ON                 | OFF                   | ON                    | OFF                   |
| Push profile master                   | —                     | —                     | —                     | **BLOCK**          | —                     | PASS                  | —                     |
| Push worker/provider branch           | —                     | —                     | —                     | blocked earlier    | —                     | **REACHES**           | —                     |

Two interpretations need care:

- Q2 and Q5 were `fresh_match` in the original queue snapshot but were `stale` against forecast rows written at `2026-08-10T17:00:52.317Z`. More forecast writes can change that again before 22:00 UTC.
- Q4's utility verdict is `no`, but the canonical engine still supplies a selection and the route gates on selection, not on `verdict !== "no"`. Therefore Q4 reaches email in the current code. That behavior is proven; whether it is desired product behavior is not part of this fix.

Projected delivery if no forecast, config, hold, or dedupe state changes before the due runs:

- Q1, Q3, Q4, and Q6 reach Resend.
- Q6 additionally reaches Expo push and the in-app insert.
- Q2 and Q5 are consumed as stale.
- Q7 is consumed as a canonical safety rejection.

## Complete gate map

### Producer: queue to email/push handoff

| Gate                                | Location                                                                                          | What can stop delivery                                                                                                              | Result for Q1–Q7                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cron schedule and authorization     | `vercel.json:152-157`; `condition-alert-deliver/route.ts:379-384`                                 | Hourly invocation must occur and cron authentication must pass.                                                                     | PASS operationally; the 16:00 run executed. No cron was triggered in this investigation.                                                                |
| Global kill switch                  | `condition-alert-deliver/route.ts:386-394,1097-1110,1353-1365`                                    | `ALERTS_DELIVERY_ENABLED !== "true"`.                                                                                               | PASS for all. Deployed config was observed enabled, and the 16:00 attempts reached the later hold gate rather than `delivery_disabled`.                 |
| User allowlist                      | `condition-alert-deliver/route.ts:388-394,1110-1120,1366-1376`                                    | A nonempty allowlist excludes the user.                                                                                             | PASS for all; deployed allowlist was empty at snapshot.                                                                                                 |
| Due, unsent queue selection         | `condition-alert-deliver/route.ts:667-690`                                                        | Requires `sent=false`, `send_at<=now`, and existing joined rule/beach rows. Query failure aborts the run.                           | All seven were unsent with valid joins; WAIT until their listed hourly due run.                                                                         |
| Rule enabled                        | Same query at `condition-alert-deliver/route.ts:672-688`                                          | Nothing: the route does **not** select or check `alert_rules.enabled`.                                                              | All seven rules were enabled anyway. This is not a delivery gate.                                                                                       |
| Alert-type branch                   | `condition-alert-deliver/route.ts:759-771`                                                        | `similarity_match` rows take a different path.                                                                                      | PASS: all seven are legacy `forecast_alert` rows.                                                                                                       |
| Revalidation prerequisites          | `condition-alert-deliver/route.ts:185-215,428-451`                                                | Missing conditions/coordinates, query error, or zero forecast rows causes fail-open use of the queued snapshot rather than a block. | PASS: all have conditions, coordinates, and eight forecast rows.                                                                                        |
| Fresh forecast still matches        | `condition-alert-deliver/route.ts:452-467,773-800`; `lib/alerts/revalidate-alert-window.ts:34-56` | A nonempty successful forecast query that yields no actionable matching window consumes the row as stale.                           | PASS Q1/Q3/Q4/Q6/Q7; BLOCK Q2/Q5 at 17:17 projection. Future writes can change this.                                                                    |
| Persist refreshed window            | `condition-alert-deliver/route.ts:469-490,775-779`                                                | An update failure throws and aborts the cron.                                                                                       | Recent production route writes succeeded with `errors:0`; current-row mutation was not attempted because production is read-only for this task.         |
| Profile batch lookup                | `condition-alert-deliver/route.ts:802-831,860-865,961-989`                                        | Query error aborts; missing profile ultimately consumes as `orphaned_profile`.                                                      | PASS all: seven active profile rows exist.                                                                                                              |
| Canonical major-event hold boundary | `condition-alert-deliver/route.ts:849-945`; `notification.ts:94-98,240-303,369-449`               | Malformed/oversized identity or payload, unresolved RPC, active matching hold, or enforce-mode evaluation failure suppresses.       | **BLOCK all seven solely because the 189-character candidate becomes null.** Hash/short controls PASS all; latest production hold chains are cancelled. |
| Safety data and skill               | `lib/recommendations/canonical-decision/engine.ts:54-83,196-351`                                  | Unknown user skill; invalid candidate; missing/excess beach skill; missing/excess wave height; explicit safety override.            | Q2/Q5 BLOCK (`advanced` beach > `intermediate` user); Q7 BLOCK (`upper-intermediate` normalizes to `intermediate` > `beginner`); Q1/Q3/Q4/Q6 PASS.      |
| One canonical candidate per user    | `condition-alert-deliver/route.ts:860-945`; `engine.ts:210-239`                                   | Only one selected candidate proceeds; other candidates are consumed as `non_canonical`.                                             | PASS all: seven distinct users and one live row each.                                                                                                   |
| Canonical selection existence       | `condition-alert-deliver/route.ts:893-908`; `route.ts:315-325`                                    | A decision without `selection` is rejected. A `no` verdict with a selection is not rejected.                                        | PASS Q1/Q3/Q4/Q6; BLOCK Q2/Q5/Q7.                                                                                                                       |
| Recent-attempt lookup               | `condition-alert-deliver/route.ts:833-847`                                                        | Query error aborts the run.                                                                                                         | PASS at snapshot.                                                                                                                                       |
| Per-rule 24-hour cooldown           | `condition-alert-deliver/route.ts:997-1038`; `lib/alerts/throttle.ts:19-39`                       | Any `sent` attempt for that rule in 24 hours blocks each requested channel.                                                         | PASS all: zero.                                                                                                                                         |
| Optional rule weekly cap            | `condition-alert-deliver/route.ts:223-229,1039-1055`                                              | `max_frequency_per_week`, capped at 14, blocks when sent-attempt count reaches it.                                                  | PASS all: cap is null and count is zero.                                                                                                                |
| Global user weekly cap              | `condition-alert-deliver/route.ts:1011-1016,1056-1066`; `lib/alerts/throttle.ts:41-59`            | Ten `sent` attempts across channels in seven days blocks.                                                                           | PASS all: zero.                                                                                                                                         |

### Email channel

| Gate                                       | Location                                                                                                     | What can stop delivery                                                                                                   | Result for Q1–Q7                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule requests email                        | `condition-alert-deliver/route.ts:959,1097`                                                                  | `notify_email=false` removes the row from email.                                                                         | PASS all seven.                                                                                                                                                 |
| Email quiet hours                          | `condition-alert-deliver/route.ts:1072-1134`; `lib/notifications/quiet-hours.ts:12-33`                       | During the rule override or default 22:00–04:00 local window, row stays unsent for a later hour.                         | PASS all at scheduled send times; all resolve to America/Los_Angeles and are outside quiet hours.                                                               |
| Email profile preference                   | `condition-alert-deliver/route.ts:1140-1153`                                                                 | `profile.notif_email_enabled=false`.                                                                                     | PASS all.                                                                                                                                                       |
| Destination present                        | `condition-alert-deliver/route.ts:1154-1168`                                                                 | Null/blank `profiles.email`.                                                                                             | PASS all; every row has a nonblank destination. Addresses are intentionally omitted.                                                                            |
| Application suppression list               | Not called by this route. Utility exists at `lib/email/suppression.ts:7-62`.                                 | There is no application-side suppression gate here. Resend may still suppress provider-side.                             | None of the seven emails appears in `email_suppression_list`, but this route would not check it if one did.                                                     |
| Email delivery dedupe                      | `condition-alert-deliver/route.ts:1170-1192`                                                                 | Existing `(user, beach, alert_date, email)` `alert_deliveries` row.                                                      | PASS all: none at snapshot.                                                                                                                                     |
| Token secret and URL construction          | `condition-alert-deliver/route.ts:1193-1201`; `lib/alerts/email-token.ts:3-25`; `lib/mailer/client.ts:65-84` | Missing `ALERT_EMAIL_SECRET`/`CRON_SECRET` in production or non-HTTPS unsubscribe URL throws.                            | PASS config: supplied production env has `CRON_SECRET`; base URL is HTTPS. No secret value was printed.                                                         |
| Second per-match hold + canonical decision | `condition-alert-deliver/route.ts:350-376,1214-1243`                                                         | A hold/unresolved result or missing selection suppresses immediately before Resend.                                      | Shorter email candidates returned `allowed` for all; Q1/Q3/Q4/Q6 retain selections.                                                                             |
| Rate limiter                               | `condition-alert-deliver/route.ts:1212`; `lib/utils/email-rate-limiter.ts:16-48,89-91`                       | It delays by 600ms between calls; an extreme batch could run into route duration.                                        | Four projected emails are well below the 120s route budget.                                                                                                     |
| Resend configuration/provider              | `condition-alert-deliver/route.ts:1244-1287`; `lib/mailer/client.ts:25-84`                                   | Missing `RESEND_API_KEY`, thrown render/client error, provider rejection, provider-side suppression, or network failure. | Credential is present in supplied production env; actual provider acceptance is UNKNOWN because sending real email was prohibited. Q1/Q3/Q4/Q6 reach this call. |
| Post-send accounting                       | `condition-alert-deliver/route.ts:1288-1346`                                                                 | `alert_deliveries`/email log writes can fail after the provider call.                                                    | Does not stop an email that already left; can make counters/dedupe misleading. Not executed.                                                                    |

### Push producer

| Gate                                       | Location                                                                                                           | What can stop delivery                                                                     | Result for Q1–Q7                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Rule requests push                         | `condition-alert-deliver/route.ts:960,1353-1354`                                                                   | `notify_push=false`.                                                                       | ON only Q4 and Q6; OFF Q1/Q2/Q3/Q5/Q7.                                         |
| Producer master preference                 | `condition-alert-deliver/route.ts:1378-1391`                                                                       | `profile.notif_push_enabled=false`.                                                        | BLOCK Q4; PASS Q6.                                                             |
| Push delivery dedupe                       | `condition-alert-deliver/route.ts:1393-1414`                                                                       | Existing `(user, beach, alert_date, push)` `alert_deliveries` row.                         | PASS Q6; none at snapshot.                                                     |
| Second per-match hold + canonical decision | `condition-alert-deliver/route.ts:1441-1519`                                                                       | Hold/unresolved result or missing selection.                                               | PASS Q6 in the executable call.                                                |
| Registry payload/type validation           | `lib/notifications/enqueue.ts:56-103`; `lib/notifications/registry.ts:54-96,509-526`                               | Unknown type, missing recipient, or invalid forecast payload.                              | PASS Q6 using the actual validator.                                            |
| Active-event dedupe                        | `lib/notifications/enqueue.ts:104-149`; `supabase/migrations/20260430180434_notifications_phase5_schema.sql:39-45` | Unique collision on `(recipient, type, dedupe_key)` while pending/processing.              | PASS Q6 at snapshot: no active matching event. A future race remains possible. |
| Enqueue insert                             | `lib/notifications/enqueue.ts:110-149`                                                                             | DB insert/internal error or no returned row.                                               | In-memory execution PASS. Production mutation intentionally not exercised.     |
| Five-minute coalescing delay               | `lib/notifications/enqueue.ts:28-30,104-108`                                                                       | Surf alerts are not claimable until `next_attempt_at`; this delays rather than suppresses. | WAIT five minutes for Q6 after enqueue.                                        |

### Push worker and provider

| Gate                                | Location                                                                                                               | What can stop delivery                                                                                                     | Q6 result                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Worker schedule/auth                | `vercel.json:155-158`; `app/api/cron/notifications-deliver/route.ts:25-47`                                             | Minutely cron must run and authenticate.                                                                                   | PASS operationally; production summaries around the snapshot ran minutely.                                                          |
| Atomic claim, due time, batch/lease | `lib/notifications/worker.ts:335-435,1249-1294`                                                                        | Event must be pending/due and within the batch; RPC failure aborts.                                                        | Projected PASS after coalescing; real insert/claim not executed.                                                                    |
| Surf-event arbitration              | `lib/notifications/worker.ts:269-324,373-382`                                                                          | A higher-priority event for the same user/beach/date can win.                                                              | PASS snapshot: no competing event/claimed slot. Forecast alert has priority 3.                                                      |
| Known type and profile              | `lib/notifications/worker.ts:472-528`; `lib/notifications/registry.ts:509-526`                                         | Unknown type or missing recipient profile is terminal; profile query errors retry.                                         | PASS actual in-memory execution using Q6 profile.                                                                                   |
| Prior terminal outcome / retry cap  | `lib/notifications/worker.ts:561-587,739-746`                                                                          | A prior terminal channel result prevents re-dispatch; three failures permanently fail the channel.                         | PASS: no prior notification event/attempt exists.                                                                                   |
| Self-notification                   | `lib/notifications/worker.ts:835-841`; `registry.ts:523`                                                               | Types configured to suppress self can skip.                                                                                | Not a gate: forecast alerts set `suppressSelfNotify:false` and actor is null.                                                       |
| Worker master preferences           | `lib/notifications/worker.ts:843-846`; `registry.ts:515-520`                                                           | `notif_push_enabled` or `notif_inapp_enabled` false.                                                                       | PASS both for Q6.                                                                                                                   |
| Worker per-type preference          | `lib/notifications/worker.ts:848-851`; `registry.ts:517-521`                                                           | `notif_forecast_alerts=false`.                                                                                             | PASS Q6.                                                                                                                            |
| Worker quiet hours                  | `lib/notifications/worker.ts:853-867`; `registry.ts:524-525`                                                           | Push defers until quiet-window end.                                                                                        | PASS: projected worker time is about 18:05 local.                                                                                   |
| Worker per-type cooldown            | `lib/notifications/worker.ts:869-946`                                                                                  | Registry `cooldownMs` plus a recent sent attempt can skip.                                                                 | Not configured for `forecast_alert`; no worker cooldown gate.                                                                       |
| Worker hold checks                  | `lib/notifications/worker.ts:948-1028,1119-1126`                                                                       | Unresolved/active hold skips before and again after slot claim.                                                            | PASS in actual worker execution. Worker event identity is a UUID, so `notification:<uuid>` is below 160.                            |
| Push payload builder                | `lib/notifications/worker.ts:1080-1084`; `registry.ts:527-548`                                                         | Missing builder is internal failure.                                                                                       | PASS.                                                                                                                               |
| Firebase Admin initialized          | `lib/notifications/worker.ts:1086-1091`; `lib/services/firebase-admin.ts:13-77`                                        | Worker fails push when Firebase config is absent—even for Expo tokens, because this check precedes device transport split. | PASS in observed production worker summaries (`firebase_configured:true`) and harness.                                              |
| Device destination                  | `lib/notifications/worker.ts:1093-1110`                                                                                | Lookup error retries; no device terminal-skips.                                                                            | PASS: Q6 has one device and it is an Expo token. Every other row has zero devices, but no other row survives producer push gates.   |
| Cross-source surf slot              | `lib/notifications/worker.ts:1112-1126`; `supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:23-150` | Existing processing/processed winner for user/beach/date rejects this event.                                               | PASS snapshot: no slot. The RPC mutation/race was not exercised. Same event can re-claim its own slot for in-app (`lines 80-82`).   |
| Expo/FCM dispatch                   | `lib/notifications/worker.ts:1128-1216`; `lib/services/push-delivery.ts:57-201`                                        | Network exception, non-2xx Expo response, error ticket, FCM error, invalid token, or zero outcomes.                        | **Provider boundary reached** with one Expo message; response was deliberately simulated. Actual acceptance/device receipt UNKNOWN. |
| Retry/finalization                  | `lib/notifications/worker.ts:569-736,761-816`                                                                          | Provider/internal failures back off and permanently fail after three per-channel failures.                                 | Harness completed with push + in-app `sent`; real-provider failure behavior remains a runtime possibility.                          |

There is no subscription, entitlement, Pro-plan, or paywall gate in the producer, enqueue, registry, or worker paths. A source search for entitlement/subscription/plan checks in those modules returned no matches.

### Queue consumption after a hold failure

PR #530's bounded accounting is downstream of the root cause, not a fix for it. `condition-alert-deliver/route.ts:564-665` retains a row after unresolved-hold attempts one and two, then consumes it on attempt three as `hold_state_unavailable_retry_exhausted`. At the control snapshot all seven had zero prior unresolved attempts. If the ID bug remains, each will still be destroyed on its third due run without a send.

## Recommended fix and alternatives

### Recommendation: hash only overflow in the central notification adapter

Proposed behavior, not implemented here:

```ts
const readable = `notification:${eventId}`;
if (readable.length <= 160) return readable;
return `notification:sha256:${sha256(eventId)}`;
```

Why this is the strongest option:

- Preserves every currently valid/readable identity unchanged.
- Converts the current invalid identity into a deterministic 84-character identity.
- Covers all notification producers, including future oversized IDs, rather than patching one route.
- Leaves ample room for the adapter's `:match:${index}` suffix.
- Has negligible practical SHA-256 collision risk.
- The Q6 demonstration proves this exact transform passes the hold, canonical, enqueue, worker, slot, preference, device, and provider-boundary gates.

Tests required in a separate implementation task:

- Adapter unit test at exactly 160 and 161 characters, asserting stable overflow hash and enforce-mode behavior.
- Route regression using the real deliver-shaped user/rule/beach/window ID rather than mocking the hold resolver's result.
- Worker regression confirming a hashed producer identity does not alter the UUID-based worker hold identity.
- End-to-end no-provider test equivalent to this harness, preserving the Expo boundary assertion.

### Alternative: shorten only the deliver route ID

Using `condition-alert-deliver:canonical:${queueId}` produced an 83-character hold candidate and returned `allowed` for all seven.

Trade-offs:

- Smallest blast radius.
- Queue UUID is stable and unique, so this specific form is safe for these rows.
- The canonical loop currently operates on `MatchingWindow` values after queue consolidation, so recovering the exact queue ID requires an explicit binding rather than casually dropping user/beach/window components.
- It leaves the central adapter vulnerable to the next producer that crosses 160.
- Shortening by simply truncating or omitting fields can collide or make audit diagnosis ambiguous. Do not truncate.

### Alternative: raise the cap

Trade-offs:

- Keeps the full readable identity.
- Requires coordinated changes at all three validation points: `notification.ts:97`, `notification.ts:200`, and `evaluator.ts:34`. Raising only one recreates the same fail-closed outage one layer later.
- There is no database column requiring the current cap, so raising it gives no persistence benefit.
- It moves the failure threshold rather than making arbitrary producer IDs bounded.

Hashing overflow is therefore preferred over route-only shortening or raising the cap.

## Identity and persistence findings

The hold `candidateId` is an ephemeral intra-call correlation key, not the alert's durable dedupe/idempotency key.

Evidence:

- `resolveMajorEventHolds()` extracts only beach IDs and time bounds and calls the RPC with `p_as_of`, `p_beach_ids`, `p_window_start`, and `p_window_end`; it never passes candidate ID (`lib/recommendations/major-event-hold/repository.ts:302-349`).
- The production resolver is `STABLE` and has exactly those four arguments (`supabase/migrations/20260717170000_create_regional_recommendation_holds.sql:1089-1117`).
- The default audit sink logs beach/cohort/hold metadata but not candidate ID (`lib/recommendations/major-event-hold/service.ts:40-49`). No production custom audit sink was found.
- The route uses the hold result only as allowed/suppressed; it does not persist the returned hold candidate.
- Read-only production schema inspection found no candidate column in `alert_queue`, `alert_delivery_attempts`, `alert_deliveries`, `notification_events`, `notification_delivery_attempts`, or `regional_recommendation_holds`.
- `regional_recommendation_holds.idempotency_key` is a separate transition-write identity, unique and regex-limited to 160 (`...create_regional_recommendation_holds.sql:160-162`; repository validation at `repository.ts:25-33,81-83`). The hold resolver never compares it with candidate ID.
- `notification_events.dedupe_key` is separately supplied by the producer and uniquely enforced only for active rows (`lib/notifications/enqueue.ts:110-127`; `...notifications_phase5_schema.sql:39-45`). For Q6 it remains `forecast_alert:${userId}:${beachId}:${alertDate}` regardless of hold candidate hashing.
- `alert_deliveries` separately dedupes by `(user_id, beach_id, alert_date, channel)` in production.
- `alert_delivery_attempts` keys outcomes by queue/rule/user/channel and has no candidate field.
- `notification_events.payload.session_decision.selection.candidateId` is persisted, but it is the canonical alert identity `alert:${ruleId}:${beachId}:${windowStart}` built at `lib/recommendations/canonical-decision/alert-adapter.ts:18-22,34-56`. It is not the hold adapter identity `notification:${eventId}` and the proposed hash does not change it.

Consequences:

- No existing oversized hold identity needs migration: oversized inputs currently become `null`, so no valid value was ever persisted or used for dedupe.
- Deterministic hashing changes only ephemeral hold-decision correlation and potential diagnostic representation for the previously invalid case.
- Shortening the route ID also would not change `alert_delivery_attempts`, `notification_events`, `alert_deliveries`, or regional-hold transition identity, provided the new value is deterministic and collision-safe.
- The shared number 160 appears to be a convention mirrored by regional-hold transition idempotency, not a database linkage or column constraint on notification candidates.

## Forecast-layer status

Verdict: `UNKNOWN` because future forecast writes and external provider acceptance cannot be frozen without either waiting or sending.

| Layer               | Status  | Evidence                                                                                                                                              | Next action                                                                                                 |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| upstream            | WATCH   | Latest-write timestamps ranged from 14:31Z to 17:00Z; Q2/Q5 changed to stale during the investigation.                                                | Re-run the read-only harness immediately before each scheduled due hour if an updated projection is needed. |
| parser              | PASS    | The actual enhanced-forecast parser and `selectFreshAlertWindow` executed over eight rows per beach.                                                  | None for the ID fix.                                                                                        |
| database            | PASS    | Seven queue rows, profiles, prefs, dedupe state, attempts, devices, slots, suppression rows, hold RPC, and schema constraints were read successfully. | Keep any implementation validation read-only until explicitly approved.                                     |
| scoring             | PASS    | Actual canonical decisions produced selections for Q1/Q3/Q4/Q6 and explicit safety rejections for Q2/Q5/Q7.                                           | Treat Q4 `selected_no` delivery semantics as a separate product decision.                                   |
| ui                  | UNKNOWN | No UI is in the alert delivery path and none was exercised.                                                                                           | Not required for this root-cause fix.                                                                       |
| external_comparison | UNKNOWN | Expo/Resend were not called; provider receipt cannot be compared safely in this task.                                                                 | Validate with an authorized non-production destination during implementation/release.                       |

Write-time note: `newestWriteAt` in the harness is derived from `updated_at`/`created_at`, not `forecast_at`; forecast timestamps describe the predicted slot, not when the row was written.

## What remains unproven

- The exact forecast revalidation outcome at 19:00, 22:00, and 01:00 UTC. Q2/Q5 were stale at 17:17; any row can change after another forecast write.
- Real Resend acceptance, provider-side suppression/bounce state, mailbox placement, and human receipt for Q1/Q3/Q4/Q6.
- Real Expo acceptance, ticket/receipt outcome, token validity, OS presentation, and human receipt for Q6. The harness proved construction of the outbound POST and simulated an `ok` ticket only.
- The real production enqueue insert, five-minute claim, and surf-slot mutation for Q6. Those are prohibited production writes; schema/state inspection and in-memory execution passed.
- A future concurrent dedupe or higher-priority surf-slot race. No collision or slot existed at snapshot.
- Future hold activations or deployment-config changes before a due run.
- Full route-handler execution with a production row, because invoking it would write attempts, refresh queue rows, consume attempt budget, and potentially send real alerts.

None of those uncertainties weakens the root-cause proof: the current 189-character candidate deterministically suppresses before they can matter. They bound the stronger claim that a real recipient will receive a message at a future due run.

## Test coverage gap that allowed this

- `__tests__/lib/recommendations/major-event-hold/notification.test.ts` covers malformed candidates and hold modes but has no 160/161 boundary or real deliver-shaped ID.
- `__tests__/api/cron/condition-alert-deliver.test.ts` mocks `resolveNotificationMajorEventHold`; it verifies how suppression is accounted but cannot expose adapter construction failure.
- `__tests__/notifications/worker.test.ts` already covers Expo routing and downstream hold behavior, but it starts after the producer's failing canonical hold.
- No relevant Playwright E2E spec exists; this is a server/cron/provider pipeline and the safe executable harness provides the missing cross-module proof without a production send.

## Frozen row aliases

| Alias | Queue ID                               | Scheduled send    |
| ----- | -------------------------------------- | ----------------- |
| Q1    | `a299c3e4-0124-43d4-bdd2-c4504eea3262` | 2026-08-10 19:00Z |
| Q2    | `38a2e309-3e23-4594-9414-049422221efd` | 2026-08-10 22:00Z |
| Q3    | `710b8538-2742-465e-9216-c47e905d76be` | 2026-08-10 22:00Z |
| Q4    | `9cc6043b-f320-4436-976d-d34cacacc824` | 2026-08-10 22:00Z |
| Q5    | `be5255ad-4eea-446b-bc0c-d84e75e315f2` | 2026-08-10 22:00Z |
| Q6    | `bf16aea8-74c7-4f82-b6de-4c791a8eea7d` | 2026-08-11 01:00Z |
| Q7    | `ed715baf-9bcf-4f69-9ad7-10418efe4e87` | 2026-08-11 01:00Z |
