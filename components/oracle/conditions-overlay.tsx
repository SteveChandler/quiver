"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import {
  compassPointToWord,
  type CompassPoint,
} from "@/lib/utils/distance-utils";
import type { CanonicalDecisionVerdict } from "@/lib/recommendations/canonical-decision/types";

interface ConditionsOverlayProps {
  beachName: string;
  waveHeight: string;
  /** null while the canonical surf-call is still in flight — render a placeholder. */
  score: number | null;
  decisionVerdict?: CanonicalDecisionVerdict | null;
  swellDirection: string;
  swellPeriod: number;
  tideHeight: number;
  tideDirection: "rising" | "falling";
  waterTemp: number;
  bestWindowTitle: string;
  bestWindowSubtitle: string;
  bestWindowTime: string;
  /** Hero-call reasoning sentence, rendered as a separate prose line under
   * the best-window card. Distinct from `bestWindowSubtitle`, which is the
   * supporting line *inside* the card. Omit when absent. */
  whySentence?: string;
  shouldAnimate: boolean;
  /** Animated wave height display value — controlled by parent for count-up */
  animatedWaveHeight?: string;
  /** When true, the best window is for tomorrow — adjusts the "Best time" label */
  isTomorrow?: boolean;
  /**
   * Drive context for the regional-best hero. Rendered as a small
   * "↗ N mi {direction} of {homeBeachName}" subtitle under the swell row.
   * Hidden when undefined (i.e. hero IS the home beach, or home beach
   * is unset).
   */
  driveContext?: {
    distanceMiles: number;
    bearing: CompassPoint;
    homeBeachName: string;
  };
}

// Score badge background is Paradise Gold; text is deep twilight for contrast.
// When score is null (canonical surf-call still in flight), render a neutral
// placeholder so we don't paint a phantom 0.0/10 verdict next to a confident
// title sourced from discovery's fallback.
function ScoreBadge({
  score,
  shouldAnimate,
}: {
  score: number | null;
  shouldAnimate: boolean;
}) {
  const isPending = score === null;
  return (
    <motion.div
      initial={shouldAnimate ? { scale: 0 } : false}
      animate={{ scale: 1 }}
      transition={
        shouldAnimate
          ? { duration: 0.4, delay: 1.5, ease: [0.16, 1, 0.3, 1] }
          : { duration: 0 }
      }
      className={
        isPending
          ? "inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1"
          : "inline-flex items-center gap-1 rounded-full bg-[#FDB84B] px-3 py-1"
      }
      aria-label={isPending ? "Surf score loading" : `Surf score ${score} out of 10`}
      data-testid="hero-score-badge"
      data-score-pending={isPending ? "true" : "false"}
    >
      <span
        className={
          isPending
            ? "font-mono text-sm font-bold text-white/70"
            : "font-mono text-sm font-bold text-[#252D6B]"
        }
      >
        {isPending ? "—/10" : `${score!.toFixed(1)}/10`}
      </span>
    </motion.div>
  );
}

function DecisionBadge({
  verdict,
  shouldAnimate,
}: {
  verdict: CanonicalDecisionVerdict;
  shouldAnimate: boolean;
}) {
  const label = verdict === "go" ? "Go" : verdict === "maybe" ? "Maybe" : "No";
  return (
    <motion.div
      initial={shouldAnimate ? { scale: 0 } : false}
      animate={{ scale: 1 }}
      transition={
        shouldAnimate
          ? { duration: 0.4, delay: 1.5, ease: [0.16, 1, 0.3, 1] }
          : { duration: 0 }
      }
      className="inline-flex items-center rounded-full bg-[#FDB84B] px-3 py-1"
      aria-label={`Session decision: ${label}`}
      data-testid="hero-decision-badge"
    >
      <span className="font-mono text-sm font-bold uppercase text-[#252D6B]">
        {label}
      </span>
    </motion.div>
  );
}

interface SwellStatProps {
  label: string;
  value: string;
}

function SwellStat({ label, value }: SwellStatProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-medium text-[11px] uppercase tracking-wider">
        {label}
      </span>
      <span className="text-high text-base font-medium">{value}</span>
    </div>
  );
}

export function ConditionsOverlay({
  beachName,
  waveHeight,
  score,
  decisionVerdict,
  swellDirection,
  swellPeriod,
  tideHeight,
  tideDirection,
  waterTemp,
  bestWindowTitle,
  bestWindowSubtitle,
  bestWindowTime,
  whySentence,
  shouldAnimate,
  animatedWaveHeight,
  isTomorrow,
  driveContext,
}: ConditionsOverlayProps) {
  const displayWaveHeight = animatedWaveHeight ?? waveHeight;
  const tideDirectionLabel = tideDirection === "rising" ? "Rising" : "Falling";

  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 p-5 sm:p-6">
      {/* Beach name */}
      <p className="text-medium font-heading text-xs uppercase tracking-[0.15em]">
        {beachName}
      </p>

      {/* Wave height + score row */}
      <div className="flex items-end gap-3">
        <h1
          aria-label={`Wave height ${waveHeight}`}
          className="font-heading text-[56px] font-extrabold leading-none text-white drop-shadow-md sm:text-[64px]"
        >
          {displayWaveHeight}
        </h1>
        <div className="mb-1.5">
          {decisionVerdict ? (
            <DecisionBadge
              verdict={decisionVerdict}
              shouldAnimate={shouldAnimate}
            />
          ) : (
            <ScoreBadge score={score} shouldAnimate={shouldAnimate} />
          )}
        </div>
      </div>

      {/* Swell details row */}
      <div className="flex gap-6">
        <SwellStat
          label="Swell"
          value={`${swellDirection} ${swellPeriod}s`}
        />
        <SwellStat
          label="Tide"
          value={`${tideHeight.toFixed(1)}ft ${tideDirectionLabel}`}
        />
        <SwellStat label="Water" value={`${waterTemp}°F`} />
      </div>

      {/* Drive subtitle — rendered when the hero is NOT the user's home beach. */}
      {driveContext && (
        <p
          data-testid="hero-drive-subtitle"
          className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[#FDB84B]/90"
        >
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {Math.round(driveContext.distanceMiles)} mi{" "}
            {compassPointToWord(driveContext.bearing)} of{" "}
            {driveContext.homeBeachName}
          </span>
        </p>
      )}

      {/* Best window card */}
      <motion.div
        initial={shouldAnimate ? { y: 24, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={
          shouldAnimate
            ? { duration: 0.6, delay: 2.0, ease: "easeOut" }
            : { duration: 0 }
        }
        className="noise-texture rounded-xl border border-[#404C92] bg-[#2D357D] p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="font-heading text-sm font-semibold text-[#FDB84B]">
              {bestWindowTitle}
            </p>
            <p className="text-medium text-xs line-clamp-1 sm:line-clamp-none">{bestWindowSubtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-medium text-[10px] uppercase tracking-wider">
              {isTomorrow ? "Best time tomorrow" : "Best time"}
            </p>
            <p className="text-high font-medium">{bestWindowTime}</p>
          </div>
        </div>
      </motion.div>

      {/* Hero why-sentence — distinct prose line under the best-window card.
          Sourced from heroSurfCall?.whySentence; the supporting subtitle
          inside the card is sourced from a different signal so the same
          sentence never renders twice. */}
      {whySentence ? (
        <p
          data-testid="hero-why-sentence"
          role="note"
          className="mt-2 text-medium text-xs sm:text-sm leading-snug"
        >
          {whySentence}
        </p>
      ) : null}
    </div>
  );
}
