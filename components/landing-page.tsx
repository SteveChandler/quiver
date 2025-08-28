"use client";

import { HeroSection } from "@/components/landing-page/hero-section";
import { Suspense, lazy, useState, useEffect } from "react";
import { PerformanceUtils } from "@/lib/utils/performance-utils";

// Aggressively lazy load non-critical sections to reduce initial bundle
const SocialFeedSection = lazy(() => 
  import("@/components/landing-page/social-feed-section").then(mod => ({ default: mod.SocialFeedSection }))
);
const ForecastSection = lazy(() => 
  import("@/components/landing-page/forecast-section").then(mod => ({ default: mod.ForecastSection }))
);
const FeaturesSection = lazy(() => 
  import("@/components/landing-page/features-section").then(mod => ({ default: mod.FeaturesSection }))
);
const CTASection = lazy(() => 
  import("@/components/landing-page/cta-section").then(mod => ({ default: mod.CTASection }))
);
const FooterSection = lazy(() => 
  import("@/components/landing-page/footer-section").then(mod => ({ default: mod.FooterSection }))
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

// Optimized progressive loading component
function ProgressiveSection({
  children,
  height = "h-64"
}: {
  children: React.ReactNode;
  height?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref || typeof window === "undefined" || !("IntersectionObserver" in window)) {
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
        threshold: 0.01 
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
      {/* Show hero section immediately - critical for LCP */}
      <HeroSection />

      {/* Progressive loading sections - reduces initial bundle size */}
      <div className="space-y-0">
        <ProgressiveSection height="h-96">
          <Suspense fallback={<SectionSkeleton height="h-96" />}>
            <SocialFeedSection />
          </Suspense>
        </ProgressiveSection>

        <ProgressiveSection height="h-80">
          <Suspense fallback={<SectionSkeleton height="h-80" />}>
            <ForecastSection />
          </Suspense>
        </ProgressiveSection>

        <ProgressiveSection height="h-96">
          <Suspense fallback={<SectionSkeleton height="h-96" />}>
            <FeaturesSection />
          </Suspense>
        </ProgressiveSection>

        <ProgressiveSection height="h-64">
          <Suspense fallback={<SectionSkeleton height="h-64" />}>
            <CTASection />
          </Suspense>
        </ProgressiveSection>

        <ProgressiveSection height="h-48">
          <Suspense fallback={<SectionSkeleton height="h-48" />}>
            <FooterSection />
          </Suspense>
        </ProgressiveSection>
      </div>
    </div>
  );
}
