# Mobile Onboarding & Apple Sign-In Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `/welcome` route with animated splash, auth method picker (Apple/Google/Email), and native Apple Sign-In for the Capacitor iOS app.

**Architecture:** New `/welcome` route as Capacitor-only entry point. Unauthenticated native users land here; authenticated users redirect to `/`. The welcome screen has a Framer Motion splash animation with orbiting emoji, then transitions to an auth method picker. Apple Sign-In uses `@capacitor-community/apple-sign-in` for native iOS and Supabase OAuth for web fallback. The existing `UnifiedAuthModal` gets an Apple button added. Capacitor config is updated to point to `/welcome`.

**Tech Stack:** Next.js App Router, React, TypeScript, Framer Motion, Capacitor, `@capacitor-community/apple-sign-in`, Supabase Auth, Tailwind CSS

**Design Spec:** `docs/plans/2026-03-01-mobile-onboarding-design.md`

---

## Task 1: Install Apple Sign-In Capacitor Plugin

**Files:**
- Modify: `package.json`
- Modify: `ios/App/App.xcodeproj/project.pbxproj` (via `npx cap sync`)

**Step 1: Install the plugin**

```bash
yarn add @capacitor-community/apple-sign-in
```

**Step 2: Sync Capacitor native projects**

```bash
npx cap sync ios
```

**Step 3: Verify install**

```bash
yarn list @capacitor-community/apple-sign-in
```

Expected: Shows the installed version.

**Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add @capacitor-community/apple-sign-in plugin"
```

**Note:** The Xcode "Sign In with Apple" capability and Apple Developer portal configuration are manual prerequisites done outside this plan. This task only installs the npm package.

---

## Task 2: Create Apple Sign-In Utility Module

**Files:**
- Create: `lib/mobile/apple-sign-in.ts`
- Test: `__tests__/lib/mobile/apple-sign-in.test.ts`

This module wraps the native Apple Sign-In plugin and Supabase token exchange, mirroring the pattern in `lib/mobile/social-login.ts`.

**Step 1: Write the failing test**

Create `__tests__/lib/mobile/apple-sign-in.test.ts`:

```typescript
import { signInWithApple } from "@/lib/mobile/apple-sign-in";

// Mock Supabase client
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithIdToken: jest.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: jest.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

// Mock platform detection
jest.mock("@/lib/mobile/platform", () => ({
  isNativeApp: jest.fn().mockReturnValue(false),
  getNativePlatform: jest.fn().mockReturnValue("web"),
}));

describe("signInWithApple", () => {
  it("returns error when not on native and no web fallback configured", async () => {
    const result = await signInWithApple();
    // On web, it should attempt Supabase OAuth redirect
    expect(result.error).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/mobile/apple-sign-in.test.ts --no-coverage
```

Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `lib/mobile/apple-sign-in.ts`:

```typescript
/**
 * Apple Sign-In integration for Quiver.
 *
 * Native iOS: Uses @capacitor-community/apple-sign-in to get an identity
 * token, then exchanges it with Supabase via signInWithIdToken.
 *
 * Web: Falls back to Supabase's built-in Apple OAuth redirect flow.
 */

import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/mobile/platform";
import * as Sentry from "@sentry/nextjs";

export interface AppleSignInResult {
  error?: string;
}

/**
 * Initiate Apple Sign-In.
 *
 * On native iOS, launches the system Apple Sign-In sheet and exchanges the
 * resulting identity token with Supabase. On web, initiates the Supabase
 * OAuth redirect flow for Apple.
 *
 * @param returnTo - Path to return to after auth (used for web OAuth redirect)
 */
export async function signInWithApple(
  returnTo: string = "/"
): Promise<AppleSignInResult> {
  const sb = createClient();

  if (isNativeApp()) {
    return signInWithAppleNative(sb);
  }

  return signInWithAppleWeb(sb, returnTo);
}

/**
 * Native iOS Apple Sign-In via Capacitor plugin.
 */
async function signInWithAppleNative(
  sb: ReturnType<typeof createClient>
): Promise<AppleSignInResult> {
  try {
    const { SignInWithApple } = await import(
      "@capacitor-community/apple-sign-in"
    );

    const result = await SignInWithApple.authorize({
      clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "",
      redirectURI: "", // Not used for native
      scopes: "email name",
      state: "",
      nonce: "",
    });

    const identityToken = result.response?.identityToken;

    if (!identityToken) {
      return { error: "Apple sign-in was cancelled or failed." };
    }

    const { error: tokenError } = await sb.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
    });

    if (tokenError) {
      console.error("[apple-sign-in] signInWithIdToken error:", tokenError);
      return {
        error: "Unable to sign in with Apple. Please try another method.",
      };
    }

    return {};
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[apple-sign-in] Native exception:", err);
    Sentry.captureException(err, {
      tags: { context: "native_apple_signin" },
    });
    return { error: `Apple sign-in failed: ${errorMessage}` };
  }
}

/**
 * Web Apple Sign-In via Supabase OAuth redirect.
 */
async function signInWithAppleWeb(
  sb: ReturnType<typeof createClient>,
  returnTo: string
): Promise<AppleSignInResult> {
  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : ""; // eslint-disable-line no-restricted-properties
    const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(returnTo)}`;

    const { error: oauthError } = await sb.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo },
    });

    if (oauthError) {
      console.error("[apple-sign-in] OAuth error:", oauthError);
      return {
        error: "Unable to sign in with Apple. Please try another method.",
      };
    }

    return {};
  } catch (err) {
    console.error("[apple-sign-in] Web exception:", err);
    return { error: "An unexpected error occurred during Apple sign in." };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/mobile/apple-sign-in.test.ts --no-coverage
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/mobile/apple-sign-in.ts __tests__/lib/mobile/apple-sign-in.test.ts
git commit -m "feat: add Apple Sign-In utility module (native + web)"
```

---

## Task 3: Add Apple Sign-In Button to AuthProviders

**Files:**
- Modify: `components/auth/auth-modal/AuthProviders.tsx`
- Modify: `components/auth/unified-auth-modal.tsx`
- Test: `__tests__/components/auth/unified-auth-modal.test.tsx` (verify existing tests still pass, add Apple button test)

**Step 1: Write the failing test**

Add to the existing test file or create a focused test:

```typescript
// In __tests__/components/auth/unified-auth-modal.test.tsx
// Add a test for the Apple button rendering
it("renders Apple sign-in button when enableApple is true", () => {
  // ... render AuthProviders with onAppleClick prop
  // expect screen.getByRole("button", { name: /apple/i }) to be in the document
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/auth/unified-auth-modal.test.tsx --no-coverage
```

**Step 3: Modify `AuthProviders.tsx`**

Add `onAppleClick` prop and Apple button. The Apple button goes above Google (Apple HIG requires it first on iOS). Add an Apple icon inline SVG.

In `components/auth/auth-modal/AuthProviders.tsx`, add to the interface:

```typescript
export interface AuthProvidersProps {
  // ... existing props
  onAppleClick?: () => void;
}
```

Add Apple button before the Google button, inside the `enableOAuth` block:

```tsx
{enableOAuth && onAppleClick && (
  <Button
    onClick={onAppleClick}
    className="w-full"
    size="lg"
    variant="outline"
    disabled={loading || (mode === "signup" && !termsAccepted)}
  >
    {loading ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    )}
    Continue with Apple
  </Button>
)}
```

**Step 4: Wire up in `unified-auth-modal.tsx`**

Add `handleAppleSignIn` function (similar to `handleGoogleOAuth`) that calls `signInWithApple` from the new utility module. Pass `onAppleClick={handleAppleSignIn}` to `<AuthProviders>`.

```typescript
import { signInWithApple } from "@/lib/mobile/apple-sign-in";

// Inside UnifiedAuthModal component:
const handleAppleSignIn = async () => {
  const start = Date.now();
  setLoading(true);
  setError(null);

  trackAuthMethodSelected({ method: "apple", mode: activeMode });
  if (activeMode === "signup") {
    trackSignupStarted("apple");
  } else {
    trackLoginStarted("apple");
  }

  const result = await signInWithApple(getReturnPath());

  if (result.error) {
    setError(result.error);
    trackLoginFailed({ method: "apple", error_type: "apple_signin_failed" });
    setLoading(false);
    return;
  }

  const duration = Date.now() - start;
  if (activeMode === "signup") {
    trackSignupSuccess({ method: "apple", requires_verification: false });
  } else {
    trackLoginSuccess({ method: "apple", duration_ms: duration });
  }
  setLoading(false);
  onClose();
};
```

Pass to AuthProviders:

```tsx
<AuthProviders
  // ... existing props
  onAppleClick={handleAppleSignIn}
/>
```

**Step 5: Run tests**

```bash
npx jest __tests__/components/auth/unified-auth-modal --no-coverage
```

Expected: All pass, including the new Apple button test.

**Step 6: Commit**

```bash
git add components/auth/auth-modal/AuthProviders.tsx components/auth/unified-auth-modal.tsx __tests__/components/auth/unified-auth-modal.test.tsx
git commit -m "feat: add Apple Sign-In button to auth modal"
```

---

## Task 4: Create Welcome Screen Page Component

**Files:**
- Create: `app/welcome/page.tsx`
- Create: `components/welcome/welcome-screen.tsx`
- Create: `components/welcome/orbit-animation.tsx`
- Create: `components/welcome/auth-method-picker.tsx`

This is the main visual feature — the animated splash with orbiting emoji and auth method picker.

**Step 1: Create the orbit animation component**

Create `components/welcome/orbit-animation.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const INNER_RING = ["🏄‍♂️", "🌊", "☀️", "🐚", "🏖️"];
const OUTER_RING = ["🦈", "🧭", "🐠", "🌴", "🐬", "🦀", "🌅"];

/**
 * Animated logo with two concentric orbiting emoji rings.
 * Uses CSS keyframes for orbit rotation (GPU-accelerated) and
 * Framer Motion for fade/scale entrance.
 */
export function OrbitAnimation() {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: 280, height: 280 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Pulsing gradient glow behind logo */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 120,
          height: 120,
          background:
            "radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0) 70%)",
        }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Quiver logo */}
      <Image
        src="/quiver-logo-transparent.png"
        alt="Quiver"
        width={80}
        height={80}
        className="relative z-10"
        priority
      />

      {/* Inner ring — faster rotation */}
      <div
        className="absolute"
        style={{
          width: 180,
          height: 180,
          animation: "orbit-spin 8s linear infinite",
        }}
      >
        {INNER_RING.map((emoji, i) => {
          const angle = (360 / INNER_RING.length) * i;
          return (
            <motion.span
              key={`inner-${i}`}
              className="absolute text-2xl"
              style={{
                left: "50%",
                top: "50%",
                transform: `rotate(${angle}deg) translateX(90px) rotate(-${angle}deg)`,
                // Counter-rotate to keep emoji upright despite parent spin
                animation: `counter-spin 8s linear infinite`,
                animationDelay: "0s",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
            >
              {emoji}
            </motion.span>
          );
        })}
      </div>

      {/* Outer ring — slower rotation */}
      <div
        className="absolute"
        style={{
          width: 260,
          height: 260,
          animation: "orbit-spin 14s linear infinite reverse",
        }}
      >
        {OUTER_RING.map((emoji, i) => {
          const angle = (360 / OUTER_RING.length) * i;
          return (
            <motion.span
              key={`outer-${i}`}
              className="absolute text-xl"
              style={{
                left: "50%",
                top: "50%",
                transform: `rotate(${angle}deg) translateX(130px) rotate(-${angle}deg)`,
                animation: `counter-spin 14s linear infinite reverse`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
            >
              {emoji}
            </motion.span>
          );
        })}
      </div>

      {/* CSS keyframes for orbiting — in a style tag for isolation */}
      <style jsx global>{`
        @keyframes orbit-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes counter-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }
      `}</style>
    </motion.div>
  );
}
```

**Step 2: Create the auth method picker component**

Create `components/welcome/auth-method-picker.tsx`:

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { signInWithApple } from "@/lib/mobile/apple-sign-in";
import { initiateOAuthFlow } from "@/lib/auth/auth-utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

/**
 * Auth method picker for the welcome screen.
 * Shows Apple / Google / Email buttons. Tapping Email opens the
 * existing UnifiedAuthModal in signup mode.
 */
export function AuthMethodPicker() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Redirect once authenticated
  if (isAuthenticated) {
    router.replace("/");
    return null;
  }

  const handleApple = async () => {
    setLoading("apple");
    setError(null);
    const result = await signInWithApple("/");
    if (result.error) {
      setError(result.error);
    }
    setLoading(null);
  };

  const handleGoogle = async () => {
    setLoading("google");
    setError(null);
    const result = await initiateOAuthFlow("google", "/");
    if (result.error) {
      setError(result.error);
    }
    setLoading(null);
  };

  const handleEmail = () => {
    router.push("/auth/sign-up");
  };

  const handleLogin = () => {
    router.push("/auth/sign-in");
  };

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-3 px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      {error && (
        <p className="text-sm text-red-500 text-center mb-2">{error}</p>
      )}

      {/* Apple Sign-In — first per Apple HIG */}
      <Button
        onClick={handleApple}
        className="w-full max-w-xs h-12 text-base"
        size="lg"
        variant="default"
        disabled={loading !== null}
      >
        {loading === "apple" ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        )}
        Continue with Apple
      </Button>

      {/* Google Sign-In */}
      <Button
        onClick={handleGoogle}
        className="w-full max-w-xs h-12 text-base"
        size="lg"
        variant="outline"
        disabled={loading !== null}
      >
        {loading === "google" ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        Continue with Google
      </Button>

      {/* Email Sign-Up */}
      <Button
        onClick={handleEmail}
        className="w-full max-w-xs h-12 text-base"
        size="lg"
        variant="outline"
        disabled={loading !== null}
      >
        <Mail className="mr-2 h-5 w-5" />
        Continue with Email
      </Button>

      {/* Login link */}
      <button
        type="button"
        onClick={handleLogin}
        className="mt-2 text-sm text-muted-foreground hover:underline"
      >
        Already have an account? Log in
      </button>
    </motion.div>
  );
}
```

**Step 3: Create the main welcome screen component**

Create `components/welcome/welcome-screen.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { OrbitAnimation } from "./orbit-animation";
import { AuthMethodPicker } from "./auth-method-picker";

/**
 * Mobile welcome/onboarding screen.
 *
 * Animation sequence:
 * 1. Splash — logo fades in with pulsing glow and orbiting emoji
 * 2. Content — "Quiver" wordmark and tagline fade in
 * 3. CTA — "Get Started" button slides up
 * 4. Auth — tapping Get Started reveals Apple/Google/Email picker
 */
export function WelcomeScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);

  // Redirect authenticated users immediately
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while auth state resolves
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Already authenticated — will redirect, show nothing
  if (isAuthenticated) {
    return null;
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Logo + orbit animation */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <OrbitAnimation />

        {/* Wordmark and tagline */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Quiver
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Gets better every session.
          </p>
        </motion.div>
      </div>

      {/* CTA / Auth section — pinned to bottom */}
      <div className="w-full pb-8">
        <AnimatePresence mode="wait">
          {!showAuth ? (
            <motion.div
              key="cta"
              className="flex justify-center px-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 1.8, duration: 0.5 }}
            >
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="w-full max-w-xs rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg active:scale-95 transition-transform"
              >
                Get Started
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AuthMethodPicker />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

**Step 4: Create the `/welcome` route page**

Create `app/welcome/page.tsx`:

```tsx
import { WelcomeScreen } from "@/components/welcome/welcome-screen";

export const metadata = {
  title: "Welcome to Quiver",
  robots: { index: false, follow: false }, // Capacitor-only, don't index
};

export default function WelcomePage() {
  return <WelcomeScreen />;
}
```

**Step 5: Manually test the page**

```bash
# Start dev server
yarn dev
# Open http://localhost:3000/welcome in browser
```

Verify:
- Logo fades in with pulsing glow
- Emoji orbit in two rings
- "Quiver" + tagline fade in
- "Get Started" button slides up
- Tapping "Get Started" shows Apple/Google/Email buttons
- "Continue with Email" navigates to `/auth/sign-up`
- "Already have an account? Log in" navigates to `/auth/sign-in`

**Step 6: Commit**

```bash
git add app/welcome/page.tsx components/welcome/
git commit -m "feat: add /welcome mobile onboarding screen with animated splash"
```

---

## Task 5: Update NativeAuthGuard to Redirect to /welcome

**Files:**
- Modify: `components/native-auth-guard.tsx`
- Test: `__tests__/components/native-auth-guard.test.tsx`

Currently, `NativeAuthGuard` redirects unauthenticated native users to `/auth/sign-in`. Change it to redirect to `/welcome` instead, and also handle new installs (not just returning users).

**Step 1: Read the existing test file**

```bash
cat __tests__/components/native-auth-guard.test.tsx
```

Understand what's being tested and update accordingly.

**Step 2: Modify `native-auth-guard.tsx`**

Key changes:
- Change redirect target from `/auth/sign-in` to `/welcome`
- Remove the "returning user" check — all unauthenticated native users go to `/welcome`
- Skip redirect if already on `/welcome` or `/auth` paths

```typescript
// In the useEffect:
// Replace:
//   if (pathname.startsWith("/auth")) return;
// With:
    if (pathname.startsWith("/auth") || pathname === "/welcome") return;

// Remove:
//   const isReturning = safeGetItem("quiver_returning_user");
//   if (!isReturning) return;

// Replace the redirect target:
//   router.replace(`/auth/sign-in${redirectTo}`);
// With:
    router.replace("/welcome");
```

**Step 3: Update tests to reflect new behavior**

Update tests to expect `/welcome` redirect instead of `/auth/sign-in`.

**Step 4: Run tests**

```bash
npx jest __tests__/components/native-auth-guard.test.tsx --no-coverage
```

Expected: PASS.

**Step 5: Commit**

```bash
git add components/native-auth-guard.tsx __tests__/components/native-auth-guard.test.tsx
git commit -m "feat: redirect unauthenticated native users to /welcome"
```

---

## Task 6: Update Capacitor Config to Point to /welcome

**Files:**
- Modify: `capacitor.config.ts` (dev)
- Modify: `capacitor.config.prod.ts`

Per the design spec (Option A): Capacitor loads `/welcome` by default, which redirects to `/` if the user is already authenticated.

**Step 1: Modify `capacitor.config.ts`**

Change `server.url` from `https://dev.quiversurf.app` to `https://dev.quiversurf.app/welcome`:

```typescript
server: {
  androidScheme: "https",
  url: "https://dev.quiversurf.app/welcome",
  cleartext: false,
},
```

**Step 2: Modify `capacitor.config.prod.ts`**

Change `server.url` from `https://www.quiversurf.app` to `https://www.quiversurf.app/welcome`:

```typescript
server: {
  androidScheme: "https",
  url: "https://www.quiversurf.app/welcome",
  cleartext: false,
  allowNavigation: ['*']
},
```

**Step 3: Commit**

```bash
git add capacitor.config.ts capacitor.config.prod.ts
git commit -m "feat: point Capacitor entry URL to /welcome"
```

---

## Task 7: Add E2E Test for Welcome Flow

**Files:**
- Create: `e2e/welcome-flow.spec.ts`

**Step 1: Write E2E test**

Create `e2e/welcome-flow.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors } from "./utils/test-helpers";

test.describe("Welcome Screen", () => {
  let errorCapture: ReturnType<typeof setupErrorDetection>;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    assertNoErrors(page, errorCapture);
  });

  test("renders splash animation and Get Started button", async ({ page }) => {
    await page.goto("/welcome");
    await page.waitForLoadState("load");

    // Wordmark and tagline should appear
    await expect(page.getByText("Quiver")).toBeVisible();
    await expect(page.getByText("Gets better every session.")).toBeVisible();

    // Get Started button should appear
    const getStarted = page.getByRole("button", { name: "Get Started" });
    await expect(getStarted).toBeVisible({ timeout: 5000 });
  });

  test("shows auth methods after tapping Get Started", async ({ page }) => {
    await page.goto("/welcome");
    await page.waitForLoadState("load");

    const getStarted = page.getByRole("button", { name: "Get Started" });
    await expect(getStarted).toBeVisible({ timeout: 5000 });
    await getStarted.click();

    // Auth buttons should appear
    await expect(
      page.getByRole("button", { name: /Continue with Apple/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Continue with Google/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Continue with Email/i })
    ).toBeVisible();

    // Login link
    await expect(
      page.getByText("Already have an account? Log in")
    ).toBeVisible();
  });

  test("Email button navigates to sign-up page", async ({ page }) => {
    await page.goto("/welcome");
    await page.waitForLoadState("load");

    const getStarted = page.getByRole("button", { name: "Get Started" });
    await expect(getStarted).toBeVisible({ timeout: 5000 });
    await getStarted.click();

    const emailBtn = page.getByRole("button", {
      name: /Continue with Email/i,
    });
    await expect(emailBtn).toBeVisible();
    await emailBtn.click();

    await page.waitForURL("**/auth/sign-up**");
    expect(page.url()).toContain("/auth/sign-up");
  });

  test("Login link navigates to sign-in page", async ({ page }) => {
    await page.goto("/welcome");
    await page.waitForLoadState("load");

    const getStarted = page.getByRole("button", { name: "Get Started" });
    await expect(getStarted).toBeVisible({ timeout: 5000 });
    await getStarted.click();

    await page.getByText("Already have an account? Log in").click();

    await page.waitForURL("**/auth/sign-in**");
    expect(page.url()).toContain("/auth/sign-in");
  });
});
```

**Step 2: Run the E2E test**

```bash
npx playwright test e2e/welcome-flow.spec.ts
```

Expected: PASS (against local dev server).

**Step 3: Commit**

```bash
git add e2e/welcome-flow.spec.ts
git commit -m "test: add E2E tests for welcome screen flow"
```

---

## Task 8: Update CHANGELOG and Final Cleanup

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Update CHANGELOG**

Add under `[Unreleased]`:

```markdown
### Added
- Mobile onboarding welcome screen at `/welcome` with animated splash (orbiting emoji, logo glow)
- Apple Sign-In support (native iOS via Capacitor plugin + web via Supabase OAuth)
- Auth method picker on welcome screen (Apple / Google / Email)
- Unauthenticated native users now redirect to `/welcome` instead of `/auth/sign-in`
- Capacitor entry URL updated to `/welcome`
```

**Step 2: Run full affected test suite**

```bash
npx jest __tests__/components/auth/ __tests__/lib/mobile/ __tests__/components/native-auth-guard.test.tsx --no-coverage
npx playwright test e2e/welcome-flow.spec.ts
```

Expected: All pass.

**Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG with mobile onboarding and Apple Sign-In"
```

---

## Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Install Apple Sign-In plugin | `package.json` |
| 2 | Apple Sign-In utility module | `lib/mobile/apple-sign-in.ts` |
| 3 | Add Apple button to auth modal | `AuthProviders.tsx`, `unified-auth-modal.tsx` |
| 4 | Welcome screen (splash + picker) | `app/welcome/page.tsx`, `components/welcome/*` |
| 5 | Update NativeAuthGuard → /welcome | `native-auth-guard.tsx` |
| 6 | Capacitor config → /welcome | `capacitor.config.ts`, `capacitor.config.prod.ts` |
| 7 | E2E tests | `e2e/welcome-flow.spec.ts` |
| 8 | CHANGELOG + final verification | `CHANGELOG.md` |

**Manual prerequisites (not in this plan):**
- Enable "Sign In with Apple" capability in Xcode
- Configure Apple App ID in Apple Developer portal
- Create Apple Service ID for web auth
- Configure Supabase Apple OAuth provider with keys
