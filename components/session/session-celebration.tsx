"use client";

import { useEffect } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";

export interface SessionCelebrationProps {
  /** Total session count for this user — shown as "Session #N in the books." */
  sessionNumber: number;
  beachName: string;
  /** Wave height in feet */
  waveHeight?: number;
  /** Wind condition descriptor, e.g. "offshore", "onshore", "cross-shore" */
  windCondition?: string;
  /** Overall rating 1–5 */
  rating?: number;
  /** XP earned from the session */
  xpEarned?: number;
  /** Called after auto-dismiss timer fires or user taps the overlay */
  onDismiss: () => void;
}

function buildSubtitle(
  beachName: string,
  waveHeight?: number,
  windCondition?: string,
  rating?: number
): string {
  const wind = windCondition?.toLowerCase() ?? "";
  const isGood = wind === "offshore" && typeof rating === "number" && rating >= 4;
  const isTough =
    wind === "onshore" || (typeof rating === "number" && rating <= 2);

  const heightPrefix =
    typeof waveHeight === "number" ? `${waveHeight}ft at ${beachName}` : beachName;

  if (isGood) {
    return `${heightPrefix} with offshore winds. Nice one.`;
  }
  if (isTough) {
    return `Tough conditions at ${beachName}. Respect for paddling out.`;
  }
  return `${heightPrefix}. Logged.`;
}

/** AUTO_DISMISS_MS is the delay before the overlay self-dismisses. */
const AUTO_DISMISS_MS = 3000;

/**
 * Full-screen celebration overlay shown after a session is saved.
 * Auto-dismisses after 3 s; tapping anywhere also dismisses it.
 * Animations respect `prefers-reduced-motion`.
 */
export function SessionCelebration({
  sessionNumber,
  beachName,
  waveHeight,
  windCondition,
  rating,
  xpEarned,
  onDismiss,
}: SessionCelebrationProps) {
  const prefersReduced = useReducedMotion();
  const subtitle = buildSubtitle(beachName, waveHeight, windCondition, rating);

  // Auto-dismiss after AUTO_DISMISS_MS
  useEffect(() => {
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [onDismiss]);

  // Keyboard: Escape also dismisses
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  const transition: Transition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.35, ease: "easeOut" as const };

  const contentTransition: Transition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.4, ease: "easeOut" as const, delay: 0.05 };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Session #${sessionNumber} logged`}
      data-testid="session-celebration"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#252D6B]/95 backdrop-blur-sm cursor-pointer"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={transition}
      onClick={onDismiss}
    >
      <motion.div
        className="flex flex-col items-center gap-5 w-full max-w-sm px-8 text-center"
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={contentTransition}
        // Prevent click on the inner card from double-triggering dismiss
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main headline */}
        <h1 className="font-heading text-4xl font-extrabold text-white leading-tight tracking-tight">
          Session #{sessionNumber} in the books.
        </h1>

        {/* Condition-reactive subtitle */}
        <p className="font-sans text-lg text-white/70 leading-snug">{subtitle}</p>

        {/* XP earned badge — only shown when xpEarned is provided and > 0 */}
        {typeof xpEarned === "number" && xpEarned > 0 && (
          <span
            className="font-mono text-2xl font-bold text-[#F78E42]"
            data-testid="xp-badge"
          >
            +{xpEarned} XP
          </span>
        )}

        {/* Tap-to-dismiss hint */}
        <p className="text-sm text-white/40 mt-2">Tap anywhere to dismiss</p>
      </motion.div>
    </motion.div>
  );
}

export { buildSubtitle };
