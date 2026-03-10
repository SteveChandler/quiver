"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useInView } from "framer-motion";
import { Brain, Radio, Waves, Droplets, Users } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { MatchScoreRing } from "./match-score-ring";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Step 1 — Real-Time Data
// ---------------------------------------------------------------------------

function StepDataSources() {
  return (
    <div className="clip-cyber-sm bg-bg-surface border border-neon-cyan/20 p-6 flex flex-col gap-4 h-full">
      <span className="font-mono text-4xl text-white text-glow-cyan leading-none">
        01
      </span>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Real-Time Data</h3>
        <p className="text-sm text-white/60">
          30K+ buoy observations, NOAA models, community reports
        </p>
      </div>
      <div className="flex flex-wrap gap-3 mt-auto">
        <Waves className="h-5 w-5 text-neon-cyan" aria-label="Wave data" />
        <Radio className="h-5 w-5 text-neon-cyan" aria-label="Satellite data" />
        <Droplets className="h-5 w-5 text-neon-cyan" aria-label="Water conditions" />
        <Users className="h-5 w-5 text-neon-cyan" aria-label="Community reports" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — ML Scoring Engine
// ---------------------------------------------------------------------------

const ML_CHIPS = [
  "Wave Height Fit",
  "Period Energy",
  "Wind Alignment",
  "Tide Fit",
] as const;

function StepMLEngine() {
  return (
    <div className="clip-cyber-sm bg-bg-surface border border-neon-orange/20 p-6 flex flex-col gap-4 h-full">
      <span className="font-mono text-4xl text-white text-glow-cyan leading-none">
        02
      </span>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">ML Scoring Engine</h3>
        <p className="text-sm text-white/60">
          XGBoost ensemble scores 4 factors every 3 hours
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-neon-orange shrink-0" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap gap-2 mt-auto">
        {ML_CHIPS.map((chip) => (
          <span
            key={chip}
            className="text-[10px] uppercase tracking-wider bg-bg-deep/60 px-2 py-0.5 rounded-full border border-neon-orange/20 text-white/70"
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
    <div className="clip-cyber-sm bg-bg-surface border border-neon-magenta/20 p-6 flex flex-col gap-4 h-full">
      <span className="font-mono text-4xl text-white text-glow-cyan leading-none">
        03
      </span>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Your Match Score</h3>
        <p className="text-sm text-white/60">
          Personalized to your skill level and wave preferences
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

function StepConnector() {
  return (
    <div
      className="hidden md:flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      <div className="w-8 border-t border-dashed border-neon-cyan/20" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MLPipelineShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <SectionWrapper
      className="py-12 md:py-16 px-4 bg-[#252D6B] noise-texture-strong"
      data-testid="ml-pipeline-showcase"
    >
      {/* Section header */}
      <div className="text-center mb-10 animate-fade-in-up">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-white mb-4">
          How your Match Score works
        </h2>
        <p className="text-lg font-sans text-white/60 max-w-2xl mx-auto">
          No black boxes. Here&apos;s exactly what powers every recommendation.
        </p>
      </div>

      {/* Steps */}
      <div
        ref={ref}
        className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-0"
      >
        <motion.div
          className="flex-1"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0 }}
        >
          <StepDataSources />
        </motion.div>

        <StepConnector />

        <motion.div
          className="flex-1"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <StepMLEngine />
        </motion.div>

        <StepConnector />

        <motion.div
          className="flex-1"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <StepMatchScore inView={isInView} />
        </motion.div>
      </div>

      {/* CTA — non-authenticated users only */}
      {!user && (
        <motion.div
          className="mt-10 flex justify-center"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Button
            onClick={() => setShowAuth(true)}
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
            title: "Unlock Your Match Scores",
            description:
              "Create a free account to see personalized match scores for every beach near you.",
          }}
        />
      )}
    </SectionWrapper>
  );
}
