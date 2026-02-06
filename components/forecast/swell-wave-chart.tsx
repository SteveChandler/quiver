"use client";

/**
 * Swell Wave Chart Component
 *
 * Mini animated wave visualization for swell events.
 * Wave amplitude based on height, frequency based on period.
 *
 * @module components/forecast/swell-wave-chart
 */

import { useEffect, useState, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Props for the SwellWaveChart component
 */
export interface SwellWaveChartProps {
  /** Wave height in feet (affects amplitude) */
  height: number;
  /** Wave period in seconds (affects frequency) */
  period: number;
  /** Swell direction (e.g., "NW", "SW") */
  direction?: string;
  /** Chart width (default: 80) */
  width?: number;
  /** Chart height (default: 40) */
  chartHeight?: number;
  /** Whether to animate (default: true) */
  animated?: boolean;
  /** Wave color based on size category */
  colorClass?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Generate wave path based on height and period
 */
function generateWavePath(
  width: number,
  height: number,
  waveHeight: number,
  period: number
): string {
  // Normalize wave parameters
  const amplitude = Math.min(height * 0.35, (waveHeight / 15) * height * 0.4);
  // More waves for shorter periods, fewer for longer periods
  const frequency = Math.max(1.5, Math.min(4, 20 / period));
  const wavelength = width / frequency;

  const centerY = height / 2;
  let path = `M 0,${centerY}`;

  // Generate smooth wave using quadratic bezier curves
  for (let x = 0; x <= width; x += wavelength / 2) {
    const nextX = Math.min(x + wavelength / 2, width);
    const controlY =
      x % wavelength < wavelength / 2
        ? centerY - amplitude
        : centerY + amplitude;

    path += ` Q ${x + wavelength / 4},${controlY} ${nextX},${centerY}`;
  }

  return path;
}

/**
 * Direction arrow component
 */
function DirectionIndicator({
  direction,
  className,
}: {
  direction: string;
  className?: string;
}) {
  // Direction to rotation mapping (arrow points to where waves come FROM)
  const rotationMap: Record<string, number> = {
    N: 180,
    NNE: 202.5,
    NE: 225,
    ENE: 247.5,
    E: 270,
    ESE: 292.5,
    SE: 315,
    SSE: 337.5,
    S: 0,
    SSW: 22.5,
    SW: 45,
    WSW: 67.5,
    W: 90,
    WNW: 112.5,
    NW: 135,
    NNW: 157.5,
  };

  const rotation = rotationMap[direction] || 0;

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className={cn("text-current", className)}
      style={{ transform: `rotate(${rotation}deg)` }}
      aria-label={`Direction: ${direction}`}
    >
      <path
        d="M8 2L4 10h3v4h2v-4h3L8 2z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

/**
 * SwellWaveChart Component
 *
 * Displays an animated wave visualization that represents swell characteristics.
 * Larger swells have bigger waves, shorter periods have more frequent waves.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SwellWaveChart height={4} period={12} />
 *
 * // With direction
 * <SwellWaveChart
 *   height={6}
 *   period={15}
 *   direction="SW"
 *   colorClass="text-blue-500"
 * />
 * ```
 */
export function SwellWaveChart({
  height,
  period,
  direction,
  width = 80,
  chartHeight = 40,
  animated = true,
  colorClass = "text-blue-500",
  className,
}: SwellWaveChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Generate wave path
  const wavePath = generateWavePath(width * 2, chartHeight, height, period);

  // Animation duration based on period (longer period = slower animation)
  const animationDuration = Math.max(2, period / 4);

  // Intersection observer for animation trigger
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const shouldAnimate = animated && !reducedMotion && isVisible;

  return (
    <div
      ref={elementRef}
      className={cn(
        "relative overflow-hidden rounded-md bg-gradient-to-b from-transparent to-current/5",
        className
      )}
      style={{ width, height: chartHeight }}
    >
      {/* Wave animation */}
      <svg
        width={width * 2}
        height={chartHeight}
        viewBox={`0 0 ${width * 2} ${chartHeight}`}
        className={cn(
          "absolute top-0 left-0",
          shouldAnimate && "animate-wave-flow"
        )}
        style={{
          animationDuration: shouldAnimate ? `${animationDuration}s` : "0s",
        }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`wave-gradient-${height}-${period}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Wave path */}
        <path
          d={wavePath}
          fill="none"
          stroke={`url(#wave-gradient-${height}-${period})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          className={colorClass}
        />

        {/* Duplicate wave for seamless loop */}
        <path
          d={wavePath}
          fill="none"
          stroke={`url(#wave-gradient-${height}-${period})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          className={colorClass}
          transform={`translate(${width}, 0)`}
        />
      </svg>

      {/* Direction indicator overlay */}
      {direction && (
        <div className="absolute top-1 right-1">
          <DirectionIndicator
            direction={direction}
            className={cn("opacity-60", colorClass)}
          />
        </div>
      )}

      {/* Static wave for reduced motion */}
      {reducedMotion && (
        <svg
          width={width}
          height={chartHeight}
          viewBox={`0 0 ${width} ${chartHeight}`}
          className="absolute top-0 left-0"
          aria-label={`Wave visualization: ${height}ft, ${period}s period`}
        >
          <path
            d={generateWavePath(width, chartHeight, height, period)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className={colorClass}
            opacity={0.6}
          />
        </svg>
      )}
    </div>
  );
}

/**
 * Compact swell indicator for use in cards
 */
export function SwellIndicator({
  size,
  className,
}: {
  size: string; // e.g., "chest-high", "overhead"
  className?: string;
}) {
  // Map size to visual parameters
  const sizeConfig: Record<string, { height: number; period: number; color: string }> = {
    "knee-high": { height: 2, period: 8, color: "text-gray-400" },
    "waist-high": { height: 3, period: 10, color: "text-gray-500" },
    "chest-high": { height: 4, period: 12, color: "text-blue-500" },
    "head-high": { height: 5, period: 13, color: "text-blue-600" },
    "overhead": { height: 7, period: 14, color: "text-emerald-500" },
    "double-overhead": { height: 10, period: 16, color: "text-purple-500" },
  };

  const config = sizeConfig[size] || sizeConfig["chest-high"];

  return (
    <SwellWaveChart
      height={config.height}
      period={config.period}
      width={48}
      chartHeight={24}
      colorClass={config.color}
      className={className}
    />
  );
}
