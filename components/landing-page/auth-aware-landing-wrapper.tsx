"use client";

import { useAuth } from "@/context/auth-context";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { isStandaloneApp } from "@/lib/isStandaloneApp";
import { AuthLoadingStates } from "@/lib/utils/loading-utils";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { hasSupabaseAuthCookie } from "@/lib/utils/supabase-cookie-utils";
import { BODY_CLASSES, PERFORMANCE_TIMING } from "@/lib/constants/css-classes";
import { Navbar } from "@/components/landing-page/navbar";
import { HeroSection } from "@/components/landing-page/hero-section";
import { LandingInteractiveSections } from "@/components/landing-page/landing-interactive-sections";
import { toast } from "sonner";

const HomeScreenDynamic = dynamic(
  () => import("@/components/home-screen").then((m) => m.HomeScreen),
  {
    ssr: false,
    loading: () => AuthLoadingStates.checking(),
  }
);

/**
 * AuthAwareLandingWrapper Component
 *
 * A client component that handles authentication-based routing within the SSR shell.
 *
 * Behavior:
 * - Loading state: Shows auth loading spinner while checking authentication
 * - Authenticated: Renders the full HomeScreen dashboard
 * - Unauthenticated: Renders interactive landing page sections
 *
 * Special Cases:
 * - Signup Confirmation (`?signup=confirm-email`): Bypasses auth loading screen
 *   to show landing page with success toast, even while auth is initializing.
 *   This improves UX by providing immediate feedback after signup.
 * - Standalone/PWA Mode: Redirects to `/auth/sign-in` immediately unless showing
 *   signup confirmation, preventing unauthenticated access to PWA shell.
 *
 * Progressive Enhancement:
 * - Manages `js-loaded` body class to hide SSR beach section when client renders
 * - SSR beach section remains for SEO crawlers and no-JS fallback
 * - `authenticated` body class is managed globally by AuthBodyClassManager
 *
 * Note: PopularBeachesSection and FooterSection are rendered in the server shell
 * to ensure beach links are always in the HTML for SEO purposes.
 */
export function AuthAwareLandingWrapper() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedRef = useRef(false);
  const didShowSignupToastRef = useRef(false);
  const [hasAuthCookie, setHasAuthCookie] = useState(false);

  // Reactive: updates when URL parameters change via soft navigation
  const isConfirmEmailSignup = searchParams.get("signup") === "confirm-email";

  // Detect auth cookies after mount only, so SSR + first client render match (prevents hydration mismatch).
  useEffect(() => {
    setHasAuthCookie(hasSupabaseAuthCookie());
  }, []);

  // Redirect to sign-in in standalone/PWA mode immediately (don't wait for auth)
  useEffect(() => {
    if (redirectedRef.current) return;
    if (!isStandaloneApp()) return;
    // Allow users who just signed up to see the confirmation message.
    if (isConfirmEmailSignup) return;
    if (user) return; // Already logged in, no redirect needed

    redirectedRef.current = true;
    router.replace("/auth/sign-in");
  }, [user, router, isConfirmEmailSignup]);

  // Show post-signup confirm-email toast on landing, then clean the URL.
  useEffect(() => {
    if (searchParams.get("signup") !== "confirm-email") return;
    if (didShowSignupToastRef.current) return;

    didShowSignupToastRef.current = true;
    toast.success("Confirm your signup in your email", {
      description:
        "We sent you a confirmation link. Open your inbox to finish creating your account.",
    });

    // Remove the signup param while preserving other query params (e.g., UTM tracking)
    const params = new URLSearchParams(searchParams.toString());
    params.delete("signup");
    const cleanUrl = params.toString() ? `/?${params.toString()}` : "/";
    router.replace(cleanUrl);
  }, [searchParams, router]);

  // Initialize performance monitoring
  useEffect(() => {
    PerformanceUtils.trackWebVitals();
    PerformanceUtils.preloadCriticalResources();

    if (process.env.NODE_ENV === "development") {
      setTimeout(() => {
        PerformanceUtils.monitorMemoryUsage();
      }, PERFORMANCE_TIMING.MEMORY_MONITOR_DELAY_MS);
    }
  }, []);

  // Note: body.authenticated class management moved to AuthBodyClassManager in providers.tsx
  // This ensures the SSR beach section is hidden on ALL routes, not just the landing page

  // Hide SSR beach section when JS is loaded (client SurfHighlightsSection takes over)
  // This keeps the SSR version for SEO crawlers and no-JS fallback
  useEffect(() => {
    if (!user) {
      document.body.classList.add(BODY_CLASSES.JS_LOADED);
    }
    return () => {
      document.body.classList.remove(BODY_CLASSES.JS_LOADED);
    };
  }, [user]);

  // Show loading for authenticated users while auth resolves, but skip for signup confirmation
  const shouldShowAuthLoading =
    isLoading && hasAuthCookie && !(isConfirmEmailSignup && !user);

  if (shouldShowAuthLoading) {
    return AuthLoadingStates.checking();
  }

  // Authenticated users see the HomeScreen
  if (user) {
    return <HomeScreenDynamic />;
  }

  // Unauthenticated users see the interactive landing page sections
  // Note: SSR PopularBeachesSection is also rendered in layout.tsx for SEO crawlers,
  // but hidden via CSS (body.js-loaded) when this client version is available.
  return (
    <>
      <Navbar />
      <main role="main">
        <HeroSection />

        <LandingInteractiveSections />
      </main>
    </>
  );
}
