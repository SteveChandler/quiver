"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

interface ParticleBackgroundProps {
  /** Number of particles (default: 15) */
  particleCount?: number;
  /** Base color for particles (default: white) */
  color?: string;
  /** Maximum particle opacity 0-1 (default: 0.15) */
  maxOpacity?: number;
  /** Minimum particle size in pixels (default: 2) */
  minSize?: number;
  /** Maximum particle size in pixels (default: 4) */
  maxSize?: number;
  /** Animation speed multiplier (default: 1) */
  speed?: number;
  className?: string;
}

/**
 * ParticleBackground - Ambient floating particle effect
 *
 * Renders small dots that float slowly across the background,
 * creating a subtle ambient atmosphere. Uses CSS animations
 * for optimal performance. Respects user's reduced motion
 * preferences by not rendering when reduced motion is preferred.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <ParticleBackground particleCount={20} color="white" />
 *   <div className="relative z-10">Content</div>
 * </div>
 * ```
 */
export function ParticleBackground({
  particleCount = 15,
  color = "white",
  maxOpacity = 0.15,
  minSize = 2,
  maxSize = 4,
  speed = 1,
  className,
}: ParticleBackgroundProps) {
  const reducedMotion = useReducedMotion();

  // Generate particles with random positions and animation properties
  const particles = useMemo<Particle[]>(() => {
    // Don't generate particles if reduced motion is preferred
    if (reducedMotion) return [];

    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: minSize + Math.random() * (maxSize - minSize),
      opacity: (0.5 + Math.random() * 0.5) * maxOpacity,
      duration: (15 + Math.random() * 20) / speed,
      delay: Math.random() * -20,
    }));
  }, [particleCount, minSize, maxSize, maxOpacity, speed, reducedMotion]);

  // Don't render anything when reduced motion is preferred
  if (reducedMotion) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        className
      )}
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: color,
            opacity: particle.opacity,
            animation: `particle-float-${particle.id % 3} ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes particle-float-0 {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(10px, -15px);
          }
          50% {
            transform: translate(20px, 5px);
          }
          75% {
            transform: translate(5px, 15px);
          }
        }
        @keyframes particle-float-1 {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(-15px, 10px);
          }
          50% {
            transform: translate(-5px, -10px);
          }
          75% {
            transform: translate(10px, -5px);
          }
        }
        @keyframes particle-float-2 {
          0%, 100% {
            transform: translate(0, 0);
          }
          33% {
            transform: translate(15px, 10px);
          }
          66% {
            transform: translate(-10px, 15px);
          }
        }
      `}</style>
    </div>
  );
}

export default ParticleBackground;
