"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { CONTENT } from "@/lib/constants/features";
import { Button } from "@/components/ui/button";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";
import { useAuth } from "@/context/auth-context";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HeroVideoBackground } from "./hero-video-background";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
} as const;

export function HeroSection() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const hasTrackedView = useRef(false);

  // Track hero CTA view on mount for unauthenticated users.
  useEffect(() => {
    if (user || hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackSignupCtaView({
      source: "hero-cta",
      surface: "landing-page",
    });
  }, [user]);

  return (
    <section
      ref={sectionRef}
      className="relative flex items-center justify-center overflow-hidden bg-black pt-32 pb-24 min-h-[600px] md:min-h-[700px]"
    >
      {/* Background: video → Ken Burns images loop */}
      <HeroVideoBackground />

      {/* Hero content */}
      <motion.div
        className="relative z-20 flex flex-col items-center gap-8 px-6 text-center max-w-4xl mx-auto"
        variants={containerVariants}
        initial={reducedMotion ? false : "hidden"}
        animate={isInView ? "visible" : "hidden"}
      >
        {/* Headline */}
        <motion.h1
          className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-white leading-tight tracking-tight text-balance"
          variants={itemVariants}
        >
          {CONTENT.hero.title}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed"
          variants={itemVariants}
        >
          {CONTENT.hero.subtitle}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-4"
          variants={itemVariants}
        >
          <Button
            onClick={() => {
              trackSignupCtaClick({
                source: "hero-cta",
                surface: "landing-page",
              });
              setAuthMode("signup");
              setAuthModalOpen(true);
            }}
            className="bg-ocean-blue text-white rounded-full px-8 py-4 font-semibold text-lg shadow-lg hover:bg-ocean-blue/90 hover:shadow-xl hover:shadow-ocean-blue/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
            size="lg"
          >
            {CONTENT.hero.cta}
          </Button>

          <Button
            asChild
            variant="ghost"
            className="border border-white/30 text-white rounded-full px-6 py-4 font-semibold hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
            size="lg"
          >
            <Link href="/about">Learn More</Link>
          </Button>
        </motion.div>
      </motion.div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        source="hero-cta"
        returnTo="/"
        contextMessage={
          authMode === "signup"
            ? {
                title: "See Your Forecast",
                description:
                  "Conditions explained clearly in 30 seconds",
              }
            : undefined
        }
      />
    </section>
  );
}
