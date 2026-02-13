"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";

export interface FirstSessionCtaProps {
  /** Callback when user clicks the "I Just Surfed" CTA */
  onLogSession: () => void;
}

/**
 * Build the URL for the quick-log session flow.
 * Pre-fills beach and start time when a home beach is available.
 */
export function buildQuickLogUrl(homeBeach?: { id: string; name: string }) {
  const params = new URLSearchParams({ mode: "log", quick: "true" });
  if (homeBeach) {
    params.set("beach", homeBeach.id);
    params.set("beachName", homeBeach.name);
  }
  params.set("startTime", new Date().toISOString());
  return `/sessions/new?${params.toString()}`;
}

/**
 * FirstSessionCta is a full-width activation card shown in the dark gradient
 * header zone of the home screen for users who have not logged any sessions.
 *
 * It encourages the user to log their first session with a clear CTA and
 * a friction-reducing message about how quick the process is.
 */
export function FirstSessionCta({ onLogSession }: FirstSessionCtaProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="rounded-2xl bg-white/[0.06] border border-white/10 px-5 py-6 space-y-4"
      data-testid="first-session-cta"
      initial={reducedMotion ? false : HOME_HEADER_MOTION.entryItem.initial}
      animate={reducedMotion ? { opacity: 1, y: 0 } : HOME_HEADER_MOTION.entryItem.animate}
      transition={reducedMotion ? { duration: 0 } : HOME_HEADER_MOTION.entryItem.transition}
    >
      {/* Heading */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-orange-400 shrink-0" />
        <h2 className="text-base sm:text-lg font-semibold text-white">
          Log your first session
        </h2>
      </div>

      {/* Body */}
      <p className="text-sm text-white/60 leading-relaxed">
        Your forecasts get smarter with every session you track.
      </p>

      {/* CTA Button */}
      <motion.button
        onClick={onLogSession}
        whileTap={reducedMotion ? undefined : HOME_HEADER_MOTION.button.tap}
        whileHover={reducedMotion ? undefined : HOME_HEADER_MOTION.button.hover}
        transition={reducedMotion ? { duration: 0 } : HOME_HEADER_MOTION.button.spring}
        className="w-full h-12 sm:h-14 min-h-[44px] rounded-full bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 active:from-orange-600 active:to-orange-800 text-white font-semibold text-sm sm:text-base shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 flex items-center justify-center"
        aria-label="Log your first surf session"
        data-testid="first-session-cta-button"
      >
        I Just Surfed
      </motion.button>

      {/* Friction reducer */}
      <p className="text-xs text-white/40 text-center">
        Takes about 30 seconds
      </p>
    </motion.div>
  );
}
