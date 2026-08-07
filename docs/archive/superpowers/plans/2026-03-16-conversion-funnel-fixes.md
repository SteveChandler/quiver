# Conversion Funnel Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix auth state propagation after OAuth signup (P0), guard event tracking for authed users, ungated cam hero, capture beach_id in anon events, ensure authed users never see CTAs, make match-score-teaser more prominent, and add conversion components to beach pages, cam pages, best-time-to-surf pages, and beach sub-pages.

**Architecture:** 17 tasks across 5 chunks. Chunk 1 is a critical auth bug fix. Chunks 2-4 are independent conversion improvements that can be parallelized across subagents. Chunk 5 is testing/validation blocked on all implementation tasks.

**Tech Stack:** Next.js App Router, React 19, Supabase Auth (PKCE flow), TypeScript

**Spec:** `docs/archive/superpowers/specs/2026-03-16-conversion-funnel-fixes-design.md`

---

## Chunk 1: Critical Auth Fix + Event Guards

### Task 1: Fix Auth State Propagation After OAuth Signup (P0)

**Context:** After OAuth signup (Apple/Google), the Supabase auth callback at `app/auth/callback/route.ts` exchanges the code for a session and sets cookies on the redirect response. The browser client at `context/auth-context.tsx:232-376` listens via `onAuthStateChange`. But on iOS Safari, the `SIGNED_IN` event may not fire if the browser doesn't detect the new session cookies after the cross-origin OAuth redirect. The user Erin Armstrong signed up 3 times via Apple on iOS Safari and never saw the authenticated UI.

**Files:**
- Modify: `context/auth-context.tsx` (lines 190-395)
- Modify: `app/auth/callback/route.ts`
- Modify: `lib/supabase.ts` (lines 37-70)

- [ ] **Step 1: Add force-refresh after OAuth redirect lands**

In `context/auth-context.tsx`, after the initial `getSession()` call (line 213), add a URL-based detection for post-OAuth state. When the page loads after an OAuth redirect, explicitly call `getSession()` to force cookie-based session detection, even if `onAuthStateChange` hasn't fired yet.

In `context/auth-context.tsx`, find the initialization block around line 213:
```typescript
const { data: { session }, error } = await supabase.auth.getSession();
```

Change the destructuring to use `let` so the session can be reassigned:
```typescript
let { data: { session }, error } = await supabase.auth.getSession();
```

After this block (around line 229), add:
```typescript
// Force session refresh after OAuth redirect
// iOS Safari may not fire onAuthStateChange if cookies were set
// during cross-origin redirect. Detect via URL hash or cookie presence.
if (!session && typeof window !== 'undefined') {
  // Check if we just came back from an OAuth redirect
  // Supabase PKCE flow sets auth cookies during the callback redirect
  const hasAuthCookies = document.cookie.includes('sb-');
  const justRedirected = sessionStorage.getItem('pending_signup_metadata');

  if (hasAuthCookies || justRedirected) {
    // Force a fresh session check from cookies
    const { data: { session: refreshedSession } } = await supabase.auth.getSession();
    if (refreshedSession) {
      session = refreshedSession;
    }
  }
}
```

- [ ] **Step 2: Ensure auth callback sets cookies with proper attributes for iOS Safari**

In `app/auth/callback/route.ts`, verify the cookie options passed to `setAll` include `SameSite=Lax` and `Secure=true` for production. The current implementation at lines 49-55 passes through options from Supabase SSR, which should be correct, but add explicit logging in development:

```typescript
setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value }) =>
    request.cookies.set(name, value)
  );
  cookiesToSet.forEach(({ name, value, options }) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth Callback] Setting cookie: ${name}, SameSite=${options?.sameSite}, Secure=${options?.secure}`);
    }
    response.cookies.set({ name, value, ...options });
  });
},
```

- [ ] **Step 3: Add a post-redirect session recovery mechanism**

In `app/auth/callback/route.ts`, before the final redirect (line 71), set a short-lived marker cookie that the client can detect:

```typescript
// Set a marker cookie so the client knows to force-refresh auth state
// This handles the iOS Safari case where onAuthStateChange doesn't fire
response.cookies.set('auth_callback_completed', '1', {
  maxAge: 30, // 30 seconds — just long enough for the page to load
  path: '/',
  httpOnly: false, // Client JS needs to read this
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
});
```

Then in `context/auth-context.tsx`, during initialization (after the getSession call), check for this marker:

```typescript
// Check if we just completed an OAuth callback
if (typeof window !== 'undefined') {
  const hasCallbackMarker = document.cookie.includes('auth_callback_completed');
  if (hasCallbackMarker && !session) {
    // Clear the marker
    document.cookie = 'auth_callback_completed=; max-age=0; path=/';
    // Force refresh — the session cookies should be present
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    if (freshSession) {
      updateAuthState(freshSession);
    }
  }
}
```

- [ ] **Step 4: Test the OAuth flow**

Test on iOS Safari (real device or simulator), Android Chrome, and desktop Chrome:
1. Open a beach page as anonymous user
2. Click match-score-teaser → sign up with Apple/Google
3. Verify: CTAs disappear, cam ungates, user_events record under user_id
4. Verify: `onboarding_step` events fire (onboarding appears)

Run: `npx playwright test e2e/auth --headed` (for visual verification)

- [ ] **Step 5: Commit**

```bash
git add context/auth-context.tsx app/auth/callback/route.ts
git commit -m "fix: force auth state refresh after OAuth redirect on iOS Safari

After OAuth signup, iOS Safari may not fire onAuthStateChange because
cookies set during cross-origin redirect aren't immediately visible.
Add a marker cookie in the callback route and a force-refresh check
in AuthContext initialization to ensure the session is detected."
```

---

### Task 2: Guard Event Tracking for Authed Users

**Context:** `trackAuthModalOpened()` and `trackSignupFormSubmitted()` fire regardless of auth state in `unified-auth-modal.tsx`. Server-side, the `/api/events` endpoint accepts all events from authenticated users. This polluted metrics with 80 ghost `signup_form_submitted` events from one logged-in user.

**Files:**
- Modify: `components/auth/unified-auth-modal.tsx` (lines 238-243, 449)
- Modify: `app/api/events/route.ts` (lines 325-345)

- [ ] **Step 1: Add client-side guard in unified-auth-modal.tsx**

At line 238-243, the `trackAuthModalOpened` fires in a useEffect when `isOpen` changes. The modal component imports `useAuth()` at line 133 but only destructures `{ signIn, signUp }`. First, add `user` to the destructuring: `const { signIn, signUp, user } = useAuth();`. Then add a guard:

```typescript
// Track modal open event — only for anonymous users (pre-auth funnel)
useEffect(() => {
  if (isOpen && !user) {
    trackAuthModalOpened({ mode, source });
  }
}, [isOpen, mode, source, user]);
```

At line 449, `trackSignupFormSubmitted` fires inside `handleEmailPassword()`. Add a guard:

> **Superseded by F3 (2026-04-20):** `trackSignupFormSubmitted` no longer accepts `mode` — it hardcodes `"signup"` and is paired with `trackLoginFormSubmitted` for the login path. See commit `5ae0109c`.

```typescript
if (!user) {
  trackSignupFormSubmitted({ mode: activeMode, source });
}
```

- [ ] **Step 2: Add server-side guard in events API**

In `app/api/events/route.ts`, before the authenticated event insert (line 332), add a blocklist check:

```typescript
// Pre-auth funnel events should not be recorded for authenticated users
// These events are only meaningful when tracking anon → authed conversion
const PRE_AUTH_ONLY_EVENTS = [
  'signup_cta_view',
  'signup_cta_click',
  'signup_form_submitted',
  'auth_modal_opened',
  'auth_modal_closed_without_action',
];

if (PRE_AUTH_ONLY_EVENTS.includes(eventType)) {
  // Silently skip — don't error, just don't record
  return createSuccessResponse({ ok: true, skipped: true });
}

// Insert event
const { error: insertError } = await supabase.from('user_events').insert({
```

- [ ] **Step 3: Run tests**

Run: `npx playwright test e2e/guest-smoke`
Run: `npx playwright test e2e/auth`

- [ ] **Step 4: Commit**

```bash
git add components/auth/unified-auth-modal.tsx app/api/events/route.ts
git commit -m "fix: guard pre-auth funnel events from firing for authenticated users

Add client-side guards in UnifiedAuthModal for trackAuthModalOpened and
trackSignupFormSubmitted. Add server-side blocklist in /api/events to
silently skip pre-auth-only events for authenticated users."
```

---

## Chunk 2: CTA Visibility + Cam Hero + Analytics

### Task 3: Ungated Cam Hero

**Context:** The cam hero CTA gets 523 impressions but 1 click (0.2% CTR). Ungating the cam lets everyone watch, keeping users on the page longer and increasing exposure to match-score-teaser (3.9% CTR).

**Files:**
- Modify: `components/beach-detail.tsx` (lines 478-509, 545)

- [ ] **Step 1: Remove PublicContentGate from cam hero**

Replace lines 478-505 in `components/beach-detail.tsx`. Currently the cam hero has a conditional: `publicMode ? <PublicContentGate>...</PublicContentGate> : <CamsSection />`. Change to always show the cam:

```tsx
{showCamHero ? (
  /* Live cam stream — ungated for all users */
  <Suspense
    fallback={
      <div
        className="aspect-video w-full"
        style={{ backgroundColor: "#2D357D" }}
      />
    }
  >
    <CamsSection sources={sources} variant="hero" />
  </Suspense>
) : (
  /* Photo gallery background */
  <BeachPhotoGallery beach={beach} className="w-full" />
)}
```

- [ ] **Step 2: Update the forecast overlay condition**

Line 545 currently hides `BeachHeroCompact` when `publicMode && showCamHero` to avoid mobile overlap with the gated CTA. Since the cam is no longer gated, we can simplify — always show the forecast overlay:

Change `{!(publicMode && showCamHero) && (` to just show it always (remove the condition):
```tsx
{/* Forecast overlay — bottom of hero */}
<div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-4 z-[6]">
```

Wait — verify this doesn't cause layout issues with the cam video. The overlay may need to remain hidden if the cam video takes full height. Check `CamsSection variant="hero"` dimensions. If the overlay clips over the video, keep the condition but change it to just `!showCamHero`:

```tsx
{!showCamHero && (
```

This shows the forecast overlay for photo galleries but hides it for cam pages (where the video is the hero content).

- [ ] **Step 3: Verify and test**

Run: `npx playwright test e2e/guest-smoke`
Open a beach page with a cam (e.g., Blacks Beach) as anonymous — verify cam plays without auth gate.

- [ ] **Step 4: Commit**

```bash
git add components/beach-detail.tsx
git commit -m "feat: ungated cam hero — show live cam to all visitors

Remove PublicContentGate wrapper from cam hero section. The cam becomes
a retention hook that keeps visitors on the page, increasing exposure
to match-score-teaser (3.9% CTR vs cam's 0.2% CTR)."
```

---

### Task 4: Capture beach_id in Anon beach_view Events

**Context:** All 673 anonymous `beach_view` events have `beach_id: null` because the cleanup effect in `beach-detail-client.tsx` fires on unmount when `beach?.id` may be stale in the closure.

**Files:**
- Modify: `app/beach/[slug]/beach-detail-client.tsx` (lines 56-83)

- [ ] **Step 1: Add a ref to capture beach.id**

In `beach-detail-client.tsx`, add a ref before the existing useEffect (around line 45):

```typescript
const beachIdRef = useRef<string | null>(null);
const beachNameRef = useRef<string | null>(null);

// Keep refs in sync with beach data
useEffect(() => {
  if (beach?.id) {
    beachIdRef.current = beach.id;
    beachNameRef.current = beach.name;
  }
}, [beach?.id, beach?.name]);
```

- [ ] **Step 2: Update the cleanup function to use the ref**

Change the cleanup function in the existing useEffect (lines 68-81) to use the ref:

```typescript
return () => {
  const id = beachIdRef.current;
  if (id) {
    const duration = Date.now() - startTime;
    if (duration > 3000) {
      track('beach_view', {
        beachId: id,
        metadata: {
          duration_ms: duration,
          forecast_viewed: true,
          beach_name: beachNameRef.current,
          beach_slug: slug,
        },
        debounceMs: 0,
      });
    }
  }
};
```

- [ ] **Step 3: Verify**

Open a beach page as anonymous → navigate away → check `user_events` table for the new `beach_view` event. Verify `beach_id` is not null and metadata includes `beach_name` and `beach_slug`.

Run: `npx playwright test e2e/guest-smoke`

- [ ] **Step 4: Commit**

```bash
git add app/beach/\[slug\]/beach-detail-client.tsx
git commit -m "fix: capture beach_id in anon beach_view events via ref

Use useRef to capture beach.id when it loads, so the cleanup function
always has the value on unmount. Also includes beach_name and beach_slug
in metadata for easier analytics querying."
```

---

### Task 5: Authed Users Never See CTAs (Defense-in-Depth Audit)

**Context:** Even if Fix 0 resolves the root auth propagation issue, we want defense-in-depth. Audit all CTA components to ensure they properly check auth state.

**Files:**
- Audit: `components/ui/public-content-gate.tsx` — already checks `if (user) return children` ✓
- Audit: `components/seo/inline-signup-cta.tsx` — already checks `if (user || isLoading) return null` ✓
- Audit: `components/recommendations/match-score-teaser.tsx` — NO auth check (relies on parent)
- Audit: `components/beach-detail/personalized-forecast-teaser.tsx` — checks `if (user) return null` ✓
- Audit: `components/beach-detail/beach-hero-compact.tsx` — uses `publicMode` prop (derived from `!user` in parent)

- [ ] **Step 1: Add auth check to MatchScoreTeaser**

Currently `match-score-teaser.tsx` has no auth check — it relies on the parent to conditionally render it. Add a self-contained guard:

```typescript
import { useAuth } from "@/context/auth-context";

export function MatchScoreTeaser({
  beachId: _beachId,
  beachName,
  className,
}: MatchScoreTeaserProps) {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const pathname = usePathname();

  // Don't show teaser for authenticated users
  if (user) return null;

  return (
    // ... rest unchanged
```

- [ ] **Step 2: Verify all CTA components are guarded**

Checklist — each component must independently hide for authenticated users:
- `PublicContentGate` → `if (user) return children` ✓
- `InlineSignupCta` → `if (user || isLoading) return null` ✓
- `MatchScoreTeaser` → `if (user) return null` ✓ (after step 1)
- `PersonalizedForecastTeaser` → `if (user) return null` ✓

- [ ] **Step 3: Run tests**

Run: `npx playwright test e2e/guest-smoke`
Run: `npx playwright test e2e/beach-detail`

- [ ] **Step 4: Commit**

```bash
git add components/recommendations/match-score-teaser.tsx
git commit -m "fix: add auth guard to MatchScoreTeaser component

MatchScoreTeaser now self-guards — returns null when user is
authenticated. Defense-in-depth alongside PublicContentGate and
InlineSignupCta which already check auth state independently."
```

---

### Task 6: Make Match-Score-Teaser More Prominent

**Context:** Match-score-teaser is the #1 converter (3.9% CTR, drove both real signups) but it's a small amber badge. Both signups were on mobile. Make it more visible above the fold.

**Files:**
- Modify: `components/recommendations/match-score-teaser.tsx` — add `variant` prop
- Modify: `components/beach-detail.tsx` — add prominent placement below hero for anon users

- [ ] **Step 1: Add a "prominent" variant to MatchScoreTeaser**

In `match-score-teaser.tsx`, add a `variant` prop that renders a larger card-style CTA:

```typescript
export interface MatchScoreTeaserProps {
  beachId: string;
  beachName: string;
  className?: string;
  /** "badge" (default) = small inline badge, "card" = prominent card CTA */
  variant?: "badge" | "card";
}

export function MatchScoreTeaser({
  beachId: _beachId,
  beachName,
  className,
  variant = "badge",
}: MatchScoreTeaserProps) {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const pathname = usePathname();

  if (user) return null;

  if (variant === "card") {
    return (
      <>
        <button
          onClick={() => setShowAuth(true)}
          className={cn(
            "w-full rounded-xl border border-amber-200/30 bg-gradient-to-r from-amber-50/10 to-amber-100/10",
            "px-4 py-3 flex items-center gap-3 text-left",
            "hover:from-amber-50/20 hover:to-amber-100/20 transition-colors",
            className
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/20">
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90">
              How well does {beachName} match you?
            </p>
            <p className="text-xs text-white/50">
              Sign up free to see your personalized match score
            </p>
          </div>
          <span className="text-lg font-bold text-amber-400">???</span>
        </button>

        {showAuth && (
          <UnifiedAuthModal
            isOpen={showAuth}
            onClose={() => setShowAuth(false)}
            mode="signup"
            contextMessage={{
              title: "See Your Match Score",
              description: `See your personalized match score for ${beachName}`,
            }}
            source="match-score-teaser"
            returnTo={pathname}
          />
        )}
      </>
    );
  }

  return (
    // ... existing badge JSX unchanged
```

- [ ] **Step 2: Add prominent placement in beach-detail.tsx**

In `components/beach-detail.tsx`, after the hero section and before the main content (around line 573-576 where the `InlineSignupCta` "Know Before You Go" appears), add the prominent match-score-teaser for anonymous users:

Find the section at line 575:
```tsx
{publicMode ? (
  <div className="mb-6">
    <InlineSignupCta
```

Add the prominent match-score-teaser above it:
```tsx
{publicMode && (
  <div className="mb-4 -mt-2">
    <MatchScoreTeaser
      beachId={beach.id}
      beachName={beach.name}
      variant="card"
    />
  </div>
)}
{publicMode ? (
  <div className="mb-6">
    <InlineSignupCta
```

Add the import at the top of the file:
```typescript
import { MatchScoreTeaser } from "@/components/recommendations/match-score-teaser";
```

- [ ] **Step 3: Test on mobile**

Use Playwright MCP or browser dev tools to verify the card variant is visible above the fold on mobile (393px width — iPhone size, matching both real signups).

Run: `npx playwright test e2e/guest-smoke`

- [ ] **Step 4: Commit**

```bash
git add components/recommendations/match-score-teaser.tsx components/beach-detail.tsx
git commit -m "feat: add prominent match-score-teaser card on beach detail pages

Add a 'card' variant to MatchScoreTeaser that renders as a full-width
banner below the hero for anonymous users. Match-score-teaser is the
#1 converter (3.9% CTR), so it deserves prime real estate."
```

---

## Parallelization Guide

These tasks are independent and can be run in parallel:

| Group | Tasks | Dependencies |
|-------|-------|-------------|
| **A** | Task 1 (Auth fix) | None — P0 critical, do first |
| **B** | Task 2 (Event guards) | None |
| **C** | Task 3 (Ungated cam) + Task 6 (Prominent teaser) | Both modify `beach-detail.tsx` — run sequentially within group |
| **D** | Task 4 (beach_id fix) | None |
| **E** | Task 5 (CTA audit) + Task 6 (Prominent teaser) | Both modify `match-score-teaser.tsx` — Task 5 first, then Task 6 builds on it |

**Recommended parallel dispatch:**
- Agent 1: Task 1 (Auth fix — P0)
- Agent 2: Task 2 (Event guards)
- Agent 3: Task 4 (beach_id fix)
- Agent 4: Task 5 → Task 6 (CTA audit → prominent teaser, sequential — both touch match-score-teaser.tsx)
- Agent 5: Task 3 (Ungated cam hero — after Task 6 merges since both touch beach-detail.tsx)

Or simpler: 3 agents with Task 5+6+3 grouped as one sequential agent.

---

## Chunk 3: Beach Page Conversion Optimization

> **Context:** 1,551 sessions/month, 12 signups (0.77% conversion). 812 sessions see CTAs but only 9 click (1.1% CTR). Google traffic lands on beach detail pages, gets full current conditions, and leaves. Competitor research confirms: keep the basic forecast free (Surfline, Surf-Forecast, Windy all do), but make CTAs more visible, concrete, and compelling.

### Task 7: Add StickySignupBar to Beach Detail Page

**Context:** `StickySignupBar` exists and works on city, forecast, intent, and features pages — but is missing from the beach detail page, which is the highest-traffic page from Google. 75% of traffic is mobile. All 3 tracked signups came from mobile.

**Files:**
- Modify: `app/[intent]/[city]/[beachSlug]/page.tsx` OR the `BeachDetailClient` wrapper

- [ ] **Step 1: Add StickySignupBar import and placement**

In the beach detail page or its client wrapper, add:

```tsx
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";

// Inside the component, as a sibling of BeachDetail
<StickySignupBar
  source={`beach-detail-${beachSlug}`}
  ctaText="Get Alerts"
  supportingText={`Know when it's firing at ${beach.name}`}
/>
```

The component already handles: mobile-only display (`md:hidden`), scroll threshold (300px), session-dismissible (1-day expiry), auth detection (hidden for logged-in users), analytics tracking (dual-fires to GA4 + user_events), iOS safe area padding, and `prefers-reduced-motion`.

**Note:** `StickySignupBar` currently hard-codes its auth modal `contextMessage` to "See Your Match Score" / "Personalized surf forecasts in 30 seconds" (lines 160-169 of sticky-signup-bar.tsx). This contradicts the concrete copy direction. Add a `contextMessage` prop to `StickySignupBar` that passes through to `UnifiedAuthModal`, defaulting to the existing copy for backward compatibility:

```tsx
interface StickySignupBarProps {
  source: string;
  ctaText?: string;
  supportingText?: string;
  scrollThreshold?: number;
  contextMessage?: { title: string; description: string };
}
```

Then pass from Task 7:
```tsx
<StickySignupBar
  source={`beach-detail-${beachSlug}`}
  ctaText="Get Alerts"
  supportingText={`Know when it's firing at ${beach.name}`}
  contextMessage={{
    title: `Get Alerts for ${beach.name}`,
    description: "Condition alerts, 12-day outlook, and your personal match score",
  }}
/>
```

- [ ] **Step 2: Verify on mobile**

Use Playwright MCP to verify on 375x667 viewport:
1. Load beach page as anonymous — scroll past 300px — StickySignupBar appears at bottom
2. Tap "Get Alerts" — auth modal opens with signup mode
3. Dismiss bar — doesn't reappear for the session
4. Load as authenticated user — bar never appears

- [ ] **Step 3: Commit**

```bash
git add app/\[intent\]/\[city\]/\[beachSlug\]/page.tsx
git commit -m "feat: add StickySignupBar to beach detail pages

Mobile-persistent signup CTA on the highest-traffic page type.
75% of traffic is mobile but beach pages had no persistent CTA
after scrolling past the inline card."
```

---

### Task 8: Concrete Beach-Specific CTA Copy

**Context:** Current CTAs use abstract copy ("Get Your Match Score", "Know Before You Go") that means nothing to a first-time visitor who doesn't know what Quiver is. Copy should reference the beach name and a tangible benefit (alerts, extended forecast).

**Files:**
- Modify: `components/beach-detail.tsx` (InlineSignupCta props, lines 577-582)
- Modify: `components/beach-detail/beach-hero-compact.tsx` (teaser button text)

- [ ] **Step 1: Update InlineSignupCta copy on beach detail**

In `components/beach-detail.tsx`, lines 577-582, change:

```tsx
<InlineSignupCta
  title="Know Before You Go"
  description={`Get today's surf call, your personal match score, 12-day outlook, and condition alerts for ${beach.name}`}
  primaryButtonText="Get My Forecast"
  source={`beach-detail-${slugify(beach.name)}`}
/>
```

To:

```tsx
<InlineSignupCta
  title={`Get Alerts for ${beach.name}`}
  description="Get notified when conditions are good, see the full 12-day outlook, and get your personalized surf call"
  primaryButtonText="Get Alerts — Free"
  source={`beach-detail-${slugify(beach.name)}`}
/>
```

- [ ] **Step 2: Update BeachHeroCompact teaser button**

In `components/beach-detail/beach-hero-compact.tsx`, update the teaser button copy from "See it →" to "Unlock →".

- [ ] **Step 3: Update auth modal context messages**

Where CTAs pass `contextMessage` to `UnifiedAuthModal`, update:
- Title: "Get Alerts for {beach.name}" (instead of "Know Before You Go")
- Description: "Condition alerts, 12-day outlook, and your personal match score" (instead of "Personalized surf forecasts in 30 seconds")

- [ ] **Step 4: Commit**

```bash
git add components/beach-detail.tsx components/beach-detail/beach-hero-compact.tsx
git commit -m "fix: concrete beach-specific CTA copy on beach detail pages

Replace abstract CTAs ('Get Your Match Score') with beach-specific
messaging ('Get Alerts for Swamis'). Framing as utility (alerts)
rather than product (forecasts) to increase click-through."
```

---

### Task 9: Trust Strip for Anonymous Users

**Context:** First-time Google visitors have no context for why they should trust Quiver over Surfline. No product identity or credibility signals on beach pages. The trust strip establishes Quiver's tech differentiation in one line.

**Files:**
- Create: `components/beach-detail/trust-strip.tsx`
- Modify: `components/beach-detail.tsx` (import + placement)

- [ ] **Step 1: Create TrustStrip component**

Create `components/beach-detail/trust-strip.tsx`:

```tsx
"use client";

import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export function TrustStrip() {
  const { user, isLoading } = useAuth();

  // Only show for anonymous visitors
  if (user || isLoading) return null;

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2.5 px-4">
      <ShieldCheck className="h-3.5 w-3.5 text-ocean-blue/60 flex-shrink-0" />
      <span>ML-corrected forecasts</span>
      <span className="text-gray-400">·</span>
      <span>Trained on 30K+ buoy observations</span>
      <span className="text-gray-400">·</span>
      <span>Updated every 3 hours</span>
    </div>
  );
}
```

Claims are honest: ML pipeline is real, 30K+ refers to automated NOAA buoy data (not user-generated), 3-hour cron is the actual forecast refresh schedule.

- [ ] **Step 2: Add TrustStrip to beach detail page**

In `components/beach-detail.tsx`, import and place between the hero and tabs (after the horizon strip, before the sticky tabs bar — approximately after line 615):

```tsx
import { TrustStrip } from "@/components/beach-detail/trust-strip";

// After horizon strip, before tabs
<TrustStrip />
```

- [ ] **Step 3: Verify**

Screenshot with Playwright — verify strip is visible below hero for anonymous users, hidden for authenticated.

- [ ] **Step 4: Commit**

```bash
git add components/beach-detail/trust-strip.tsx components/beach-detail.tsx
git commit -m "feat: add trust strip on beach pages for anonymous visitors

Shows 'ML-corrected forecasts · 30K+ buoy observations · Updated every
3 hours' between hero and tabs. Establishes credibility and tech
differentiation for first-time visitors from Google."
```

---

### Task 10: Model Confidence Badge

**Context:** Quiver's ML-corrected forecasts are a key differentiator over Surfline's human-forecaster model, but this is invisible to users. A small confidence badge near the conditions data surfaces this advantage inline with the forecast.

**Files:**
- Create: `components/beach-detail/forecast-confidence-badge.tsx`
- Modify: `components/beach-detail.tsx` OR `components/beach-detail/tabs/forecast-tab.tsx` (placement)

- [ ] **Step 1: Create ForecastConfidenceBadge component**

Create `components/beach-detail/forecast-confidence-badge.tsx`:

```tsx
"use client";

import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForecastConfidenceBadgeProps {
  className?: string;
}

export function ForecastConfidenceBadge({ className }: ForecastConfidenceBadgeProps) {
  // v1: Static badge. Future: derive from forecast data quality signals.
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 rounded-full px-2.5 py-0.5 border border-emerald-800/30",
        className
      )}
    >
      <Activity className="h-3 w-3" />
      <span>ML-enhanced forecast</span>
    </div>
  );
}
```

Note: v1 is a static badge. Once forecast confidence data is available from the ML pipeline, derive the label dynamically (High/Moderate confidence with a percentage).

- [ ] **Step 2: Place badge in forecast tab or conditions area**

Add near the conditions ticker or at the top of the Forecast tab, visible to all users (this is informational, not a CTA — no auth gating needed):

```tsx
import { ForecastConfidenceBadge } from "@/components/beach-detail/forecast-confidence-badge";

// Adjacent to the ConditionsTicker or at the top of the tab content
<ForecastConfidenceBadge />
```

- [ ] **Step 3: Commit**

```bash
git add components/beach-detail/forecast-confidence-badge.tsx components/beach-detail.tsx
git commit -m "feat: add ML-enhanced forecast confidence badge

Small badge near conditions data surfacing Quiver's ML-corrected
forecast differentiation. Static v1 — future versions will derive
confidence from pipeline quality signals."
```

---

### Task 11: Ghost Match Score in Hero

**Context:** Match Score is Quiver's most differentiated feature but it's invisible to anonymous users. A ghost/locked Match Score badge in the hero creates curiosity and a clear reason to sign up. The `PersonalizedForecastTeaser` explains Match Score but is buried in the Forecast tab and currently not even rendered on beach pages.

**Files:**
- Modify: `components/beach-detail/beach-hero-compact.tsx`

- [ ] **Step 1: Add ghost Match Score to hero overlay**

In `components/beach-detail/beach-hero-compact.tsx`, inside the `publicMode && !personalizationScore` conditional block (around lines 186-217), add a ghost score button:

```tsx
{publicMode && !personalizationScore && (
  <div className="flex items-center gap-2">
    {/* Existing forecast teaser */}
    {/* ... */}

    {/* Ghost Match Score */}
    <button
      onClick={() => {
        trackSignupCtaClick({
          source: "ghost-match-score",
          cta_type: "ghost_score",
          cta_text: "Your Match",
        });
        trackAuthModalOpened({
          mode: "signup",
          source: "ghost-match-score",
        });
        setShowGhostAuthModal(true);
      }}
      className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20 hover:bg-white/20 transition-colors"
    >
      <div className="relative flex items-center justify-center w-6 h-6">
        <span className="text-sm font-bold text-white/30 blur-[2px] select-none">87</span>
        <Lock className="absolute h-3 w-3 text-white/80" />
      </div>
      <span className="text-xs text-white/80 font-medium">Your Match</span>
    </button>
  </div>
)}
```

The blurred "87" is a static placeholder that creates curiosity without being deceptive (it's clearly locked/blurred). Import `Lock` from lucide-react. Note: The existing component uses `authModalOpen` / `setAuthModalOpen` state (line 55). Add a separate `showGhostAuthModal` / `setShowGhostAuthModal` state to avoid conflicts with the existing teaser's auth modal. The ghost score should sit beside (not wrap) the existing `<motion.div>` teaser — place it as a sibling element within the conditional block.

- [ ] **Step 2: Add analytics tracking**

Add view tracking via IntersectionObserver (same pattern as existing match-score-teaser at lines 94-128):

```tsx
// Track ghost score view
useEffect(() => {
  if (!publicMode || personalizationScore) return;
  trackSignupCtaView({
    source: "ghost-match-score",
    cta_type: "ghost_score",
  });
}, [publicMode, personalizationScore]);
```

- [ ] **Step 3: Add auth modal state**

Add state for the auth modal and render `UnifiedAuthModal` with context:

```tsx
const [showGhostAuthModal, setShowGhostAuthModal] = useState(false);

// In JSX
{showGhostAuthModal && (
  <UnifiedAuthModal
    isOpen={showGhostAuthModal}
    onClose={() => setShowGhostAuthModal(false)}
    mode="signup"
    contextMessage={{
      title: "See Your Match Score",
      description: `Get a personalized conditions match for ${beach.name} based on your skill level and preferences`,
    }}
    source="ghost-match-score"
  />
)}
```

- [ ] **Step 4: Test**

Playwright screenshot on mobile: verify ghost score is visible in hero overlay, tapping it opens auth modal.

- [ ] **Step 5: Commit**

```bash
git add components/beach-detail/beach-hero-compact.tsx
git commit -m "feat: ghost Match Score badge in hero for anonymous visitors

Shows a blurred/locked score ('Your Match: ??') in the hero overlay
that creates curiosity about Quiver's personalized match scoring.
Tapping opens the auth modal. Surfaces the key differentiator where
eyes go first."
```

---

## Chunk 4: Cam Page + Intent Page Conversion

> **Context:** Cam pages (`/cams`, `/cams/[region]`) and best-time-to-surf pages have **zero signup CTAs** — complete conversion dead ends. These pages get Google traffic (cam pages: 4 clicks each, best-time-to-surf/santa-cruz: 362 impressions) but visitors get full value and leave. Beach sub-pages (tides, water-temp) inherit parent gating but have no contextual CTAs.

### Task 12: Add Conversion Components to Cam Pages

**Context:** `/cams` (hub) and `/cams/[region]` (e.g., southern-california, hawaii, pacific-northwest) have zero signup CTAs. Visitors browse cams and leave. Competitors: Surfline hard-gates premium cams, Surf-Forecast wraps free cams in 3x "Go Pro" banners.

**Important:** These page files are **server components** (async functions, no `"use client"` directive). `StickySignupBar` and `InlineSignupCta` are client components — they can be imported and rendered from server component files. Do NOT add `"use client"` to the page files (that would break their server-side data fetching).

**Dependency:** Step 4 (TrustStrip) requires Task 9 to be completed first. If Task 9 is not done, skip Step 4 and add TrustStrip in a follow-up.

**Files:**
- Modify: `app/cams/page.tsx` (cam hub)
- Modify: `app/cams/[region]/page.tsx` (region pages)

- [ ] **Step 1: Add StickySignupBar to cam hub page**

```tsx
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";

// At the bottom of the page component
<StickySignupBar
  source="cams-hub"
  ctaText="Get Cam Alerts"
  supportingText="Get notified when conditions are firing"
/>
```

- [ ] **Step 2: Add InlineSignupCta to cam hub page**

Place after the cam grid, before the "More Surf Tools" section:

```tsx
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";

<InlineSignupCta
  title="Never Miss a Session"
  description="Get alerts when conditions line up at your favorite breaks. Free condition reports, 12-day outlooks, and personalized surf calls."
  primaryButtonText="Get Alerts — Free"
  source="cams-hub-inline"
/>
```

- [ ] **Step 3: Add StickySignupBar + InlineSignupCta to cam region pages**

Same pattern, with region-specific source tracking:

```tsx
<StickySignupBar
  source={`cams-${region.slug}`}
  ctaText="Get Cam Alerts"
  supportingText="Get notified when conditions are firing"
/>

<InlineSignupCta
  title="Never Miss a Session"
  description="Get alerts when conditions line up at your favorite breaks. Free condition reports, 12-day outlooks, and personalized surf calls."
  primaryButtonText="Get Alerts — Free"
  source={`cams-${region.slug}-inline`}
/>
```

- [ ] **Step 4: Add TrustStrip to cam pages**

Add the `TrustStrip` component (from Task 9) below the hero on cam pages for anonymous visitors.

- [ ] **Step 5: Test and commit**

```bash
git add app/cams/page.tsx app/cams/\[region\]/page.tsx
git commit -m "feat: add conversion components to cam pages

Cam pages had zero signup CTAs — complete conversion dead ends.
Add StickySignupBar, InlineSignupCta, and TrustStrip to both
the cam hub and region pages."
```

---

### Task 13: Add Conversion Components to Best-Time-to-Surf Pages

**Context:** `/best-time-to-surf` (hub) and `/best-time-to-surf/[city]` pages have zero signup CTAs. Santa Cruz alone has 362 Google impressions. These are content-rich SEO pages that deliver full value with no conversion mechanism.

**Important:** These page files are **server components** (async functions, no `"use client"` directive). `StickySignupBar` and `InlineSignupCta` are client components — they can be imported and rendered from server component files. Do NOT add `"use client"` to the page files.

**Files:**
- Modify: `app/best-time-to-surf/page.tsx` (hub)
- Modify: `app/best-time-to-surf/[city]/page.tsx` (city pages)

- [ ] **Step 1: Add StickySignupBar to hub page**

```tsx
<StickySignupBar
  source="best-time-hub"
  ctaText="Get Alerts"
  supportingText="Get notified when peak conditions arrive"
/>
```

- [ ] **Step 2: Add InlineSignupCta to hub page**

Place after the state cards grid:

```tsx
<InlineSignupCta
  title="Know When to Paddle Out"
  description="Get personalized alerts when conditions match your skill level, preferred breaks, and schedule"
  primaryButtonText="Get Alerts — Free"
  source="best-time-hub-inline"
/>
```

- [ ] **Step 3: Add StickySignupBar + InlineSignupCta to city pages**

With city-specific copy:

```tsx
<StickySignupBar
  source={`best-time-${citySlug}`}
  ctaText="Get Alerts"
  supportingText={`Best conditions alerts for ${cityName}`}
/>

<InlineSignupCta
  title={`Get Alerts for ${cityName}`}
  description={`Get notified when conditions are ideal in ${cityName}. Personalized surf calls, 12-day outlooks, and condition alerts.`}
  primaryButtonText="Get Alerts — Free"
  source={`best-time-${citySlug}-inline`}
/>
```

- [ ] **Step 4: Test and commit**

```bash
git add app/best-time-to-surf/page.tsx app/best-time-to-surf/\[city\]/page.tsx
git commit -m "feat: add conversion components to best-time-to-surf pages

Hub and city pages had zero signup CTAs despite getting significant
Google impressions (santa-cruz: 362 impressions). Add StickySignupBar
and InlineSignupCta with seasonal/city-specific copy."
```

---

### Task 14: Add Contextual CTAs to Beach Sub-Pages

**Context:** Beach sub-pages (`/[state]/[city]/[beach]/water-temp` and `/tides`) inherit parent gating but have no contextual CTAs matching the visitor's search intent. Wrightsville Beach water-temp page has 301 Google impressions with only 2 clicks.

**Files:**
- Modify: `lib/utils/beach-sub-page-utils.tsx` (the `renderBeachSubPage` utility that both sub-pages use)
- OR modify individual sub-page files if they have separate rendering

- [ ] **Step 1: Determine insertion point**

Read `lib/utils/beach-sub-page-utils.tsx` to understand how sub-pages render. If there's a shared layout, add CTAs there. If each sub-page renders independently, add to each.

- [ ] **Step 2: Add StickySignupBar with intent-specific copy**

For water-temp pages:
```tsx
<StickySignupBar
  source={`water-temp-${beachSlug}`}
  ctaText="Get Alerts"
  supportingText={`Water temp alerts for ${beachName}`}
/>
```

For tides pages:
```tsx
<StickySignupBar
  source={`tides-${beachSlug}`}
  ctaText="Get Alerts"
  supportingText={`Tide alerts for ${beachName}`}
/>
```

- [ ] **Step 3: Add InlineSignupCta with intent-specific copy**

For water-temp:
```tsx
<InlineSignupCta
  title={`Water Temp Alerts for ${beachName}`}
  description="Track water temperatures and get wetsuit recommendations based on real-time conditions and your comfort preferences"
  primaryButtonText="Get Alerts — Free"
  source={`water-temp-${beachSlug}-inline`}
/>
```

For tides:
```tsx
<InlineSignupCta
  title={`Tide Alerts for ${beachName}`}
  description="Get notified when optimal tide windows approach. Track your preferences and plan sessions around the tide"
  primaryButtonText="Get Alerts — Free"
  source={`tides-${beachSlug}-inline`}
/>
```

- [ ] **Step 4: Test and commit**

```bash
git add lib/utils/beach-sub-page-utils.tsx
git commit -m "feat: add contextual CTAs to beach sub-pages (water-temp, tides)

Sub-pages inherited parent gating but had no intent-specific conversion
components. Add StickySignupBar and InlineSignupCta with copy matching
the visitor's search intent (tide alerts, water temp tracking)."
```

---

## Chunk 5: Testing & Validation

### Task 15: Visual QA — Evidence Collector

**Context:** All new components need visual verification on mobile (375x667) and desktop (1440x900) across anonymous and authenticated states.

- [ ] **Step 1: Screenshot anonymous beach page (mobile)**

Playwright screenshots capturing:
- Full beach page scroll for anonymous user
- StickySignupBar appearance after 300px scroll
- Ghost Match Score in hero overlay
- Trust strip between hero and tabs
- Confidence badge near conditions
- InlineSignupCta with new copy
- All elements visible in natural reading order

- [ ] **Step 2: Screenshot anonymous beach page (desktop)**

Same elements at desktop breakpoint.

- [ ] **Step 3: Screenshot authenticated beach page**

Verify all conversion components are hidden for logged-in users — no StickySignupBar, no InlineSignupCta, no Ghost Match Score, no TrustStrip.

- [ ] **Step 4: Screenshot cam pages (anonymous mobile)**

Verify StickySignupBar, InlineSignupCta, and TrustStrip on cam hub and region pages.

- [ ] **Step 5: Screenshot best-time-to-surf pages (anonymous mobile)**

Verify StickySignupBar and InlineSignupCta on hub and city pages.

- [ ] **Step 6: Screenshot beach sub-pages (anonymous mobile)**

Verify contextual CTAs on water-temp and tides sub-pages.

- [ ] **Step 7: Report**

Compile evidence-based QA report with PASS/FAIL per component per page type.

---

### Task 16: Accessibility Audit

**Context:** All new interactive elements must be keyboard-navigable, screen-reader-compatible, and respect `prefers-reduced-motion`.

- [ ] **Step 1: Keyboard navigation audit**

Verify all new buttons (Ghost Match Score, StickySignupBar CTA, InlineSignupCta buttons) are reachable via Tab and activatable via Enter/Space.

- [ ] **Step 2: Screen reader audit**

Verify Ghost Match Score button has an accessible label (e.g., `aria-label="See your personalized match score — sign up free"`). Verify TrustStrip is announced as informational content. Verify ForecastConfidenceBadge is announced.

- [ ] **Step 3: Color contrast**

Verify trust strip text (`text-gray-500` on page background) meets WCAG 1.4.3 minimum 4.5:1 ratio. Verify confidence badge text (`text-emerald-400` on `bg-emerald-950/40`) meets contrast requirements.

- [ ] **Step 4: Motion**

Verify any new animations (StickySignupBar slide-in, Ghost Match Score hover effects) respect `prefers-reduced-motion`.

- [ ] **Step 5: Report**

Compile accessibility audit with WCAG criterion references for any issues found.

---

### Task 17: Analytics Verification

**Context:** All new CTAs must fire tracking events correctly to both GA4 and user_events table.

- [ ] **Step 1: Verify new CTA view events**

Load beach page as anonymous, scroll to trigger each CTA. Check browser console / network tab for:
- `signup_cta_view` with source `beach-detail-{slug}` and `cta_type: "sticky_bar"`
- `signup_cta_view` with source `ghost-match-score` and `cta_type: "ghost_score"`
- Existing sources (`beach-detail-{slug}` inline, `match-score-teaser`) still fire correctly

- [ ] **Step 2: Verify new CTA click events**

Click each CTA. Check for:
- `signup_cta_click` with correct source and cta_text
- `auth_modal_opened` with correct mode and source

- [ ] **Step 3: Verify deduplication**

View events should fire once per source per session. Scroll up and down — view events should not re-fire.

- [ ] **Step 4: Verify auth state suppression**

Log in, revisit beach page. Verify zero CTA events fire (all components hidden).

- [ ] **Step 5: Verify cam + intent page tracking**

Repeat steps 1-2 for cam pages (source: `cams-hub`, `cams-{region}`) and best-time-to-surf pages (source: `best-time-hub`, `best-time-{city}`).

---

### Task 18: New-User Alert System

**Context:** Both new signups this week hit the auth bug and churned. At ~2 signups/week, the founder should be personally notified of every signup and alerted if auth fails. Uses existing Resend email infrastructure.

**Files:**
- Create: `lib/services/new-user-alerts.ts`
- Create: `app/api/admin/new-user-alert/route.ts`
- Modify: `app/api/events/route.ts` (add auth failure detection)

- [ ] **Step 1: Create the admin alert service**

Create `lib/services/new-user-alerts.ts`:

```typescript
import { getResendClient } from "@/lib/email/resend-client";

const ADMIN_EMAIL = "stcha0004@gmail.com";

interface NewUserAlertData {
  userId: string;
  email: string;
  name: string | null;
  signupMethod: string;
  device?: { os?: string; browser?: string; device_type?: string };
  viewportWidth?: number;
  entryPage?: string;
}

interface AuthFailureAlertData {
  userId: string;
  email: string;
  name: string | null;
  signupMethod: string;
  minutesSinceSignup: number;
  ctaSource: string;
}

export async function sendNewUserAlert(data: NewUserAlertData) {
  const resend = getResendClient();
  if (!resend) return;

  const deviceInfo = data.device
    ? `${data.device.os} / ${data.device.browser} / ${data.device.device_type}`
    : "Unknown";

  await resend.emails.send({
    from: "Quiver Alerts <noreply@quiversurf.app>",
    to: ADMIN_EMAIL,
    subject: `New signup: ${data.name || data.email} (${data.signupMethod})`,
    text: [
      `New user signed up for Quiver!`,
      ``,
      `Name: ${data.name || "(no name)"}`,
      `Email: ${data.email}`,
      `Method: ${data.signupMethod}`,
      `Device: ${deviceInfo}`,
      `Viewport: ${data.viewportWidth || "unknown"}px`,
      `Entry page: ${data.entryPage || "unknown"}`,
      ``,
      `User ID: ${data.userId}`,
      `Admin: https://quiversurf.app/admin`,
    ].join("\n"),
  });
}

export async function sendAuthFailureAlert(data: AuthFailureAlertData) {
  const resend = getResendClient();
  if (!resend) return;

  await resend.emails.send({
    from: "Quiver Alerts <noreply@quiversurf.app>",
    to: ADMIN_EMAIL,
    subject: `AUTH FAILURE: ${data.name || data.email} still seeing CTAs ${data.minutesSinceSignup}min after signup`,
    text: [
      `A user who signed up ${data.minutesSinceSignup} minutes ago is still seeing signup CTAs.`,
      `This means auth state did not propagate correctly.`,
      ``,
      `Name: ${data.name || "(no name)"}`,
      `Email: ${data.email}`,
      `Method: ${data.signupMethod}`,
      `CTA source that triggered this alert: ${data.ctaSource}`,
      ``,
      `User ID: ${data.userId}`,
      ``,
      `ACTION: Check if they are stuck in the same auth bug that affected Erin Armstrong and Steve Rhea.`,
      `Consider reaching out personally.`,
    ].join("\n"),
  });
}
```

- [ ] **Step 2: Create the new-user-alert API route**

Create `app/api/admin/new-user-alert/route.ts`:

```typescript
import { withAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
import { sendNewUserAlert } from "@/lib/services/new-user-alerts";

export const POST = withAuth(async (request, { user, supabase }) => {
  const body = await request.json();

  // Only fire for users created in the last 60 seconds
  const createdAt = new Date(user.created_at!).getTime();
  if (Date.now() - createdAt > 60_000) {
    return createSuccessResponse({ skipped: true });
  }

  // Get profile for name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  await sendNewUserAlert({
    userId: user.id,
    email: user.email || "unknown",
    name: profile?.full_name || null,
    signupMethod: body.method || "unknown",
    device: body.device,
    viewportWidth: body.viewportWidth,
    entryPage: body.entryPage,
  });

  return createSuccessResponse({ ok: true });
}, { errorMessage: "Failed to send new user alert" });
```

- [ ] **Step 3: Fire the alert from auth context**

In `context/auth-context.tsx`, inside the `onAuthStateChange` handler where `isNewUser` is detected (around line 263), add a fire-and-forget call:

```typescript
if (isNewUser) {
  // Send new-user alert to founder (fire and forget)
  fetch("/api/admin/new-user-alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: session.user.app_metadata?.provider || "unknown",
      device: typeof navigator !== "undefined" ? {
        os: navigator.platform,
        browser: navigator.userAgent.includes("Safari") ? "Safari" : "Chrome",
        device_type: window.innerWidth < 768 ? "mobile" : "desktop",
      } : undefined,
      viewportWidth: typeof window !== "undefined" ? window.innerWidth : undefined,
      entryPage: typeof window !== "undefined" ? window.location.pathname : undefined,
    }),
    keepalive: true,
  }).catch(() => {}); // Fire and forget — don't block auth flow
}
```

- [ ] **Step 4: Add auth failure detection in events API**

In `app/api/events/route.ts`, in the anonymous event recording section (around line 383), add a check: if the event is `signup_cta_view` and the sessionId matches a recently-signed-up user, fire the auth failure alert.

After the anonymous event insert succeeds, add:

```typescript
// Auth failure detection: if a signup_cta_view fires for a session
// that belongs to a user who signed up in the last 10 minutes, alert
if (eventType === 'signup_cta_view' && body.sessionId) {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Check if this session's visitor had a recent signup
  const { data: recentUser } = await serviceClient
    .from('user_events')
    .select('user_id, metadata')
    .eq('session_id', body.sessionId)
    .eq('event_type', 'signup_success')
    .gte('created_at', tenMinAgo)
    .limit(1)
    .single();

  if (recentUser?.user_id) {
    // This user signed up recently but is still seeing CTAs — auth failed
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', recentUser.user_id)
      .single();

    const { data: authUser } = await serviceClient.auth.admin.getUserById(recentUser.user_id);

    // Fire and forget
    sendAuthFailureAlert({
      userId: recentUser.user_id,
      email: authUser?.user?.email || profile?.email || 'unknown',
      name: profile?.full_name || null,
      signupMethod: (recentUser.metadata as any)?.method || 'unknown',
      minutesSinceSignup: Math.round((Date.now() - new Date(tenMinAgo).getTime()) / 60000),
      ctaSource: enrichedMetadata?.source || 'unknown',
    }).catch(() => {}); // Don't block event recording
  }
}
```

- [ ] **Step 5: Test**

1. Sign up with a test account → verify admin email received within 30 seconds
2. After signup, if CTAs still show → verify auth failure alert email received
3. Verify alerts don't fire for returning users (created > 60 seconds ago)

- [ ] **Step 6: Commit**

```bash
git add lib/services/new-user-alerts.ts app/api/admin/new-user-alert/route.ts context/auth-context.tsx app/api/events/route.ts
git commit -m "feat: new-user alert system with auth failure detection

Email founder on every signup (name, method, device, entry page).
Detect when a user who signed up <10 min ago still sees signup CTAs
and send an auth failure alert. Uses existing Resend infrastructure."
```

---

## Updated Parallelization Guide

| Group | Tasks | Dependencies |
|-------|-------|-------------|
| **A** | Task 1 (Auth fix) | P0 critical — do first |
| **B** | Task 2 (Event guards) | None |
| **C** | Task 3 (Ungated cam) | Touches `beach-detail.tsx` — sequence with other beach-detail changes |
| **D** | Task 4 (beach_id fix) | None |
| **E** | Task 5 (CTA audit) → Task 6 (Prominent teaser) | Sequential — both touch `match-score-teaser.tsx` |
| **F** | Task 7 (StickySignupBar) + Task 8 (CTA copy) + Task 9 (TrustStrip) + Task 10 (Confidence badge) + Task 11 (Ghost Match Score) | All touch `beach-detail.tsx` or its children — run in one sequential agent |
| **G** | Task 12 (Cam page CTAs) | Depends on Task 9 for TrustStrip component — start after Agent 4 completes Task 9, or skip TrustStrip step |
| **H** | Task 13 (Best-time CTAs) | Independent — separate files |
| **I** | Task 14 (Beach sub-page CTAs) | Independent — separate files |
| **J** | Task 18 (New-user alerts) | Touches `context/auth-context.tsx` and `app/api/events/route.ts` — sequence with Task 1 and Task 2 |
| **K** | Tasks 15-17 (Testing) | Blocked by all implementation tasks |

**Recommended parallel dispatch:**
- Agent 1: Task 1 (Auth fix — P0) → Task 18 (New-user alerts — both touch auth-context.tsx)
- Agent 2: Task 2 (Event guards) + Task 4 (beach_id fix)
- Agent 3: Task 5 → Task 6 (CTA audit → prominent teaser)
- Agent 4: Task 3 → Task 7 → Task 8 → Task 9 → Task 10 → Task 11 (all beach-detail changes, sequential)
- Agent 5: Task 12 (Cam pages) — start after Agent 4 completes Task 9 (needs TrustStrip), or skip TrustStrip step
- Agent 6: Task 13 (Best-time-to-surf pages)
- Agent 7: Task 14 (Beach sub-pages)
- Agent 8: Tasks 15-17 (Testing — after all implementation agents complete)

**Important notes for all agents:**
- Every commit must also update `CHANGELOG.md` under `[Unreleased]` with a brief bullet (Added/Changed/Fixed)
- If any existing tests break during implementation, fix them in the same commit (same-commit rule)
- Run `npx playwright test e2e/guest-smoke` after each task to verify no regressions
