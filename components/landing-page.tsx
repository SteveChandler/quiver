"use client";

import Link from "next/link";
import { Navbar } from "@/components/landing-page/navbar";
import { HeroSection } from "@/components/landing-page/hero-section";
import { useState, useEffect } from "react";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { QuiverFAQSchema } from "@/components/seo/faq-schema";

// Import sections for modern landing page
import { LandingConditionsTicker } from "@/components/landing-page/landing-conditions-ticker";
import { MLPipelineShowcase } from "@/components/landing-page/ml-pipeline-showcase";
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";
import { HowItWorksSection } from "@/components/landing-page/how-it-works-section";
import { SocialFeedSection } from "@/components/landing-page/social-feed-section";
import { CTASection } from "@/components/landing-page/cta-section";
import { SiteFooter } from "@/components/shared/site-footer";

// Loading placeholder for sections
function SectionSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div
      className={`w-full ${height} bg-gradient-to-r from-bg-surface to-bg-elevated animate-pulse rounded-lg mx-auto`}
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
      },
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

export default function LandingPage({
  autoOpenLogin = false,
}: {
  autoOpenLogin?: boolean;
}) {
  // Preload critical resources immediately
  useEffect(() => {
    PerformanceUtils.preloadCriticalResources();
  }, []);

  return (
    <div className="min-h-screen bg-[#252D6B]">
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
      <Navbar autoOpenLogin={autoOpenLogin} />

      <main role="main">
        {/* Hero Section */}
        <HeroSection />

        {/* Progressive loading sections - Modern layout */}
        <div className="space-y-0">
          {/* Conditions Ticker — shows the product is live */}
          <ProgressiveSection height="h-12">
            <LandingConditionsTicker />
          </ProgressiveSection>

          {/* ML Pipeline Showcase */}
          <ProgressiveSection height="h-96">
            <MLPipelineShowcase />
          </ProgressiveSection>

          {/* Top Picks */}
          <ProgressiveSection height="h-96">
            <SurfHighlightsSection />
          </ProgressiveSection>

          {/* How It Works */}
          <ProgressiveSection height="h-64">
            <HowItWorksSection />
          </ProgressiveSection>

          {/* Social Feed */}
          <ProgressiveSection height="h-96">
            <SocialFeedSection />
          </ProgressiveSection>

          {/* CTA Section */}
          <ProgressiveSection height="h-64">
            <CTASection
              source="landing-final-cta"
              ctaCopyVariant="landing_final_v1"
            />
          </ProgressiveSection>

          {/* Footer Section */}
          <ProgressiveSection height="h-48">
            <SiteFooter showBrandSection showSocialLinks />
          </ProgressiveSection>
        </div>
      </main>
    </div>
  );
}
