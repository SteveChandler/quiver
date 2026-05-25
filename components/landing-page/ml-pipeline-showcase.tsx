"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  ClipboardList,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

interface LoopStep {
  number: string;
  title: string;
  body: string;
  Icon: LucideIcon;
  chips: string[];
  showScore?: boolean;
}

const LOOP_STEPS: LoopStep[] = [
  {
    number: "1",
    title: "Quiver makes the call.",
    body:
      "We read swell, wind, tide, buoys, and beach context, then turn the noise into one surf call for your day.",
    Icon: Waves,
    chips: ["Forecast", "Tide", "Wind"],
  },
  {
    number: "2",
    title: "You check the beach.",
    body:
      "Use local reports, photos, and your own eyes to see whether the call matches the lineup in front of you.",
    Icon: CheckCircle2,
    chips: ["Reports", "Photos", "Lineup"],
  },
  {
    number: "3",
    title: "You log the session.",
    body:
      "Save where you surfed, what board you rode, how it felt, and what the waves actually did.",
    Icon: ClipboardList,
    chips: ["Board", "Rating", "Notes"],
  },
  {
    number: "4",
    title: "Quiver tunes the next one.",
    body:
      "Your surf forecast gets smarter when you log what happened, without treating every note like buoy truth.",
    Icon: Brain,
    chips: ["Signal", "Preference", "Next call"],
    showScore: true,
  },
];

interface LoopStepCardProps {
  step: LoopStep;
  inView: boolean;
}

function LoopStepCard({ step, inView }: LoopStepCardProps) {
  const { Icon } = step;

  return (
    <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col gap-4 h-full">
      <div className="w-8 h-8 rounded-full border-2 border-[#F78E42] flex items-center justify-center text-sm font-bold text-white">
        {step.number}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          {step.title}
        </h3>
        <p className="text-sm text-[#B0C0D6]">
          {step.body}
        </p>
      </div>
      {step.showScore ? (
        <div className="flex justify-center mt-auto">
          <MatchScoreRing score={87} size={96} animated={inView} />
        </div>
      ) : (
        <div className="flex items-center gap-3 mt-auto">
          <Icon
            className="h-6 w-6 text-[#F78E42] shrink-0"
            aria-hidden="true"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-auto">
        {step.chips.map((chip) => (
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
      className="hidden xl:flex items-center justify-center shrink-0"
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
          The loop behind one clear surf call
        </h2>
        <p className="text-lg font-sans text-white/60 max-w-2xl mx-auto">
          Forecast, check, log, improve. Quiver gets useful when the app and the surfer keep comparing the call to the real session.
        </p>
      </div>

      {/* Steps */}
      <div
        ref={ref}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] xl:items-stretch gap-4 xl:gap-0"
      >
        {LOOP_STEPS.map((step, index) => (
          <div
            key={step.number}
            className="contents"
          >
            {index > 0 ? (
              <StepConnector
                isInView={isInView}
                delay={0.25 + index * 0.18}
                shouldReduceMotion={shouldReduceMotion}
              />
            ) : null}
            <motion.div
              className="min-w-0"
              initial={stepInitial}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: shouldReduceMotion ? 0 : index * 0.22,
                ease: EASE_OUT_QUART,
              }}
            >
              <LoopStepCard step={step} inView={isInView} />
            </motion.div>
          </div>
        ))}
      </div>

      {/* Founder note — short, restrained, transparency over hype */}
      <motion.div
        className="mt-10 md:mt-12 max-w-2xl mx-auto text-center"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 1.2, ease: EASE_OUT_QUART }}
      >
        <p className="text-sm md:text-base font-sans text-white/70 leading-relaxed italic">
          &ldquo;The model is only useful if we keep checking it. Forecast, measure, correct,
          publish. That&apos;s the discipline Quiver is built around.&rdquo;
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
            Get my surf call
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
              "Create a free account to see one clear call for the beaches near you.",
          }}
        />
      )}
    </SectionWrapper>
  );
}
