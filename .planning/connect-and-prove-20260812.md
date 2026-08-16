# Connect and Prove — 2026-08-12

Production measured directly via `POSTGRES_URL_NON_POOLING` (psql). Supabase/PostHog/Sentry
MCP connectors are unauthorized in this session, so every claim below is Postgres-observed
or code-read. Nothing was written to production: all probes ran inside rolled-back
transactions.

---

## Iteration 1 — Alert delivery: PROVEN CONNECTED

**Was disconnected:** `FORECAST_ALERT_DELIVERY_ENABLED` was an empty string; the pipeline
evaluated and queued nothing deliverable for 16 days (last delivery 2026-07-25).

**Changed:** nothing this session — the flag flip and redeploy landed 2026-08-11. This
iteration was proof, which had never been obtained.

**Observed evidence (production):**

| Signal | Value |
|---|---|
| `alert_deliveries` rows | 2, at 2026-08-11 22:01:37 and 22:01:38 UTC |
| Recipients | Real users, real spots (Waddell Creek 2-3ft, Bolinas 3-4ft) |
| Provider confirmation | `email_delivery_events` → `email.delivered` for both |
| **User-visible outcome** | **`email.opened` at 22:13:51 — a user opened a surf alert 12 min after send** |

End-to-end chain confirmed: evaluate → queue → deliver → Resend → inbox → opened.
The 16-day outage is over.

**Mechanism verified, not just the value.** `condition-alert-evaluate` went from
`queued: 0, skipped: 31` (Aug 10, flag off) to `queued: 25/28` (Aug 11/12). The
`shadow_withheld` counter fires only when `!forecastDeliveryEnabled`, which dates the
redeploy to between 16:00 and 22:01 on Aug 11.

**Full Aug 11 accounting — 25 queued, reconciles exactly:**
- 14 `shadow_withheld` (runs at 13:01 and 16:00, still on the pre-fix deploy)
- 9 `stale` (fresh forecast no longer matched the rule — correct behavior, not loss)
- 2 delivered

**Ruled out, honestly:** `pushSent: 0` is *not* a disconnection — both delivered users have
zero rows in `user_devices`. Today's `"No items due"` runs are also correct: today's 28 rows
are future-dated (`send_at` 13:00–22:00 UTC).

**Confirmed on the first full post-fix day (13:01 UTC run).** Expectation stated *before*
the run: 19 due, 16 above the 0.3 floor, 10 of those with a registered device;
`emailSent = 0` would mean delivery is still disconnected, and `emailSent > 0` with
`pushSent = 0` would mean the push channel specifically is.

Result: `processed 13, emailSent 13, pushSent 7`, `stale=6, delivered=13`. Queue
reconciles exactly — 19 due = 13 delivered + 6 stale.

| Channel | Sent | Users | Spots |
|---|---|---|---|
| email | 13 | 13 | 9 |
| push | **7** | 7 | 6 |

Provider confirmation for today's alerts: **12 `email.delivered`, 5 `email.opened`** —
several opened within ~60–90 seconds of send. Real spots: Oceanside Pier 3-4ft, C Street /
Ventura Point 3ft, Pleasure Point, Windansea, La Jolla Shores, Mission Beach, Tourmaline,
Beacons, Grandview.

**Push is connected.** The `pushSent: 0` seen on Aug 11 was purely an artifact of those two
recipients having no registered device — not a second disconnection. Both channels are live.

---

## Iteration 2 — 11 native events rejected by the database: CONNECTED (applied 2026-08-12)

> **Correction — 2026-08-13:** The migration below was merged to `main` and stamped as
> applied to production in `dc4f0a6d5` on 2026-08-12. The current audit could not repeat
> the live check because production DNS access was unavailable.

**Was disconnected:** native `trackEvent()` inserts *directly* into `user_events` via the
Supabase client, so the web `VALID_EVENTS` taxonomy never gates it —
`user_events_event_type_check` is the only gate. Eleven types in
`NativeAnalyticsEventType` are absent from that constraint. Each insert raises 23514,
`dispatchTrackEvent` retries once, fails, and drops it. `trackEvent` is `void`-dispatched,
so the success signal cannot represent failure.

**Proof (production, rolled back):** inserting `onboarding_paywall_viewed` raises
`violates check constraint "user_events_event_type_check"`; the control
`onboarding_paywall_skipped` inserts cleanly. A loop over all 139 native event types
returns exactly 11 rejected:

```
onboarding_paywall_viewed, onboarding_free_selected, onboarding_purchase_started,
onboarding_purchase_success, onboarding_purchase_failed, onboarding_purchase_cancelled,
onboarding_restore_result, community_filter_selected, siri_shortcut_opened,
garmin_connect_viewed, garmin_designated_activity_set
```

All eleven have **zero rows all-time**, despite shipping in 1.0.1/1.0.2. Proof the code
path is live: `paywall_opened` fires from the *same* `useEffect` in
`trial-prompt-step.tsx`, three lines above, and has rows on both versions.

**Impact is narrower than the zero-row counts suggest — correcting an overstatement I
made mid-session.** Ten of the eleven are emitted alongside an allowed sibling at the same
call site (`paywall_opened`, `paywall_purchase_started`/`_success`/`_failed`,
`onboarding_paywall_skipped`), so the underlying signal survived. The mission brief's
"the denominator for that surface is unmeasured" is therefore not right:
`paywall_opened` with `paywall_step: trial_prompt` *is* the denominator and it works.

`onboarding_restore_result` is the single genuine loss — no sibling, so onboarding restore
outcomes were never recorded.

The real ongoing costs are (a) every onboarding paywall view runs two rejected inserts plus
a Sentry diagnostic, and (b) the structural defect below.

**Changed:** `supabase/migrations/20260812130000_allow_native_onboarding_purchase_events.sql`
from commit `2fe2e3bf6`; it was subsequently merged to `main` and stamped as applied in
`dc4f0a6d5`. It follows the established idempotent pattern that preserves the live CHECK
expression dynamically.

**Verified in a rolled-back transaction against production:** 11 added → 0 still rejected;
an unknown event type is **still rejected** (so the constraint was widened, not neutered);
a second run reports "no change". `yarn jest __tests__/events-allowlist` 38/38 and
`__tests__/migrations` 653/653 pass.

**Applied:** The repository records the production apply on 2026-08-12 14:19 UTC. The
original rolled-back verification reported 11/11 accepted, unknown event types still
rejected, and a second run as a no-op. Historical rejected rows are not recoverable;
`onboarding_restore_result` remains the one genuine lost signal.

**Structural cause (named rather than patched):** the native allowlist
(`quiver-native/src/lib/analytics.ts`) and this CHECK constraint (`quiver` migrations) are
two independent registries in two repos with no invariant binding them. 38 event-allowlist
tests pass while 11 events are dropped, and `KNOWN_REJECTED_USER_EVENT_EMITTERS` — the
registry meant to catch exactly this — is an empty array covering only web emitters. The
next native event added without a sibling will be lost the same silent way. Closing this
needs a cross-repo invariant (a native test probing a local Supabase, or a checked-in
contract); that is a separate piece of work and a design call, deliberately not made here.

---

## Measured and deliberately NOT pursued

- **NWS Guam (`nws_gum_srf`) parser failure.** The 2026-08-12 12:10 ingest run is the first
  `healthy: false` one: `parser_failed / duplicate_issue_identity` at HTTP 200. **Zero
  beaches and zero users** sit within Guam's bounding box, so this is the "11 Great Lakes
  offices" trap. Worth fixing only for a second-order reason: it pins `healthy: false`
  permanently, turning the one flag that could catch a real stall into noise.

- **Paywall retiming (L2).** ~11–16 new users/week and ~10 paywall opens/week, with zero
  `paywall_purchase_success` since 2026-07-04. Real, but at that volume a timing change
  would take many weeks to produce a readable signal. Sized, not started.

## Confirmed from the brief

- **Seaside 12:10 UTC run shows `source_count: 41`.** Confirmed (40 ok, 1 failed).
- **`fetch-trusted-forecasts` staleness is real and recurred.** No run record between
  2026-08-11 06:10 and 2026-08-12 12:10 — a **30-hour gap** spanning the deploy, covering
  at least the Aug 12 00:10 run under the new `CronTrigger(hour='*/12', minute=10)`
  schedule. The run row is upserted only on success
  (`crons/fetch_trusted_forecasts.py:_write_ingest_run`), so a crash and a never-fired run
  are indistinguishable.
- **Nothing reads `trusted_forecast_ingest_runs`** in either repo outside migration tests.
  The web side already has the machinery to alert on this — `/api/monitoring/forecast-health`
  runs every 30 min under `withObservedCron` with a Sentry monitor — but it checks
  beach-level source staleness only and has no concept of the trusted ingest. That is the
  cheapest remaining connection, and the brief pre-authorizes it ("a staleness alert is
  cheaper than a write-path change"). Next iteration.
