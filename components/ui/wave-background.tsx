"use client";

import { useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface WaveBackgroundProps {
  /** Number of wave layers (default: 3) */
  layerCount?: number;
  /** Base color for waves (default: "white") */
  color?: string;
  /** Maximum wave opacity 0-1 (default: 0.08) */
  maxOpacity?: number;
  /** Animation speed multiplier (default: 1) */
  speed?: number;
  className?: string;
}

interface WaveLayer {
  id: number;
  opacity: number;
  duration: number;
  yPosition: number;
  path: string;
}

// Generate a smooth wave path that tiles seamlessly
function generateWavePath(amplitude: number): string {
  // Create a sine wave that completes exactly 2 cycles over 200% width (for seamless tiling)
  const points: string[] = [];
  const segments = 100;

  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * 200; // 0 to 200 (percentage)
    const y = Math.sin((i / segments) * Math.PI * 4) * amplitude + 50; // 4 half-cycles
    points.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }

  // Close the path at the bottom
  points.push(`L 200 100`);
  points.push(`L 0 100`);
  points.push("Z");

  return points.join(" ");
}

/**
 * WaveBackground - Animated wave effect for ocean-themed backgrounds
 *
 * Renders multiple semi-transparent wave layers that flow horizontally
 * at different speeds, creating a parallax ocean atmosphere effect.
 * Uses pure CSS animations for optimal performance. Respects user's
 * reduced motion preferences by not rendering when reduced motion is preferred.
 *
 * @example
 * ```tsx
 * <div className="relative bg-[#1e1e1e]">
 *   <WaveBackground layerCount={3} color="white" maxOpacity={0.08} />
 *   <div className="relative z-10">Content</div>
 * </div>
 * ```
 */
export const WaveBackground = memo(function WaveBackground({
  layerCount = 3,
  color = "white",
  maxOpacity = 0.08,
  speed = 1,
  className,
}: WaveBackgroundProps) {
  const reducedMotion = useReducedMotion();

  // Memoize wave layers to prevent recalculation on parent re-renders
  const layers = useMemo<WaveLayer[]>(() => {
    if (reducedMotion) return [];

    return Array.from({ length: layerCount }, (_, i) => {
      // Layers go from front (more visible, faster) to back (less visible, slower)
      const layerIndex = layerCount - 1 - i;
      const opacityFactor = 1 - (layerIndex / layerCount) * 0.7;
      const amplitude = 8 + layerIndex * 2;

      return {
        id: i,
        opacity: maxOpacity * opacityFactor,
        duration: (8 + layerIndex * 4) / speed, // 8s, 12s, 16s for 3 layers
        yPosition: 70 - layerIndex * 20, // 70%, 50%, 30% for 3 layers
        path: generateWavePath(amplitude),
      };
    });
  }, [layerCount, maxOpacity, speed, reducedMotion]);

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
      {/* Inline keyframes to ensure they're not purged by Tailwind */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wave-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />
      {layers.map((layer) => (
        <div
          key={layer.id}
          className="wave-layer absolute inset-0"
          style={{
            top: `${layer.yPosition}%`,
            animationName: "wave-scroll",
            animationDuration: `${layer.duration}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
          }}
        >
          <svg
            className="absolute h-full"
            style={{
              width: "200%",
              left: 0,
            }}
            viewBox="0 0 200 100"
            preserveAspectRatio="none"
          >
            <path
              d={layer.path}
              fill={color}
              fillOpacity={layer.opacity}
            />
          </svg>
        </div>
      ))}
    </div>
  );
})

export default WaveBackground;
