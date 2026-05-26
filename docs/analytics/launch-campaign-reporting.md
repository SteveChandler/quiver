# Launch Campaign Reporting

**Status:** read-only runbook
**Campaign:** `go_live_2026_05`
**Primary SQL:** `docs/analytics/launch-campaign-reporting.sql`

## Scope

Use this runbook to assemble the go-live readout without sending outreach,
changing trackers, mutating production data, or claiming checkout is live before
RevenueCat Web Billing is verified.

## Web Signals

- Page views: `page_view` rows where
  `metadata->>'launch_campaign' = 'go_live_2026_05'`.
- iOS CTA funnel: existing `cta_impression` / `cta_click` rows where
  `metadata->>'cta_family' = 'ios_app'`.
- Pricing waitlist funnel: `signup_cta_view` / `signup_cta_click` rows where
  `metadata->>'cta_type' = 'founding_access_waitlist'`.
- Blog cross-links: `cta_click` rows where
  `metadata->>'cta_family' = 'launch_blog_cross_link'`.

Do not add ad hoc event names for the launch report. New event types require the
TypeScript union, API allowlist, anonymous/pre-auth guard review, and database
constraint to move together.

## App Store And TestFlight Truth

Recheck these immediately before publishing a launch readout because Apple state
can change independently of this repo:

```bash
curl -fsS "https://itunes.apple.com/lookup?id=6759300320&country=us"
curl -I -L "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320"
curl -I -L "https://testflight.apple.com/join/G31D4XW6"
```

Report the exact checked timestamp, status code, app version, bundle ID,
destination URL, and whether the App Store page still exposes preorder metadata.

## Outreach And Social State

Use the Brand-Vault trackers as evidence sources, not write targets:

- `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/founding-crew-warm-user-tracker.csv`
- `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/ig-outreach-targets.csv`
- `/Users/stevenchandler/Desktop/dev/Brand-Vault/trackers/TASKS.md`

Summarize counts by channel, segment, approved/draft/sent status, reply status,
and suppression reason. Suppress Apple relay, bounce, unsubscribe,
not-interested, internal/test, and platform-mismatch rows per the Phase 8 channel
rules before any human-approved send.

## Report Shape

1. Window and source freshness.
2. App Store/TestFlight truth.
3. Web launch traffic by surface.
4. iOS CTA views/clicks by placement and destination status.
5. Pricing waitlist views/clicks.
6. Blog views and cross-link clicks into pricing, forecast, beach, learn,
   roadmap, session-log, and App Store surfaces.
7. Outreach/social tracker state.
8. Conversion notes, blockers, and approval-gated next steps.

## Approval Gates

- No public checkout or lifetime purchase claim until RevenueCat Web Billing,
  entitlement sync, webhook filtering, and native unlock are verified.
- No outbound email, DM, social post, Reddit post/comment, tracker write,
  entitlement grant, App Store Connect change, or production mutation without
  explicit approval.
