"use client";

import { useMemo } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const PARTICLE_COUNT = 20;

interface Particle {
  size: number;
  opacity: number;
  top: string;
  delay: string;
  duration: string;
}

export function FloatingParticles() {
  const reducedMotion = useReducedMotion();

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      size: 3 + ((i * 7 + 3) % 12), // 3-14px
      opacity: 0.08 + ((i * 3) % 7) * 0.025, // 0.08-0.23
      top: `${(i * 13 + 5) % 100}%`,
      delay: `${((i * 1.7) % 8).toFixed(1)}s`,
      duration: `${6 + ((i * 3) % 8)}s`, // 6-13s
    }));
  }, []);

  if (reducedMotion) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-[1]"
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, rgba(255,255,255,${p.opacity}), rgba(255,255,255,${p.opacity * 0.3}) 60%, transparent 100%)`,
            top: p.top,
            left: "-5%",
            animation: `formgrid-spray ${p.duration} linear infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
