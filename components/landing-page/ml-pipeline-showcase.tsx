"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Brain, Radio, Waves, Droplets, Users } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { MatchScoreRing } from "./match-score-ring";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];

// ---------------------------------------------------------------------------
// Step 1 — Real-Time Data
// ---------------------------------------------------------------------------

function StepDataSources() {
  return (
    <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col gap-4 h-full">
      <div className="w-8 h-8 rounded-full border-2 border-[#F78E42] flex items-center justify-center text-sm font-bold text-white">
        1
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">We pull from real ocean data.</h3>
        <p className="text-sm text-[#B0C0D6]">
          NOAA buoys, Open-Meteo models, your local stations, and what surfers post from the lineup.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 mt-auto">
        <Waves className="h-5 w-5 text-[#4A70D9]" aria-label="Wave data" />
        <Radio className="h-5 w-5 text-[#4A70D9]" aria-label="Satellite data" />
        <Droplets className="h-5 w-5 text-[#4A70D9]" aria-label="Water conditions" />
        <Users className="h-5 w-5 text-[#4A70D9]" aria-label="Community reports" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — ML Scoring Engine
// ---------------------------------------------------------------------------

const ML_CHIPS = [
  "Wave Height",
  "Period",
  "Wind",
  "Tide",
] as const;

function StepMLEngine() {
  return (
    <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col gap-4 h-full">
      <div className="w-8 h-8 rounded-full border-2 border-[#F78E42] flex items-center justify-center text-sm font-bold text-white">
        2
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">We check our forecast against what actually happened.</h3>
        <p className="text-sm text-[#B0C0D6]">
          Every three hours we compare the model to live buoy observations and correct what was off.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-[#F78E42] shrink-0" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap gap-2 mt-auto">
        {ML_CHIPS.map((chip) => (
          <span
            key={chip}
            className="text-[10px] uppercase tracking-wider bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.1] text-white/60"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Match Score
// ---------------------------------------------------------------------------

interface StepMatchScoreProps {
  inView: boolean;
}

function StepMatchScore({ inView }: StepMatchScoreProps) {
  return (
    <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col gap-4 h-full">
      <div className="w-8 h-8 rounded-full border-2 border-[#F78E42] flex items-center justify-center text-sm font-bold text-white">
        3
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">We tell you what it means at your beach.</h3>
        <p className="text-sm text-[#B0C0D6]">
          One call, read for your skill level and the way you actually surf.
        </p>
      </div>
      <div className="flex justify-center mt-auto">
        <MatchScoreRing score={87} size={100} animated={inView} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connector (desktop only)
// ---------------------------------------------------------------------------

interface StepConnectorProps {
  isInView: boolean;
  delay: number;
  shouldReduceMotion: boolean;
}

function StepConnector({ isInView, delay, shouldReduceMotion }: StepConnectorProps) {
  return (
    <motion.div
      className="hidden md:flex items-center justify-center shrink-0"
      aria-hidden="true"
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4, delay, ease: EASE_OUT_QUART }}
    >
      <div className="w-8 border-t border-dashed border-white/20" />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MLPipelineShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.25 });
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const hasTrackedView = useRef(false);

  const stepInitial = shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 };

  // Track CTA view when the section enters viewport for unauthenticated users.
  useEffect(() => {
    if (user || !isInView || hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackSignupCtaView({
      source: "ml-pipeline-showcase",
      surface: "landing-page",
    });
  }, [user, isInView]);

  const handleCtaClick = () => {
    trackSignupCtaClick({
      source: "ml-pipeline-showcase",
      surface: "landing-page",
    });
    setShowAuth(true);
  };

  return (
    <SectionWrapper
      className="py-12 md:py-16 px-4 bg-[#2D357D]"
      noiseVariant="strong"
      data-testid="ml-pipeline-showcase"
    >
      {/* Section header */}
      <div className="text-center mb-10 md:mb-12 animate-fade-in-up">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-white mb-4">
          How the forecast actually works
        </h2>
        <p className="text-lg font-sans text-white/60 max-w-2xl mx-auto">
          No black box. Real ocean data, checked against what actually happened, read for your beach.
        </p>
      </div>

      {/* Steps */}
      <div
        ref={ref}
        className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-0"
      >
        <motion.div
          className="flex-1"
          initial={stepInitial}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0, ease: EASE_OUT_QUART }}
        >
          <StepDataSources />
        </motion.div>

        <StepConnector isInView={isInView} delay={0.3} shouldReduceMotion={shouldReduceMotion} />

        <motion.div
          className="flex-1"
          initial={stepInitial}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE_OUT_QUART }}
        >
          <StepMLEngine />
        </motion.div>

        <StepConnector isInView={isInView} delay={0.8} shouldReduceMotion={shouldReduceMotion} />

        <motion.div
          className="flex-1"
          initial={stepInitial}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.0, ease: EASE_OUT_QUART }}
        >
          <StepMatchScore inView={isInView} />
        </motion.div>
      </div>

      {/* Founder note — short, restrained, transparency over hype */}
      <motion.div
        className="mt-10 md:mt-12 max-w-2xl mx-auto text-center"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 1.2, ease: EASE_OUT_QUART }}
      >
        <p className="text-sm md:text-base font-sans text-white/70 leading-relaxed italic">
          &ldquo;I shipped a forecast model, found a direction bug in our own data pipeline, fixed it,
          retrained it, and kept the old predictions honest instead of rewriting history.
          That&apos;s the difference: we check our own work.&rdquo;
        </p>
        <p className="text-xs uppercase tracking-wider text-white/40 mt-3">
          — Steven, founder
        </p>
      </motion.div>

      {/* CTA — non-authenticated users only */}
      {!user && (
        <motion.div
          className="mt-10 flex justify-center"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 1.3, ease: EASE_OUT_QUART }}
        >
          <Button
            onClick={handleCtaClick}
            size="lg"
            className="rounded-full px-8"
          >
            Get scores for every beach near you
          </Button>
        </motion.div>
      )}

      {showAuth && (
        <UnifiedAuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          mode="signup"
          source="ml-pipeline-showcase"
          returnTo={pathname}
          contextMessage={{
            title: "See Your Forecast",
            description:
              "Create a free account to see conditions explained clearly at every beach near you.",
          }}
        />
      )}
    </SectionWrapper>
  );
}
