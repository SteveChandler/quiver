"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { MatchScoreRing } from "./match-score-ring";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { QuiverSticker, type QuiverStickerProps } from "@/components/zine";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];

interface LoopStep {
  number: string;
  title: string;
  body: string;
  sticker: QuiverStickerProps["sticker"];
  chips: string[];
  cardClassName: string;
  stickerClassName: string;
  showScore?: boolean;
}

const LOOP_STEPS: LoopStep[] = [
  {
    number: "1",
    title: "Quiver makes the call.",
    body:
      "We read swell, wind, tide, buoys, and beach context, then turn the noise into one surf call for your day.",
    sticker: "spotBestSeason",
    chips: ["Forecast", "Tide", "Wind"],
    cardClassName: "md:-rotate-[0.6deg]",
    stickerClassName: "rotate-[5deg]",
  },
  {
    number: "2",
    title: "You check the beach.",
    body:
      "Use local reports, photos, and your own eyes to see whether the call matches the lineup in front of you.",
    sticker: "spotLocation",
    chips: ["Reports", "Photos", "Lineup"],
    cardClassName: "md:rotate-[0.45deg]",
    stickerClassName: "-rotate-[4deg]",
  },
  {
    number: "3",
    title: "You log the session.",
    body:
      "Save where you surfed, what board you rode, how it felt, and what the waves actually did.",
    sticker: "spotGallery",
    chips: ["Board", "Rating", "Notes"],
    cardClassName: "md:-rotate-[0.35deg]",
    stickerClassName: "rotate-[3deg]",
  },
  {
    number: "4",
    title: "Quiver compares the next one.",
    body:
      "Your logged days sit next to the next call, so you can see how a new window stacks up against sessions you actually surfed.",
    sticker: "spotSwellMatch",
    chips: ["Signal", "Preference", "Next call"],
    cardClassName: "md:rotate-[0.55deg]",
    stickerClassName: "-rotate-[6deg]",
    showScore: true,
  },
];

interface LoopStepCardProps {
  step: LoopStep;
  inView: boolean;
}

function LoopStepCard({ step, inView }: LoopStepCardProps) {
  return (
    <div
      className={`group relative isolate flex min-h-[360px] h-full flex-col overflow-hidden rounded-lg border-2 border-[#121735] bg-[#F5EEDC] p-5 text-[#121735] shadow-[10px_10px_0_rgba(7,12,42,0.35)] transition-transform duration-300 ease-out hover:-translate-y-1 ${step.cardClassName}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_center,#121735_1px,transparent_1px)] [background-size:8px_8px]"
        aria-hidden="true"
      />
      <div
        className="absolute -top-2 left-8 z-20 h-5 w-24 rotate-[-7deg] bg-[#F78E42] shadow-[3px_3px_0_rgba(18,23,53,0.25)]"
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 rotate-[-3deg] items-center justify-center border-2 border-[#121735] bg-[#F78E42] font-heading text-base font-black text-[#121735] shadow-[3px_3px_0_rgba(18,23,53,0.28)]">
          {step.number}
        </div>
        <QuiverSticker
          sticker={step.sticker}
          className={`h-auto w-[clamp(7rem,9vw,9.5rem)] drop-shadow-[0_14px_18px_rgba(18,23,53,0.18)] ${step.stickerClassName}`}
          decorative
          sizes="(min-width: 1280px) 152px, (min-width: 768px) 136px, 128px"
        />
      </div>
      <div className="relative z-10 mt-5">
        <h3 className="mb-2 font-heading text-xl font-black leading-tight text-[#121735]">
          {step.title}
        </h3>
        <p className="max-w-[18rem] font-sans text-sm leading-6 text-[#3E4A6A]">
          {step.body}
        </p>
      </div>
      {step.showScore ? (
        <div className="relative z-10 mt-auto flex items-end justify-between gap-4 pt-6">
          <span className="max-w-[7rem] font-mono text-[10px] uppercase tracking-[0.2em] text-[#6E7895]">
            Tuned by real sessions
          </span>
          <MatchScoreRing score={87} size={108} animated={inView} />
        </div>
      ) : (
        <div className="relative z-10 mt-auto pt-8" aria-hidden="true">
          <div className="h-2 w-24 rotate-[-2deg] bg-[#00D4AA]/70 shadow-[3px_3px_0_rgba(18,23,53,0.2)]" />
        </div>
      )}
      <div className="relative z-10 mt-5 flex flex-wrap gap-2">
        {step.chips.map((chip) => (
          <span
            key={chip}
            className="border border-[#121735]/20 bg-[#121735]/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#3E4A6A]"
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
