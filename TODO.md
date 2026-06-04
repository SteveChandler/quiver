# TODO

## Analytics And Funnel Follow-Ups

- [ ] Add explicit first-touch signup channel capture.
  - Capture `signup_channel` as a stable enum such as `web_app`, `ios_app`, `android_app`, `app_store_native`, or `unknown`.
  - Also capture first-touch platform, app build/version when native, landing path, referrer, UTM fields, and attribution source such as web auth, native auth, Smart App Banner, App Store CTA, or later device registration.
  - Use this to answer whether new signups are coming mostly from App Store/native app or web without inferring from device rows after the fact.

- [ ] Canonicalize signup CTA page and source metadata.
  - Every `signup_cta_view` and `signup_cta_click` should carry canonical `page`, `pathname`, `surface`, raw `source`, normalized `source_group`, `cta_type`, and `cta_copy_variant`.
  - Fix cases where CTA clicks must be joined to the nearest `page_view` to infer the page.
  - Audit known mismatches: `beach-alert-cta` reporting `surface='beach-detail'` near landing-page views, and `state-hub-ca` clicks reporting `surface='other'`.

- [ ] Clean PostHog web navigation instrumentation.
  - Decide whether Quiver should use custom `page_view`, PostHog `$pageview`, or both; avoid double-counting.
  - Remove or explain `(unknown)` paths before building a sticky-parts dashboard.
  - Ensure core web events consistently include `pathname`, `page`, `$session_id`, visitor type, and product surface.

- [ ] Build a sticky-parts readout for web behavior.
  - Segment anonymous vs identified users.
  - Report repeat usage and downstream behavior for home, map, beach detail, water-temp, tide, forecast, cam, and SEO funnel pages.
  - Treat one-person power-user loops separately from broad anonymous traffic.
  - Lead with product loops: home -> map -> beach detail -> forecast details -> nearby spots.

- [ ] Improve cam funnel attribution.
  - Track `/cams` and `/surf-cams/...` as separate acquisition/product families.
  - Attribute cam-page CTA views, clicks, auth opens, signups, beach views, map interactions, and forecast interactions with a stable `source_group`.
  - Add reliable next-path attribution so cam sessions can be evaluated without fragile session/path joins.
  - Use the current read as baseline: cam pages show engagement into beach/forecast/map behavior, but traffic is too low to call acquisition proven.

## Forecast Trust Follow-Ups

- [ ] Draft a forecast-literacy guide.
  - Working angle: how to read a surf forecast without outsourcing the call.
  - Cover swell height, period, direction, tide height, tide direction, wind, spot sensitivity, and red flags like heavy/closed-out low-tide beach breaks.
  - Do not write the article until the product trust language and setup-risk regression have shipped.

## Web Custom Spots Follow-Ups

- [ ] Decide and implement web custom spot parity.
  - Current state: `custom_spots`, `sessions.custom_spot_id`, and custom spot favorites exist, but web favorites, Home Break, and alerts still operate on curated `beaches`.
  - Product decision: keep custom spots as saved/loggable-only locations, or introduce a typed Home target so custom spots can drive Home and notification logic.
  - If saved/loggable-only: update web favorites/profile surfaces to show custom spots while keeping Home Break and alerts curated-only.
  - If custom-as-Home: add a typed Home target model, then update web, native, alerts, forecasts, onboarding, and analytics together.
  - Validation: custom spot favorite rows appear on web saved/profile surfaces; curated beach favorites and alert behavior do not regress.

- [ ] Design custom spot as Home target model.
  - Current state: `profiles.home_beach_id` is curated-only and FK'd to `beaches(id)`.
  - Goal: allow a user's Home target to be either a curated beach or a saved custom spot.
  - Requires a typed Home target model, then coordinated updates across web, native, onboarding, profile/settings, Home, alerts, forecasts, analytics, and deep links.
  - Do not overload `profiles.home_beach_id` with custom spot IDs.
  - V1 fallback: saved custom spots appear in Best surf calls using closest curated beach scoring, but cannot be set as Home.

## E2E Bug Follow-Ups

- [ ] Fix `/beach/[slug]` not-found and legacy deeplink handling.
  - Failing coverage: `e2e/push-deeplink-routing.spec.ts` forecast-alert deeplinks and invalid slug handling.
  - Notes: `/beach/nonexistent-beach-xyz` and some push deeplink slugs render the generic beach error state instead of a 404/not-found UX. Check the catch path in `app/beach/[slug]/page.tsx` and rethrow current Next.js `notFound()` digests.

- [ ] Fix Hawaii island-specific city filtering for Waimea.
  - Failing coverage: `e2e/location-pages.spec.ts` for `/hi/waimea-kauai`.
  - Notes: the Kauai page leaked `Hapuna Beach (Kohala)` from Big Island/Kohala. Apply the island-specific filter consistently to every beach list/table/card data source on that page.
