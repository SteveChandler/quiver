"use client";

import { useAuth } from "@/context/auth-context";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { isStandaloneApp } from "@/lib/isStandaloneApp";
import { AuthLoadingStates } from "@/lib/utils/loading-utils";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
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
 * Note: PopularBeachesSection and FooterSection are rendered in the server shell
 * to ensure beach links are always in the HTML for SEO purposes.
 */
export function AuthAwareLandingWrapper() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isConfirmEmailSignup, setIsConfirmEmailSignup] = useState(false);
  const redirectedRef = useRef(false);
  const didShowSignupToastRef = useRef(false);
  const [hasAuthCookie, setHasAuthCookie] = useState(false);

  // Parse query params after mount to avoid SSR/client rendering bailouts that can
  // lead to hydration mismatches.
  useEffect(() => {
    try {
      // eslint-disable-next-line no-restricted-properties -- Reading URL on mount, not for navigation
      const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
      const signupParam = url?.searchParams.get("signup") ?? null;
      setIsConfirmEmailSignup(signupParam === "confirm-email");
    } catch {
      setIsConfirmEmailSignup(false);
    }
  }, []);

  // Detect auth cookies after mount only, so SSR + first client render match (prevents hydration mismatch).
  useEffect(() => {
    try {
      // Supabase cookie looks like: sb-<projectRef>-auth-token.<n>=...
      setHasAuthCookie(/(?:^|;\\s*)sb-[^=]+-auth-token\\./.test(document.cookie));
    } catch {
      setHasAuthCookie(false);
    }
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
    if (!isConfirmEmailSignup) return;
    if (didShowSignupToastRef.current) return;

    didShowSignupToastRef.current = true;
    toast.success("Confirm your signup in your email", {
      description:
        "We sent you a confirmation link. Open your inbox to finish creating your account.",
    });

    // Remove the query param so refreshes don't re-toast.
    router.replace("/");
  }, [isConfirmEmailSignup, router]);

  // Initialize performance monitoring
  useEffect(() => {
    PerformanceUtils.trackWebVitals();
    PerformanceUtils.preloadCriticalResources();

    if (process.env.NODE_ENV === "development") {
      setTimeout(() => {
        PerformanceUtils.monitorMemoryUsage();
      }, 5000);
    }
  }, []);

  // Note: body.authenticated class management moved to AuthBodyClassManager in providers.tsx
  // This ensures the SSR beach section is hidden on ALL routes, not just the landing page

  // Hide SSR beach section when JS is loaded (client SurfHighlightsSection takes over)
  // This keeps the SSR version for SEO crawlers and no-JS fallback
  useEffect(() => {
    if (!user) {
      document.body.classList.add("js-loaded");
    }
    return () => {
      document.body.classList.remove("js-loaded");
    };
  }, [user]);

  // Show loading state while checking authentication
  // - Logged-in users: keep the checking state to avoid landing flicker.
  // - Logged-out users: render the landing immediately (faster FCP/LCP) while auth resolves.
  if (isLoading && hasAuthCookie && !(isConfirmEmailSignup && !user)) {
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
