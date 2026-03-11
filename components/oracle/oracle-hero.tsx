"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SwellLines } from "./swell-lines";
import { WindIndicator } from "./wind-indicator";
import { ConditionsOverlay } from "./conditions-overlay";

export interface OracleHeroProps {
  beachName: string;
  heroPhotoUrl: string;
  waveHeight: string;
  score: number;
  swellDirection: string;
  swellPeriod: number;
  tideHeight: number;
  tideDirection: "rising" | "falling";
  waterTemp: number;
  windSpeed: number;
  windDirection: string;
  bestWindowTitle: string;
  bestWindowSubtitle: string;
  bestWindowTime: string;
  shouldAnimate: boolean;
  onAnimationComplete?: () => void;
  // Greeting
  userName?: string | null;
  levelTitle?: string | null;
  xpTotal?: number | null;
}

// Animated wave height: count up from "0" to the actual numeric prefix.
// e.g. "4-5ft" → animates the number portion, then snaps to final string.
function useWaveHeightAnimation(
  waveHeight: string,
  shouldAnimate: boolean
): string {
  const [displayed, setDisplayed] = useState(
    shouldAnimate ? "0ft" : waveHeight
  );
  const hasRun = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || hasRun.current) return;
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
          requestAnimationFrame(tick);
          return;
        }
        const progress = Math.min(elapsed / duration, 1);
        // Simple ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);

        if (progress < 1) {
          setDisplayed(`${current}ft`);
          requestAnimationFrame(tick);
        } else {
          setDisplayed(waveHeight);
        }
      };
      requestAnimationFrame(tick);
    }, 0);

    return () => clearTimeout(timeout);
  }, [shouldAnimate, waveHeight]);

  return displayed;
}

export function OracleHero({
  beachName,
  heroPhotoUrl,
  waveHeight,
  score,
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
  shouldAnimate,
  onAnimationComplete,
  userName,
  levelTitle,
  xpTotal,
}: OracleHeroProps) {
  const animatedWaveHeight = useWaveHeightAnimation(waveHeight, shouldAnimate);

  // Call onAnimationComplete after the full sequence (~3s).
  useEffect(() => {
    if (!shouldAnimate || !onAnimationComplete) return;
    const id = setTimeout(onAnimationComplete, 3000);
    return () => clearTimeout(id);
  }, [shouldAnimate, onAnimationComplete]);

  const hasGreeting = userName || levelTitle || xpTotal != null;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <section
      role="banner"
      className="relative h-[520px] w-full overflow-hidden rounded-2xl"
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
              <p className="text-medium text-xs">
                {greeting}, {userName}
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
        swellDirection={swellDirection}
        swellPeriod={swellPeriod}
        tideHeight={tideHeight}
        tideDirection={tideDirection}
        waterTemp={waterTemp}
        bestWindowTitle={bestWindowTitle}
        bestWindowSubtitle={bestWindowSubtitle}
        bestWindowTime={bestWindowTime}
        shouldAnimate={shouldAnimate}
        animatedWaveHeight={animatedWaveHeight}
      />
    </section>
  );
}
