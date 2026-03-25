# Month 1, Week 1: Auth Funnel Restoration — Technical Spec

**Period**: Mar 18-22, 2026
**Goal**: Restore signup flow to 1-2% CTA click rate; get to 3-5 signups/week
**Owner**: Engineering Lead + Product
**Status**: Ready to execute

---

## Overview

Week 1 focuses on fixing the four critical conversion killers in the signup funnel:

1. **Best-converting CTA deleted** → Restore `surf-call-conditions` PublicContentGate
2. **cam-hero fires 27x per session** → Fix IntersectionObserver double-firing
3. **Email confirmation loses context** → Preserve return path via `?returnTo=`
4. **Apple auth broken** → Generate client secret and configure Supabase

These are all implementation fixes—no new features. Total scope: 4 PRs, 3-5 days of engineering.

---

## Task 1: Restore `surf-call-conditions` PublicContentGate

### Problem
The best-converting CTA (2.4% click rate) was deleted Mar 11. Current CTAs achieve only 0.2% click rate. Restoring this single CTA could 10x signup flow.

### Solution
Restore the gate that surfaces "See today's surf call for [Beach Name]" and gates the conditions detail behind signup.

### Files to Modify

#### 1. `components/beach-detail/spot-surf-report.tsx`

**Current behavior**: Shows verdict badge, but no gate on conditions detail.

**Changes**:
```tsx
// Add import
import { PublicContentGate } from '@/components/ui/public-content-gate';

// Around line ~400 (where conditions detail renders):
<div className="mt-4 space-y-3">
  <PublicContentGate
    feature="surf-call-conditions"
    headline="See today's surf call"
    description={`Know what you're surfing before you paddle out at ${beach.name}`}
  >
    <ConditionsDetail
      forecast={bestWindow}
      conditions={...}
    />
  </PublicContentGate>
</div>
```

#### 2. Analytics Instrumentation

**File**: `lib/analytics/signup-conversion-tracking.ts`

**Changes**: Add event tracking for gate impression + click

```ts
export function trackSurfCallConditionsGateView(beachName: string) {
  trackSignupCtaView({
    source: 'surf-call-conditions',
    beachName,
    placement: 'spot-detail-conditions',
  });
}

export function trackSurfCallConditionsGateClick(beachName: string) {
  // Fires when user clicks gate CTA
  ga('event', 'signup_cta_click', {
    source: 'surf-call-conditions',
    beachName,
  });
  // Also fire to internal DB
  logEvent('signup_cta_click', {
    source: 'surf-call-conditions',
    beach_name: beachName,
    placement: 'spot-detail-conditions',
  });
}
```

**Wire in component**:
```tsx
useEffect(() => {
  if (showGate) {
    trackSurfCallConditionsGateView(beach.name);
  }
}, [showGate, beach.name]);
```

#### 3. Test Coverage

**File**: `e2e/signup-cta-performance.spec.ts` (new test)

```ts
test('surf-call-conditions gate displays and converts', async ({ page, context }) => {
  // Load beach page as anonymous
  await page.goto('/ca/san-diego/blacks');

  // Verify gate is visible when scrolling to conditions
  const gate = page.locator('[data-testid="public-content-gate-surf-call-conditions"]');
  await gate.scrollIntoViewIfNeeded();
  expect(gate).toBeVisible();

  // Verify analytics event fired
  const gaEvents = await page.evaluate(() =>
    (window as any).gtag?.getDataLayer?.() || []
  );
  expect(gaEvents).toContainEqual(
    expect.objectContaining({
      event: 'signup_cta_view',
      source: 'surf-call-conditions',
    })
  );

  // Click gate CTA
  await gate.locator('button').click();

  // Verify signup modal opens
  expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();
});
```

### Success Criteria
- ✓ Gate renders on beach detail conditions section
- ✓ Gate impression logged (GA4 + internal DB)
- ✓ Gate click logged
- ✓ Auth modal opens on click
- ✓ E2E test passes

### Effort
**Frontend**: 2-3 hours (import, wire event tracking, test)
**QA**: 1 hour (verify gate + analytics)
**Total**: ~4 hours

---

## Task 2: Fix cam-hero Double-Firing Bug

### Problem
`cam-hero` (beach detail live cam feed) fires `signup_cta_view` event ~27x per session due to IntersectionObserver remounting on every render cycle. This inflates metrics and makes CTA performance data useless.

### Solution
Implement module-level deduplication Set that tracks `(source, pageLoadId)` pairs, ensuring each CTA fires at most once per page session.

### Files to Modify

#### 1. `lib/analytics/signup-conversion-tracking.ts`

**Current code**:
```ts
export function trackSignupCtaView(params: SignupCtaViewParams) {
  ga('event', 'signup_cta_view', {
    source: params.source,
    // ... other params
  });
}
```

**Updated code**:
```ts
// Module-level Set to track deduped CTAs per page session
const FIRED_CTAS = new Set<string>();

// Generate or retrieve page session ID (persisted in sessionStorage)
function getPageLoadId(): string {
  if (typeof window === 'undefined') return '';

  let id = sessionStorage.getItem('_page_load_id');
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('_page_load_id', id);
  }
  return id;
}

export function trackSignupCtaView(params: SignupCtaViewParams) {
  const dedupeKey = `${params.source}`;

  // Only fire once per source per page session
  if (FIRED_CTAS.has(dedupeKey)) {
    return;
  }
  FIRED_CTAS.add(dedupeKey);

  ga('event', 'signup_cta_view', {
    source: params.source,
    beach_name: params.beachName,
    placement: params.placement,
    page_load_id: getPageLoadId(),
    // ... other params
  });

  // Also log to internal DB
  logEvent('signup_cta_view', {
    source: params.source,
    beach_name: params.beachName,
    placement: params.placement,
    page_load_id: getPageLoadId(),
  });
}
```

#### 2. Test Coverage

**File**: `__tests__/lib/analytics/signup-conversion-tracking.test.ts`

```ts
describe('trackSignupCtaView deduplication', () => {
  beforeEach(() => {
    // Clear sessionStorage and module Set before each test
    sessionStorage.clear();
    jest.resetModules();
  });

  test('fires once per source per page load', async () => {
    const { trackSignupCtaView } = await import(
      '@/lib/analytics/signup-conversion-tracking'
    );

    const mockGa = jest.fn();
    global.ga = mockGa;

    // First call should fire
    trackSignupCtaView({
      source: 'cam-hero',
      beachName: 'Blacks',
      placement: 'beach-detail',
    });
    expect(mockGa).toHaveBeenCalledTimes(1);

    // Second call with same source should NOT fire
    trackSignupCtaView({
      source: 'cam-hero',
      beachName: 'Blacks',
      placement: 'beach-detail',
    });
    expect(mockGa).toHaveBeenCalledTimes(1); // Still 1, not 2

    // Different source should fire
    trackSignupCtaView({
      source: 'beach-detail-blacks',
      beachName: 'Blacks',
      placement: 'forecast-tab',
    });
    expect(mockGa).toHaveBeenCalledTimes(2);
  });

  test('resets dedup Set on new page load (new sessionStorage ID)', () => {
    // Simulate navigation to new page
    sessionStorage.clear();
    // Next call should fire again
  });
});
```

#### 3. Verification

**Manual QA**:
1. Load beach detail page
2. Open DevTools console
3. Run: `fetch('/api/events').post({event_type: 'signup_cta_view', source: 'cam-hero'}).then(...)` to verify
4. Scroll up/down to trigger IntersectionObserver multiple times
5. Verify event fires only once in GA4 + internal DB

### Success Criteria
- ✓ cam-hero fires exactly 1x per page session (verified in analytics)
- ✓ Other CTAs still fire normally
- ✓ Unit tests pass (dedup Set logic)
- ✓ E2E test confirms single event in GA4

### Effort
**Frontend**: 2 hours (module Set, sessionStorage logic, tests)
**QA**: 1 hour (manual verification)
**Total**: ~3 hours

---

## Task 3: Fix Email Confirmation Redirect

### Problem
Email confirmation redirect is hardcoded to `/?signup=confirm-email`, losing context. Users sign up from `/ca/san-diego/blacks`, but after email verification, they're sent to `/` instead of the beach page.

### Solution
Capture `returnTo` in signup flow; store in localStorage; use on email confirmation redirect.

### Files to Modify

#### 1. `lib/analytics/signup-conversion-tracking.ts` or `middleware.ts`

**Capture returnTo on signup click**:
```ts
export function trackSignupCtaClick(params: SignupCtaClickParams) {
  // Capture current path as returnTo
  const returnTo = typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : '/';

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('signup_returnTo', returnTo);
  }

  ga('event', 'signup_cta_click', {
    ...params,
    return_to: returnTo,
  });
}
```

#### 2. `components/auth/unified-auth-modal.tsx`

**On signup success**, retrieve returnTo:
```ts
async function handleSignupSuccess() {
  const returnTo = sessionStorage.getItem('signup_returnTo') || '/';

  // Redirect to beach page (or whatever page they came from)
  window.location.href = `${returnTo}?signup=confirm-email`;
}
```

#### 3. `app/api/auth/callback/route.ts` (if using server-side redirect)

```ts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') || '/';

  // Verify email confirmation...

  // Redirect back to original page
  return NextResponse.redirect(new URL(returnTo, request.url));
}
```

#### 4. Test Coverage

**File**: `e2e/auth-redirect.spec.ts` (new test)

```ts
test('email confirmation redirect preserves beach context', async ({ page }) => {
  // Start on beach page
  await page.goto('/ca/san-diego/blacks');

  // Click signup CTA
  await page.locator('button:has-text("Sign up")').click();

  // Fill signup form (email + password)
  await page.fill('[name="email"]', 'newuser@test.com');
  await page.fill('[name="password"]', 'TestPassword123');
  await page.locator('button:has-text("Create account")').click();

  // Simulate email confirmation (backend would send link)
  // In test, we can directly set auth session
  await page.context().addCookies([{
    name: 'sb-auth',
    value: 'valid-token',
    domain: 'localhost',
    path: '/',
  }]);

  // Reload to trigger auth state update
  await page.reload();

  // Verify user is redirected back to beach page (not /)
  expect(page.url()).toContain('/ca/san-diego/blacks');
});
```

### Success Criteria
- ✓ returnTo captured on signup click
- ✓ Email confirmation redirect uses returnTo
- ✓ User returns to beach page (or original page) after email confirmation
- ✓ E2E test passes

### Effort
**Frontend**: 2-3 hours (capture logic, redirect logic, test)
**QA**: 1 hour
**Total**: ~3-4 hours

---

## Task 4: Unblock Apple Sign-In

### Problem
Apple Sign-In button renders but fails silently because client secret JWT is not configured in Supabase. Users see broken UX.

### Solution
Generate Apple client secret via `scripts/generate-apple-secret.mjs` and configure Supabase OAuth provider.

### Files to Modify

#### 1. Generate Secret Script

**File**: `scripts/generate-apple-secret.mjs` (if doesn't exist, create)

```js
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Generate Apple Sign In client secret JWT
 *
 * Prerequisites:
 * - Apple Developer Team ID (from developer.apple.com/account)
 * - Service ID (from Apple Identifiers)
 * - Key ID (from Apple Keys)
 * - Private key file (from Apple Keys download)
 *
 * Usage:
 * APPLE_TEAM_ID=abc123 \
 * APPLE_SERVICE_ID=com.quiversurf.web \
 * APPLE_KEY_ID=xyz789 \
 * APPLE_PRIVATE_KEY_PATH=./apple_key.p8 \
 * node scripts/generate-apple-secret.mjs
 */

const TEAM_ID = process.env.APPLE_TEAM_ID;
const SERVICE_ID = process.env.APPLE_SERVICE_ID;
const KEY_ID = process.env.APPLE_KEY_ID;
const PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH;

if (!TEAM_ID || !SERVICE_ID || !KEY_ID || !PRIVATE_KEY_PATH) {
  console.error('Missing required environment variables');
  console.error('APPLE_TEAM_ID, APPLE_SERVICE_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY_PATH');
  process.exit(1);
}

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');

// Create JWT header
const header = {
  alg: 'ES256',
  kid: KEY_ID,
  typ: 'JWT',
};

// Create JWT payload
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: TEAM_ID,
  sub: SERVICE_ID,
  aud: 'https://appleid.apple.com',
  iat: now,
  exp: now + 15777000, // 6 months
};

// Encode header and payload
const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
const messageToSign = `${headerEncoded}.${payloadEncoded}`;

// Sign with private key
const signer = crypto.createSign('SHA256');
signer.update(messageToSign);
const signature = signer.sign(privateKey, 'base64url');

// Construct JWT
const jwt = `${messageToSign}.${signature}`;

console.log('Apple Client Secret JWT:');
console.log(jwt);
console.log('\n✓ Copy this value to Supabase OAuth settings for Apple');
```

#### 2. Configure Supabase

**In Supabase Dashboard**:
1. Go to `Authentication → Providers → Apple`
2. Enable Apple
3. Paste generated JWT into "Client Secret" field
4. Verify Enabled Service ID matches `APPLE_SERVICE_ID` env var
5. Save

#### 3. Environment Variables

**File**: `.env.local` (or CI secrets)

```
APPLE_TEAM_ID=abc123xyz
APPLE_SERVICE_ID=com.quiversurf.web
APPLE_KEY_ID=xyz789abc
APPLE_PRIVATE_KEY_PATH=./apple_key.p8
NEXT_PUBLIC_APPLE_CLIENT_ID=com.quiversurf.web
```

#### 4. Update Component

**File**: `components/auth/unified-auth-modal.tsx`

**Hide Apple button if not configured**:
```ts
const hasAppleConfig = Boolean(process.env.NEXT_PUBLIC_APPLE_CLIENT_ID);

// In render:
{hasAppleConfig && (
  <button onClick={handleAppleSignIn}>
    Continue with Apple
  </button>
)}
```

#### 5. Test Coverage

**File**: `e2e/apple-auth.spec.ts`

```ts
test('Apple Sign-In flow works end-to-end', async ({ page, context }) => {
  // Navigate to beach page (anonymous)
  await page.goto('/ca/san-diego/blacks');

  // Click signup CTA to open auth modal
  await page.locator('button:has-text("Sign up")').click();

  // Verify Apple button is visible
  const appleButton = page.locator('button:has-text("Apple")');
  expect(appleButton).toBeVisible();

  // Click Apple button
  await appleButton.click();

  // Supabase will redirect to Apple OAuth (we can mock this in test environment)
  // For now, just verify modal is handling the click without errors

  // Check browser console for errors
  const errors = await page.evaluate(() => {
    const logs = (window as any).__LOG_ERRORS__ || [];
    return logs.filter((e: any) => e.type === 'error');
  });
  expect(errors).toHaveLength(0);
});
```

### Success Criteria
- ✓ Apple client secret generated and stored securely
- ✓ Supabase OAuth configured
- ✓ Apple button hidden if secret not configured
- ✓ E2E test verifies flow works (or redirects correctly to Apple)

### Effort
**Setup**: 1-2 hours (Apple Dev account setup, key generation, Supabase config)
**Frontend**: 1 hour (env var logic, test)
**Total**: ~2-3 hours

---

## Auth Instrumentation

In parallel with above fixes, instrument the auth funnel for better metrics.

### Files to Modify

#### 1. `lib/analytics/auth-events.ts`

**Update to fire to internal DB**:
```ts
export async function trackAuthModalOpened(source: string) {
  // GA4
  ga('event', 'auth_modal_opened', {
    source,
    timestamp: new Date().toISOString(),
  });

  // Internal DB
  await logEvent('auth_modal_opened', {
    source,
  });
}

export async function trackAuthProviderSelected(provider: 'google' | 'apple' | 'email') {
  ga('event', 'auth_provider_selected', { provider });
  await logEvent('auth_provider_selected', { provider });
}

export async function trackSignupFormSubmitted() {
  ga('event', 'signup_started');
  await logEvent('signup_started');
}

export async function trackSignupError(error: string) {
  ga('event', 'signup_error', { error });
  await logEvent('signup_error', { error_code: error });
}

export async function trackSignupSuccess(userId: string) {
  ga('event', 'signup_success', { user_id: userId });
  await logEvent('signup_success', { user_id: userId });
}
```

#### 2. Wire in Auth Modal

**File**: `components/auth/unified-auth-modal.tsx`

```ts
useEffect(() => {
  if (isOpen) {
    trackAuthModalOpened('beach-detail'); // or source prop
  }
}, [isOpen]);

async function handleGoogleClick() {
  trackAuthProviderSelected('google');
  // ... rest of logic
}

async function handleAppleClick() {
  trackAuthProviderSelected('apple');
  // ... rest of logic
}

async function handleEmailSubmit() {
  trackSignupFormSubmitted();
  try {
    // ... submit logic
    trackSignupSuccess(userId);
  } catch (error) {
    trackSignupError(error.code);
  }
}
```

### Success Criteria
- ✓ All auth events fire to GA4 + internal `user_events` DB
- ✓ Dashboard can measure auth funnel (modal opens → provider selected → signup success)
- ✓ Errors are tracked

---

## Deployment & Verification

### Pre-Deployment Checklist
- [ ] All 4 PRs reviewed and approved
- [ ] E2E tests passing locally
- [ ] Analytics instrumentation verified in dev environment
- [ ] Product lead approves copy/UX changes

### Deployment Steps
1. **Monday morning**: Merge all 4 PRs to `main`
2. **Monday 2pm**: Deploy to production via Vercel CI/CD
3. **Monday 3pm-5pm**: Monitor analytics dashboard for:
   - ✓ cam-hero firing exactly 1x per session (was 27x)
   - ✓ surf-call-conditions gate visible in metrics
   - ✓ auth_modal_opened events appearing in Supabase
   - ✓ signup_cta_view deduplication working

### Rollback Plan
If any metric goes wrong:
1. Revert latest deployment
2. Fix issue
3. Re-deploy

---

## Success Criteria (End of Week 1)

| Metric | Target | Verification |
|--------|--------|--------------|
| cam-hero events | 1-2 per session | GA4 dashboard shows <3 total cam-hero events per user |
| CTA impression dedup | 1x per source | Internal DB shows 1 `signup_cta_view` per source |
| Auth modal instrumentation | All events firing | Supabase `user_events` table has `auth_modal_opened`, `auth_provider_selected`, `signup_started` events |
| Email redirect | Preserves context | QA: Sign up from `/beach` and verify redirect back to `/beach` |
| Apple auth | Unblocked | QA: Apple button renders and clicks without errors |

**Expected outcome**: Signup CTA click rate improves from 0.2% to 0.5-0.8% due to restored CTA + fixed metrics.

---

## Notes for Engineering

- **No database migrations needed** (all changes are application logic)
- **No new dependencies** (use existing GA4 + Supabase instrumentation)
- **Minimal design changes** (mostly restoring deleted gate)
- **Full test coverage required** (E2E + unit tests for all 4 changes)
- **Ship everything by Friday EOD** (Monday starts Phase 2: session logging)

---

**Owner**: Engineering Lead
**PM Lead**: Product Manager
**Next Review**: Friday (Mar 22) — metrics review + Phase 2 design spec finalization
