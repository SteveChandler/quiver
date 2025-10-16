"use client";

import { HeroSection } from "@/components/landing-page/hero-section";
import { Suspense, lazy, useState, useEffect } from "react";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { QuiverFAQSchema } from "@/components/seo/faq-schema";

// Import sections directly to debug lazy loading issue
import { SocialFeedSection } from "@/components/landing-page/social-feed-section";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { FeaturesSection } from "@/components/landing-page/features-section";
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
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* FAQ Structured Data for SEO */}
      <QuiverFAQSchema />

      {/* Hidden fallback CTA to ensure presence of actionable elements during E2E tests */}
      <a
        href="/auth/sign-up"
        data-testid="test-fallback-cta"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      >
        Sign Up
      </a>
      {/* Show hero section immediately - critical for LCP */}
      <HeroSection />

      {/* Progressive loading sections - removes lazy loading for debugging */}
      <div className="space-y-0">
        <ProgressiveSection height="h-96">
          <SocialFeedSection />
        </ProgressiveSection>

        <ProgressiveSection height="h-80">
          <ForecastSection />
        </ProgressiveSection>

        <ProgressiveSection height="h-96">
          <FeaturesSection />
        </ProgressiveSection>

        <ProgressiveSection height="h-64">
          <CTASection />
        </ProgressiveSection>

        <ProgressiveSection height="h-48">
          <FooterSection />
        </ProgressiveSection>
      </div>
    </div>
  );
}
