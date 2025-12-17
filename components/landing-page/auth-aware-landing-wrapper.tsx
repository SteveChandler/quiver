"use client";

import { useAuth } from "@/context/auth-context";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isStandaloneApp } from "@/lib/isStandaloneApp";
import { AuthLoadingStates } from "@/lib/utils/loading-utils";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { HomeScreen } from "@/components/home-screen";
import { Navbar } from "@/components/landing-page/navbar";
import { HeroSection } from "@/components/landing-page/hero-section";
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";
import { UpgradeSessionSection } from "./upgrade-session-section";
import { ActivitiesSection } from "@/components/landing-page/activities-section";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { CTASection } from "@/components/landing-page/cta-section";

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
  const redirectedRef = useRef(false);

  // Redirect to sign-in in standalone/PWA mode immediately (don't wait for auth)
  useEffect(() => {
    if (redirectedRef.current) return;
    if (!isStandaloneApp()) return;
    if (user) return; // Already logged in, no redirect needed

    redirectedRef.current = true;
    router.replace("/auth/sign-in");
  }, [user, router]);

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
  if (isLoading) {
    return AuthLoadingStates.checking();
  }

  // Authenticated users see the HomeScreen
  if (user) {
    return <HomeScreen />;
  }

  // Unauthenticated users see the interactive landing page sections
  // Note: SSR PopularBeachesSection is also rendered in layout.tsx for SEO crawlers,
  // but hidden via CSS (body.js-loaded) when this client version is available.
  return (
    <>
      <Navbar />
      <main role="main">
        <HeroSection />

        {/* These sections have client-side interactivity */}
        <div className="space-y-0">
          <SurfHighlightsSection />
          <UpgradeSessionSection />
          <ActivitiesSection />
          <ForecastSection />
          <CTASection />
        </div>
      </main>
    </>
  );
}
