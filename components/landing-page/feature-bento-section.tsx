"use client";

import { useRef, type ComponentType } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { FEATURE_CARDS } from "@/lib/constants/features";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  WaveBars,
  MatchRingIllustration,
  SignalRipples,
  CompassPin,
  ChartTrend,
  PhoneNotification,
  CommunityPeople,
} from "./bento-illustrations";

// ---------------------------------------------------------------------------
// Illustration mapping — one per FEATURE_CARDS entry, matched by index
// ---------------------------------------------------------------------------

const ILLUSTRATIONS: ComponentType<{ className?: string }>[] = [
  WaveBars,             // 0 — Your Surf Call
  MatchRingIllustration, // 1 — Tuned to You
  SignalRipples,        // 2 — What's Happening Now
  CompassPin,           // 3 — Spot Discovery
  ChartTrend,           // 4 — Session Tracking
  PhoneNotification,    // 5 — Join the Beta
  CommunityPeople,      // 6 — Community
];

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

// ---------------------------------------------------------------------------
// Bento card
// ---------------------------------------------------------------------------

interface BentoCardProps {
  title: string;
  description: string;
  Illustration: ComponentType<{ className?: string }>;
  isTall: boolean;
}

function BentoCard({ title, description, Illustration, isTall }: BentoCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={[
        // Tall cards span two rows on desktop
        isTall ? "md:row-span-2" : "",
        // Frosted glass card
        "bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-8",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        // Hover treatment
        "transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out",
        "hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-1",
        "hover:shadow-lg hover:shadow-ocean-blue/5",
        // Internal layout
        "flex flex-col",
      ].join(" ")}
    >
      {/* Illustration container */}
      <div className={`w-full ${isTall ? "h-[160px]" : "h-[120px]"} mb-6 flex items-center justify-center`}>
        <Illustration className="max-h-full" />
      </div>

      {/* Text content */}
      <h3 className="font-heading text-xl font-semibold text-white mb-2">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-[#B0C0D6]">
        {description}
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function FeatureBentoSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const reducedMotion = useReducedMotion();

  return (
    <section
      className="relative overflow-hidden pt-8 pb-16 md:pt-10 md:pb-24 px-4 bg-[#252D6B] noise-texture"
      data-testid="feature-bento-section"
    >
      {/* Off-center gradient glow */}
      <div
        className="pointer-events-none absolute -top-1/4 left-1/3 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(247,142,66,0.35) 0%, rgba(37,45,107,0) 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-white mb-4">
            Everything you need to surf smarter
          </h2>
          <p className="text-base sm:text-lg font-sans text-white/60 max-w-3xl mx-auto">
            Quiver reads real buoy data and corrects the forecast for each
            individual beach break — trained on 30,000+ observations. The
            result: surf conditions explained clearly for 279+ beaches, updated
            every 3 hours.
          </p>
        </div>

        {/* Bento grid */}
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial={reducedMotion ? false : "hidden"}
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {FEATURE_CARDS.map((card, i) => {
            const isTall = i === 0 || i === 2;
            const Illustration = ILLUSTRATIONS[i];

            if (!Illustration) return null;

            return (
              <BentoCard
                key={card.title}
                title={card.title}
                description={card.description}
                Illustration={Illustration}
                isTall={isTall}
              />
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
