"use client";

import { motion } from "framer-motion";

// Convert compass direction string to rotation degrees for swell lines.
// Swell lines are horizontal by default; rotating by the swell direction
// angle makes them visually track the incoming swell.
function compassToRotationDegrees(direction: string): number {
  const dir = direction.trim().toUpperCase();
  const compassMap: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };
  return compassMap[dir] ?? 315;
}

interface SwellLinesProps {
  swellDirection: string;
  shouldAnimate: boolean;
}

// Offsets spread the 5 lines across the hero area at varying vertical positions.
const LINE_OFFSETS = ["15%", "30%", "50%", "68%", "82%"];
const LINE_WIDTHS = ["150%", "135%", "150%", "140%", "160%"];

export function SwellLines({ swellDirection, shouldAnimate }: SwellLinesProps) {
  const rotationDeg = compassToRotationDegrees(swellDirection);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {LINE_OFFSETS.map((topOffset, index) => {
        // Vary the wavelength and speed slightly to create organic depth
        const wavelength = 120 + index * 40; // 120px to 280px
        const duration = 2.5 + index * 0.5;

        return (
          <motion.div
            key={index}
            initial={shouldAnimate ? { opacity: 0, x: -20 } : { opacity: 0.4, x: 0 }}
            animate={{
              opacity: 0.4,
              x: 0,
              backgroundPositionX: ["0px", `${wavelength}px`],
            }}
            transition={{
              opacity: {
                duration: 1.2,
                delay: shouldAnimate ? 0.3 + index * 0.06 : 0,
                ease: "easeOut",
              },
              x: {
                duration: 1.2,
                delay: shouldAnimate ? 0.3 + index * 0.06 : 0,
                ease: "easeOut",
              },
              backgroundPositionX: {
                repeat: Infinity,
                duration: duration,
                ease: "linear",
              },
            }}
            style={{
              position: "absolute",
              top: topOffset,
              left: "-25%", // Shift left to ensure rotation coverage
              width: LINE_WIDTHS[index],
              height: "2px", // Give it a slight thickness for visibility
              background: `repeating-linear-gradient(to right, transparent 0%, rgba(74,112,217,0.1) 25%, #4A70D9 50%, rgba(74,112,217,0.1) 75%, transparent 100%)`,
              backgroundSize: `${wavelength}px 100%`,
              transform: `rotate(${rotationDeg}deg)`,
              transformOrigin: "center center",
            }}
          />
        );
      })}
    </div>
  );
}
