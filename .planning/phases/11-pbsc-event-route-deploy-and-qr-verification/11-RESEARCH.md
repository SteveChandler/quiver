# Phase 11: PBSC Event Route Deploy And QR Verification - Research

**Researched:** 2026-05-26
**Status:** Complete

## Research Question

What does the planner need to know to make the printed PBSC QR destination
work at `https://www.quiversurf.app/pbsc`, route scanners to the right primary
conversion path, and prove the live public URL before event materials are used?

## Current Live Route Truth

- `curl -I -L --max-time 20 https://www.quiversurf.app/pbsc` returned
  `HTTP/2 404` on 2026-05-26, with `x-matched-path: /[intent]` and
  `x-vercel-cache: MISS`.
- `curl -I -L --max-time 20 https://dev.quiversurf.app/pbsc` returned
  `HTTP/2 200` on 2026-05-26, with `x-matched-path: /pbsc`,
  `x-nextjs-prerender: 1`, and `x-vercel-cache: HIT`.
- This means the route exists on the dev deployment but is not live at the
  printed canonical QR destination. Phase completion must require production
  `www` proof after approved deploy or alias promotion.

## Route And Component Findings

### Current PBSC Route

- `app/pbsc/page.tsx` is currently a server component with static CTAs.
- It imports `IOS_APP_STORE_URL` directly and renders:
  - primary App Store link text: `Open Quiver on iPhone`
  - secondary web fallback link text: `Use Quiver on web`
  - bottom App Store link text: `Open Quiver`
- `const WEB_APP_URL = "/map"` is the web fallback that conflicts with
  context decision D-04.
- The route is currently prerendered on dev. Any use of request headers will
  make the page dynamic, which is acceptable for a one-off QR event route if it
  prevents wrong first-paint CTA behavior.

### Existing iOS CTA Primitive

- `components/app-store/ios-app-store-cta.tsx` is a client component that links
  to `IOS_APP_STORE_URL` and tracks both impression and click through
  `trackIosAppCtaView` / `trackIosAppCtaClick`.
- The component accepts `source`, `surface`, and `placement` metadata. PBSC can
  reuse it with event-specific values such as:
  - `source="pbsc-event"`
  - `surface="pbsc-page"`
  - `placement="hero_primary"` or `placement="bottom_primary"`
- Reusing this component satisfies D-08 without inventing new analytics code.

### Existing Android Waitlist Primitive

- `components/pricing/android-waitlist-cta.tsx` is a client component that:
  - tracks CTA view and click
  - stores an anonymous pending intent under `ANDROID_WAITLIST_STORAGE_KEY`
  - opens `UnifiedAuthModal`
  - passes `returnTo={pathname || "/plans"}`
  - after auth, confirms the stored intent through `joinAndroidWaitlist`
- `actions/android-waitlist-actions.ts` validates `source`, `surface`, and
  `placement`, writes profile waitlist fields, inserts a `profile_update`
  event, and revalidates `/features`, `/plans`, `/pricing`, and `/profile`.
- The existing action does not revalidate `/pbsc`. That is not required for the
  button state in the client component, but the planner should decide whether
  to add `/pbsc` to the revalidation list while touching the action.
- Existing Android waitlist tests mock `usePathname` as `/features`. Phase 11
  should add explicit `/pbsc` return-path coverage so anonymous scanner intent
  returns to the event route.

### Existing User-Agent Parser

- `lib/utils/user-agent-parser.ts` returns `{ device_type, os, browser }`.
- Current tests cover Windows desktop, iPhone Safari, Android Chrome, iPad
  Safari, macOS, Linux, Edge, Samsung Internet, empty UA, and unknown UA.
- OS values relevant to this phase are:
  - iPhone / iPad / iPod -> `iOS`
  - Android -> `Android`
  - Windows / macOS / Linux / unknown -> non-iOS
- The parser already supports the required iOS-vs-everyone-else split.

## Recommended Implementation Strategy

Use a server user-agent split in `app/pbsc/page.tsx` for first-paint accuracy:

1. Import `headers` from `next/headers` and `parseUserAgent` from
   `lib/utils/user-agent-parser`.
2. Make `PbscPage` async.
3. Read the request user agent with:
   `const userAgent = (await headers()).get("user-agent") ?? "";`
4. Compute `isIosVisitor = parseUserAgent(userAgent).os === "iOS"`.
5. Render a small PBSC CTA component tree where:
   - iOS gets tracked `IosAppStoreCta` as the primary action.
   - every non-iOS visitor gets `AndroidWaitlistCta` as the primary action.
   - the web fallback link is removed.
6. Keep CTA copy specific to the available action. Avoid promising immediate
   Tourmaline/web access on non-iOS when the action is only waitlist signup.

Why this is preferable:

- It avoids a hydration flash where Android, desktop, or tablet scanners see
  the iOS App Store CTA before client-side detection settles.
- It uses the existing parser and existing CTA primitives.
- The dynamic rendering cost is small for this event route and is outweighed by
  QR scan correctness.

Planner alternative:

- A client wrapper can still work only if it renders a neutral loading state or
  no primary CTA until device detection completes. It must not render the wrong
  primary CTA first. This path needs stronger browser checks and is less direct
  than the server split.

## Copy And Campaign Alignment

- Brand-Vault source copy says the canonical QR destination is
  `https://www.quiversurf.app/pbsc`.
- Current campaign lines include `Tag your best days. Keep them on repeat.` and
  event framing around the PBSC Summer Longboard Classic at Tourmaline.
- After removing web fallback, route copy should not say or imply:
  - everyone can open Tourmaline live on the web
  - Android users can install immediately
  - desktop users can use the full product from the QR route
- Safer route copy:
  - iOS: open Quiver on the App Store.
  - non-iOS: join Android updates / get Android access updates.
  - general: try the forecast, log sessions, help shape Quiver.
- Printed flyer copy that says `Open Tourmaline on Quiver` or
  `Scan Tourmaline live` should be reviewed before print. If the route only
  offers App Store or waitlist conversion, those lines need tightening before
  any approved print run.

## Testing Research

### Unit And Component Tests

Recommended focused tests:

- Add a PBSC audience helper test, or extend existing user-agent parser tests,
  proving:
  - iPhone UA -> iOS/App Store primary
  - iPad UA -> iOS/App Store primary
  - Android phone UA -> Android waitlist primary
  - Windows desktop UA -> Android waitlist primary
  - empty or unknown UA -> Android waitlist primary
- Add PBSC CTA render tests if a new component is extracted:
  - iOS render includes a link to `IOS_APP_STORE_URL`.
  - non-iOS render includes a button with `data-testid="android-waitlist-cta"`.
  - neither path renders `Use Quiver on web`.
  - iOS CTA passes PBSC-specific source/surface/placement metadata.
  - Android CTA passes PBSC-specific source/surface/placement metadata.
- Extend `__tests__/components/pricing/android-waitlist-cta.test.tsx` or add a
  focused PBSC test proving the auth modal gets `data-return-to="/pbsc"` when
  `usePathname()` returns `/pbsc`.

### E2E Tests

Review and follow:

- `e2e/ARCHITECTURE.md`
- `e2e/README.md`
- `e2e/guest-smoke.spec.ts`
- `e2e/utils/error-detection.ts`
- `e2e/utils/strict-helpers.ts`

Recommended guest E2E coverage:

- Add or extend a guest PBSC spec using `setupErrorDetection` in `beforeEach`
  and `assertNoErrors` in `afterEach`.
- Navigate to `/pbsc` with an iPhone user agent and assert:
  - response is 200
  - App Store CTA is visible
  - link `href` is `IOS_APP_STORE_URL`
  - Android waitlist primary is not visible
  - web fallback text is absent
- Navigate to `/pbsc` with an Android user agent and assert:
  - response is 200
  - Android waitlist CTA is visible
  - web fallback text is absent
  - App Store primary is not visible
- Navigate with desktop/default user agent and assert:
  - Android waitlist CTA is primary
  - web fallback text is absent

Run `npx playwright test --list <pbsc spec>` before expensive browser runs.
If localhost conflicts with another Next server, run with
`BASE_URL=https://dev.quiversurf.app` only after the dev deployment includes the
Phase 11 changes.

## Deployment And Verification Research

- `vercel.json` has an ignored-build command that triggers deployments when the
  final commit touches `app/`, `components/`, `hooks/`, `lib/`, `types/`,
  `actions/`, `public/`, config files, or package lock/config files.
- A docs-only final commit can be skipped by Vercel. The implementation commit
  should include code changes in `app/`, `components/`, `lib/`, or tests so the
  deploy is not canceled by the ignored-build step.
- `.vercelignore` ignores `__tests__/`, `e2e/`, docs, scripts, and migrations,
  but does not ignore `app/`, `components/`, `lib/`, or `public/`.
- Production-impacting work remains approval-gated:
  - deploy
  - alias promotion
  - printing
  - outbound email/social sends
  - tracker writes

Required live proof after approved deploy or promotion:

- `curl -I -L https://www.quiversurf.app/pbsc` returns HTTP 200.
- Header evidence shows the live path resolves to `/pbsc`, not `/[intent]`.
- Desktop browser proof shows the non-iOS waitlist path and no web fallback.
- Mobile iOS proof shows App Store primary.
- Mobile Android proof shows Android waitlist primary.
- QR scan proof uses the printed/campaign QR asset or a decoded asset target
  pointing to `https://www.quiversurf.app/pbsc`.

## Security And ASVS Notes

- No new secrets are needed.
- No database migration is needed for the route split.
- The Android waitlist path uses an existing authenticated server action with
  Zod validation and profile ownership via `withAuthenticatedAction`.
- Anonymous users only store a client-side pending waitlist intent before auth.
- The plan should include a `<threat_model>` block because GSD security
  enforcement defaults to enabled when no `.planning/config.json` disables it.
- Main threats to include:
  - malformed metadata in waitlist intent, already bounded by Zod
  - tracking failures blocking navigation, already guarded in CTA tracking
  - auth return path sending users away from `/pbsc`
  - live alias mismatch leaving printed QR at 404

## Validation Architecture

Framework: Jest 29 for unit/component tests, Playwright for guest E2E.

Config files:

- `jest.config.js`
- `playwright.config.ts`

Quick automated commands:

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/utils/user-agent-parser.test.ts __tests__/components/pricing/android-waitlist-cta.test.tsx`
- `source ~/.nvm/nvm.sh && nvm use 22 && npx playwright test --list e2e/<pbsc-spec>.spec.ts`

Full phase verification commands:

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck`
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 app/pbsc/page.tsx components/<pbsc-cta-file>.tsx __tests__/<pbsc-tests>.test.tsx e2e/<pbsc-spec>.spec.ts`
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand <targeted unit tests>`
- `source ~/.nvm/nvm.sh && nvm use 22 && npx playwright test e2e/<pbsc-spec>.spec.ts --project=guest`
- `curl -I -L --max-time 20 https://www.quiversurf.app/pbsc`

Manual-only verifications:

- Production QR scan on iOS Safari after approved deploy.
- Production QR scan on Android Chrome after approved deploy.
- Approval confirmation before print, send, post, deploy, or alias promotion.

## Planning Implications

The phase should likely become one implementation plan with approval-gated
release verification:

1. Build the PBSC OS split using server UA classification and existing CTA
   primitives.
2. Remove web fallback and tighten route copy.
3. Add unit/component tests for OS split, tracked App Store CTA metadata, and
   `/pbsc` Android waitlist return path.
4. Add guest E2E for iOS, Android, and desktop scanner behavior.
5. Run local validation.
6. After explicit approval, deploy or promote so `www.quiversurf.app/pbsc`
   returns 200.
7. Verify the live QR destination on desktop and mobile.

## RESEARCH COMPLETE
