# Server-Side Funnel Events

**Status:** production contract
**Last verified:** 2026-10-08

These PostHog events are captured by the Quiver web server so one set of event
names measures the funnel onboarding -> first session -> alert created ->
paywall -> trial -> paid for web and native together. They are PostHog-only:
they are not written to Supabase `user_events` and are not accepted from
clients by `/api/events`.

All of them:

- use the Supabase user id as `distinct_id`, so they join the person native and
  web already identify;
- carry the `$insert_id` shown below, so a retry does not double count;
- are sent only when the user has analytics tracking allowed
  (`profiles.allow_implicit_tracking`, the same rule as
  `notification_delivery_attempt`). Opted-out users are absent from these
  events, so revenue counts here are a lower bound on RevenueCat.

## `alert_created`

Emitted after a successful `alert_rules` insert by
`lib/analytics/alert-created-server.ts`. Replaces `alert_rule_created` for
funnel reporting: that event is client-emitted, comes only from the native
one-tap button, and never covered onboarding seeds or the web.

| Property | Values |
| --- | --- |
| `alert_type` | `alert_rules.preset_type`, or `custom` for a hand-built condition set |
| `beach_id` | beach the rule watches |
| `source` | `rules_api` (`POST /api/alerts/rules`: web popover, web alerts page, native), `onboarding_seed` (default rules seeded when onboarding completes: web action and native `POST /api/alerts/seed-default`), `anon_capture` (email captures converted in `/auth/callback`) |
| `platform` | `web` or `native` (a Bearer token or `x-quiver-platform: ios\|android` means native) |
| `is_first_alert` | the user owned no alert rule before this one; in a seed batch only the first rule is true |
| `rule_id` | rule id (absent for `anon_capture`, which only knows the capture id) |
| `notify_email`, `notify_push` | channels on the rule (absent for `anon_capture`) |

`$insert_id` is `alert_created:<rule_id>` or `alert_created:capture:<capture_id>`.
Not emitted when `POST /api/alerts/rules` returns an existing watched call
(`already_exists`) or rejects the request.

Count users who created an alert with `uniq(person_id)` on `alert_created`;
filter `source = 'rules_api'` for deliberate creation, because most new
rules are onboarding seeds.

## RevenueCat events

Emitted by `app/api/webhooks/revenuecat/route.ts` through
`lib/analytics/revenuecat-funnel-events.ts`, right after the
`revenuecat_provider_events` ledger row is stored. A redelivery of an event
that already finished returns before this point. The RevenueCat event id is
the PostHog `uuid` and `$insert_id` (`revenuecat:<id>`), and the RevenueCat
event time is the PostHog `timestamp`, so a retry of an unfinished event lands
on the same row.

| RevenueCat event | PostHog event |
| --- | --- |
| `INITIAL_PURCHASE` with `period_type` `TRIAL` | `trial_started` |
| `INITIAL_PURCHASE`, any other period | `subscription_started` |
| `RENEWAL` with `is_trial_conversion` true | `trial_converted` |
| `RENEWAL`, otherwise | `subscription_renewed` |
| `NON_RENEWING_PURCHASE` | `lifetime_purchased` |
| `CANCELLATION` | `subscription_cancelled` |
| `UNCANCELLATION` | `subscription_uncancelled` |
| `EXPIRATION` | `subscription_expired` |
| `BILLING_ISSUE` | `billing_issue` |
| `PRODUCT_CHANGE` | `subscription_product_changed` |

Properties: `product_id`, `store`, `period_type`, `price`,
`price_in_purchased_currency`, `currency` and `cancel_reason` when RevenueCat
sends them; `rc_event_id`, `rc_event_type`, `rc_environment`
(`PRODUCTION` or `SANDBOX`) and `is_sandbox`; `is_paid_lifetime_product` on
`lifetime_purchased`. The standard `environment` property is the Vercel
deployment environment, not the RevenueCat one.

Rules:

- **Filter sandbox out of paid funnels**: add `is_sandbox = false`.
- Anonymous `$RCAnonymousID:` ids and any non-UUID app user id are never sent.
- Promotional grants (store or period `PROMOTIONAL`, `rc_promo_*` products)
  are skipped, because they are not paid conversion. `TRANSFER` and other
  unmapped event types are skipped too.
- If the ledger insert fails and the event is only recorded in the DLQ, the
  PostHog event is skipped; the RevenueCat retry or reconciler is the repair
  path for entitlements, not for PostHog.

Related client events that still exist: `paywall_opened`,
`paywall_purchase_started`, `paywall_purchase_success`, `onboarding_trial_started`
(native). Use the server events above for conversion counts and the client
events for step-level drop-off.
