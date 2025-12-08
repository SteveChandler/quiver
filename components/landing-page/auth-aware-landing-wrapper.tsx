"use client";

import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";
import { AuthLoadingStates } from "@/lib/utils/loading-utils";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { HomeScreen } from "@/components/home-screen";
import { Navbar } from "@/components/landing-page/navbar";
import { HeroSection } from "@/components/landing-page/hero-section";
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

  // Note: body.authenticated class management moved to AuthBodyClassManager in providers.tsx
  // This ensures the SSR beach section is hidden on ALL routes, not just the landing page

  // Show loading state while checking authentication
  if (isLoading) {
    return AuthLoadingStates.checking();
  }

  // Authenticated users see the HomeScreen
  if (user) {
    return <HomeScreen />;
  }

  // Unauthenticated users see the interactive landing page sections
  // Note: PopularBeachesSection (beach highlights) is rendered in layout.tsx via LandingPageSSRSection
  // for SEO purposes. We don't render SurfHighlightsSection here to avoid duplication.
  return (
    <>
      <Navbar />
      <HeroSection />

      {/* These sections have client-side interactivity */}
      {/* Note: Beach highlights ("Discover epic surf spots") are handled by SSR PopularBeachesSection */}
      <div className="space-y-0">
        <ActivitiesSection />
        <ForecastSection />
        <CTASection />
      </div>
    </>
  );
}
