"use client";

import { HeroSection } from "@/components/landing-page/hero-section";
import { Suspense, lazy, useState, useEffect } from "react";
import { PerformanceUtils } from "@/lib/utils/performance-utils";

// Lazy load heavy sections to improve LCP
const SocialFeedSection = lazy(() =>
  import("@/components/landing-page/social-feed-section").then((m) => ({
    default: m.SocialFeedSection,
  }))
);
const ForecastSection = lazy(() =>
  import("@/components/landing-page/forecast-section").then((m) => ({
    default: m.ForecastSection,
  }))
);
const FeaturesSection = lazy(() =>
  import("@/components/landing-page/features-section").then((m) => ({
    default: m.FeaturesSection,
  }))
);
const CTASection = lazy(() =>
  import("@/components/landing-page/cta-section").then((m) => ({
    default: m.CTASection,
  }))
);
const FooterSection = lazy(() =>
  import("@/components/landing-page/footer-section").then((m) => ({
    default: m.FooterSection,
  }))
);

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

// Progressive loading component with intersection observer
function ProgressiveSection({
  children,
  threshold = 0.1,
  rootMargin = "100px",
}: {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref) return;

    const observer = PerformanceUtils.createImageObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer?.unobserve(entry.target);
        }
      });
    });

    if (observer) {
      observer.observe(ref);
      return () => observer.disconnect();
    }
  }, [ref]);

  return <div ref={setRef}>{isVisible ? children : <SectionSkeleton />}</div>;
}

export default function LandingPage() {
  // Preload critical resources immediately
  useEffect(() => {
    PerformanceUtils.preloadCriticalResources();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Show hero section immediately - critical for LCP */}
      <HeroSection />

      {/* Progressive loading sections - reduces initial bundle size */}
      <div className="space-y-0">
        <ProgressiveSection>
          <Suspense fallback={<SectionSkeleton height="h-96" />}>
            <SocialFeedSection />
          </Suspense>
        </ProgressiveSection>

        <ProgressiveSection>
          <Suspense fallback={<SectionSkeleton height="h-80" />}>
            <ForecastSection />
          </Suspense>
        </ProgressiveSection>

        <ProgressiveSection>
          <Suspense fallback={<SectionSkeleton height="h-96" />}>
            <FeaturesSection />
          </Suspense>
        </ProgressiveSection>

        <ProgressiveSection>
          <Suspense fallback={<SectionSkeleton height="h-64" />}>
            <CTASection />
          </Suspense>
        </ProgressiveSection>

        <ProgressiveSection>
          <Suspense fallback={<SectionSkeleton height="h-48" />}>
            <FooterSection />
          </Suspense>
        </ProgressiveSection>
      </div>
    </div>
  );
}
