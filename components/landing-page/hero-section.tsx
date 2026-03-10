"use client";

import { useState } from "react";
import { CONTENT } from "@/lib/constants/features";
import { HeroCarousel } from "./hero-carousel";
import { HeroMatchDemo } from "./hero-match-demo";
import { Button } from "@/components/ui/button";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";

export function HeroSection() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  return (
    <section className="relative min-h-[75svh] flex items-center justify-center overflow-clip md:overflow-visible pt-20">
      {/* Hero Carousel Background - includes gradient overlay */}
      <HeroCarousel />

      {/* Hero Content */}
      <div className="relative z-30 w-full max-w-3xl mx-auto px-6 text-center text-white flex flex-col items-center gap-6">
        {/* Main Headline */}
        <h1
          className="font-semibold leading-tight tracking-tight text-5xl md:text-6xl font-heading animate-fade-in-up [text-shadow:_0_2px_8px_rgb(0_0_0_/_30%)] text-balance"
          style={{ animationDelay: "100ms" }}
        >
          {CONTENT.hero.title}
        </h1>

        {/* Subhead */}
        <div
          className="flex flex-col items-center gap-2 animate-fade-in-up"
          style={{ animationDelay: "150ms" }}
        >
          <p className="text-lg md:text-xl text-high max-w-2xl font-sans leading-relaxed">
            {CONTENT.hero.subtitle}
          </p>
        </div>

        {/* Live Match Score Demo Card */}
        <div
          className="animate-fade-in-up w-full max-w-sm"
          style={{ animationDelay: "200ms" }}
        >
          <HeroMatchDemo />
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => {
            setAuthMode("signup");
            setAuthModalOpen(true);
            trackAuthModalOpened({ mode: "signup", source: "hero-cta" });
          }}
          className="bg-ocean-blue text-white rounded-full px-8 py-4 font-sans font-semibold text-lg shadow-lg hover:bg-ocean-blue/90 animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
          size="lg"
        >
          {CONTENT.hero.cta}
        </Button>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        source="hero-cta"
        returnTo="/"
        contextMessage={
          authMode === "signup"
            ? { title: "Get Your Match Score", description: "Personalized surf forecasts in 30 seconds" }
            : undefined
        }
      />
    </section>
  );
}
