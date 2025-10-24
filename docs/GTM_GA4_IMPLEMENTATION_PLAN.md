# GTM + GA4 + Google Ads Implementation Plan

**Date**: 2025-10-24  
**Requested by**: Growth  
**Primary owner**: Analytics/Marketing Engineering  
**Supporting teams**: Web (Next.js), Backend (Supabase), Lifecycle Marketing

---

## Objectives
- Centralize all client-side tracking through Google Tag Manager (GTM) and remove direct GA instrumentation.
- Deploy a unified analytics stack that powers GA4 reporting, Google Ads conversion tracking, enhanced conversions, and consent mode.
- Establish the `sign_up_verified` primary conversion and `session_created` / `return_7d` secondary events.
- Persist UTM attribution to the user record for downstream lifecycle tooling.
- Launch an email alerts MVP so Growth receives actionable notifications on key events.

---

## Current State & Gaps
- `app/layout.tsx` injects the GA gtag script directly, bypassing GTM.  
- Client helpers in `lib/analytics.ts` push events straight to `window.gtag`, which limits downstream destinations.
- No durable UTM capture; only short-lived params on landing pages.
- Consent handling is not wired into analytics. No GTM data layer exists yet.
- No automation that surfaces conversion events to Growth in real time.

---

## Workstream Overview
1. **GTM Container Setup** – create container, environments, and base tags.  
2. **Next.js Instrumentation** – load GTM, define a hardened data layer helper, and retrofit existing analytics calls.  
3. **Event Specification** – implement the conversion and support events required for GA4 + Google Ads.  
4. **Attribution Persistence** – capture and store UTMs through signup and into Supabase.  
5. **Enhanced Conversions & Consent Mode** – fulfill policy requirements for Ads and GDPR.  
6. **QA & Launch** – validate in GTM preview, promote to production.  
7. **Email Alerts MVP** – surface high-signal conversion activity to the Growth team.

Each subsection below calls out deliverables, owners, and dependencies.

---

## 1. GTM Container Setup
- **Create container**: `quiver-web` (Web target). Configure GA4 + Ads linking.
- **Workspace hygiene**: establish `main` workspace, `dev` environment (preview link for staging), `prod` environment (live URL).
- **Variables**:
  - URL parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`).
  - 1st-party cookies for attribution persistence (`qvr_utm_*`, `qvr_referrer`).
  - JavaScript variable for `window.__quiver` state (see Section 4).
- **Tags to create**:
  1. GA4 Configuration tag with Measurement ID (fires on All Pages, respects consent).
  2. GA4 Event tags (`sign_up_verified`, `session_created`, `return_7d`, `consent_update`).
  3. Google Ads Conversion tag for `sign_up_verified` (primary) and remarketing tag.
  4. Google Ads Conversion tag for secondary events if required by performance marketing.
  5. Custom HTML/JSON for Enhanced Conversions (pass hashed email) if Ads requires manual feed.
- **Triggers**:
  - Custom Event triggers keyed to data layer pushes (see Section 3).
  - Page View (DOM Ready) for config tag.
  - Consent Initialization trigger (fires before other tags).
- **Publishing control**: enable two-step approval (one builder, one approver). Document version names (e.g., `GA4 + Ads Launch v1`).

---

## 2. Next.js Instrumentation & Data Layer
1. **Replace GA snippet**  
   - Remove direct gtag script in `app/layout.tsx` and inject GTM instead:
     ```tsx
     <Script id="gtm-base" strategy="afterInteractive">
       {`
         window.dataLayer = window.dataLayer || [];
         function gtm(){dataLayer.push(arguments);}
         window.dataLayer.push({ event: "gtm.js", "gtm.start": Date.now() });
       `}
     </Script>
     <Script
       id="gtm-src"
       strategy="afterInteractive"
       src={`https://www.googletagmanager.com/gtm.js?id=${process.env.NEXT_PUBLIC_GTM_ID}`}
     />
     ```
   - Add the `<noscript>` iframe fallback inside `<body>` via a ClientBoundary component.
2. **Data layer helper**  
   - Update `lib/analytics.ts` to export `pushEvent(eventName, payload)` that only interacts with `window.dataLayer`.
   - Ensure helper is no-op safe on server/SSR.
   - Provide typed wrappers (e.g., `trackSignupVerified`) that call `pushEvent`.
3. **Retrofit existing analytics calls**  
   - Update `components/analytics/google-analytics.tsx` (or replace with `GTMRouteChangeHandler`) to push a `page_view` event or rely on GA4 config auto page views (preferred: keep manual `page_view` pushes for SPAs).
   - Replace `track*` calls across app/components with the new helper.
4. **Server-side events**  
   - For events emitted from API routes or Supabase edge functions, POST to GTM Server-Side (future), or enqueue to backend logging; for launch, ensure critical events still have client coverage.
5. **Environment config**  
   - Add `NEXT_PUBLIC_GTM_ID` to `.env.local`, staging, and production secrets.

---

## 3. Event & Conversion Specification

| Event | Type | Trigger point | Required parameters (data layer payload) | Destinations | Notes |
|-------|------|---------------|------------------------------------------|--------------|-------|
| `sign_up_verified` | Primary conversion | User confirms email (Supabase `auth.users` status = `confirmed`) | `user_id`, `email_hash`, `plan_tier`, `signup_method`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `timestamp` | GA4 conversion, Google Ads conversion & enhanced conversions | Fired server-to-client: emit via API when verification completes or on next authenticated page load if verification occurs off-app. |
| `session_created` | Secondary | A user schedules or logs a surf session (creation in Supabase `sessions` table) | `user_id`, `session_id`, `session_type`, `experience_level`, `location_id`, `utm_source`, `timestamp` | GA4 event, optional Ads | Use Supabase trigger or API hook to surface event to client and data layer. |
| `return_7d` | Secondary (engagement) | A verified user returns within 7 days of signup (detected on authenticated page view) | `user_id`, `days_since_signup`, `utm_source`, `platform`, `timestamp` | GA4 event (audience building) | Implement via middleware + user metadata (Section 4). Fire only once per user. |
| `consent_update` | Supporting | User updates consent banner | `ad_storage`, `analytics_storage`, `functionality_storage`, `security_storage`, `timestamp`, `region` | GTM consent, GA4, Ads | Fire immediately when banner rendered with defaults, and again on user selection. |
| `page_view` | Supporting | SPA route changes (if explicit push needed) | `page_path`, `page_title`, `utm_source` (if present) | GA4 | Keep parity with GA4 auto page views. |

**Data layer contract** (example):
```ts
pushEvent("sign_up_verified", {
  user_id: user.id,
  email_hash: sha256(user.email.toLowerCase().trim()),
  signup_method: "password" | "magic_link" | "google_oauth",
  plan_tier: profile.plan_tier ?? "free",
  utm_source: attribution.source,
  utm_medium: attribution.medium,
  utm_campaign: attribution.campaign,
  utm_content: attribution.content,
  utm_term: attribution.term,
  referrer: attribution.referrer,
  timestamp: new Date().toISOString(),
});
```

---

## 4. Attribution Capture & Persistence
1. **Landing capture**  
   - Extend `middleware.ts` to read UTM params + `document.referrer` (via `sec-fetch-site` fallback) and set 1st-party cookies (`qvr_utm_*`, 90-day expiry, Secure + SameSite=Lax).
   - Persist original landing timestamp (`qvr_first_touch_ts`) and last touch values.
2. **Client state**  
   - Hydrate a `window.__quiver.attribution` object inside `_app`/layout to expose cookie values to GTM via JS variable.
   - Provide React hook (`useAttribution`) for components (auth modal, session creator) needing the data.
3. **Signup flow**  
   - When `UnifiedAuthModal` completes signup, include UTM fields in the payload persisted to Supabase:
     - Option A: store in `profiles` table columns (`utm_source`, `utm_medium`, etc.).
     - Option B: embed inside `user_metadata.attribution`.
   - Ensure the backend uses first-touch values for reporting; maintain last-touch separately if helpful.
4. **Verification path**  
   - After email confirmation, fetch stored attribution and return it to the client so `sign_up_verified` event can include the same values.
5. **Session creation**  
   - On new session, pull attribution from user profile to enrich `session_created`.
6. **Data retention**  
   - Add nightly job to backfill missing UTM fields if they were captured post-signup.

---

## 5. Enhanced Conversions
- **Data requirements**: hashed email (mandatory), optionally phone and name if available.
- **Hashing strategy**: perform SHA-256 hashing client-side before pushing to data layer; fallback to server hashing to avoid exposing raw PII in client logs.
- **GTM implementation**:
  1. Create a Data Layer variable for `email_hash`.
  2. In Google Ads conversion tag, enable Enhanced Conversions and map the hashed email.
  3. Ensure the tag fires only when consent allows `ad_storage = granted`.
- **Testing**: use Google Tag Assistant to confirm hashed payload is received; check Ads diagnostics after launch.
- **Privacy**: document hashing flow in the privacy policy and ensure the consent banner discloses enhanced conversions.

---

## 6. Consent Mode
1. **Consent defaults**  
   - On first load, push:
     ```js
     pushEvent("consent_update", {
       ad_storage: "denied",
       analytics_storage: "denied",
       functionality_storage: "granted",
       security_storage: "granted",
       region: resolveRegionFromIP(),
       timestamp: new Date().toISOString(),
     });
     ```
   - Use GTM Consent Initialization trigger to set defaults before other tags fire.
2. **Banner integration**  
   - Integrate with existing consent UI (if none, add a lightweight banner with allow/deny options).
   - On acceptance, push updated consent values and persist decision (`qvr_consent_state` cookie).
3. **Consent-dependent logic**  
   - Ensure analytics helper checks consent before pushing events (or allow GTM to gate tags).
   - For users who decline, capture only essential functional events (no GA/Ads triggers).
4. **Region handling**  
   - Detect EEA/UK/CA visitors via IP or Cloudflare headers; default to denied if geo uncertain.
5. **Audit**  
   - Maintain consent logs in Supabase (`consent_events` table) for regulatory review.

---

## 7. QA & Launch Checklist
- Enable GTM Preview on staging, walk through:
  - Signup, email verification, session creation, returning within 7 days (use mocked signup date).
  - Consent acceptance/denial flows.
  - UTM landing scenarios (organic, paid).
- Validate GA4 DebugView shows events with correct parameters.
- Confirm Google Ads conversion tests register (using test conversion ID or preview mode).
- Run lighthouse/perf check to ensure GTM addition doesn’t regress core metrics.
- Document rollback plan (re-enable gtag snippet) in case GTM fails.

---

## 8. Email Alerts MVP
**Goal**: Notify Growth when high-value events occur without waiting for dashboards.

1. **Event logging**  
   - Create Supabase table `growth_events` with columns: `id`, `event_name`, `user_id`, `payload`, `utm_source`, `occurred_at`.
   - Backfill via API routes or Supabase triggers (each conversion inserts a row).
2. **Triggering mechanism**  
   - Supabase function or Next.js route handler (`app/api/alerts/dispatch`) runs on cron (every 15 minutes) via Vercel Scheduled Functions.
   - Query for new `growth_events` since last send; group by event type.
3. **Email transport**  
   - Reuse `lib/mailer/client.ts` (Resend). Template includes:
     - Total new sign ups (verified)
     - Sessions created
     - Returning users within 7 days
     - Highlight top UTMs (source / campaign).
   - Send to `growth@quiver.com` (configurable via env).
4. **MVP acceptance criteria**  
   - Email shows at least event counts and direct links to user profiles/admin.
   - Opt-out link (internal) or instructions for Growth to manage frequency.
5. **Future iterations**  
   - Slack webhook integration.
   - A/B testing alerts or segmentation by campaign.

---

## 9. Dependencies & Timeline
- **Analytics engineering**: GTM container, helpers, QA (3–4 days).
- **Web team**: Layout swap, data layer wiring, UTM persistence (3 days).
- **Backend**: Supabase schema updates, verification webhook (2 days).
- **Lifecycle**: Email template + distribution list (1 day).
- **QA**: Joint session with marketing to validate GTM preview (0.5 day).
- Target launch: end of next sprint (estimate 2 weeks including buffer).

---

## 10. Risks & Mitigations
- **Consent misconfiguration** → Run GTM’s consent checks and perform geo tests before launch.
- **Loss of historic GA tracking** → Overlap GA4 + GTM for a day (dual tagging) before removing gtag snippet.
- **Attribution gaps** → Add monitoring to ensure UTMs exist on new user records; alert if missing.
- **Email noise** → Start with daily digest; reevaluate cadence once event volume known.
- **Enhanced conversions compliance** → Coordinate with legal/privacy before enabling in Ads.

---

## Next Steps
1. Confirm GTM container access and GA4/Ads IDs with Growth.
2. Create non-production GTM environment and connect staging site.
3. Open implementation tickets per workstream above with owners and due dates.
4. Schedule end-to-end QA session prior to production publish.

