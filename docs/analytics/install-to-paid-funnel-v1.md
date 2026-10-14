# Install-to-paid funnel v1

The unit is one valid `native_install_id`, anchored at the earliest production PostHog `native_app_first_open` for that ID within the report window. App Store Connect downloads are an aggregate-only comparison and never become people or install rows. The existing `install_to_paid.v1` rows and CSV are unchanged; `install_to_paid_aggregates.v1` adds cohort counts and rates.

## Sources and stages

| Stage | Proof and join | Aggregate maturity |
| --- | --- | --- |
| Native install | PostHog `native_app_first_open`, valid `native_install_id` | At anchor |
| Signup | Supabase `user_events` first-open `session_id` or `metadata.native_install_id` to `user_id`, then `profiles.id` and `profiles.created_at` | At anchor; reinstall excluded from signup eligibility |
| Home activated | Linked profile `onboarding_completed_at` or same PostHog person `home_viewed` / `home_hero_forecast_viewed` | At anchor |
| First decision loop | Same PostHog person `decision_loop_completed` | At anchor |
| D1 return | Same PostHog person's meaningful activity in [install + 24h, install + 48h) | Install + 48h |
| D7 return | Same PostHog person's meaningful activity in [install + 168h, install + 192h) | Install + 192h |
| Paywall viewed | Same PostHog person `paywall_opened` / `onboarding_paywall_viewed` | At anchor |
| Verified trial | `revenuecat_provider_events.app_user_id = user_id`, production `INITIAL_PURCHASE` with `period_type = TRIAL`; aggregate qualification is within 720h of install | Install + 720h |
| D30 paid | RevenueCat ledger replay for the linked user at install + 720h, requiring active non-trial, non-promotional paid entitlement | Install + 720h |

Rates are `true / (true + false)` and emitted with numerator, denominator, and nullable rate. Unknown and immature are counted separately; unknown share is `unknown / (true + false + unknown)`. The overall group, Monday-start local install weeks, each one-way dimension, and platform × experiment variant use the same anchored rows. Repeated evidence for the same user, stage, and qualification timestamp is attributed once; later rows are unknown for that stage. The signup eligible count excludes explicitly excluded rows and reinstall rows.

Dimensions come from the same PostHog event payload and RevenueCat ledger: platform, acquisition source and surface from the anchor, first onboarding experiment exposure's variant, first paywall view's `source`, and the product ID of the first qualifying RevenueCat trial event. Missing properties are `unknown`; no paywall or verified trial is `none`. Trial plan is annual, monthly, lifetime, or other from product ID text. An intent event cannot verify a trial.

Bot, emulator, test, non-production, and internal or ineligible profiles stay visible in exclusion counts. Missing links, unmerged PostHog people, missing profiles, webhook DLQ, and reinstall identity churn stay visible in join diagnostics. The report cannot identify opted-out first opens, recover a missing exact join, infer attribution from ASC downloads, or prove a purchase from PostHog intent alone. The existing row-level milestone semantics remain intact; aggregate trial maturity and duplicate attribution are additional rules.

Run with Node 22 and report credentials, for example:

```sh
source ~/.nvm/nvm.sh && nvm use 22
npx tsx scripts/install-to-paid-funnel-report.ts --start 2026-01-01 --end 2026-02-01 --tz America/Los_Angeles --as-of 2026-03-05T00:00:00Z --output-json /tmp/install-to-paid.json --output-md /tmp/install-to-paid.md
```

`--start` and `--end` are local complete-day boundaries when `--tz` is supplied. For compatibility, explicit date-only boundaries without `--tz` retain UTC semantics. The default complete-day window uses America/Los_Angeles. `--days` selects its length; `--output-csv` retains the original row columns, and `--asc-json` accepts a separate ASC aggregate array.
