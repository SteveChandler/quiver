"use client";

import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { CONTENT } from "@/lib/constants/features";
import { Button } from "@/components/ui/button";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";

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

  return (
    <section
      ref={sectionRef}
      className="relative flex items-center justify-center overflow-hidden bg-[#252D6B] pt-32 pb-24"
    >
      {/* Ambient radial glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#F78E42]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8 px-6 text-center max-w-4xl mx-auto"
        variants={containerVariants}
        initial="hidden"
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
          className="text-lg md:text-xl text-[#9AABC6] max-w-2xl leading-relaxed"
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
              setAuthMode("signup");
              setAuthModalOpen(true);
              trackAuthModalOpened({ mode: "signup", source: "hero-cta" });
            }}
            className="bg-ocean-blue text-white rounded-full px-8 py-4 font-semibold text-lg shadow-lg hover:bg-ocean-blue/90 hover:shadow-xl hover:shadow-ocean-blue/20 transition-all duration-300"
            size="lg"
          >
            {CONTENT.hero.cta}
          </Button>

          <Button
            asChild
            variant="ghost"
            className="border border-white/30 text-white rounded-full px-6 py-4 font-semibold hover:bg-white/10 transition-all duration-300"
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
                title: "Get Your Match Score",
                description:
                  "Personalized surf forecasts in 30 seconds",
              }
            : undefined
        }
      />
    </section>
  );
}
