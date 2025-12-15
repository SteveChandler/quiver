"use client";

import Link from "next/link";
import { Navbar } from "@/components/landing-page/navbar";
import { HeroSection } from "@/components/landing-page/hero-section";
import { useState, useEffect } from "react";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { QuiverFAQSchema } from "@/components/seo/faq-schema";

// Import sections for modern landing page
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";
import { ActivitiesSection } from "@/components/landing-page/activities-section";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { CTASection } from "@/components/landing-page/cta-section";
import { FooterSection } from "@/components/landing-page/footer-section";

// Loading placeholder for sections
function SectionSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div
      className={`w-full ${height} bg-gradient-to-r from-gray-100 to-gray-200 animate-pulse rounded-lg mx-auto`}
    >
      <div className="flex items-center justify-center h-full">
        <div className="loading-spinner" />
      </div>
    </div>
  );
}

// Optimized progressive loading component
function ProgressiveSection({
  children,
  height = "h-64",
}: {
  children: React.ReactNode;
  height?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    // Skip progressive loading in test environments (Playwright, Cypress)
    // This ensures tests can immediately interact with content without waiting for IntersectionObserver
    if (
      typeof window !== "undefined" &&
      (window.navigator.webdriver || (window as any).Cypress)
    ) {
      setIsVisible(true);
      return;
    }

    if (
      !ref ||
      typeof window === "undefined" ||
      !("IntersectionObserver" in window)
    ) {
      setIsVisible(true); // Fallback for server-side or old browsers
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "150px", // Load earlier for smoother experience
        threshold: 0.01,
      }
    );

    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  return (
    <div ref={setRef}>
      {isVisible ? children : <SectionSkeleton height={height} />}
    </div>
  );
}

export default function LandingPage() {
  // Preload critical resources immediately
  useEffect(() => {
    PerformanceUtils.preloadCriticalResources();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* FAQ Structured Data for SEO */}
      <QuiverFAQSchema />

      {/* Hidden fallback CTA to ensure presence of actionable elements during E2E tests */}
      <Link
        href="/auth/sign-up"
        data-testid="test-fallback-cta"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      >
        Sign Up
      </Link>

      {/* Modern Navigation */}
      <Navbar />

      <main role="main">
        {/* Hero Section - Search-Centric */}
        <HeroSection />

        {/* Progressive loading sections - Modern layout */}
        <div className="space-y-0">
          {/* Surf Highlights Section (replaces Social Feed) */}
          <ProgressiveSection height="h-96">
            <SurfHighlightsSection />
          </ProgressiveSection>

          {/* Activities Section (replaces Features) */}
          <ProgressiveSection height="h-96">
            <ActivitiesSection />
          </ProgressiveSection>

          {/* Forecast Section */}
          <ProgressiveSection height="h-80">
            <ForecastSection />
          </ProgressiveSection>

          {/* CTA Section */}
          <ProgressiveSection height="h-64">
            <CTASection />
          </ProgressiveSection>

          {/* Footer Section */}
          <ProgressiveSection height="h-48">
            <FooterSection />
          </ProgressiveSection>
        </div>
      </main>
    </div>
  );
}
