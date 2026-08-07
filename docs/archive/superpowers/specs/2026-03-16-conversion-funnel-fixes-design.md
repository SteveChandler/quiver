# Conversion Funnel Fixes — Design Spec

**Date:** 2026-03-16
**Context:** Dashboard analysis revealed a broken signup funnel: 0.08% end-to-end conversion (2 signups from ~2,383 real CTA views). Investigation uncovered a critical auth state propagation bug where OAuth signup on iOS Safari doesn't update the client auth context, causing signed-up users to keep seeing anonymous CTAs and never enter the authenticated experience. One real user (Erin Armstrong) signed up 3 times and logged in once but never saw the logged-in UI.

---

## Fix 0: Auth State Propagation After OAuth Signup (P0 — Critical)

**Problem:** After OAuth signup (Apple/Google) via `UnifiedAuthModal`, the Supabase auth session is created server-side but the client-side auth context (`useAuth()`) doesn't refresh. Components continue rendering in anonymous mode. Confirmed on iOS Safari — user completed 3 signups + 1 login without the page ever reflecting authenticated state.

**Root cause investigation areas:**
- `components/auth/unified-auth-modal.tsx` — does it trigger an auth context refresh after OAuth redirect?
- Auth context provider — does it listen for `onAuthStateChange` events from Supabase?
- `app/auth/callback/route.ts` — does the OAuth callback properly exchange the code and set cookies?
- iOS Safari cookie handling — SameSite/Secure cookie attributes may prevent session cookies from being set after cross-origin OAuth redirect

**Fix approach:**
1. Trace the OAuth flow end-to-end: modal → provider redirect → callback route → cookie set → client auth refresh
2. Ensure `onAuthStateChange('SIGNED_IN')` fires after OAuth callback and triggers component re-renders
3. Add a fallback: after `signup_success` event, explicitly call `supabase.auth.getSession()` to force-refresh the client state
4. Test on iOS Safari, Android Chrome, and desktop Chrome

**Success criteria:** After OAuth signup, all PublicContentGate components immediately ungate, MatchScoreTeaser transforms to PersonalizedBadge, and user_events record under the authenticated user_id.

---

## Fix 1: Guard Event Tracking for Authed Users

**Problem:** `signup_form_submitted` and `auth_modal_opened` events fire regardless of auth state, polluting funnel metrics. One internal user generated 80 `signup_form_submitted` and 189 `auth_modal_opened` events while already authenticated.

**Files to modify:**
- `components/auth/unified-auth-modal.tsx` — add `if (!user)` guard before `trackAuthModalOpened()` and `trackSignupFormSubmitted()`
- `app/api/events/route.ts` — add server-side guard: if request has authenticated user AND event is in pre-auth-only list, skip insert

**Pre-auth-only events (server-side blocklist for authed users):**
- `signup_cta_view`
- `signup_cta_click`
- `signup_form_submitted`
- `auth_modal_opened`
- `auth_modal_closed_without_action`

**Note:** `signup_started`, `signup_success`, and `login_success` should still be allowed for authed users since they fire during the auth transition.

---

## Fix 2: Ungated Cam Hero

**Problem:** Cam hero CTA ("Watch the Live Cam") gets 523 impressions but only 1 click (0.2% CTR). Users don't want to sign up just to watch a cam.

**Files to modify:**
- `components/beach-detail.tsx` — remove `PublicContentGate` wrapper around the cam hero section. Show the live cam to everyone.

**What changes:**
- Anonymous users see the live cam stream (iframe/HLS/video) ungated
- No more `signup_cta_view` events from "cam-hero" source
- The cam itself becomes a retention hook — keeps users on the page longer, increasing exposure to match-score-teaser and other CTAs that actually convert

**What to gate instead (future):** Cam alerts/notifications ("Get notified when it's firing"), cam replay/history.

---

## Fix 3: Make Match-Score-Teaser More Prominent

**Problem:** Match-score-teaser is the #1 converter (3.9% click rate, drove both real signups) but it's a small amber badge that's easy to miss.

**Current placement:**
- Small badge on beach cards in recommendations/discovery
- Button in `beach-hero-compact.tsx` (only in publicMode)

**Proposed changes:**
- Elevate on beach detail page: render the match-score-teaser as a more prominent card/banner below the hero for anonymous users — not just a tiny badge
- Ensure it's visible above the fold on mobile (where most conversions happen — both signups were mobile)
- Keep the same click handler and conversion mechanics (they work perfectly)

**Files to modify:**
- `components/beach-detail.tsx` — add a prominent MatchScoreTeaser placement for anon users
- `components/recommendations/match-score-teaser.tsx` — potentially add a `variant="prominent"` prop for larger rendering

---

## Fix 4: Capture beach_id in Anon beach_view Events

**Problem:** All 673 anonymous `beach_view` events have `beach_id: null`, making it impossible to know which beaches attract anonymous visitors.

**Root cause:** In `app/beach/[slug]/beach-detail-client.tsx`, the cleanup effect fires `track('beach_view', { beachId: beach.id })` on unmount, but if the component unmounts before `beach` data loads, `beach.id` is undefined.

**Fix:**
- Capture `beach.id` in a ref (`beachIdRef`) when it becomes available
- Use the ref in the cleanup function so it always has the value even after unmount
- Also capture `beach.name` and `beach.slug` in metadata for easier querying

**Files to modify:**
- `app/beach/[slug]/beach-detail-client.tsx` — add `useRef` for beach.id, update in effect when beach loads

---

## Fix 5: Authed Users Never See CTAs

**Problem:** Even after successful signup, the Apple user continued seeing all anonymous CTAs (cam-hero, match-score, best-window, inline, personalized-forecast). This is partially caused by Fix 0 (auth state not propagating), but we should also audit all CTA touchpoints for defense-in-depth.

**Audit checklist:**
- `components/ui/public-content-gate.tsx` — already checks `if (user) return children` ✓ (works if auth state is correct)
- `components/seo/inline-signup-cta.tsx` — already checks `if (user || isLoading) return null` ✓
- `components/recommendations/match-score-teaser.tsx` — verify it checks auth state
- `components/beach-detail/personalized-forecast-teaser.tsx` — verify it checks auth state
- Navbar login/signup button — should transform to profile/avatar when logged in
- `components/beach-detail/beach-hero-compact.tsx` — match-score-teaser in publicMode

**Fix:** Verify each component properly checks `useAuth()` and hides/transforms for authenticated users. Fix any that don't. This is defense-in-depth — Fix 0 is the real solution, but these guards prevent the problem from manifesting even if auth state is slow to propagate.

---

## Priority Order

1. **Fix 0** — Auth state propagation (P0, critical — this is actively losing users)
2. **Fix 1** — Guard event tracking (P1, data quality)
3. **Fix 5** — Authed users never see CTAs (P1, defense-in-depth for Fix 0)
4. **Fix 2** — Ungated cam hero (P2, conversion improvement)
5. **Fix 4** — Capture beach_id in anon events (P2, analytics)
6. **Fix 3** — Prominent match-score-teaser (P2, conversion improvement)

---

## Verification Plan

1. **Fix 0:** Sign up with Apple on iOS Safari → verify CTAs disappear, user_events record under user_id, onboarding flow triggers
2. **Fix 1:** Log in → verify no `signup_cta_view`/`auth_modal_opened` events fire → check `user_events` table
3. **Fix 5:** Log in → navigate to beach page → verify no CTAs visible, cam is ungated, match-score shows actual score
4. **Fix 2:** Open beach page as anon → verify cam plays without auth gate
5. **Fix 4:** View a beach page as anon → check `user_events` for `beach_view` with non-null `beach_id`
6. **Fix 3:** Open beach page as anon on mobile → verify match-score-teaser is prominent above the fold
7. Run affected Playwright tests: `e2e/beach-detail*.spec.ts`, `e2e/auth*.spec.ts`, `e2e/guest-smoke*.spec.ts`
