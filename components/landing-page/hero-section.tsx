"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

const HERO_FORECAST_MARKERS = [
  { label: "Wave height", value: "2-3 ft", note: "mellow enough to learn" },
  { label: "Swell period", value: "12s", note: "more push than the number implies" },
  { label: "Wind", value: "light W", note: "cleaner before lunch" },
] as const;

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
      className="relative overflow-hidden bg-[oklch(18%_0.04_268)] pt-24 pb-12 md:pt-28 md:pb-8"
    >
      {/* Background: video → Ken Burns images loop */}
      <HeroVideoBackground />
      <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,oklch(18%_0.04_268_/_0.94)_0%,oklch(20%_0.05_268_/_0.78)_45%,oklch(19%_0.04_268_/_0.5)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 z-10 h-32 bg-[linear-gradient(0deg,oklch(34%_0.09_268),transparent)]" />

      {/* Hero content */}
      <motion.div
        className="relative z-20 mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)] lg:items-end"
        variants={containerVariants}
        initial={reducedMotion ? false : "hidden"}
        animate={isInView ? "visible" : "hidden"}
      >
        <div className="max-w-3xl">
          <motion.h1
            className="max-w-4xl text-balance font-heading text-4xl font-black leading-[0.94] tracking-normal text-[#F8F2DD] xs:text-5xl sm:text-6xl md:text-7xl lg:text-7xl"
            variants={itemVariants}
          >
            {CONTENT.hero.title}
          </motion.h1>

          <motion.p
            className="mt-6 max-w-2xl text-lg leading-relaxed text-[#D8E1F0] md:text-xl"
            variants={itemVariants}
          >
            {CONTENT.hero.subtitle}
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
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
              className="rounded-[16px_8px_18px_8px] bg-ocean-blue px-7 py-4 font-heading text-base font-bold text-white shadow-[0_5px_0_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ocean-blue/90 hover:shadow-[0_7px_0_rgba(0,0,0,0.35)] active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
              size="lg"
            >
              {CONTENT.hero.cta}
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
            </Button>

            <Button
              asChild
              variant="ghost"
              className="rounded-[14px_6px_16px_4px] border border-[#F8F2DD]/35 bg-[#F8F2DD]/8 px-6 py-4 font-heading text-base font-bold text-[#F8F2DD] transition-all duration-200 hover:-rotate-1 hover:bg-[#F8F2DD]/14 focus-visible:ring-2 focus-visible:ring-[#F8F2DD]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
              size="lg"
            >
              <Link href="/beginner/san-diego">{CONTENT.hero.secondaryCta}</Link>
            </Button>
          </motion.div>

        </div>

        <motion.div
          className="relative mx-auto w-full max-w-md rotate-[1deg] rounded-[30px_14px_34px_18px] border-2 border-[#252D6B] bg-[#F8F2DD] p-4 text-[#171A35] shadow-[10px_12px_0_rgba(0,0,0,0.34)] sm:p-5 lg:mx-0"
          variants={itemVariants}
        >
          <div className="absolute -left-5 top-6 rotate-[-9deg] rounded-[12px_4px_12px_4px] bg-[#F78E42] px-4 py-2 font-heading text-xs font-black uppercase tracking-wide text-[#252D6B] shadow-[0_3px_0_rgba(0,0,0,0.25)]">
            Epic
          </div>

          <div className="mt-8 border-y-2 border-[#252D6B] py-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9E5010]">
              La Jolla Shores, tomorrow morning
            </p>
            <p className="mt-3 font-heading text-4xl font-black leading-none">
              Go before 10.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#31375D]">
              Small enough to learn, enough period to push a soft top, and wind
              stays light before lunch.
            </p>
          </div>

          <div className="mt-5 hidden gap-3 sm:grid">
            {HERO_FORECAST_MARKERS.map((marker) => (
              <div
                key={marker.label}
                className="grid grid-cols-[88px_72px_1fr] items-center gap-3 border-b border-[#252D6B]/20 pb-3 last:border-b-0 last:pb-0"
              >
                <span className="font-mono text-[11px] uppercase tracking-wide text-[#58607F]">
                  {marker.label}
                </span>
                <span className="font-heading text-xl font-black text-[#252D6B]">
                  {marker.value}
                </span>
                <span className="text-sm leading-snug text-[#31375D]">
                  {marker.note}
                </span>
              </div>
            ))}
          </div>

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
                title: "Get Your Surf Call",
                description:
                  "Create a free account to see conditions explained for your level.",
              }
            : undefined
        }
      />
    </section>
  );
}
