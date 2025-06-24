"use client";

import { HeroSection } from "@/components/landing-page/hero-section";
import { SocialFeedSection } from "@/components/landing-page/social-feed-section";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { FeaturesSection } from "@/components/landing-page/features-section";
import { CTASection } from "@/components/landing-page/cta-section";
import { FooterSection } from "@/components/landing-page/footer-section";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Show hero section immediately */}
      <HeroSection />

      {/* Other sections load progressively */}
      <div className="space-y-0">
        <SocialFeedSection />
        <ForecastSection />
        <FeaturesSection />
        <CTASection />
        <FooterSection />
      </div>
    </div>
  );
}
