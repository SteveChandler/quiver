# Phase 20: Domain, App Links, Analytics, And QA - Context

**Gathered:** 2026-06-01
**Status:** Added to roadmap, not planned

<domain>
## Phase Boundary

Validate web-to-native handoff, analytics, and full Session Intelligence QA. Do
not ship placeholder app-link identifiers or certificate fingerprints.
</domain>

<app_links>
## Domain And App Links

- Verify canonical web domain: `www.quiversurf.app`.
- Add or validate `apple-app-site-association`.
- Add or validate `assetlinks.json`.
- Validate universal links for `/app/spot/:slug?window=:id`.
- Fall back to the App Store if the app is not installed.
</app_links>

<analytics>
## Analytics

Track when analytics exists:

- `surf_window_impression`
- `surf_window_click`
- `why_this_call_opened`
- `app_deeplink_clicked`
- `forecast_accuracy_table_viewed`
- `save_alert_clicked`
- `seo_intent_page_window_clicked`

Also measure GSC CTR, GSC average position, GSC impressions, multi-page rate,
app CTA clicks, app deep-link conversion, bounce rate, and route performance
before/after.
</analytics>

<qa>
## QA Matrix

- Mobile 360px, 390px, 412px, tablet, and desktop.
- No forecast data.
- 7-day only.
- 14-day available.
- No buoy, no tide, no cam, no user reports.
- Model only.
- Low confidence.
- App not installed.
- App-link fallback.
- Canonical tags intact.
- Schema still valid.
- Slow route regression check.
</qa>

---

*Phase: 20-App Links Analytics And QA*
*Context gathered: 2026-06-01*
