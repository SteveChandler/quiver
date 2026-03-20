"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useInView } from "framer-motion";
import { Sliders, Brain, Target } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Step data
// ---------------------------------------------------------------------------

interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const STEPS: HowItWorksStep[] = [
  {
    number: "01",
    title: "Tell us where you surf",
    description:
      "Your home beach, what kind of waves you like, how long you've been surfing.",
    Icon: Sliders,
  },
  {
    number: "02",
    title: "We read the conditions for you",
    description:
      "Wave height, wind, tide, swell direction — translated into whether it's worth the drive, for you.",
    Icon: Brain,
  },
  {
    number: "03",
    title: "Know when to go",
    description:
      "Best window today, at your spots, with the conditions explained clearly.",
    Icon: Target,
  },
];

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

interface StepCardProps {
  step: HowItWorksStep;
  delay: number;
  inView: boolean;
}

function StepCard({ step, delay, inView }: StepCardProps) {
  const { number, title, description, Icon } = step;

  return (
    <motion.div
      className="relative flex flex-col gap-4"
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
    >
      {/* Large background number */}
      <span
        className="font-mono font-bold text-white/10 leading-none select-none"
        style={{ fontSize: "4rem" /* text-5xl */ }}
        aria-hidden="true"
      >
        {number}
      </span>

      {/* Icon circle */}
      <div className="w-12 h-12 rounded-full bg-neon-orange/10 flex items-center justify-center -mt-4">
        <Icon className="h-6 w-6 text-neon-orange" aria-hidden="true" />
      </div>

      {/* Text */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-white/70 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.25 });
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <SectionWrapper
      className="py-12 md:py-16 px-4 bg-[#252D6B]"
      data-testid="how-it-works-section"
    >
      {/* Section header */}
      <div className="text-center mb-10 animate-fade-in-up">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-white mb-4">
          How it works
        </h2>
        <p className="text-lg font-sans text-white/60 max-w-2xl mx-auto">
          Three steps to conditions explained clearly, every morning.
        </p>
      </div>

      {/* Steps grid */}
      <div
        ref={ref}
        className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12"
      >
        {STEPS.map((step, i) => (
          <StepCard
            key={step.number}
            step={step}
            delay={i * 0.15}
            inView={isInView}
          />
        ))}
      </div>

      {/* CTA — non-authenticated users only */}
      {!user && (
        <motion.div
          className="mt-10 flex justify-center"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Button
            onClick={() => setShowAuth(true)}
            size="lg"
            className="rounded-full px-8"
          >
            Set up in 30 seconds
          </Button>
        </motion.div>
      )}

      {showAuth && (
        <UnifiedAuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          mode="signup"
          source="how-it-works-section"
          returnTo={pathname}
          contextMessage={{
            title: "Create Your Surf Profile",
            description:
              "Tell us where you surf and we'll explain your conditions clearly.",
          }}
        />
      )}
    </SectionWrapper>
  );
}
