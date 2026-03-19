"use client";

import { useMemo } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const WAVE_PARTICLE_COUNT = 12;

interface WaveParticle {
  size: number;
  left: string;
  delay: string;
  duration: string;
  opacity: number;
}

export function WaveParticles() {
  const reducedMotion = useReducedMotion();

  const particles = useMemo<WaveParticle[]>(() => {
    return Array.from({ length: WAVE_PARTICLE_COUNT }, (_, i) => ({
      size: 4 + ((i * 5 + 3) % 10), // 4-13px
      left: `${(i * 19 + 5) % 100}%`,
      delay: `${(i * 0.7) % 5}s`,
      duration: `${4 + ((i * 3) % 6)}s`, // 4-9s
      opacity: 0.15 + ((i * 7) % 5) * 0.05, // 0.15-0.35
    }));
  }, []);

  if (reducedMotion) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* SVG wave path background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.04]"
        viewBox="0 0 400 400"
        preserveAspectRatio="none"
      >
        <path
          d="M0,300 C100,280 200,320 300,290 C350,275 380,300 400,295 L400,400 L0,400 Z"
          fill="rgba(255,255,255,0.3)"
        >
          <animate
            attributeName="d"
            dur="8s"
            repeatCount="indefinite"
            values="
              M0,300 C100,280 200,320 300,290 C350,275 380,300 400,295 L400,400 L0,400 Z;
              M0,310 C100,290 200,300 300,310 C350,295 380,310 400,305 L400,400 L0,400 Z;
              M0,300 C100,280 200,320 300,290 C350,275 380,300 400,295 L400,400 L0,400 Z
            "
          />
        </path>
        <path
          d="M0,340 C120,320 280,350 400,330 L400,400 L0,400 Z"
          fill="rgba(255,255,255,0.2)"
        >
          <animate
            attributeName="d"
            dur="6s"
            repeatCount="indefinite"
            values="
              M0,340 C120,320 280,350 400,330 L400,400 L0,400 Z;
              M0,330 C120,340 280,330 400,340 L400,400 L0,400 Z;
              M0,340 C120,320 280,350 400,330 L400,400 L0,400 Z
            "
          />
        </path>
      </svg>

      {/* Drifting water droplet particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            bottom: "-10%",
            background: `radial-gradient(circle, rgba(255,255,255,${p.opacity}), transparent 70%)`,
            animation: `wave-particle-drift ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
