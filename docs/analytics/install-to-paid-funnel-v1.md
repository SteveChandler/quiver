# Install-to-paid funnel v1

The unit is one valid `native_install_id`, anchored at the earliest production PostHog `native_app_first_open` for that ID within the report window. App Store Connect downloads are an aggregate-only comparison and never become people or install rows. The existing `install_to_paid.v1` rows and CSV are unchanged; `install_to_paid_aggregates.v1` adds cohort counts and rates.

## Sources and stages

| Stage | Proof and join | Aggregate maturity |
| --- | --- | --- |
| Native install | PostHog `native_app_first_open`, valid `native_install_id` | At anchor |
| Signup | Supabase `user_events` first-open `session_id` or `metadata.native_install_id` to `user_id`, then `profiles.id` and `profiles.created_at` | At anchor; reinstall counted as `notApplicable` |
| Home activated | Linked profile `onboarding_completed_at` or same PostHog person `home_viewed` / `home_hero_forecast_viewed` | At anchor |
| First decision loop | Same PostHog person `decision_loop_completed` | At anchor |
| D1 return | Same PostHog person's meaningful activity in [install + 24h, install + 48h) | Install + 48h |
| D7 return | Same PostHog person's meaningful activity in [install + 168h, install + 192h) | Install + 192h |
| Paywall viewed | Same PostHog person `paywall_opened` / `onboarding_paywall_viewed` | At anchor |
| Verified trial | `revenuecat_provider_events.app_user_id = user_id`, `environment = PRODUCTION`, `event_type = INITIAL_PURCHASE`, `period_type = TRIAL`; first qualifying event in [install, install + N days), seen by `asOf` | Install + N days; `--trial-window-days` defaults to 7 |
| D30 paid | RevenueCat ledger replay for the linked user at install + 720h, requiring active non-trial, non-promotional paid entitlement | Install + 720h |

Every rate includes numerator, denominator, and a nullable rate. The **known-join rate** (`rate`) is `true / (true + false)`. The **lower bound (unknown counted as no)** (`lowerBoundRate`) is `true / (true + false + unknown)`. Unknown share is `unknown / (true + false + unknown)`. Excluded rows are absent from all stage counts and rate denominators, including native install. Immature and `notApplicable` rows are counted separately and omitted from all rate denominators. A reinstall onto an existing account without an exclusion reason is `notApplicable` only for signup. The `installs` header retains all anchored rows, with excluded counts by reason and join diagnostics.

The overall group, Monday-start local install weeks, each one-way dimension, and platform × experiment variant use the same anchored rows. Repeated evidence for the same user, stage, and qualification timestamp is attributed once; later rows are unknown for that stage. Aggregate trial truth scans the loaded ledger for the configured install window, independently of the row's earliest account trial. `maturityHours.verifiedTrial` reports N × 24; D30 paid remains 720 hours.

PostHog's HogQL `properties` column may be an object or a JSON-encoded string. The runner preserves either object form; malformed JSON and non-object values are treated as missing properties. Dimensions use the same loaded events and ledger:

- `platform`: anchor `native_app_first_open.properties.platform`, normalized from ios/native-ios or android/native-android.
- `acquisitionSource`: `acquisition_source` on the first `native_install_attribution_joined` matched by `native_install_id`. If no exact match exists, use an event without an install ID for the same person between this anchor and their next distinct install. If that event has no source, use `outcome:<install_attribution_outcome>` from the joined event, then from the anchor, then `unknown`. The runner explicitly loads the attribution-joined event. `acquisitionSurface` remains the anchor's secondary field.
- `experimentVariant`: first onboarding experiment exposure's `onboarding_variant` as of the report cutoff.
- `paywallSource`: first install paywall view's `source`; no view is `none`.
- `trialPlan`: annual, monthly, lifetime, or other from the first in-window qualifying RevenueCat trial's product ID, retaining the raw product ID. It is `none` unless the aggregate verified-trial status is true, including when immature, unknown, excluded, or deduplicated. A verified trial without a product ID has plan `unknown`.

Missing dimension properties are `unknown`. An intent event cannot verify a trial.

Bot, emulator, test, non-production, and internal or ineligible profiles stay visible in exclusion counts. Missing links, unmerged PostHog people, missing profiles, webhook DLQ, and reinstall identity churn stay visible in join diagnostics. The report cannot identify opted-out first opens, recover a missing exact join, infer attribution from ASC downloads, or prove a purchase from PostHog intent alone. The existing row-level milestone semantics remain intact; aggregate trial maturity and duplicate attribution are additional rules.

Run with Node 22 and report credentials, for example:

```sh
source ~/.nvm/nvm.sh && nvm use 22
npx tsx scripts/install-to-paid-funnel-report.ts --start 2026-01-01 --end 2026-02-01 --tz America/Los_Angeles --as-of 2026-03-05T00:00:00Z --trial-window-days 7 --output-json /tmp/install-to-paid.json --output-md /tmp/install-to-paid.md
```

`--start` and `--end` are local complete-day boundaries when `--tz` is supplied. For compatibility, explicit date-only boundaries without `--tz` retain UTC semantics. The default complete-day window uses America/Los_Angeles. `--days` selects its length; `--output-csv` retains the original row columns, and `--asc-json` accepts a separate ASC aggregate array.

`--trial-window-days` requires a positive integer and controls aggregate trial qualification and maturity. Markdown prints both rate definitions beside their n values, plus unknown, immature, and not-applicable counts for every stage and breakdown.
