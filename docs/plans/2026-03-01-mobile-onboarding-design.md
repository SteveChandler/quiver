# Mobile Onboarding & Apple Sign-In Design

**Date:** 2026-03-01
**Status:** Approved

---

## Overview

Create a native-feeling mobile onboarding experience for the Quiver iOS app and add Apple Sign-In to the auth flow. The web landing page remains unchanged.

## Scope

1. **Mobile welcome screen** — new `/welcome` route, Capacitor-only entry point
2. **Apple Sign-In** — native iOS (Capacitor plugin) + web (Supabase OAuth)
3. **Auth method picker** — Apple / Google / Email on the welcome screen and existing auth modal

---

## Mobile Welcome Screen

### Route

`/welcome` — only loaded by the Capacitor native app. Web visitors never see this page.

### Animation Sequence

1. **Splash phase:** Screen opens white. Quiver logo (`public/quiver-logo-transparent.png`) fades in centered, small, with a soft pulsing gradient glow behind it (Framer Motion).
2. **Expand phase:** Logo scales up slightly. Two concentric rings of surf emoji fade in and begin orbiting around the logo:
   - **Inner ring:** 4-5 emoji, faster rotation. Examples: 🏄‍♂️ 🌊 ☀️ 🐚 🏖️
   - **Outer ring:** 6-7 emoji, slower rotation. Examples: 🦈 🧭 🐠 🌴 🐬 🦀 🌅
3. **Content phase:** Below the animation, "Quiver" wordmark and **"Gets better every session."** tagline fade in.
4. **CTA phase:** **"Get Started"** button slides up from bottom.

### Tech

- Framer Motion for all animations (already in the stack)
- CSS keyframes for orbit rotation (performant on mobile)
- Emoji rendered as text (no image assets needed)
- Full-screen layout with safe area padding for iOS notch/home indicator

### Returning Users

If the user is already authenticated (Supabase session exists), `/welcome` immediately redirects to `/` (dashboard). The splash is never shown.

---

## Auth Flow

### After "Get Started"

1. **Auth method screen** — three stacked buttons:
   - "Continue with Apple" (Apple logo)
   - "Continue with Google" (Google logo)
   - "Continue with Email" (envelope icon)
   - Small "Already have an account? Log in" link at bottom
2. **Email path:** Email input → password → verify (existing flow)
3. **OAuth path:** Native plugin (iOS) or Supabase redirect (web) → token exchange
4. **After auth:** Existing onboarding dialog (home beach, skill level, time slots) → dashboard

### Auth is Required

No skip option. No "Browse first." Every user must authenticate before entering the app.

---

## Apple Sign-In

### Prerequisites (Manual — Developer Portal)

1. Enable "Sign In with Apple" capability in Xcode project
2. Configure App ID in Apple Developer portal with Sign In with Apple
3. Create a Service ID for web-based Apple Sign-In
4. Configure Supabase Apple OAuth provider with the Service ID, Team ID, and Key ID
5. Generate and upload the private key (.p8) to Supabase

### Native iOS (Capacitor)

- Install `@capacitor-community/apple-sign-in` plugin
- On tap "Continue with Apple":
  1. Call native Apple Sign-In SDK → returns identity token
  2. Pass identity token to Supabase via `signInWithIdToken({ provider: 'apple', token })`
  3. Supabase creates/links the user account
  4. Session established → redirect to dashboard

### Web Fallback

- Uses Supabase built-in Apple OAuth: `signInWithOAuth({ provider: 'apple' })`
- Redirect flow, same pattern as existing Google OAuth
- Only needed if Apple Sign-In button is shown on web auth modal (future consideration)

---

## Routing & Capacitor Config

### Capacitor Changes

Update `capacitor.config.ts` and `capacitor.config.prod.ts`:
- Server URL stays the same (domain root)
- App entry point: add logic to redirect to `/welcome` when not authenticated on native

### Routing Logic

```
App opens (Capacitor)
  → Check auth state
    → Authenticated: load `/` (dashboard/HomeScreen)
    → Not authenticated: load `/welcome` (onboarding)
```

Option A: Capacitor config points to `/welcome`, which redirects to `/` if authed.
Option B: Capacitor config points to `/`, and `NativeAuthGuard` redirects to `/welcome` if not authed.

**Recommended: Option A** — load `/welcome` by default, redirect if authed. Avoids flash of dashboard content.

---

## What's NOT Changing

- Web landing page (hero, features, beach search) — untouched
- Existing `UnifiedAuthModal` — enhanced with Apple Sign-In button, not replaced
- Post-auth onboarding dialog (home beach, skill level, time slots) — untouched
- Dashboard/HomeScreen — untouched

---

## Implementation Order

1. **Apple Developer setup** (manual, prerequisite)
2. **Apple Sign-In — native iOS** (Capacitor plugin + Supabase `signInWithIdToken`)
3. **Apple Sign-In — auth modal** (add Apple button to existing `UnifiedAuthModal`)
4. **Welcome screen** (`/welcome` route with animation)
5. **Capacitor routing** (point native app to `/welcome`)
6. **Testing** (native iOS auth flow, animation performance, returning user redirect)
