"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SwellLines } from "./swell-lines";
import { WindIndicator } from "./wind-indicator";
import { ConditionsOverlay } from "./conditions-overlay";
import { getHourInTimezone } from "@/lib/utils/date-time";
import { getOracleGreeting } from "@/lib/oracle/greeting";
import type { CompassPoint } from "@/lib/utils/distance-utils";
import type { CanonicalDecisionVerdict } from "@/lib/recommendations/canonical-decision/types";

export interface OracleHeroProps {
  beachName: string;
  heroPhotoUrl: string;
  waveHeight: string;
  /** null while the canonical surf-call is still loading — keeps the hero
   * visible without painting a phantom 0/10 score in the badge. */
  score: number | null;
  /** Single server-owned session decision; replaces client score-derived calls. */
  decisionVerdict?: CanonicalDecisionVerdict | null;
  swellDirection: string;
  swellPeriod: number;
  tideHeight: number;
  tideDirection: "rising" | "falling";
  waterTemp: number;
  windSpeed: number;
  windDirection: string | number;
  bestWindowTitle: string;
  bestWindowSubtitle: string;
  bestWindowTime: string;
  /** Hero-call reasoning sentence rendered as a distinct prose line under
   * the best-window card. Sourced from heroSurfCall?.whySentence; omit when
   * absent so we don't paint placeholder reasoning. */
  whySentence?: string;
  shouldAnimate: boolean;
  onAnimationComplete?: () => void;
  // Greeting
  userName?: string | null;
  levelTitle?: string | null;
  xpTotal?: number | null;
  timezone?: string;
  /** Wind condition classification — "offshore", "onshore", "cross-shore", etc. Pass null when not available. */
  windCondition?: string | null;
  /** Days since user's last visit. Drives the "Missed you out there" greeting. */
  daysAbsent?: number;
  /** Regional surf call from the discovery orchestrator. When present, overrides the default greeting. */
  regionalCall?: string;
  /** When true, the best window is for tomorrow */
  isTomorrow?: boolean;
  /**
   * Drive context for the regional-best hero. When the hero is a beach
   * other than the user's home, render a "↗ N mi {direction} of
   * {homeBeachName}" subtitle inside the conditions overlay. Hidden when
   * undefined (hero IS the home, or no home beach set).
   */
  driveContext?: {
    distanceMiles: number;
    bearing: CompassPoint;
    homeBeachName: string;
  };
}

// Animated wave height: count up from "0" to the actual numeric prefix.
// e.g. "4-5ft" → animates the number portion, then snaps to final string.
function useWaveHeightAnimation(
  waveHeight: string,
  shouldAnimate: boolean
): string {
  const [displayed, setDisplayed] = useState(
    shouldAnimate ? "" : waveHeight
  );
  const hasRun = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!shouldAnimate || hasRun.current) return;
    // Wait for real wave height data before animating
    if (waveHeight === "—" || waveHeight === "0ft") return;
    hasRun.current = true;

    // Parse the first number from waveHeight, e.g. "4-5ft" → 4, "6ft" → 6
    const match = waveHeight.match(/^(\d+(?:\.\d+)?)/);
    const target = match ? parseFloat(match[1]) : 0;

    const startTime = Date.now();
    const duration = 1000; // 1.0s
    const delay = 800; // 0.8s

    const timeout = setTimeout(() => {
      const tick = () => {
        const elapsed = Date.now() - startTime - delay;
        if (elapsed < 0) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const progress = Math.min(elapsed / duration, 1);
        // Simple ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);

        if (progress < 1) {
          setDisplayed(`${current}ft`);
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplayed(waveHeight);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 0);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [shouldAnimate, waveHeight]);

  // Sync displayed value when not animating (e.g. return visit or data update)
  useEffect(() => {
    if (!shouldAnimate && displayed !== waveHeight) {
      setDisplayed(waveHeight);
    }
  }, [shouldAnimate, waveHeight, displayed]);

  return displayed;
}

export function OracleHero({
  beachName,
  heroPhotoUrl,
  waveHeight,
  score,
  decisionVerdict,
  swellDirection,
  swellPeriod,
  tideHeight,
  tideDirection,
  waterTemp,
  windSpeed,
  windDirection,
  bestWindowTitle,
  bestWindowSubtitle,
  bestWindowTime,
  whySentence,
  shouldAnimate,
  onAnimationComplete,
  userName,
  levelTitle,
  xpTotal,
  timezone,
  windCondition,
  daysAbsent = 0,
  regionalCall,
  isTomorrow,
  driveContext,
}: OracleHeroProps) {
  const animatedWaveHeight = useWaveHeightAnimation(waveHeight, shouldAnimate);

  // Call onAnimationComplete after the full sequence (~3s).
  useEffect(() => {
    if (!shouldAnimate || !onAnimationComplete) return;
    const id = setTimeout(onAnimationComplete, 3000);
    return () => clearTimeout(id);
  }, [shouldAnimate, onAnimationComplete]);

  const hasGreeting = userName || levelTitle || xpTotal != null;

  const greeting = regionalCall ?? (() => {
    const hour = getHourInTimezone(new Date(), timezone || "America/Los_Angeles");
    return getOracleGreeting({
      score,
      hour,
      swellPeriod,
      windCondition: windCondition ?? null,
      userName: userName ?? "Surfer",
      beachName: beachName ?? null,
      daysAbsent,
    });
  })();

  return (
    <section
      role="banner"
      className="relative h-[420px] md:h-[480px] w-full overflow-hidden rounded-none md:rounded-2xl"
      aria-label={`${beachName} surf conditions`}
    >
      {/* Layer 1: Beach photo with Ken Burns scale + gradient overlay */}
      <motion.div
        className="absolute inset-0"
        initial={shouldAnimate ? { scale: 1.08 } : false}
        animate={{ scale: 1.0 }}
        transition={
          shouldAnimate
            ? { duration: 3.5, ease: "easeOut" }
            : { duration: 0 }
        }
        style={{
          backgroundImage: `url(${heroPhotoUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden="true"
      />

      {/* Gradient overlay: transparent top → Deep Twilight bottom.
          This is NOT the photo — grain goes on this layer per brand guide. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(37,45,107,0.55) 45%, #252D6B 100%)",
        }}
      />

      {/* Layer 2: noise-texture-strong on the overlay (not on the photo) */}
      <div
        aria-hidden="true"
        className="noise-texture-strong absolute inset-0 pointer-events-none"
      />

      {/* Layer 3: Swell lines */}
      <SwellLines
        swellDirection={swellDirection}
        shouldAnimate={shouldAnimate}
      />

      {/* Layer 4: Top bar — greeting (left) + wind indicator (right) */}
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between p-5 sm:p-6">
        {/* Greeting */}
        {hasGreeting && (
          <div className="flex flex-col gap-0.5">
            {userName && (
              <p className="text-medium text-sm">
                {greeting}
              </p>
            )}
            {(levelTitle || xpTotal != null) && (
              <div className="flex items-center gap-1.5">
                {levelTitle && (
                  <span className="rounded-full bg-[#FDB84B]/20 px-2 py-0.5 font-mono text-[10px] text-[#FDB84B]">
                    {levelTitle}
                  </span>
                )}
                {xpTotal != null && (
                  <span className="text-medium font-mono text-[10px]">
                    {xpTotal.toLocaleString()} XP
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Wind indicator — top-right corner */}
        <div className={hasGreeting ? "" : "ml-auto"}>
          <WindIndicator
            windDirection={windDirection}
            windSpeed={windSpeed}
          />
        </div>
      </div>

      {/* Layer 5: Conditions overlay — positioned at bottom */}
      <ConditionsOverlay
        beachName={beachName}
        waveHeight={waveHeight}
        score={score}
        decisionVerdict={decisionVerdict}
        swellDirection={swellDirection}
        swellPeriod={swellPeriod}
        tideHeight={tideHeight}
        tideDirection={tideDirection}
        waterTemp={waterTemp}
        bestWindowTitle={bestWindowTitle}
        bestWindowSubtitle={bestWindowSubtitle}
        bestWindowTime={bestWindowTime}
        whySentence={whySentence}
        shouldAnimate={shouldAnimate}
        animatedWaveHeight={animatedWaveHeight}
        isTomorrow={isTomorrow}
        driveContext={driveContext}
      />
    </section>
  );
}
