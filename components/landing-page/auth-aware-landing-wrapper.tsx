"use client";

import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";
import { AuthLoadingStates } from "@/lib/utils/loading-utils";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { HomeScreen } from "@/components/home-screen";
import { Navbar } from "@/components/landing-page/navbar";
import { HeroSection } from "@/components/landing-page/hero-section";
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";
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

  // Manage body class for authenticated state
  // This hides the SSR beach section (rendered in layout.tsx for SEO) when user is logged in
  useEffect(() => {
    if (user) {
      document.body.classList.add("authenticated");
    } else {
      document.body.classList.remove("authenticated");
    }
    return () => {
      document.body.classList.remove("authenticated");
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
  // Note: PopularBeachesSection is rendered separately in the shell (SSR)
  return (
    <>
      <Navbar />
      <HeroSection />

      {/* These sections have client-side interactivity */}
      <div className="space-y-0">
        <SurfHighlightsSection />
        <ActivitiesSection />
        <ForecastSection />
        <CTASection />
      </div>
    </>
  );
}
