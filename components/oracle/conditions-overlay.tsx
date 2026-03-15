"use client";

import { motion } from "framer-motion";

interface ConditionsOverlayProps {
  beachName: string;
  waveHeight: string;
  score: number;
  swellDirection: string;
  swellPeriod: number;
  tideHeight: number;
  tideDirection: "rising" | "falling";
  waterTemp: number;
  bestWindowTitle: string;
  bestWindowSubtitle: string;
  bestWindowTime: string;
  shouldAnimate: boolean;
  /** Animated wave height display value — controlled by parent for count-up */
  animatedWaveHeight?: string;
}

// Score badge background is Paradise Gold; text is deep twilight for contrast.
function ScoreBadge({
  score,
  shouldAnimate,
}: {
  score: number;
  shouldAnimate: boolean;
}) {
  return (
    <motion.div
      initial={shouldAnimate ? { scale: 0 } : false}
      animate={{ scale: 1 }}
      transition={
        shouldAnimate
          ? { duration: 0.4, delay: 1.5, ease: [0.16, 1, 0.3, 1] }
          : { duration: 0 }
      }
      className="inline-flex items-center gap-1 rounded-full bg-[#FDB84B] px-3 py-1"
      aria-label={`Surf score ${score} out of 10`}
    >
      <span className="font-mono text-sm font-bold text-[#252D6B]">
        {score.toFixed(1)}/10
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
  swellDirection,
  swellPeriod,
  tideHeight,
  tideDirection,
  waterTemp,
  bestWindowTitle,
  bestWindowSubtitle,
  bestWindowTime,
  shouldAnimate,
  animatedWaveHeight,
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
          <ScoreBadge score={score} shouldAnimate={shouldAnimate} />
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
              Best time
            </p>
            <p className="text-high font-medium">{bestWindowTime}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
