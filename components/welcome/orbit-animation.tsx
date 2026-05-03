"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const INNER_RING = ["🏄‍♂️", "🌊", "☀️", "🐚", "🏖️"];
const OUTER_RING = ["🦈", "🧭", "🐠", "🌴", "🐬", "🦀", "🌅"];

interface OrbitAnimationProps {
  /** Whether the orbit rings are visible (animated in after splash) */
  visible: boolean;
}

export function OrbitAnimation({ visible }: OrbitAnimationProps) {
  return (
    <>
      {/*
        CSS keyframes for GPU-accelerated orbit rotation.
        Plain <style> tag — this project does not use styled-jsx.
        .orbit-spin / .orbit-spin-slow: clockwise at 8s / 14s.
        .counter-spin / .counter-spin-slow: counter-clockwise to cancel parent rotation,
        keeping each emoji upright relative to the screen.
      */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes orbit-spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            @keyframes counter-spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(-360deg); }
            }
            .orbit-spin {
              animation: orbit-spin 8s linear infinite;
              will-change: transform;
            }
            .orbit-spin-slow {
              animation: orbit-spin 14s linear infinite;
              will-change: transform;
            }
          `,
        }}
      />

      <div className="relative flex items-center justify-center">
        {/* Pulsing radial gradient glow behind logo */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 240,
            height: 240,
            background:
              "radial-gradient(circle, rgba(0,119,182,0.35) 0%, rgba(0,180,216,0.18) 45%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Outer ring — 7 emoji, 14s slow clockwise rotation */}
        {visible && (
          <div
            className="orbit-spin-slow absolute"
            style={{ width: 260, height: 260 }}
          >
            {OUTER_RING.map((emoji, i) => {
              const angle = (360 / OUTER_RING.length) * i;
              return (
                /*
                 * Positioning: each emoji is placed at the center of the container
                 * via top/left 50% + negative margin. Then:
                 *   rotate(angle)        — rotates the local coordinate system to the correct
                 *                          position on the ring.
                 *   translateX(radius)   — moves the emoji outward along that rotated axis.
                 *   rotate(-angle)       — counter-rotates the emoji so it stays upright
                 *                         (cancels the first rotate in static space).
                 *
                 * Note: we do NOT use Framer Motion for the positional transform here so that
                 * CSS handles the orbit animation without Framer Motion overriding transform.
                 * The motion.div inside handles only the fade-in (opacity).
                 */
                <div
                  key={`outer-${i}`}
                  className="absolute"
                  style={{
                    width: 32,
                    height: 32,
                    top: "50%",
                    left: "50%",
                    marginTop: -16,
                    marginLeft: -16,
                    transform: `rotate(${angle}deg) translateX(130px) rotate(${-angle}deg)`,
                  }}
                >
                  <motion.span
                    className="flex h-full w-full items-center justify-center text-xl select-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.08 * i + 0.3, duration: 0.4 }}
                    aria-hidden="true"
                  >
                    {emoji}
                  </motion.span>
                </div>
              );
            })}
          </div>
        )}

        {/* Inner ring — 5 emoji, 8s faster clockwise rotation */}
        {visible && (
          <div
            className="orbit-spin absolute"
            style={{ width: 180, height: 180 }}
          >
            {INNER_RING.map((emoji, i) => {
              const angle = (360 / INNER_RING.length) * i;
              return (
                <div
                  key={`inner-${i}`}
                  className="absolute"
                  style={{
                    width: 32,
                    height: 32,
                    top: "50%",
                    left: "50%",
                    marginTop: -16,
                    marginLeft: -16,
                    transform: `rotate(${angle}deg) translateX(90px) rotate(${-angle}deg)`,
                  }}
                >
                  <motion.span
                    className="flex h-full w-full items-center justify-center text-xl select-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.08 * i, duration: 0.4 }}
                    aria-hidden="true"
                  >
                    {emoji}
                  </motion.span>
                </div>
              );
            })}
          </div>
        )}

        {/* Logo — centered on top of rings, priority loaded */}
        <motion.div
          className="relative z-10 flex items-center justify-center"
          style={{ width: 180, height: 180 }}
        >
          <Image
            src="/quiver-app-icon.png"
            alt="Quiver"
            width={180}
            height={180}
            priority
            className="object-contain drop-shadow-lg"
          />
        </motion.div>
      </div>
    </>
  );
}
