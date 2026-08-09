# Quiver E2E Test Plan (Playwright)

This is a fresh, step‑by‑step plan to rebuild the Playwright end‑to‑end test suite grounded in the current codebase and docs.

## Goals

- Validate core user journeys: Auth, Home → Beach Detail, Session Wizard, Profile.
- Keep tests stable and fast with deterministic waits and test IDs.
- Deliver value incrementally with a phased rollout.

## Environment & Assumptions

- Base URL: `BASE_URL` (defaults to `http://localhost:3000`).
- Dev env scripts already available in `package.json` (e.g., `test:e2e:dev`).
- Test user credentials available via `.env`: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`.
- Middleware enforces protected routes (see `middleware.ts`).
- Public test pages exist to bootstrap: `app/test/page.tsx`, `app/test/gamification/page.tsx`.

## Setup (Once)

1. Verify Playwright config

- File: `playwright.config.ts` (HTML reporter enabled).
- `use.baseURL` reads `BASE_URL`; local defaults to `http://localhost:3000`.
- `extraHTTPHeaders` adds `x-vercel-protection-bypass` automatically for non‑localhost using:
  - `VERCEL_BYPASS_TOKEN` or `VERCEL_AUTOMATION_BYPASS_SECRET` or `VERCEL_BYPASS`.

2. Global auth storage state

- File: `e2e/global-setup.ts`
- Logs in once using env creds and saves `e2e/.auth/state.json`.
- Uses `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` when `BASE_URL` contains `dev.quiversurf.app`; otherwise `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`.

3. Project split

- `guest` project: runs only `e2e/guest-*.spec.ts` (no storageState).
- `auth` project: runs all non‑guest specs with `storageState: e2e/.auth/state.json`.

4. Run local app (only for localhost)

- Config auto‑starts `npm run dev` when `BASE_URL` includes `localhost`.

5. Credentials

- Dev (`BASE_URL=https://dev.quiversurf.app`): set `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, and a Vercel bypass token env from above.
- Local (`BASE_URL=http://localhost:3000`): set `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`.

---

## Phase 1 — Foundation (Day 1–2)

Purpose: Establish runner health, public pages, auth, and route gating.

1. Utilities (scaffold)

- `e2e/utils/auth.ts`
  - `loginViaUI(page)` — fill sign‑in form and wait for redirect.
  - `logout(page)` — call `DELETE /api/auth/[...supabase]` and reload.
- `e2e/utils/selectors.ts`
  - Centralize repeated data‑testids and selectors (e.g., `forecastTab`, `setHomeBeachBtn`).
- `e2e/utils/waits.ts`
  - `waitForNetworkIdle(page)`, `waitForURLContains(page, fragment)`.

2. Guest smoke

- File: `e2e/guest-smoke.spec.ts`
- Steps:
  - Visit `/` — hero renders primary CTA (Join Free Today).

3. Test page smoke

- File: `e2e/smoke.spec.ts`
- Steps:
  - Visit `/test` — assert `data-testid="forecast-tab"` exists.

4. Guest auth and redirect

- File: `e2e/guest-auth.spec.ts`
- Steps:
  - Visit `/profile` → redirect to sign‑in with `redirectTo`.
  - Login via UI → redirected back to `/profile` → tabs visible.

5. Protected route gating

- File: `e2e/guest-protected-routing.spec.ts`
- Steps:
  - Unauthed: `/sessions/new` → redirected to sign‑in.
  - Login → redirected back → wizard shell visible (`data-testid="session-wizard-form"`).

Run:

- Dev: `BASE_URL=https://dev.quiversurf.app npx playwright test`
- Local: `BASE_URL=http://localhost:3000 npx playwright test`
- By project: `npx playwright test --project=guest` or `--project=auth`

---

## Phase 2 — Core App (Day 3–4)

Purpose: Validate Home forecast experience, Beach detail, and Profile basics.

1. Home + Forecast

- File: `e2e/home-forecast.spec.ts`
- Precondition: Logged in.
- Steps:
  - Visit `/` → `HomeScreen` loads (`components/home-screen/index.tsx`).
  - Assert `data-testid="forecast-tab"` container exists (`components/home-screen/forecast-tab.tsx`).
  - If high confidence, `data-testid="high-confidence-forecast"` visible.
  - If “View Details” is present, click and assert `/beach/:id` navigation (optional branch for skeleton states).

2. Beach detail (consolidated)

- File: `e2e/beach-detail.spec.ts`
- Precondition: From Home or direct link to a known/fallback beach.
- Steps:
  - Prefer direct navigation via `TEST_BEACH_ID` when set (Dev fallback used: `15c7337e-5258-4339-9dc3-c435c666926b`).
  - 5 Day Outlook section visible by default; tolerate chips-only state and optional charts/tables.
  - Deep-link `?section=intel` opens Intel; assert `#intel`/`#intel-section` visibility and “Local Intel” trigger.
  - Favorite toggle via accessible label flips between “Add to favorites”/“Remove from favorites”.
  - Reviews: open section, click “Write Review/Write the First Review”, dialog opens and closes.
  - Spot Overview: expand and assert key fields (Break Type, Best Swell, Best Wind / Tide).
  - Intel view-all toggles to “Show less” when posts > 3 (no navigation on this page).
  - Back header button navigates to `/map`.

3. Profile basics

- File: `e2e/profile.spec.ts`
- Precondition: Logged in.
- Steps:
  - Open `/profile` → tabs render (Journal+, Quiver, Beaches, Comments).
  - Open Edit Profile modal and change a simple field (e.g., `location`) → save → reload and assert persistence.
  - Beaches tab → “Add Beach” button opens edit and remains accessible.

---

## Phase 3 — Session Wizard & Map (Day 5–6)

Purpose: Validate session planning/logging, and map discovery.

8. Session wizard (plan/log)

- File: `e2e/session-wizard.spec.ts`
- Precondition: Logged in.
- Steps (Plan mode):
  - Visit `/sessions/new?mode=plan`.
  - Pick beach, date, time → required steps valid → submit.
  - Success overlay appears (`app/sessions/new/page.tsx`) → redirect to `/profile` after delay.
- Steps (Log mode):
  - Visit `/sessions/new?mode=log`.
  - Fill required + one optional (e.g., overall rating) → submit → redirect.

4. Map + discovery

- File: `e2e/map-discovery.spec.ts`
- Steps:
  - `/map` loads (skeleton then `data-testid="map-view"`).
  - Switch between map/list views.
  - Type a query (common beach) → results populate → select beach → quick card updates.

---

## Phase 4 — Password Reset & Gamification (Next)

Purpose: Cover flows described in docs without over‑mocking.

10. Password reset flow

- Files: `e2e/guest-password-reset-flow.spec.ts` (guest) and `e2e/password-reset-validations.spec.ts` (auth)
- Based on `README-PASSWORD-RESET.md`.
- Steps:
  - Guest: `/auth/forgot-password` submits → assert success or descriptive error (rate limit, etc.).
  - Guest: `/auth/confirm?type=recovery&token_hash=invalid` → redirects to `/error?reason=invalid_or_expired_link` with actionable link.
  - Auth: `/auth/reset` validation only (short password + mismatch) — avoids changing real password.

11. Gamification smoke

- File: `e2e/gamification-smoke.spec.ts`
- Steps:
  - Visit `/test/gamification` (`components/gamification/gamification-test-page.tsx`).
  - Click mock XP actions → expect success toasts and simple badge UI updates.
  - Keep assertions UI‑focused; defer deep DB checks to Jest/integration.

---

## Notification Testing

**Overview**: Comprehensive testing for push notifications across iOS, Android, and web platforms.

**Testing Levels**:

1. **Unit Tests**: Push notification service logic, token management, error handling
   ```bash
   npm test -- push-notifications
   ```

2. **Manual API Testing**: Send test notifications to specific users
   ```bash
   node scripts/test-push-notification.mjs <user_id>
   ```

3. **Integration Testing**:
   - **Web Push**: Browser notification permissions, Firebase SDK, service worker registration
   - **Mobile Push**: iOS/Android device builds, token registration, deep link navigation
   - **Email Fallback**: Resend delivery when push fails

4. **Database Verification**: Check `user_devices` table for token registration
   ```sql
   SELECT user_id, platform, device_token FROM user_devices;
   ```

**Key Test Scenarios**:
- Session invitation flow (multi-channel: push → email fallback → in-app)
- Push notification permissions and denial handling
- Token refresh and pruning for invalid/expired tokens
- Deep link navigation from notifications
- Foreground vs background notification handling

**Performance Targets**:
- Push delivery: <3 seconds
- Email fallback: <30 seconds
- Token registration: immediate

**Security**:
- RLS policies on `user_devices` table
- Token truncation in logs (first 20 chars only)
- No token leakage in API responses

---

## Accessibility Testing

**Goal**: Ensure WCAG 2.1 AA compliance across all features.

**Tools & Infrastructure**:

1. **@axe-core/playwright**: Automated accessibility testing in E2E tests
2. **jest-axe**: Component-level accessibility testing in unit tests
3. **eslint-plugin-jsx-a11y**: Static analysis during development
4. **Lighthouse CI**: Automated audits in CI/CD pipeline

**Running Tests**:

```bash
# E2E accessibility tests
npm run test:e2e:a11y

# Component accessibility tests (included in unit tests)
npm test

# Linting
npm run lint
```

**Key Test Areas**:

1. **Keyboard Navigation**: All interactive elements accessible via keyboard (Tab, Enter, Space, Arrow keys)
2. **Screen Readers**: ARIA labels, roles, live regions for dynamic content
3. **Color Contrast**: WCAG AA minimum contrast ratios (4.5:1 text, 3:1 UI elements)
4. **Focus Management**: Visible focus indicators, focus trapping in modals
5. **Form Accessibility**: Labels, error messages, validation feedback
6. **Motion**: `prefers-reduced-motion` support for animations

**Critical Checks** (run before each release):
- [ ] All forms have proper labels and error handling
- [ ] All images have alt text
- [ ] All interactive elements keyboard accessible
- [ ] Color contrast meets AA standards
- [ ] Focus indicators visible
- [ ] Modals trap focus and allow Esc to close
- [ ] Live regions announce dynamic content

**WCAG 2.1 AA Compliance**: Target 100% compliance for all user-facing features

---

## Utilities — Implementation Notes

- `loginViaUI(page)`
  - Go to `/auth/sign-in`, fill `[id="email"]` and `[id="password"]`, submit.
  - `await page.waitForURL('**/profile')` (or intended `redirectTo`), then `await page.waitForLoadState('networkidle')`.
- `logout(page)`
  - `await page.request.delete('/api/auth/[...supabase]'); await page.reload();`.
- Selectors (`e2e/utils/selectors.ts`)
  - `forecastTab = page.getByTestId('forecast-tab')`.
  - `highConfidence = page.getByTestId('high-confidence-forecast')`.
  - `sessionWizardForm = page.getByTestId('session-wizard-form')`.
  - `setHomeBeachBtn = page.getByTestId('set-home-beach')`.
- Waits (`e2e/utils/waits.ts`)
  - Helper wrappers for network idle and URL matching.

---

## Stability Guidelines

- Prefer `expect(locator).toBeVisible()` and `waitForLoadState('networkidle')` around navigations.
- Avoid tight coupling to realtime updates; assert final UI or user actions instead.
- Branch assertions to accept forecast‑unavailable variants when backend data lags.
- Keep project list minimal (Chromium) until coverage stabilizes.

---

## Execution

- Dev: `BASE_URL=https://dev.quiversurf.app npx playwright test`
- Local (auto webServer): `BASE_URL=http://localhost:3000 npx playwright test`
- Focused spec: `npx playwright test e2e/session-wizard.spec.ts --project=auth`
- Guest-only: `npx playwright test --project=guest`

---

## File Map (current)

- Global: `e2e/global-setup.ts`
- Guest: `e2e/guest-smoke.spec.ts`, `e2e/guest-routing.spec.ts`, `e2e/guest-protected-routing.spec.ts`, `e2e/guest-auth.spec.ts`
- Auth: `e2e/smoke.spec.ts`, `e2e/home-forecast.spec.ts`, `e2e/beach-detail.spec.ts`, `e2e/profile.spec.ts`, `e2e/map-discovery.spec.ts`, `e2e/session-wizard.spec.ts`, `e2e/auth.spec.ts`
- Utils: `e2e/utils/auth.ts`, `e2e/utils/selectors.ts`, `e2e/utils/waits.ts`

---

## References (for selectors and flows)

- `components/auth/sign-in-form.tsx`
- `components/home-screen/forecast-tab.tsx`
- `components/beach-detail.tsx`
- `components/session/wizard/AnimatedSessionWizard.tsx`
- `components/map-view.tsx`
- `app/sessions/new/page.tsx`
- `app/test/page.tsx`
- `app/test/gamification/page.tsx`
- `README-PASSWORD-RESET.md`
- `docs/GAMIFICATION_TESTING_GUIDE.md`
- `PLAYWRIGHT_TEST_FAILURES_REPORT.md`

---

## Verification (Dev)

- With `BASE_URL=https://dev.quiversurf.app` and a valid Vercel bypass token in env, plus `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`, the full suite passes:
  - 13 tests passed across guest + auth projects.

## Notes

- Landing CTA and “View Details” may be absent under certain content states; specs allow optional branches to keep runs stable while still validating core flows.
