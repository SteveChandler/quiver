"use client";

/**
 * Ocean Background Component
 *
 * Atmospheric page background with layered ocean gradients,
 * SVG wave patterns, and optional animated overlay.
 * Respects reduced motion preferences.
 *
 * @module components/ui/ocean-background
 */

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Props for the OceanBackground component
 */
export interface OceanBackgroundProps {
  /** Child content to render over the background */
  children: React.ReactNode;
  /** Background variant (default: "ocean") */
  variant?: "ocean" | "deep" | "sunset" | "minimal";
  /** Whether to show animated wave overlay (default: false) */
  animated?: boolean;
  /** Whether to show SVG wave pattern (default: true) */
  showWaves?: boolean;
  /** Wave pattern opacity (0-1, default: 0.3) */
  waveOpacity?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the content wrapper */
  contentClassName?: string;
}

/**
 * Gradient configurations for each variant
 */
const VARIANT_GRADIENTS: Record<string, string> = {
  ocean: "bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50",
  deep: "bg-gradient-to-br from-blue-100 via-blue-50 to-sky-50",
  sunset: "bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50",
  minimal: "bg-gradient-to-b from-slate-50 to-white",
};

/**
 * SVG Wave Pattern Component
 * Renders a subtle wave pattern overlay
 */
function WavePattern({
  opacity = 0.3,
  animated = false,
  reducedMotion = false,
}: {
  opacity?: number;
  animated?: boolean;
  reducedMotion?: boolean;
}) {
  const shouldAnimate = animated && !reducedMotion;

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        shouldAnimate && "animate-wave-flow"
      )}
      style={{ opacity }}
      aria-hidden="true"
    >
      <svg
        className="absolute bottom-0 left-0 w-[200%] h-48"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(14, 165, 233)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="rgb(6, 182, 212)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* Primary wave */}
        <path
          d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          fill="url(#waveGradient)"
        />
        {/* Secondary wave (offset) */}
        <path
          d="M0,224L48,208C96,192,192,160,288,170.7C384,181,480,235,576,250.7C672,267,768,245,864,224C960,203,1056,181,1152,186.7C1248,192,1344,224,1392,240L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          fill="url(#waveGradient)"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}

/**
 * Animated Gradient Overlay
 * Subtle animated color shift effect
 */
function AnimatedOverlay({ reducedMotion = false }: { reducedMotion?: boolean }) {
  if (reducedMotion) return null;

  return (
    <div
      className="absolute inset-0 opacity-30 pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 30% 20%, rgba(14, 165, 233, 0.15) 0%, transparent 50%), " +
          "radial-gradient(circle at 70% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)",
      }}
      aria-hidden="true"
    />
  );
}

/**
 * OceanBackground Component
 *
 * Provides an atmospheric ocean-themed background for pages.
 * Includes layered gradients, optional wave patterns, and
 * animated overlays while respecting accessibility preferences.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <OceanBackground>
 *   <div className="container">Page content</div>
 * </OceanBackground>
 *
 * // With animation
 * <OceanBackground animated showWaves>
 *   <div className="container">Animated background</div>
 * </OceanBackground>
 *
 * // Deep ocean variant
 * <OceanBackground variant="deep" waveOpacity={0.4}>
 *   <div className="container">Deep ocean feel</div>
 * </OceanBackground>
 * ```
 */
export function OceanBackground({
  children,
  variant = "ocean",
  animated = false,
  showWaves = true,
  waveOpacity = 0.3,
  className,
  contentClassName,
}: OceanBackgroundProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className={cn("relative min-h-screen", VARIANT_GRADIENTS[variant], className)}>
      {/* Wave pattern layer */}
      {showWaves && (
        <WavePattern
          opacity={waveOpacity}
          animated={animated}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Animated gradient overlay */}
      {animated && <AnimatedOverlay reducedMotion={reducedMotion} />}

      {/* Content layer */}
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </div>
  );
}

/**
 * Simpler wave background for use within sections
 * Lighter weight than full OceanBackground
 */
export function WaveBackground({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "medium" | "dark";
}) {
  const opacityMap = {
    light: 0.05,
    medium: 0.1,
    dark: 0.15,
  };

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      aria-hidden="true"
    >
      <svg
        className="absolute bottom-0 left-0 w-full h-24"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,60L60,65C120,70,240,80,360,75C480,70,600,50,720,45C840,40,960,50,1080,60C1200,70,1320,80,1380,85L1440,90L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z"
          fill="rgb(14, 165, 233)"
          fillOpacity={opacityMap[variant]}
        />
      </svg>
    </div>
  );
}
