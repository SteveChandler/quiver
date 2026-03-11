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
const LINE_WIDTHS = ["110%", "90%", "105%", "95%", "100%"];

export function SwellLines({ swellDirection, shouldAnimate }: SwellLinesProps) {
  const rotationDeg = compassToRotationDegrees(swellDirection);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {LINE_OFFSETS.map((topOffset, index) => (
        <motion.div
          key={index}
          initial={shouldAnimate ? { opacity: 0, x: -20 } : false}
          animate={{ opacity: 0.3, x: 0 }}
          transition={
            shouldAnimate
              ? { duration: 1.2, delay: 0.3 + index * 0.06, ease: "easeOut" }
              : { duration: 0 }
          }
          style={{
            position: "absolute",
            top: topOffset,
            left: "-5%",
            width: LINE_WIDTHS[index],
            height: "1px",
            background:
              "linear-gradient(to right, transparent 0%, #4A70D9 30%, #4A70D9 70%, transparent 100%)",
            transform: `rotate(${rotationDeg}deg)`,
            transformOrigin: "left center",
          }}
        />
      ))}
    </div>
  );
}
